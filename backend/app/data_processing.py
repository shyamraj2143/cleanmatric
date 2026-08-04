import csv
import io
from pathlib import Path


MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_PREVIEW_ROWS = 20


class DataProcessingError(ValueError):
    pass


def process_uploaded_data(filename: str, content: bytes) -> dict[str, object]:
    if not content:
        raise DataProcessingError('The uploaded file is empty.')
    if len(content) > MAX_UPLOAD_BYTES:
        raise DataProcessingError('The uploaded file exceeds the 5 MB limit.')

    suffix = Path(filename).suffix.lower()
    if suffix not in {'.csv', '.txt'}:
        raise DataProcessingError('Only CSV and TXT files are supported.')

    try:
        text = content.decode('utf-8-sig')
    except UnicodeDecodeError as error:
        raise DataProcessingError('The file must use UTF-8 encoding.') from error

    if suffix == '.csv':
        columns, rows, stats = _process_csv(text)
    else:
        columns, rows, stats = _process_text(text)

    return {
        'filename': filename,
        'columns': columns,
        'preview': rows[:MAX_PREVIEW_ROWS],
        'stats': stats,
    }


def _process_csv(text: str) -> tuple[list[str], list[dict[str, str]], dict[str, int]]:
    raw_rows = list(csv.reader(io.StringIO(text)))
    if not raw_rows:
        raise DataProcessingError('The CSV file does not contain a header row.')

    width = max(len(row) for row in raw_rows)
    columns = _unique_columns(raw_rows[0], width)
    records, stats = _clean_rows(columns, raw_rows[1:])
    stats['total_rows'] = len(raw_rows) - 1
    return columns, records, stats


def _process_text(text: str) -> tuple[list[str], list[dict[str, str]], dict[str, int]]:
    records, stats = _clean_rows(['line'], [[line] for line in text.splitlines()])
    stats['total_rows'] = len(text.splitlines())
    return ['line'], records, stats


def _unique_columns(header: list[str], width: int) -> list[str]:
    seen: dict[str, int] = {}
    columns: list[str] = []
    for index in range(width):
        base_name = header[index].strip() if index < len(header) else ''
        base_name = base_name or f'column_{index + 1}'
        seen[base_name] = seen.get(base_name, 0) + 1
        columns.append(base_name if seen[base_name] == 1 else f'{base_name}_{seen[base_name]}')
    return columns


def _clean_rows(columns: list[str], raw_rows: list[list[str]]) -> tuple[list[dict[str, str]], dict[str, int]]:
    cleaned_rows: list[dict[str, str]] = []
    seen_rows: set[tuple[str, ...]] = set()
    blank_rows = duplicate_rows = trimmed_values = missing_values = 0

    for raw_row in raw_rows:
        padded_row = raw_row + [''] * (len(columns) - len(raw_row))
        values = [value.strip() for value in padded_row[:len(columns)]]
        trimmed_values += sum(value != value.strip() for value in padded_row[:len(columns)])
        if not any(values):
            blank_rows += 1
            continue
        row_key = tuple(values)
        if row_key in seen_rows:
            duplicate_rows += 1
            continue
        seen_rows.add(row_key)
        missing_values += sum(value == '' for value in values)
        cleaned_rows.append(dict(zip(columns, values, strict=True)))

    return cleaned_rows, {
        'total_rows': len(raw_rows),
        'cleaned_rows': len(cleaned_rows),
        'removed_blank_rows': blank_rows,
        'removed_duplicate_rows': duplicate_rows,
        'trimmed_values': trimmed_values,
        'missing_values': missing_values,
    }
