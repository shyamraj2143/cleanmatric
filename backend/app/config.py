import os
import secrets
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv()


def _positive_integer(value: str | None, default: int) -> int:
    try:
        parsed = int(value) if value is not None else default
    except ValueError:
        return default
    return parsed if parsed > 0 else default


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
        is_production = os.getenv('NODE_ENV') == 'production'
        jwt_secret = os.getenv('JWT_SECRET') or ('' if is_production else secrets.token_urlsafe(48))
        if not jwt_secret:
            raise RuntimeError('JWT_SECRET must be set when NODE_ENV is production.')
        database_url = os.getenv('DATABASE_URL', 'sqlite:///./metricflow.db')

        return cls(
            port=_positive_integer(os.getenv('PORT'), 4000),
            jwt_secret=jwt_secret,
            token_expires_in_seconds=_positive_integer(os.getenv('JWT_EXPIRES_IN_SECONDS'), 86_400),
            database_url=database_url,
            allowed_origin=os.getenv('ALLOWED_ORIGIN', '*'),
            google_web_client_id=os.getenv('GOOGLE_WEB_CLIENT_ID') or os.getenv('GOOGLE_CLIENT_ID') or os.getenv('VITE_GOOGLE_WEB_CLIENT_ID'),
        )
