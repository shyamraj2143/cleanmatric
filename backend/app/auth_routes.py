import asyncio
from secrets import token_urlsafe
from typing import Callable

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.config import Settings
from app.security import create_access_token, hash_password, verify_password
from app.user_store import User, UserStore


class RegisterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator('password')
    @classmethod
    def password_size(cls, value: str) -> str:
        if len(value.encode()) > 72:
            raise ValueError('Password must be at most 72 UTF-8 bytes.')
        return value


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


def public_user(user: User) -> UserResponse:
    return UserResponse(id=user['id'], name=user['name'], email=user['email'], created_at=user['created_at'])


def build_auth_router(store: UserStore, settings: Settings, verifier: Callable[[str, str], dict[str, object]]) -> APIRouter:
    router = APIRouter(prefix='/api/auth', tags=['authentication'])

    @router.post('/register', response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
    async def register(payload: RegisterRequest) -> AuthResponse:
        email = str(payload.email).lower()
        user = await store.create(payload.name, email, await asyncio.to_thread(hash_password, payload.password))
        if user is None:
            raise HTTPException(status_code=409, detail='An account with this email already exists.')
        return AuthResponse(user=public_user(user), token=create_access_token(user, settings))

    @router.post('/login', response_model=AuthResponse)
    async def login(payload: LoginRequest) -> AuthResponse:
        user = await store.find_by_email(str(payload.email).lower())
        valid = user is not None and await asyncio.to_thread(verify_password, payload.password, user['password_hash'])
        if not valid:
            raise HTTPException(status_code=401, detail='Invalid email or password.')
        return AuthResponse(user=public_user(user), token=create_access_token(user, settings))

    @router.post('/google', response_model=AuthResponse)
    async def google_auth(payload: GoogleAuthRequest) -> AuthResponse:
        if not settings.google_web_client_id:
            raise HTTPException(status_code=503, detail='Google sign-in is not configured.')
        try:
            claims = await asyncio.to_thread(verifier, payload.credential, settings.google_web_client_id)
        except ValueError as error:
            raise HTTPException(status_code=401, detail='Google sign-in failed. Check that this domain is allowed in the Google OAuth Web client.') from error
        if claims.get('aud') != settings.google_web_client_id or not claims.get('email_verified'):
            raise HTTPException(status_code=401, detail='Invalid Google credential.')
        email = str(claims.get('email', '')).lower()
        if not email:
            raise HTTPException(status_code=401, detail='Invalid Google credential.')
        name = str(claims.get('name') or email.split('@')[0]).strip()
        user = await store.find_by_email(email)
        if user is None:
            user = await store.create(name or email, email, await asyncio.to_thread(hash_password, token_urlsafe(32)))
            user = user or await store.find_by_email(email)
        if user is None:
            raise HTTPException(status_code=500, detail='Unable to create Google account.')
        return AuthResponse(user=public_user(user), token=create_access_token(user, settings))

    return router
