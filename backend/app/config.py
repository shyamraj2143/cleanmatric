import os
import secrets
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


load_dotenv()

DEFAULT_GOOGLE_WEB_CLIENT_ID = '776507506876-vjrrc9m5eer82k6digta7ie2phd4l1f8.apps.googleusercontent.com'


def _positive_integer(value: str | None, default: int) -> int:
    try:
        parsed = int(value) if value is not None else default
    except ValueError:
        return default
    return parsed if parsed > 0 else default


def _persistent_secret() -> str:
    secret_path = Path(os.getenv('JWT_SECRET_FILE', '/data/jwt_secret'))
    try:
        if secret_path.exists():
            secret = secret_path.read_text(encoding='utf-8').strip()
            if secret:
                return secret
        secret_path.parent.mkdir(parents=True, exist_ok=True)
        secret = secrets.token_urlsafe(48)
        secret_path.write_text(secret, encoding='utf-8')
        return secret
    except OSError:
        return secrets.token_urlsafe(48)


@dataclass(frozen=True)
class Settings:
    port: int
    jwt_secret: str
    token_expires_in_seconds: int
    database_url: str
    allowed_origin: str
    google_web_client_id: str | None

    @classmethod
    def from_environment(cls) -> 'Settings':
        jwt_secret = os.getenv('JWT_SECRET') or _persistent_secret()
        database_url = os.getenv('DATABASE_URL', 'sqlite:///./metricflow.db')

        return cls(
            port=_positive_integer(os.getenv('PORT'), 4000),
            jwt_secret=jwt_secret,
            token_expires_in_seconds=_positive_integer(os.getenv('JWT_EXPIRES_IN_SECONDS'), 86_400),
            database_url=database_url,
            allowed_origin=os.getenv('ALLOWED_ORIGIN', '*'),
            google_web_client_id=(
                os.getenv('GOOGLE_WEB_CLIENT_ID')
                or os.getenv('GOOGLE_CLIENT_ID')
                or os.getenv('VITE_GOOGLE_WEB_CLIENT_ID')
                or DEFAULT_GOOGLE_WEB_CLIENT_ID
            ),
        )
