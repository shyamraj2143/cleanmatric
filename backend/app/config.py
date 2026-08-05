import os
import secrets
import sqlite3
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


load_dotenv()


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


def _sqlite_path(database_url: str) -> Path | None:
    prefix = 'sqlite:///'
    if not database_url.startswith(prefix):
        return None
    raw_path = database_url.removeprefix(prefix)
    if not raw_path or raw_path == ':memory:':
        return None
    return Path(raw_path).expanduser()


def _sqlite_url(path: Path) -> str:
    return f'sqlite:///{path}'


def _database_score(path: Path) -> tuple[int, int, int]:
    """Prefer the database containing the most real application data."""
    try:
        size = path.stat().st_size
        if size <= 0:
            return (0, 0, 0)
        row_count = 0
        table_count = 0
        connection = sqlite3.connect(f'file:{path}?mode=ro', uri=True)
        try:
            existing_tables = {
                str(row[0])
                for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
            }
            for table in ('users', 'analysis_jobs', 'user_settings'):
                if table not in existing_tables:
                    continue
                table_count += 1
                try:
                    row_count += int(connection.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0])
                except sqlite3.DatabaseError:
                    pass
        finally:
            connection.close()
        return (row_count, table_count, size)
    except (OSError, sqlite3.DatabaseError):
        return (0, 0, 0)


def _sqlite_backup(source_path: Path, destination_path: Path) -> None:
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = destination_path.with_suffix(f'{destination_path.suffix}.tmp')
    temporary_path.unlink(missing_ok=True)
    source = sqlite3.connect(source_path)
    destination = sqlite3.connect(temporary_path)
    try:
        source.backup(destination)
    finally:
        destination.close()
        source.close()
    os.replace(temporary_path, destination_path)


def _restore_latest_backup(preferred_path: Path, backup_directory: Path) -> bool:
    for backup_name in ('metricflow-latest.db', 'metricflow-previous.db'):
        backup_path = backup_directory / backup_name
        if _database_score(backup_path) == (0, 0, 0):
            continue
        try:
            _sqlite_backup(backup_path, preferred_path)
            print(f'CleanMetric restored persistent database from {backup_path}.', flush=True)
            return True
        except (OSError, sqlite3.DatabaseError) as error:
            print(f'CleanMetric could not restore {backup_path}: {error}', flush=True)
    return False


def _write_recovery_backup(source_path: Path, backup_directory: Path) -> None:
    if _database_score(source_path) == (0, 0, 0):
        return
    latest_path = backup_directory / 'metricflow-latest.db'
    previous_path = backup_directory / 'metricflow-previous.db'
    try:
        backup_directory.mkdir(parents=True, exist_ok=True)
        if latest_path.exists() and _database_score(latest_path) != _database_score(source_path):
            os.replace(latest_path, previous_path)
        _sqlite_backup(source_path, latest_path)
        print(f'CleanMetric recovery backup updated: {latest_path}', flush=True)
    except (OSError, sqlite3.DatabaseError) as error:
        print(f'CleanMetric recovery backup failed: {error}', flush=True)


def _resolve_database_url() -> str:
    configured_url = os.getenv('DATABASE_URL', '').strip()
    volume_mount_value = os.getenv('RAILWAY_VOLUME_MOUNT_PATH', '').strip()

    if not volume_mount_value:
        return configured_url or 'sqlite:///./metricflow.db'

    volume_mount = Path(volume_mount_value).expanduser().resolve()
    volume_mount.mkdir(parents=True, exist_ok=True)
    backup_directory = volume_mount / 'backups'
    configured_path = _sqlite_path(configured_url) if configured_url else None

    preferred_path = volume_mount / 'metricflow.db'
    if configured_path is not None:
        try:
            resolved_configured_path = configured_path.resolve()
            if resolved_configured_path == volume_mount or volume_mount in resolved_configured_path.parents:
                preferred_path = resolved_configured_path
            else:
                print(
                    f'CleanMetric ignored non-persistent DATABASE_URL {resolved_configured_path}; '
                    f'Railway volume is mounted at {volume_mount}.',
                    flush=True,
                )
        except OSError:
            pass

    candidates: set[Path] = {preferred_path}
    for pattern in ('*.db', '*.sqlite', '*.sqlite3'):
        try:
            for path in volume_mount.rglob(pattern):
                if not path.is_file() or backup_directory in path.parents:
                    continue
                candidates.add(path.resolve())
        except OSError:
            pass

    # Include common legacy paths only when they still exist in the running container.
    for legacy_path in (
        Path('/app/metricflow.db'),
        Path('/app/backend/metricflow.db'),
        Path('./metricflow.db'),
    ):
        try:
            if legacy_path.exists() and legacy_path.is_file():
                candidates.add(legacy_path.resolve())
        except OSError:
            pass

    selected_path = max(candidates, key=_database_score)
    if _database_score(selected_path) == (0, 0, 0):
        selected_path = preferred_path
        _restore_latest_backup(preferred_path, backup_directory)

    selected_path.parent.mkdir(parents=True, exist_ok=True)
    selected_score = _database_score(selected_path)
    print(
        f'CleanMetric persistent database: {selected_path} '
        f'(score={selected_score}, volume={volume_mount})',
        flush=True,
    )
    _write_recovery_backup(selected_path, backup_directory)
    return _sqlite_url(selected_path)


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

        return cls(
            port=_positive_integer(os.getenv('PORT'), 4000),
            jwt_secret=jwt_secret,
            token_expires_in_seconds=_positive_integer(os.getenv('JWT_EXPIRES_IN_SECONDS'), 86_400),
            database_url=_resolve_database_url(),
            allowed_origin=os.getenv('ALLOWED_ORIGIN', '*'),
            google_web_client_id=(
                os.getenv('GOOGLE_WEB_CLIENT_ID')
                or os.getenv('GOOGLE_CLIENT_ID')
                or os.getenv('VITE_GOOGLE_WEB_CLIENT_ID')
                or None
            ),
        )
