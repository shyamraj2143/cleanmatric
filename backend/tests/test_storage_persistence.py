import sqlite3
from pathlib import Path

from app.config import Settings
from app.user_store import UserStore


def _create_database(path: Path, emails: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as connection:
        connection.execute('''
            CREATE TABLE users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        ''')
        for index, email in enumerate(emails):
            connection.execute(
                'INSERT INTO users VALUES (?, ?, ?, ?, ?)',
                (str(index), f'User {index}', email, 'hash', '2026-08-05T00:00:00+00:00'),
            )


def _count_users(database_url: str) -> int:
    database_path = UserStore._parse_database_url(database_url)
    with sqlite3.connect(database_path) as connection:
        return int(connection.execute('SELECT COUNT(*) FROM users').fetchone()[0])


def test_selects_populated_database_from_railway_volume(tmp_path, monkeypatch):
    volume = tmp_path / 'volume'
    preferred = volume / 'metricflow.db'
    populated = volume / 'legacy-users.db'
    _create_database(preferred, [])
    _create_database(populated, ['one@example.com', 'two@example.com'])

    monkeypatch.setenv('RAILWAY_VOLUME_MOUNT_PATH', str(volume))
    monkeypatch.setenv('DATABASE_URL', 'sqlite:///./ephemeral.db')
    monkeypatch.setenv('JWT_SECRET', 'storage-test-secret-that-is-long-enough')

    settings = Settings.from_environment()

    assert Path(UserStore._parse_database_url(settings.database_url)) == populated.resolve()
    assert _count_users(settings.database_url) == 2
    assert (volume / 'backups' / 'metricflow-latest.db').exists()


def test_restores_latest_backup_when_primary_database_is_missing(tmp_path, monkeypatch):
    volume = tmp_path / 'volume'
    backup = volume / 'backups' / 'metricflow-latest.db'
    _create_database(backup, ['restored@example.com'])

    monkeypatch.setenv('RAILWAY_VOLUME_MOUNT_PATH', str(volume))
    monkeypatch.delenv('DATABASE_URL', raising=False)
    monkeypatch.setenv('JWT_SECRET', 'storage-test-secret-that-is-long-enough')

    settings = Settings.from_environment()

    selected_path = Path(UserStore._parse_database_url(settings.database_url))
    assert selected_path == (volume / 'metricflow.db').resolve()
    assert _count_users(settings.database_url) == 1


def test_migrates_ephemeral_legacy_database_into_volume(tmp_path, monkeypatch):
    working_directory = tmp_path / 'app'
    volume = tmp_path / 'volume'
    legacy_database = working_directory / 'metricflow.db'
    _create_database(legacy_database, ['legacy@example.com'])

    monkeypatch.chdir(working_directory)
    monkeypatch.setenv('RAILWAY_VOLUME_MOUNT_PATH', str(volume))
    monkeypatch.setenv('DATABASE_URL', 'sqlite:///./metricflow.db')
    monkeypatch.setenv('JWT_SECRET', 'storage-test-secret-that-is-long-enough')

    settings = Settings.from_environment()

    selected_path = Path(UserStore._parse_database_url(settings.database_url))
    assert selected_path == (volume / 'metricflow.db').resolve()
    assert _count_users(settings.database_url) == 1
    assert (volume / 'backups' / 'metricflow-latest.db').exists()
