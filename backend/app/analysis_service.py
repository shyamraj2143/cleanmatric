import csv
import io
import json
import re
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pandas as pd


MAX_FILE_SIZE = 10 * 1024 * 1024
SUPPORTED_SUFFIXES = {'.csv', '.txt', '.log'}
STATUS_KEYWORDS = {
    'Success': ('success', 'passed', 'pass', 'completed', 'completed successfully', 'ok', 'healthy', 'active'),
    'Failed': ('failed', 'fail', 'error', 'exception', 'critical', 'unsuccessful', 'rejected', 'down'),
    'Warning': ('warning', 'warn', 'pending', 'partial', 'degraded', 'retry', 'timeout'),
}


class FileValidationError(ValueError):
    pass


class FileParsingError(ValueError):
    pass


def validate_upload(filename: str | None, content: bytes) -> tuple[str, str]:
    safe_filename = Path(filename or '').name.strip()
    if not safe_filename or safe_filename in {'.', '..'}:
        raise FileValidationError('A valid filename is required.')
    suffix = Path(safe_filename).suffix.lower()
    if suffix not in SUPPORTED_SUFFIXES:
        raise FileValidationError('Only CSV, TXT, and LOG files are supported.')
    if not content:
        raise FileValidationError('The uploaded file is empty.')
    if len(content) > MAX_FILE_SIZE:
        raise OverflowError('The uploaded file exceeds the 10 MB limit.')
    if b'\x00' in content:
        raise FileValidationError('The uploaded file contains invalid binary data.')
    return safe_filename, suffix.removeprefix('.')


def parse_file(filename: str, content: bytes) -> list[dict[str, str]]:
    try:
        text = content.decode('utf-8-sig')
    except UnicodeDecodeError as error:
        raise FileParsingError('The file must be UTF-8 or UTF-8-SIG encoded.') from error
    if filename.lower().endswith('.csv'):
        return _parse_csv(text, filename)
    return _parse_lines(text, filename)


def clean_and_analyze(records: list[dict[str, str]]) -> tuple[list[dict[str, str]], dict[str, Any], dict[str, list[dict[str, Any]]]]:
    cleaned: list[dict[str, str]] = []
    seen: set[tuple[str, ...]] = set()
    empty_rows_removed = duplicates_removed = invalid_records = missing_values_count = 0

    for record in records:
        normalized = {key: str(value).strip() for key, value in record.items()}
        if not any(normalized.get(key, '') for key in ('record_id', 'timestamp', 'service', 'status', 'message', 'raw_message')):
            empty_rows_removed += 1
            continue
        for field in ('status', 'service', 'message'):
            if not normalized.get(field):
                missing_values_count += 1
        normalized['status'] = normalized.get('status') or 'Unknown'
        normalized['service'] = normalized.get('service') or 'Unknown Service'
        normalized['timestamp'] = _normalize_timestamp(normalized.get('timestamp', ''))
        normalized['original_status'] = normalized.get('status', '')
        normalized['status'] = classify_status(normalized['status'], normalized.get('message', ''))
        key = (normalized['record_id'],) if normalized.get('record_id') else tuple(
            normalized.get(field, '') for field in ('timestamp', 'service', 'status', 'message')
        )
        if key in seen:
            duplicates_removed += 1
            continue
        seen.add(key)
        cleaned.append(normalized)

    counts = Counter(record['status'] for record in cleaned)
    total = len(cleaned)
    metrics: dict[str, Any] = {
        'original_records': len(records), 'cleaned_records': total, 'total_records': total,
        'success_count': counts['Success'], 'failed_count': counts['Failed'],
        'warning_count': counts['Warning'], 'unknown_count': counts['Unknown'],
        'duplicates_removed': duplicates_removed, 'empty_rows_removed': empty_rows_removed,
        'invalid_records': invalid_records, 'missing_values_count': missing_values_count,
    }
    for name, key in (('success', 'Success'), ('failed', 'Failed'), ('warning', 'Warning'), ('unknown', 'Unknown')):
        metrics[f'{name}_percentage'] = round((counts[key] / total * 100) if total else 0, 2)
    charts = {
        'status_distribution': [{'name': name, 'value': counts[name]} for name in ('Success', 'Failed', 'Warning', 'Unknown')],
        'service_distribution': [{'name': name, 'value': value} for name, value in Counter(row['service'] for row in cleaned).most_common()],
        'timeline_distribution': _timeline(cleaned),
    }
    return cleaned, metrics, charts


def classify_status(status: str, message: str) -> str:
    candidate = (status or message).strip().casefold()
    if not candidate or candidate in {'none', 'null', 'unknown'}:
        return 'Unknown'
    for category, keywords in STATUS_KEYWORDS.items():
        if candidate in keywords or any(re.search(rf'\b{re.escape(keyword)}\b', candidate) for keyword in keywords):
            return category
    return 'Unknown'


def _parse_csv(text: str, filename: str) -> list[dict[str, str]]:
    try:
        frame = pd.read_csv(io.StringIO(text), dtype=str, keep_default_na=False, engine='python', on_bad_lines='error')
    except (pd.errors.ParserError, UnicodeError, csv.Error) as error:
        raise FileParsingError('The CSV file format cannot be parsed.') from error
    frame.columns = [str(column).strip() for column in frame.columns]
    if not len(frame.columns):
        raise FileParsingError('The CSV file does not contain columns.')
    return [_normalize_row(row, index + 2, filename) for index, row in enumerate(frame.to_dict(orient='records'))]


def _parse_lines(text: str, filename: str) -> list[dict[str, str]]:
    return [_parse_line(line, index, filename) for index, line in enumerate(text.splitlines(), start=1)]


def _parse_line(line: str, line_number: int, filename: str) -> dict[str, str]:
    raw = line.rstrip('\r\n')
    pipe = re.match(r'^\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*)$', raw)
    comma = re.match(r'^\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*(.*)$', raw)
    bracket = re.match(r'^\s*\[(.*?)\]\s+([^\s]+)\s+(.+?)\s*-\s*(.*)$', raw)
    if pipe or comma:
        timestamp, service, status, message = (pipe or comma).groups()
    elif bracket:
        timestamp, status, service, message = bracket.groups()
    else:
        timestamp = service = status = message = ''
    return {'record_id': '', 'timestamp': timestamp, 'service': service, 'status': status, 'message': message, 'raw_message': raw, 'source_line': str(line_number), 'source_file': filename}


def _normalize_row(row: dict[str, object], line_number: int, filename: str) -> dict[str, str]:
    values = {str(key).strip(): str(value).strip() for key, value in row.items()}
    lookup = {key.casefold().replace(' ', '_'): value for key, value in values.items()}
    def get(*keys: str) -> str:
        return next((lookup[key] for key in keys if lookup.get(key)), '')
    message = get('message', 'raw_message', 'description', 'details') or json.dumps(values, ensure_ascii=False)
    return {'record_id': get('record_id', 'id'), 'timestamp': get('timestamp', 'time', 'date'), 'service': get('service', 'source', 'application'), 'status': get('status', 'state', 'result'), 'message': message, 'raw_message': json.dumps(values, ensure_ascii=False), 'source_line': str(line_number), 'source_file': filename}


def _normalize_timestamp(value: str) -> str:
    if not value:
        return ''
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(UTC).isoformat()
    except ValueError:
        return value


def _timeline(records: list[dict[str, str]]) -> list[dict[str, Any]]:
    dates = Counter(record['timestamp'][:10] for record in records if re.match(r'^\d{4}-\d{2}-\d{2}', record['timestamp']))
    return [{'name': name, 'value': value} for name, value in sorted(dates.items())]
