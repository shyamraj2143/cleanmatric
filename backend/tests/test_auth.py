import asyncio
import os
from datetime import UTC, datetime
from uuid import uuid4

from fastapi.testclient import TestClient

os.environ.setdefault('DATABASE_URL', 'sqlite:///./test.db')

from app.config import Settings
from app.main import create_app
from app.analysis_repository import AnalysisRepository
from app.user_store import UserStore


class FakeUserStore:
    def __init__(self) -> None:
        self.users: dict[str, dict[str, str]] = {}

    async def initialize(self) -> None:
        pass

    async def create(self, name: str, email: str, password_hash: str) -> dict[str, str] | None:
        if email in self.users:
            return None
        user = {
            'id': str(uuid4()),
            'name': name,
            'email': email,
            'password_hash': password_hash,
            'created_at': datetime.now(UTC).isoformat(),
        }
        self.users[email] = user
        return user

    async def find_by_email(self, email: str) -> dict[str, str] | None:
        return self.users.get(email)

    async def find_by_id(self, user_id: str) -> dict[str, str] | None:
        return next((user for user in self.users.values() if user['id'] == user_id), None)

    async def update_name(self, user_id: str, name: str) -> dict[str, str] | None:
        user = await self.find_by_id(user_id)
        if user is not None:
            user['name'] = name
        return user

    async def update_password_hash(self, user_id: str, password_hash: str) -> bool:
        user = await self.find_by_id(user_id)
        if user is None:
            return False
        user['password_hash'] = password_hash
        return True


def client_for() -> TestClient:
    settings = Settings(
        port=4000,
        jwt_secret='test-secret',
        token_expires_in_seconds=3600,
        database_url='sqlite:///./test.db',
        allowed_origin='http://localhost:3000',
        google_web_client_id='google-client-id.apps.googleusercontent.com',
    )
    return TestClient(create_app(settings, FakeUserStore()))


def test_register_and_login() -> None:
    with client_for() as client:
        registration = client.post('/api/auth/register', json={
            'name': 'Asha Sharma', 'email': 'ASHA@example.com', 'password': 'secure-password-123',
        })
        assert registration.status_code == 201
        registered_user = registration.json()['user']
        assert registered_user['email'] == 'asha@example.com'
        assert registration.json()['token'].count('.') == 2

        login = client.post('/api/auth/login', json={
            'email': 'asha@example.com', 'password': 'secure-password-123',
        })
        assert login.status_code == 200
        assert login.json()['user']['id'] == registered_user['id']


def test_rejects_duplicate_registration_and_invalid_login() -> None:
    with client_for() as client:
        payload = {'name': 'Ravi Kumar', 'email': 'ravi@example.com', 'password': 'secure-password-123'}
        assert client.post('/api/auth/register', json=payload).status_code == 201
        assert client.post('/api/auth/register', json=payload).status_code == 409
        assert client.post('/api/auth/login', json={'email': payload['email'], 'password': 'wrong-password'}).status_code == 401


def test_sqlite_user_store_persists_users(tmp_path) -> None:
    store = UserStore(f"sqlite:///{tmp_path / 'users.db'}")
    asyncio.run(store.initialize())

    created = asyncio.run(store.create('Maya Patel', 'maya@example.com', 'password-hash'))

    assert created is not None
    assert asyncio.run(store.find_by_email('maya@example.com')) == created
    assert asyncio.run(store.create('Maya Patel', 'maya@example.com', 'password-hash')) is None


