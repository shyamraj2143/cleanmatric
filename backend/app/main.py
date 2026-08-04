import asyncio
import csv
import io
from contextlib import asynccontextmanager
from secrets import token_urlsafe
from typing import Literal

from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.analysis_repository import AnalysisRepository
from app.analysis_service import FileParsingError, FileValidationError, clean_and_analyze, parse_file, validate_upload
from app.config import Settings
from app.data_processing import DataProcessingError, process_uploaded_data
from app.security import create_access_token, decode_access_token, hash_password, verify_password
from app.settings_repository import SettingsRepository
from app.user_store import User, UserStore


class RegisterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator('password')
    @classmethod
    def password_must_fit_bcrypt(cls, password: str) -> str:
        if len(password.encode('utf-8')) > 72:
            raise ValueError('Password must be at most 72 UTF-8 bytes.')
        return password


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class GoogleAuthRequest(BaseModel):
    credential: str = Field(min_length=1)


class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    created_at: str


class AuthResponse(BaseModel):
    user: UserResponse
    token: str


class SettingsUpdate(BaseModel):
    theme: Literal['system', 'light', 'dark'] | None = None
    email_notifications: bool | None = None
    analysis_notifications: bool | None = None
    export_format: Literal['csv', 'xlsx'] | None = None
    rows_per_page: Literal[5, 10, 20, 50] | None = None
    compact_sidebar: bool | None = None


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    full_name: str = Field(min_length=2, max_length=100)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=8, max_length=72)

    @field_validator('new_password')
    @classmethod
    def new_password_must_fit_bcrypt(cls, password: str) -> str:
        if len(password.encode('utf-8')) > 72:
            raise ValueError('Password must be at most 72 UTF-8 bytes.')
        return password


def _public_user(user: User) -> UserResponse:
    return UserResponse(id=user['id'], name=user['name'], email=user['email'], created_at=user['created_at'])


def verify_google_credential(credential: str, client_id: str) -> dict[str, object]:
    from google.auth.transport import requests
    from google.oauth2 import id_token

    return id_token.verify_oauth2_token(credential, requests.Request(), client_id)


