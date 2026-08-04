import asyncio
import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import TypedDict


class User(TypedDict):
    id: str
    name: str
    email: str
    password_hash: str
    created_at: str


class UserStore:
    def __init__(self, database_url: str) -> None:
        self._database_path = self._parse_database_url(database_url)

    async def initialize(self) -> None:
        await asyncio.to_thread(self._initialize)

    async def find_by_email(self, email: str) -> User | None:
        return await asyncio.to_thread(self._find_by_email, email)

    async def find_by_id(self, user_id: str) -> User | None:
        return await asyncio.to_thread(self._find_by_id, user_id)

    async def create(self, name: str, email: str, password_hash: str) -> User | None:
        return await asyncio.to_thread(self._create, name, email, password_hash)

    async def update_name(self, user_id: str, name: str) -> User | None:
        return await asyncio.to_thread(self._update_name, user_id, name)

    async def update_password_hash(self, user_id: str, password_hash: str) -> bool:
        return await asyncio.to_thread(self._update_password_hash, user_id, password_hash)

    def _initialize(self) -> None:
        if self._database_path != ':memory:':
            Path(self._database_path).parent.mkdir(parents=True, exist_ok=True)

        with self._connect() as connection:
            cursor = connection.cursor()
            cursor.execute(
                '''
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                '''
            )

    def _find_by_email(self, email: str) -> User | None:
        with self._connect() as connection:
            cursor = connection.cursor()
            cursor.execute(
                'SELECT id, name, email, password_hash, created_at FROM users WHERE email = ?',
                (email,),
            )
            row = cursor.fetchone()
        return self._to_user(row) if row else None

    def _find_by_id(self, user_id: str) -> User | None:
        with self._connect() as connection:
            cursor = connection.cursor()
            cursor.execute(
                'SELECT id, name, email, password_hash, created_at FROM users WHERE id = ?',
                (user_id,),
            )
            row = cursor.fetchone()
        return self._to_user(row) if row else None

    def _create(self, name: str, email: str, password_hash: str) -> User | None:
        created_at = datetime.now(UTC).isoformat()
        with self._connect() as connection:
            cursor = connection.cursor()
            cursor.execute(
                '''
                INSERT OR IGNORE INTO users (id, name, email, password_hash, created_at)
                VALUES (?, ?, ?, ?, ?)
                ''',
                (str(uuid.uuid4()), name, email, password_hash, created_at),
            )
            if cursor.rowcount == 0:
                return None
            cursor.execute(
                'SELECT id, name, email, password_hash, created_at FROM users WHERE email = ?',
                (email,),
            )
            row = cursor.fetchone()
        return self._to_user(row) if row else None

    def _update_name(self, user_id: str, name: str) -> User | None:
        with self._connect() as connection:
            connection.execute('UPDATE users SET name = ? WHERE id = ?', (name, user_id))
        return self._find_by_id(user_id)

    def _update_password_hash(self, user_id: str, password_hash: str) -> bool:
        with self._connect() as connection:
            cursor = connection.execute('UPDATE users SET password_hash = ? WHERE id = ?', (password_hash, user_id))
        return cursor.rowcount == 1

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._database_path)
        connection.row_factory = sqlite3.Row
        return connection

    @staticmethod
    def _parse_database_url(database_url: str) -> str:
        prefix = 'sqlite:///'
        if not database_url.startswith(prefix):
            raise ValueError('DATABASE_URL must use the sqlite:/// path format.')
        database_path = database_url.removeprefix(prefix)
        if not database_path:
            raise ValueError('DATABASE_URL must include a SQLite database path.')
        return database_path

    @staticmethod
    def _to_user(row: sqlite3.Row) -> User:
        return {
            'id': str(row['id']),
            'name': str(row['name']),
            'email': str(row['email']),
            'password_hash': str(row['password_hash']),
            'created_at': str(row['created_at']),
        }
