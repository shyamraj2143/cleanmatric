import base64
import hashlib
import hmac
import json
import time

import bcrypt

from app.config import Settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
    except (ValueError, TypeError):
        return False


def _encode_json(value: dict[str, object]) -> str:
    raw = json.dumps(value, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    return base64.urlsafe_b64encode(raw).rstrip(b'=').decode('ascii')


def create_access_token(user: dict[str, str], settings: Settings) -> str:
    issued_at = int(time.time())
    header = _encode_json({'alg': 'HS256', 'typ': 'JWT'})
    payload = _encode_json({
        'sub': user['id'],
        'email': user['email'],
        'iat': issued_at,
        'exp': issued_at + settings.token_expires_in_seconds,
    })
    signature = hmac.new(
        settings.jwt_secret.encode('utf-8'), f'{header}.{payload}'.encode('ascii'), hashlib.sha256
    ).digest()
    return f'{header}.{payload}.{base64.urlsafe_b64encode(signature).rstrip(b"=").decode("ascii")}'


def decode_access_token(token: str, settings: Settings) -> dict[str, object]:
    try:
        header, payload, signature = token.split('.')
        expected_signature = hmac.new(
            settings.jwt_secret.encode('utf-8'), f'{header}.{payload}'.encode('ascii'), hashlib.sha256
        ).digest()
        supplied_signature = base64.urlsafe_b64decode(f'{signature}{"=" * (-len(signature) % 4)}')
        if not hmac.compare_digest(supplied_signature, expected_signature):
            raise ValueError('Invalid token signature.')
        decoded_payload = json.loads(base64.urlsafe_b64decode(f'{payload}{"=" * (-len(payload) % 4)}'))
        if not isinstance(decoded_payload, dict) or not isinstance(decoded_payload.get('sub'), str):
            raise ValueError('Invalid token payload.')
        if int(decoded_payload.get('exp', 0)) <= int(time.time()):
            raise ValueError('Token has expired.')
        return decoded_payload
    except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError) as error:
        raise ValueError('Invalid access token.') from error
