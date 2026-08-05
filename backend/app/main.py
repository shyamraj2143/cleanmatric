from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.analysis_repository import AnalysisRepository
from app.analysis_routes import build_analysis_router
from app.auth_routes import build_auth_router
from app.config import Settings
from app.data_processing import DataProcessingError, process_uploaded_data
from app.security import decode_access_token
from app.settings_repository import SettingsRepository
from app.settings_routes import build_settings_router
from app.user_store import User, UserStore


def verify_google_credential(credential: str, client_id: str) -> dict[str, object]:
    from google.auth.transport import requests
    from google.oauth2 import id_token
    return id_token.verify_oauth2_token(credential, requests.Request(), client_id)


def create_app(settings: Settings | None = None, store: UserStore | None = None,
               analysis_repository: AnalysisRepository | None = None,
               settings_repository: SettingsRepository | None = None) -> FastAPI:
    settings = settings or Settings.from_environment()
    store = store or UserStore(settings.database_url)
    analysis_repository = analysis_repository or AnalysisRepository(settings.database_url)
    settings_repository = settings_repository or SettingsRepository(settings.database_url)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        await store.initialize(); await analysis_repository.initialize(); await settings_repository.initialize()
        yield

    app = FastAPI(lifespan=lifespan, title='CleanMetric API', version='2.0.0',
                  description='Reliable data cleaning, profiling, analytics, and export API.')
    origins = ['*'] if settings.allowed_origin == '*' else [item.strip() for item in settings.allowed_origin.split(',') if item.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origins or ['http://localhost:3000'],
                       allow_credentials=False, allow_methods=['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
                       allow_headers=['Content-Type', 'Authorization'])

    async def current_user(authorization: str | None = Header(default=None)) -> User:
        if not authorization or not authorization.startswith('Bearer '):
            raise HTTPException(status_code=401, detail='Authentication is required.')
        try:
            payload = decode_access_token(authorization.removeprefix('Bearer '), settings)
        except ValueError as error:
            raise HTTPException(status_code=401, detail='Invalid or expired access token.') from error
        user = await store.find_by_id(str(payload['sub']))
        if user is None:
            raise HTTPException(status_code=401, detail='User account was not found.')
        return user

    app.include_router(build_auth_router(store, settings, verify_google_credential))
    app.include_router(build_analysis_router(analysis_repository, current_user))
    app.include_router(build_settings_router(store, settings_repository, current_user))

    @app.get('/')
    async def service_root():
        return {
            'service': 'cleanmetric-api',
            'status': 'online',
            'version': '2.0.0',
            'docs': '/docs',
            'health': '/health',
        }

    @app.get('/health')
    async def health():
        return {'status': 'healthy', 'service': 'cleanmetric-api', 'version': '2.0.0'}

    @app.get('/api/public/config')
    async def public_config():
        return {
            'service': 'cleanmetric-api',
            'version': '2.0.0',
            'google_sign_in_enabled': bool(settings.google_web_client_id),
            'google_web_client_id': settings.google_web_client_id or '',
        }

    @app.post('/api/data/process')
    async def process_data(file: UploadFile = File(...)):
        try:
            return process_uploaded_data(file.filename or 'upload.csv', await file.read())
        except DataProcessingError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    return app


app = create_app()
