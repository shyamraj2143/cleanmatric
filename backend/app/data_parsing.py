import csv
import io
import json
import math
import re
from pathlib import Path
from typing import Any

import pandas as pd

MAX_FILE_SIZE = 20 * 1024 * 1024
MAX_ROWS = 100_000
MAX_COLUMNS = 250
SUPPORTED_SUFFIXES = {'.csv', '.tsv', '.txt', '.log', '.json', '.xlsx'}
STATUS_KEYWORDS = {
    'Success': ('success', 'passed', 'pass', 'completed', 'completed successfully', 'ok', 'healthy', 'active', 'true'),
    'Failed': ('failed', 'fail', 'error', 'exception', 'critical', 'unsuccessful', 'rejected', 'down', 'false'),
    'Warning': ('warning', 'warn', 'pending', 'partial', 'degraded', 'retry', 'timeout'),
}
DEFAULT_CLEANING_OPTIONS: dict[str, Any] = {
    'trim_whitespace': True, 'remove_duplicates': True, 'remove_empty_rows': True,
    'missing_strategy': 'keep', 'case_normalization': 'none',
    'outlier_action': 'flag', 'normalize_dates': True,
}
NULL_TOKENS = {'', 'na', 'n/a', 'none', 'null', 'nil', 'nan', '-', '--'}


class FileValidationError(ValueError):
    pass


class FileParsingError(ValueError):
    pass


def validate_upload(filename: str | None, content: bytes) -> tuple[str, str]:
    safe = Path(filename or '').name.strip()
    if not safe or safe in {'.', '..'}:
        raise FileValidationError('A valid filename is required.')
    suffix = Path(safe).suffix.lower()
    if suffix not in SUPPORTED_SUFFIXES:
        supported = ', '.join(sorted(item[1:].upper() for item in SUPPORTED_SUFFIXES))
        raise FileValidationError(f'Unsupported file type. Supported formats: {supported}.')
    if not content:
        raise FileValidationError('The uploaded file is empty.')
    if len(content) > MAX_FILE_SIZE:
        raise OverflowError('The uploaded file exceeds the 20 MB limit.')
    if suffix != '.xlsx' and b'\x00' in content:
        raise FileValidationError('The uploaded file contains invalid binary data.')
    return safe, suffix[1:]


def parse_file(filename: str, content: bytes) -> list[dict[str, str]]:
    suffix = Path(filename).suffix.lower()
    try:
        if suffix == '.xlsx':
            frame = pd.read_excel(io.BytesIO(content), dtype=object)
        elif suffix == '.json':
            frame = _json_frame(_decode(content))
        elif suffix in {'.csv', '.tsv'}:
            frame = _delimited_frame(_decode(content), suffix)
        else:
            return _parse_lines(_decode(content), filename)
    except FileParsingError:
        raise
    except (ValueError, TypeError, csv.Error, UnicodeError, pd.errors.ParserError) as error:
        raise FileParsingError('The file format could not be parsed. Check the structure and try again.') from error
    if frame.empty and len(frame.columns) == 0:
        raise FileParsingError('The file does not contain any columns.')
    if len(frame.index) > MAX_ROWS:
        raise FileParsingError(f'The file contains more than {MAX_ROWS:,} rows.')
    if len(frame.columns) > MAX_COLUMNS:
        raise FileParsingError(f'The file contains more than {MAX_COLUMNS} columns.')
    frame.columns = unique_columns([str(column) for column in frame.columns])
    frame = frame.where(pd.notna(frame), '')
    return [{column: stringify(value) for column, value in row.items()} for row in frame.to_dict(orient='records')]


def normalize_cleaning_options(options: dict[str, Any] | None) -> dict[str, Any]:
    value = DEFAULT_CLEANING_OPTIONS.copy()
    if options:
        value.update({key: item for key, item in options.items() if key in value})
    if value['missing_strategy'] not in {'keep', 'drop_rows', 'fill_zero', 'fill_mode'}:
        value['missing_strategy'] = 'keep'
    if value['case_normalization'] not in {'none', 'lower', 'upper', 'title'}:
        value['case_normalization'] = 'none'
    if value['outlier_action'] not in {'flag', 'remove', 'cap', 'ignore'}:
        value['outlier_action'] = 'flag'
    for key in ('trim_whitespace', 'remove_duplicates', 'remove_empty_rows', 'normalize_dates'):
        value[key] = bool(value[key])
    return value


def classify_status(status: str, message: str) -> str:
    candidate = (status or message).strip().casefold()
    if not candidate or candidate in {'none', 'null', 'unknown'}:
        return 'Unknown'
    for category, keywords in STATUS_KEYWORDS.items():
        if candidate in keywords or any(re.search(rf'\b{re.escape(keyword)}\b', candidate) for keyword in keywords):
            return category
    return 'Unknown'


def stringify(value: object) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ''
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    return str(value)


def unique_columns(columns: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    result: list[str] = []
    for index, column in enumerate(columns, start=1):
        base = re.sub(r'[^a-zA-Z0-9]+', '_', column.strip()).strip('_').casefold() or f'column_{index}'
        seen[base] = seen.get(base, 0) + 1
        result.append(base if seen[base] == 1 else f'{base}_{seen[base]}')
    return result


def _decode(content: bytes) -> str:
    for encoding in ('utf-8-sig', 'utf-8', 'cp1252', 'latin-1'):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            pass
    raise FileParsingError('The text encoding is not supported.')


def _delimited_frame(text: str, suffix: str) -> pd.DataFrame:
    try:
        return pd.read_csv(io.StringIO(text), dtype=object, keep_default_na=False,
                           sep='\t' if suffix == '.tsv' else None, engine='python', on_bad_lines='error')
    except pd.errors.EmptyDataError as error:
        raise FileParsingError('The file does not contain tabular data.') from error


def _json_frame(text: str) -> pd.DataFrame:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as error:
        raise FileParsingError(f'Invalid JSON near line {error.lineno}, column {error.colno}.') from error
    if isinstance(payload, dict):
        payload = next((payload[key] for key in ('records', 'data', 'items', 'results') if isinstance(payload.get(key), list)), [payload])
    if not isinstance(payload, list):
        raise FileParsingError('JSON must contain an object or an array.')
    if payload and not all(isinstance(item, dict) for item in payload):
        payload = [{'value': item} for item in payload]
    return pd.json_normalize(payload)


def _parse_lines(text: str, filename: str) -> list[dict[str, str]]:
    return [_parse_line(line, index, filename) for index, line in enumerate(text.splitlines(), start=1)][:MAX_ROWS]


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
    return {'record_id': '', 'timestamp': timestamp, 'service': service, 'status': status,
            'message': message, 'raw_message': raw, 'source_line': str(line_number), 'source_file': filename}
