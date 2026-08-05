import asyncio
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.security import hash_password, verify_password
from app.settings_repository import SettingsRepository
from app.user_store import User, UserStore


class SettingsUpdate(BaseModel):
    theme: Literal['system', 'light', 'dark'] | None = None
    email_notifications: bool | None = None
    analysis_notifications: bool | None = None
    export_format: Literal['csv', 'xlsx', 'json', 'pdf'] | None = None
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
    def password_size(cls, value: str) -> str:
        if len(value.encode()) > 72:
            raise ValueError('Password must be at most 72 UTF-8 bytes.')
        return value


def build_settings_router(store: UserStore, repository: SettingsRepository, current_user) -> APIRouter:
    router = APIRouter(prefix='/api/v1', tags=['account'])

    @router.get('/settings')
    async def get_settings(user: User = Depends(current_user)):
        return await repository.get(user['id'])

    @router.patch('/settings')
    async def update_settings(payload: SettingsUpdate, user: User = Depends(current_user)):
        values = payload.model_dump(exclude_none=True)
        return await repository.update(user['id'], values) if values else await repository.get(user['id'])

    @router.get('/profile')
    async def get_profile(user: User = Depends(current_user)):
        return {'id': user['id'], 'full_name': user['name'], 'email': user['email'], 'is_active': True, 'created_at': user['created_at']}

    @router.patch('/profile')
    async def update_profile(payload: ProfileUpdate, user: User = Depends(current_user)):
        updated = await store.update_name(user['id'], payload.full_name)
        if updated is None:
            raise HTTPException(status_code=404, detail='Profile not found.')
        return {'id': updated['id'], 'full_name': updated['name'], 'email': updated['email'], 'is_active': True, 'created_at': updated['created_at']}

    @router.post('/profile/change-password')
    async def change_password(payload: ChangePasswordRequest, user: User = Depends(current_user)):
        if not await asyncio.to_thread(verify_password, payload.current_password, user['password_hash']):
            raise HTTPException(status_code=400, detail='Current password is incorrect.')
        if not await store.update_password_hash(user['id'], await asyncio.to_thread(hash_password, payload.new_password)):
            raise HTTPException(status_code=404, detail='Profile not found.')
        return {'message': 'Password updated successfully.'}

    return router
