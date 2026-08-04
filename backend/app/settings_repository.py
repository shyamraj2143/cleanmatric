import asyncio
import sqlite3
from datetime import UTC, datetime
from typing import Any

from app.user_store import UserStore


DEFAULT_SETTINGS = {'theme': 'system', 'email_notifications': True, 'analysis_notifications': True, 'export_format': 'csv', 'rows_per_page': 10, 'compact_sidebar': False}


class SettingsRepository:
    def __init__(self, database_url: str) -> None:
        self._database_path = UserStore._parse_database_url(database_url)

    async def initialize(self) -> None:
        await asyncio.to_thread(self._initialize)

    async def get(self, user_id: str) -> dict[str, Any]:
        return await asyncio.to_thread(self._get, user_id)

    async def update(self, user_id: str, values: dict[str, Any]) -> dict[str, Any]:
        return await asyncio.to_thread(self._update, user_id, values)

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._database_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute('''CREATE TABLE IF NOT EXISTS user_settings (
                user_id TEXT PRIMARY KEY, theme TEXT NOT NULL, email_notifications INTEGER NOT NULL,
                analysis_notifications INTEGER NOT NULL, export_format TEXT NOT NULL, rows_per_page INTEGER NOT NULL,
                compact_sidebar INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
            )''')

    def _get(self, user_id: str) -> dict[str, Any]:
        with self._connect() as connection:
            row = connection.execute('SELECT * FROM user_settings WHERE user_id = ?', (user_id,)).fetchone()
            if row is None:
                now = datetime.now(UTC).isoformat()
                connection.execute('INSERT INTO user_settings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', (user_id, 'system', 1, 1, 'csv', 10, 0, now, now))
                return DEFAULT_SETTINGS.copy()
        return self._row_to_settings(row)

    def _update(self, user_id: str, values: dict[str, Any]) -> dict[str, Any]:
        self._get(user_id)
        assignments = ', '.join(f'{key} = ?' for key in values)
        parameters = [int(value) if isinstance(value, bool) else value for value in values.values()]
        with self._connect() as connection:
            connection.execute(f'UPDATE user_settings SET {assignments}, updated_at = ? WHERE user_id = ?', (*parameters, datetime.now(UTC).isoformat(), user_id))
        return self._get(user_id)

    @staticmethod
    def _row_to_settings(row: sqlite3.Row) -> dict[str, Any]:
        return {'theme': row['theme'], 'email_notifications': bool(row['email_notifications']), 'analysis_notifications': bool(row['analysis_notifications']), 'export_format': row['export_format'], 'rows_per_page': row['rows_per_page'], 'compact_sidebar': bool(row['compact_sidebar'])}