def create_app(settings: Settings | None = None, store: UserStore | None = None, analysis_repository: AnalysisRepository | None = None, settings_repository: SettingsRepository | None = None) -> FastAPI:
    settings = settings or Settings.from_environment()
    store = store or UserStore(settings.database_url)
    analysis_repository = analysis_repository or AnalysisRepository(settings.database_url)
    settings_repository = settings_repository or SettingsRepository(settings.database_url)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        await store.initialize()
        await analysis_repository.initialize()
        await settings_repository.initialize()
        yield

    app = FastAPI(lifespan=lifespan, title='MetricFlow API', version='1.0.0')
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.allowed_origin],
        allow_credentials=False,
        allow_methods=['GET', 'POST', 'PATCH', 'DELETE'],
        allow_headers=['Content-Type', 'Authorization'],
    )

    async def current_user(authorization: str | None = Header(default=None)) -> User:
        if not authorization or not authorization.startswith('Bearer '):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Authentication is required.')
        try:
            token_payload = decode_access_token(authorization.removeprefix('Bearer '), settings)
        except ValueError as error:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid or expired access token.') from error
        user = await store.find_by_id(str(token_payload['sub']))
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='User account was not found.')
        return user

    @app.post('/api/auth/register', response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
    async def register(payload: RegisterRequest) -> AuthResponse:
        normalized_email = str(payload.email).lower()
        password_hash = await asyncio.to_thread(hash_password, payload.password)
        user = await store.create(payload.name, normalized_email, password_hash)
        if user is None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='An account with this email already exists.')
        return AuthResponse(user=_public_user(user), token=create_access_token(user, settings))

    @app.post('/api/auth/login', response_model=AuthResponse)
    async def login(payload: LoginRequest) -> AuthResponse:
        user = await store.find_by_email(str(payload.email).lower())
        valid_password = user is not None and await asyncio.to_thread(verify_password, payload.password, user['password_hash'])
        if not valid_password:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid email or password.')
        return AuthResponse(user=_public_user(user), token=create_access_token(user, settings))

    @app.post('/api/auth/google', response_model=AuthResponse)
    async def google_auth(payload: GoogleAuthRequest) -> AuthResponse:
        if not settings.google_web_client_id:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail='Google sign-in is not configured.')
        try:
            claims = await asyncio.to_thread(verify_google_credential, payload.credential, settings.google_web_client_id)
        except ValueError as error:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid Google credential.') from error
        if claims.get('aud') != settings.google_web_client_id or not claims.get('email_verified'):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid Google credential.')
        email = str(claims.get('email', '')).lower()
        name = str(claims.get('name') or email.split('@')[0]).strip()
        if not email:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid Google credential.')
        user = await store.find_by_email(email)
        if user is None:
            user = await store.create(name or email, email, await asyncio.to_thread(hash_password, token_urlsafe(32)))
            if user is None:
                user = await store.find_by_email(email)
        if user is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='Unable to create Google account.')
        return AuthResponse(user=_public_user(user), token=create_access_token(user, settings))

    @app.post('/api/data/process')
    async def process_data(file: UploadFile = File(...)) -> dict[str, object]:
        try:
            return process_uploaded_data(file.filename or 'upload.csv', await file.read())
        except DataProcessingError as error:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error

    @app.post('/api/v1/files/analyze', status_code=status.HTTP_201_CREATED)
    async def analyze_file(file: UploadFile = File(...), user: User = Depends(current_user)) -> dict[str, object]:
        content = await file.read()
        try:
            filename, file_type = validate_upload(file.filename, content)
            parsed_records = await asyncio.to_thread(parse_file, filename, content)
            cleaned_records, metrics, charts = await asyncio.to_thread(clean_and_analyze, parsed_records)
        except OverflowError as error:
            raise HTTPException(status_code=413, detail=str(error)) from error
        except FileValidationError as error:
            error_status = status.HTTP_415_UNSUPPORTED_MEDIA_TYPE if 'Only CSV' in str(error) else status.HTTP_400_BAD_REQUEST
            raise HTTPException(status_code=error_status, detail=str(error)) from error
        except FileParsingError as error:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
        job = await analysis_repository.create(user['id'], filename, file_type, len(content), cleaned_records, metrics, charts)
        job.pop('records', None)
        job['warnings'] = []
        return job

    @app.get('/api/v1/analyses')
    async def list_analyses(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), user: User = Depends(current_user)) -> dict[str, object]:
        items = await analysis_repository.list_for_user(user['id'], (page - 1) * page_size, page_size)
        return {'page': page, 'page_size': page_size, 'items': items}

    @app.get('/api/v1/analyses/{analysis_id}')
    async def get_analysis(analysis_id: str, user: User = Depends(current_user)) -> dict[str, object]:
        analysis = await analysis_repository.find_for_user(analysis_id, user['id'])
        if analysis is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Analysis not found.')
        analysis.pop('records', None)
        analysis['warnings'] = []
        return analysis

    @app.delete('/api/v1/analyses/{analysis_id}', status_code=status.HTTP_204_NO_CONTENT)
    async def delete_analysis(analysis_id: str, user: User = Depends(current_user)) -> None:
        if not await analysis_repository.delete_for_user(analysis_id, user['id']):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Analysis not found.')

    async def owned_analysis(analysis_id: str, user: User) -> dict[str, object]:
        analysis = await analysis_repository.find_for_user(analysis_id, user['id'])
        if analysis is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Analysis not found.')
        return analysis

    @app.get('/api/v1/analyses/{analysis_id}/export/csv')
    async def export_csv(analysis_id: str, user: User = Depends(current_user)) -> StreamingResponse:
        analysis = await owned_analysis(analysis_id, user)
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=analysis['columns'])
        writer.writeheader()
        writer.writerows(analysis['records'])
        filename = f"{analysis['filename'].rsplit('.', 1)[0]}_cleaned.csv"
        return StreamingResponse(iter([output.getvalue()]), media_type='text/csv', headers={'Content-Disposition': f'attachment; filename="{filename}"'})

    @app.get('/api/v1/analyses/{analysis_id}/export/xlsx')
    async def export_xlsx(analysis_id: str, user: User = Depends(current_user)) -> StreamingResponse:
        analysis = await owned_analysis(analysis_id, user)
        from openpyxl import Workbook
        workbook, cleaned_sheet = Workbook(), None
        cleaned_sheet = workbook.active
        cleaned_sheet.title = 'Cleaned_Data'
        cleaned_sheet.append(analysis['columns'])
        for row in analysis['records']:
            cleaned_sheet.append([row.get(column, '') for column in analysis['columns']])
        summary_sheet = workbook.create_sheet('Metric_Summary')
        for key, value in analysis['metrics'].items():
            summary_sheet.append([key, value])
        output = io.BytesIO()
        workbook.save(output)
        filename = f"{analysis['filename'].rsplit('.', 1)[0]}_cleaned.xlsx"
        return StreamingResponse(iter([output.getvalue()]), media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', headers={'Content-Disposition': f'attachment; filename="{filename}"'})

    @app.get('/api/v1/dashboard/summary')
    async def dashboard_summary(user: User = Depends(current_user)) -> dict[str, object]:
        summary = await analysis_repository.dashboard_summary(user['id'])
        total = summary['cleaned_records']
        response: dict[str, object] = {'total_analyses': summary['total_analyses'], 'total_records': total, **{key: summary[key] for key in ('success_count', 'failed_count', 'warning_count', 'unknown_count', 'duplicates_removed', 'invalid_records')}}
        for name in ('success', 'failed', 'warning', 'unknown'):
            response[f'{name}_percentage'] = round(summary[f'{name}_count'] / total * 100, 2) if total else 0.0
        return response

    @app.get('/api/v1/dashboard/status-distribution')
    async def dashboard_status_distribution(user: User = Depends(current_user)) -> dict[str, object]:
        summary = await analysis_repository.dashboard_summary(user['id'])
        return {'data': [{'name': name, 'value': summary[f'{name.casefold()}_count']} for name in ('Success', 'Failed', 'Warning', 'Unknown')]}

    @app.get('/api/v1/dashboard/file-type-distribution')
    async def dashboard_file_type_distribution(user: User = Depends(current_user)) -> dict[str, object]:
        return {'data': await analysis_repository.file_type_distribution(user['id'])}

    @app.get('/api/v1/dashboard/trends')
    async def dashboard_trends(range: Literal['7d', '30d', '90d'] = '30d', user: User = Depends(current_user)) -> dict[str, object]:
        return {'range': range, 'data': await analysis_repository.trends(user['id'], int(range.removesuffix('d')))}

    @app.get('/api/v1/dashboard/recent-analyses')
    async def dashboard_recent_analyses(limit: int = Query(5, ge=1, le=20), user: User = Depends(current_user)) -> dict[str, object]:
        items = await analysis_repository.list_for_user(user['id'], 0, limit)
        return {'items': [{'id': item['analysis_id'], 'filename': item['filename'], 'file_type': item['file_type'], 'status': item['processing_status'], 'total_records': item['metrics']['total_records'], 'success_count': item['metrics']['success_count'], 'failed_count': item['metrics']['failed_count'], 'warning_count': item['metrics']['warning_count'], 'unknown_count': item['metrics']['unknown_count'], 'duplicates_removed': item['metrics']['duplicates_removed'], 'created_at': item['created_at']} for item in items]}

    @app.get('/api/v1/dashboard/latest-analysis')
    async def dashboard_latest_analysis(user: User = Depends(current_user)) -> dict[str, object]:
        analysis = await analysis_repository.latest_for_user(user['id'])
        if analysis is None:
            return {'analysis': None}
        return {'analysis': {'id': analysis['analysis_id'], 'filename': analysis['filename'], 'file_type': analysis['file_type'], 'file_size': analysis['file_size'], 'processing_status': analysis['processing_status'], 'total_records': analysis['metrics']['total_records'], 'duplicates_removed': analysis['metrics']['duplicates_removed'], 'created_at': analysis['created_at']}}

    @app.get('/api/v1/settings')
    async def get_settings(user: User = Depends(current_user)) -> dict[str, object]:
        return await settings_repository.get(user['id'])

    @app.patch('/api/v1/settings')
    async def update_settings(payload: SettingsUpdate, user: User = Depends(current_user)) -> dict[str, object]:
        values = payload.model_dump(exclude_none=True)
        return await settings_repository.update(user['id'], values) if values else await settings_repository.get(user['id'])

    @app.get('/api/v1/profile')
    async def get_profile(user: User = Depends(current_user)) -> dict[str, object]:
        return {'id': user['id'], 'full_name': user['name'], 'email': user['email'], 'is_active': True, 'created_at': user['created_at']}

    @app.patch('/api/v1/profile')
    async def update_profile(payload: ProfileUpdate, user: User = Depends(current_user)) -> dict[str, object]:
        updated = await store.update_name(user['id'], payload.full_name)
        if updated is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Profile not found.')
        return {'id': updated['id'], 'full_name': updated['name'], 'email': updated['email'], 'is_active': True, 'created_at': updated['created_at']}

    @app.post('/api/v1/profile/change-password')
    async def change_password(payload: ChangePasswordRequest, user: User = Depends(current_user)) -> dict[str, str]:
        valid = await asyncio.to_thread(verify_password, payload.current_password, user['password_hash'])
        if not valid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Current password is incorrect.')
        password_hash = await asyncio.to_thread(hash_password, payload.new_password)
        if not await store.update_password_hash(user['id'], password_hash):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Profile not found.')
        return {'detail': 'Password updated successfully.'}

    return app


app = create_app()
