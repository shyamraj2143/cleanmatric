from collections import Counter
from typing import Any

import pandas as pd

from app.data_parsing import (
    DEFAULT_CLEANING_OPTIONS, NULL_TOKENS, FileParsingError, FileValidationError,
    classify_status, normalize_cleaning_options, parse_file, stringify, validate_upload,
)
from app.data_profiling import (
    apply_outliers, charts, column_profiles, consistency_score, detect_outliers,
    quality_warnings, validity_score,
)


def clean_and_analyze(records: list[dict[str, str]], options: dict[str, Any] | None = None):
    cleaning = normalize_cleaning_options(options)
    original = len(records)
    columns = _columns(records)
    cleaned: list[dict[str, str]] = []
    seen: set[tuple[str, ...]] = set()
    duplicates = empty = dropped = trimmed = 0
    for record in records:
        row: dict[str, str] = {}
        for column in columns:
            raw = stringify(record.get(column, ''))
            value = raw.strip() if cleaning['trim_whitespace'] else raw
            trimmed += value != raw
            if value.casefold() in NULL_TOKENS:
                value = ''
            row[column] = _case(value, cleaning['case_normalization'])
        if cleaning['remove_empty_rows'] and not any(row.values()):
            empty += 1
            continue
        if cleaning['missing_strategy'] == 'drop_rows' and any(value == '' for value in row.values()):
            dropped += 1
            continue
        key = tuple(row[column] for column in columns)
        if cleaning['remove_duplicates'] and key in seen:
            duplicates += 1
            continue
        seen.add(key)
        cleaned.append(row)
    if cleaning['missing_strategy'] in {'fill_zero', 'fill_mode'} and cleaned:
        _fill_missing(cleaned, columns, cleaning['missing_strategy'])
    if cleaning['normalize_dates']:
        _normalize_dates(cleaned, columns)
    outliers = detect_outliers(cleaned, columns)
    if cleaning['outlier_action'] in {'remove', 'cap'} and outliers:
        cleaned = apply_outliers(cleaned, outliers, cleaning['outlier_action'])
        outliers = detect_outliers(cleaned, columns)
    status_column = next((name for name in columns if name in {'status', 'state', 'result'}), None)
    message_column = next((name for name in columns if name in {'message', 'description', 'details', 'raw_message'}), None)
    if status_column:
        for row in cleaned:
            row[status_column] = classify_status(row.get(status_column, ''), row.get(message_column or '', ''))
    profiles = column_profiles(cleaned, columns, outliers)
    missing = sum(item['missing_count'] for item in profiles)
    cells = max(len(cleaned) * max(len(columns), 1), 1)
    completeness = round(max(0.0, 100 * (1 - missing / cells)), 2)
    uniqueness = round(max(0.0, 100 * (1 - duplicates / max(original, 1))), 2)
    validity = round(validity_score(profiles), 2)
    consistency = round(consistency_score(cleaned, columns), 2)
    quality = round(completeness * .35 + uniqueness * .25 + validity * .2 + consistency * .2, 2)
    counts = Counter(row.get(status_column, 'Unknown') for row in cleaned) if status_column else Counter()
    metrics: dict[str, Any] = {
        'original_records': original, 'cleaned_records': len(cleaned), 'total_records': len(cleaned),
        'row_count': len(cleaned), 'column_count': len(columns), 'success_count': counts['Success'],
        'failed_count': counts['Failed'], 'warning_count': counts['Warning'],
        'unknown_count': counts['Unknown'] if status_column else 0, 'duplicates_removed': duplicates,
        'empty_rows_removed': empty, 'rows_dropped_missing': dropped, 'trimmed_values': trimmed,
        'invalid_records': 0, 'missing_values_count': missing,
        'outliers_detected': sum(item['count'] for item in outliers.values()),
        'completeness_score': completeness, 'uniqueness_score': uniqueness,
        'validity_score': validity, 'consistency_score': consistency, 'quality_score': quality,
        'column_profiles': profiles, 'cleaning_options': cleaning,
        'transformations_applied': _transformations(cleaning, duplicates, empty, dropped, trimmed),
        'warnings': quality_warnings(profiles, quality, outliers),
    }
    total = len(cleaned)
    for name, key in (('success', 'Success'), ('failed', 'Failed'), ('warning', 'Warning'), ('unknown', 'Unknown')):
        metrics[f'{name}_percentage'] = round(counts[key] / total * 100, 2) if status_column and total else 0.0
    return cleaned, metrics, charts(cleaned, profiles, status_column, counts, columns)


def _columns(records: list[dict[str, str]]) -> list[str]:
    result: list[str] = []
    for record in records:
        for column in record:
            if column not in result:
                result.append(column)
    return result


def _case(value: str, mode: str) -> str:
    return value.lower() if mode == 'lower' else value.upper() if mode == 'upper' else value.title() if mode == 'title' else value


def _fill_missing(rows: list[dict[str, str]], columns: list[str], strategy: str) -> None:
    modes = {column: Counter(row[column] for row in rows if row[column]).most_common(1)[0][0] if any(row[column] for row in rows) else '' for column in columns}
    for row in rows:
        for column in columns:
            if not row[column]:
                row[column] = '0' if strategy == 'fill_zero' else modes[column]


def _normalize_dates(rows: list[dict[str, str]], columns: list[str]) -> None:
    for column in columns:
        values = [row[column] for row in rows if row[column]][:50]
        if not values:
            continue
        parsed = pd.to_datetime(pd.Series(values), errors='coerce', utc=True, format='mixed')
        named = any(token in column for token in ('date', 'time', 'timestamp', 'created'))
        if not ((named and float(parsed.notna().mean()) >= .6) or float(parsed.notna().mean()) >= .9):
            continue
        for row in rows:
            if row[column]:
                value = pd.to_datetime(row[column], errors='coerce', utc=True, format='mixed')
                if not pd.isna(value):
                    row[column] = value.isoformat()


def _transformations(options: dict[str, Any], duplicates: int, empty: int, dropped: int, trimmed: int) -> list[str]:
    items: list[str] = []
    if trimmed: items.append(f'Trimmed whitespace in {trimmed} values')
    if duplicates: items.append(f'Removed {duplicates} duplicate rows')
    if empty: items.append(f'Removed {empty} empty rows')
    if dropped: items.append(f'Dropped {dropped} rows with missing values')
    if options['missing_strategy'] in {'fill_zero', 'fill_mode'}: items.append(f"Filled missing values using {options['missing_strategy'].replace('_', ' ')}")
    if options['normalize_dates']: items.append('Normalized detected date columns to ISO-8601')
    if options['outlier_action'] in {'remove', 'cap'}: items.append(f"Applied outlier action: {options['outlier_action']}")
    return items or ['Validated dataset structure; no destructive cleaning was required']


__all__ = ['FileParsingError', 'FileValidationError', 'clean_and_analyze', 'classify_status',
           'normalize_cleaning_options', 'parse_file', 'validate_upload', 'DEFAULT_CLEANING_OPTIONS']