def test_authenticated_analysis_and_csv_export(tmp_path) -> None:
    database_url = f"sqlite:///{tmp_path / 'analysis.db'}"
    settings = Settings(port=4000, jwt_secret='test-secret', token_expires_in_seconds=3600, database_url=database_url, allowed_origin='*', google_web_client_id='google-client-id.apps.googleusercontent.com')
    fake_store = FakeUserStore()
    with TestClient(create_app(settings, fake_store, AnalysisRepository(database_url))) as client:
        registration = client.post('/api/auth/register', json={'name': 'Asha Sharma', 'email': 'asha@example.com', 'password': 'secure-password-123'})
        token = registration.json()['token']
        assert client.post('/api/v1/files/analyze', files={'file': ('metrics.csv', b'status,service,message\npassed,api,done\npassed,api,done\n', 'text/csv')}).status_code == 401
        response = client.post('/api/v1/files/analyze', headers={'Authorization': f'Bearer {token}'}, files={'file': ('metrics.csv', b'status,service,message\npassed,api,done\npassed,api,done\n', 'text/csv')})
        assert response.status_code == 201
        analysis = response.json()
        assert analysis['metrics']['cleaned_records'] == 1
        assert analysis['metrics']['duplicates_removed'] == 1
        exported = client.get(f"/api/v1/analyses/{analysis['analysis_id']}/export/csv", headers={'Authorization': f'Bearer {token}'})
        assert exported.status_code == 200
        assert 'Success' in exported.text
        workbook = client.get(f"/api/v1/analyses/{analysis['analysis_id']}/export/xlsx", headers={'Authorization': f'Bearer {token}'})
        assert workbook.status_code == 200
        assert workbook.content.startswith(b'PK')
        second_user = client.post('/api/auth/register', json={'name': 'Ravi Kumar', 'email': 'ravi@example.com', 'password': 'secure-password-123'})
        second_token = second_user.json()['token']
        assert client.get(f"/api/v1/analyses/{analysis['analysis_id']}", headers={'Authorization': f'Bearer {second_token}'}).status_code == 404
        summary = client.get('/api/v1/dashboard/summary', headers={'Authorization': f'Bearer {token}'}).json()
        assert summary['total_analyses'] == 1
        assert summary['success_count'] == 1
        assert client.get('/api/v1/dashboard/status-distribution', headers={'Authorization': f'Bearer {token}'}).json()['data'][0] == {'name': 'Success', 'value': 1}
        assert client.get('/api/v1/dashboard/file-type-distribution', headers={'Authorization': f'Bearer {token}'}).json()['data'] == [{'name': 'CSV', 'value': 1}]
        assert client.get('/api/v1/dashboard/trends?range=invalid', headers={'Authorization': f'Bearer {token}'}).status_code == 422
        assert client.get('/api/v1/dashboard/recent-analyses?limit=21', headers={'Authorization': f'Bearer {token}'}).status_code == 422
        assert client.get('/api/v1/settings', headers={'Authorization': f'Bearer {token}'}).json()['theme'] == 'system'
        updated_settings = client.patch('/api/v1/settings', headers={'Authorization': f'Bearer {token}'}, json={'theme': 'dark', 'rows_per_page': 20}).json()
        assert updated_settings['theme'] == 'dark' and updated_settings['rows_per_page'] == 20
        assert client.patch('/api/v1/settings', headers={'Authorization': f'Bearer {token}'}, json={'rows_per_page': 12}).status_code == 422
        assert client.patch('/api/v1/profile', headers={'Authorization': f'Bearer {token}'}, json={'full_name': 'Asha Gupta'}).json()['full_name'] == 'Asha Gupta'
        assert client.post('/api/v1/profile/change-password', headers={'Authorization': f'Bearer {token}'}, json={'current_password': 'incorrect', 'new_password': 'new-password-456'}).status_code == 400
        assert client.post('/api/v1/profile/change-password', headers={'Authorization': f'Bearer {token}'}, json={'current_password': 'secure-password-123', 'new_password': 'new-password-456'}).status_code == 200
        assert fake_store.users['asha@example.com']['password_hash'] != 'new-password-456'


def test_cors_preflight_allows_authenticated_analysis_requests() -> None:
    with client_for() as client:
        response = client.options('/api/v1/analyses?page=1&page_size=10', headers={
            'Origin': 'http://localhost:3000',
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'authorization',
        })
        assert response.status_code == 200
        assert response.headers['access-control-allow-origin'] == 'http://localhost:3000'


def test_google_auth_creates_account(monkeypatch) -> None:
    def fake_verify_google_credential(credential: str, client_id: str) -> dict[str, object]:
        assert credential == 'valid-token'
        assert client_id == 'google-client-id.apps.googleusercontent.com'
        return {
            'aud': client_id,
            'email': 'NILA@example.com',
            'email_verified': True,
            'name': 'Nila Shah',
        }

    monkeypatch.setattr('app.main.verify_google_credential', fake_verify_google_credential)
    with client_for() as client:
        response = client.post('/api/auth/google', json={'credential': 'valid-token'})
        assert response.status_code == 200
        payload = response.json()
        assert payload['user']['email'] == 'nila@example.com'
        assert payload['user']['name'] == 'Nila Shah'
        assert payload['token'].count('.') == 2


def test_google_auth_rejects_invalid_credential(monkeypatch) -> None:
    def fake_verify_google_credential(_: str, __: str) -> dict[str, object]:
        raise ValueError('bad token')

    monkeypatch.setattr('app.main.verify_google_credential', fake_verify_google_credential)
    with client_for() as client:
        response = client.post('/api/auth/google', json={'credential': 'invalid-token'})
        assert response.status_code == 401
