import asyncio
import json
import sqlite3
import uuid
from datetime import UTC, datetime
from typing import Any

from app.user_store import UserStore


class AnalysisRepository:
    def __init__(self, database_url: str) -> None:
        self._database_path = UserStore._parse_database_url(database_url)

    async def initialize(self) -> None:
        await asyncio.to_thread(self._initialize)

    async def create(self, user_id: str, filename: str, file_type: str, file_size: int, records: list[dict[str, str]], metrics: dict[str, Any], charts: dict[str, Any]) -> dict[str, Any]:
        return await asyncio.to_thread(self._create, user_id, filename, file_type, file_size, records, metrics, charts)

    async def list_for_user(self, user_id: str, offset: int, limit: int) -> list[dict[str, Any]]:
        return await asyncio.to_thread(self._list_for_user, user_id, offset, limit)

    async def count_for_user(self, user_id: str) -> int:
        return await asyncio.to_thread(self._count_for_user, user_id)

    async def find_for_user(self, analysis_id: str, user_id: str) -> dict[str, Any] | None:
        return await asyncio.to_thread(self._find_for_user, analysis_id, user_id)

    async def delete_for_user(self, analysis_id: str, user_id: str) -> bool:
        return await asyncio.to_thread(self._delete_for_user, analysis_id, user_id)

    async def dashboard_summary(self, user_id: str) -> dict[str, int | float]:
        return await asyncio.to_thread(self._dashboard_summary, user_id)

    async def file_type_distribution(self, user_id: str) -> list[dict[str, object]]:
        return await asyncio.to_thread(self._file_type_distribution, user_id)

    async def trends(self, user_id: str, days: int) -> list[dict[str, object]]:
        return await asyncio.to_thread(self._trends, user_id, days)

    async def latest_for_user(self, user_id: str) -> dict[str, Any] | None:
        return await asyncio.to_thread(self._latest_for_user, user_id)

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._database_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute('''
                CREATE TABLE IF NOT EXISTS analysis_jobs (
                    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, original_filename TEXT NOT NULL,
                    file_type TEXT NOT NULL, file_size INTEGER NOT NULL, status TEXT NOT NULL,
                    metrics_json TEXT NOT NULL, charts_json TEXT NOT NULL, columns_json TEXT NOT NULL,
                    records_json TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT NOT NULL,
                    error_message TEXT
                )
            ''')
            connection.execute('CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_created ON analysis_jobs(user_id, created_at DESC)')

    def _create(self, user_id: str, filename: str, file_type: str, file_size: int, records: list[dict[str, str]], metrics: dict[str, Any], charts: dict[str, Any]) -> dict[str, Any]:
        analysis_id, now = str(uuid.uuid4()), datetime.now(UTC).isoformat()
        columns: list[str] = []
        for record in records:
            for column in record:
                if column not in columns:
                    columns.append(column)
        with self._connect() as connection:
            connection.execute('''
                INSERT INTO analysis_jobs (id, user_id, original_filename, file_type, file_size, status, metrics_json, charts_json, columns_json, records_json, created_at, completed_at)
                VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?)
            ''', (analysis_id, user_id, filename, file_type, file_size, json.dumps(metrics), json.dumps(charts), json.dumps(columns), json.dumps(records), now, now))
        return self._find_for_user(analysis_id, user_id) or {}

    def _list_for_user(self, user_id: str, offset: int, limit: int) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute('SELECT * FROM analysis_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?', (user_id, limit, offset)).fetchall()
        return [self._row_to_job(row, include_records=False) for row in rows]

    def _count_for_user(self, user_id: str) -> int:
        with self._connect() as connection:
            row = connection.execute('SELECT COUNT(*) AS total FROM analysis_jobs WHERE user_id = ?', (user_id,)).fetchone()
        return int(row['total'])

    def _find_for_user(self, analysis_id: str, user_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute('SELECT * FROM analysis_jobs WHERE id = ? AND user_id = ?', (analysis_id, user_id)).fetchone()
        return self._row_to_job(row, include_records=True) if row else None

    def _delete_for_user(self, analysis_id: str, user_id: str) -> bool:
        with self._connect() as connection:
            cursor = connection.execute('DELETE FROM analysis_jobs WHERE id = ? AND user_id = ?', (analysis_id, user_id))
        return cursor.rowcount == 1

    def _dashboard_summary(self, user_id: str) -> dict[str, int | float]:
        fields = ('cleaned_records', 'success_count', 'failed_count', 'warning_count', 'unknown_count', 'duplicates_removed', 'invalid_records', 'missing_values_count', 'outliers_detected')
        expressions = ', '.join(f"COALESCE(SUM(CAST(json_extract(metrics_json, '$.{field}') AS INTEGER)), 0) AS {field}" for field in fields)
        with self._connect() as connection:
            row = connection.execute(f'''SELECT COUNT(*) AS total_analyses, {expressions},
                COALESCE(AVG(CAST(json_extract(metrics_json, '$.quality_score') AS REAL)), 0) AS average_quality_score
                FROM analysis_jobs WHERE user_id = ?''', (user_id,)).fetchone()
        result: dict[str, int | float] = {key: int(row[key]) for key in ('total_analyses', *fields)}
        result['average_quality_score'] = round(float(row['average_quality_score']), 2)
        return result

    def _file_type_distribution(self, user_id: str) -> list[dict[str, object]]:
        with self._connect() as connection:
            rows = connection.execute('SELECT UPPER(file_type) AS name, COUNT(*) AS value FROM analysis_jobs WHERE user_id = ? GROUP BY UPPER(file_type) ORDER BY name', (user_id,)).fetchall()
        return [{'name': str(row['name']), 'value': int(row['value'])} for row in rows]

    def _trends(self, user_id: str, days: int) -> list[dict[str, object]]:
        fields = ('cleaned_records', 'success_count', 'failed_count', 'warning_count', 'unknown_count')
        expressions = ', '.join(f"COALESCE(SUM(CAST(json_extract(metrics_json, '$.{field}') AS INTEGER)), 0) AS {field}" for field in fields)
        with self._connect() as connection:
            rows = connection.execute(f'''SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS analyses, {expressions},
                COALESCE(AVG(CAST(json_extract(metrics_json, '$.quality_score') AS REAL)), 0) AS quality_score
                FROM analysis_jobs WHERE user_id = ? AND created_at >= datetime('now', ?)
                GROUP BY substr(created_at, 1, 10) ORDER BY date''', (user_id, f'-{days} days')).fetchall()
        return [{'date': str(row['date']), 'analyses': int(row['analyses']), 'records': int(row['cleaned_records']), 'success': int(row['success_count']), 'failed': int(row['failed_count']), 'warning': int(row['warning_count']), 'unknown': int(row['unknown_count']), 'quality_score': round(float(row['quality_score']), 2)} for row in rows]

    def _latest_for_user(self, user_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute('SELECT * FROM analysis_jobs WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1', (user_id, 'completed')).fetchone()
        return self._row_to_job(row, include_records=False) if row else None

    @staticmethod
    def _row_to_job(row: sqlite3.Row, include_records: bool) -> dict[str, Any]:
        metrics = json.loads(row['metrics_json'])
        job = {
            'analysis_id': row['id'], 'filename': row['original_filename'], 'file_type': row['file_type'],
            'file_size': row['file_size'], 'processing_status': row['status'], 'metrics': metrics,
            'charts': json.loads(row['charts_json']), 'columns': json.loads(row['columns_json']),
            'created_at': row['created_at'], 'completed_at': row['completed_at'],
            'warnings': metrics.get('warnings', []),
        }
        if include_records:
            records = json.loads(row['records_json'])
            job['preview'] = records[:50]
            job['records'] = records
        return job
