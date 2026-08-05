import re
from collections import Counter
from typing import Any

import pandas as pd


def infer_type(values: list[str]) -> str:
    non_empty = [value for value in values if value != '']
    if not non_empty:
        return 'empty'
    lowered = {value.casefold() for value in non_empty}
    if lowered <= {'true', 'false', 'yes', 'no', '0', '1'}:
        return 'boolean'
    numeric = pd.to_numeric(pd.Series(non_empty), errors='coerce')
    if float(numeric.notna().mean()) >= 0.95:
        return 'integer' if all(float(value).is_integer() for value in numeric.dropna()) else 'number'
    dates = pd.to_datetime(pd.Series(non_empty), errors='coerce', utc=True, format='mixed')
    if float(dates.notna().mean()) >= 0.9:
        return 'datetime'
    unique_ratio = len(set(non_empty)) / len(non_empty)
    return 'category' if len(set(non_empty)) <= 30 and unique_ratio <= 0.5 else 'text'


def detect_outliers(rows: list[dict[str, str]], columns: list[str]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for column in columns:
        values = [row[column] for row in rows]
        if infer_type(values) not in {'integer', 'number'}:
            continue
        series = pd.to_numeric(pd.Series(values), errors='coerce').dropna()
        if len(series) < 4:
            continue
        q1, q3 = float(series.quantile(.25)), float(series.quantile(.75))
        iqr = q3 - q1
        if not iqr:
            continue
        lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        count = int(((series < lower) | (series > upper)).sum())
        if count:
            result[column] = {'count': count, 'lower': lower, 'upper': upper}
    return result


def apply_outliers(rows: list[dict[str, str]], details: dict[str, dict[str, Any]], action: str) -> list[dict[str, str]]:
    result: list[dict[str, str]] = []
    for row in rows:
        updated, remove = row.copy(), False
        for column, bounds in details.items():
            try:
                value = float(row[column])
            except (TypeError, ValueError):
                continue
            outside = value < bounds['lower'] or value > bounds['upper']
            if outside and action == 'remove':
                remove = True
                break
            if outside and action == 'cap':
                capped = min(max(value, bounds['lower']), bounds['upper'])
                updated[column] = str(int(capped)) if capped.is_integer() else f'{capped:.6g}'
        if not remove:
            result.append(updated)
    return result


def column_profiles(rows: list[dict[str, str]], columns: list[str], outliers: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    profiles: list[dict[str, Any]] = []
    for column in columns:
        values = [row.get(column, '') for row in rows]
        non_empty = [value for value in values if value != '']
        inferred = infer_type(values)
        profile: dict[str, Any] = {
            'name': column, 'inferred_type': inferred,
            'missing_count': len(values) - len(non_empty),
            'missing_percentage': round((len(values) - len(non_empty)) / max(len(values), 1) * 100, 2),
            'unique_count': len(set(non_empty)),
            'unique_percentage': round(len(set(non_empty)) / max(len(non_empty), 1) * 100, 2),
            'outlier_count': outliers.get(column, {}).get('count', 0), 'sample_values': non_empty[:3],
        }
        if inferred in {'integer', 'number'} and non_empty:
            numeric = pd.to_numeric(pd.Series(non_empty), errors='coerce').dropna()
            if not numeric.empty:
                profile.update(min=round(float(numeric.min()), 4), max=round(float(numeric.max()), 4),
                               mean=round(float(numeric.mean()), 4), median=round(float(numeric.median()), 4))
        elif non_empty:
            lengths = [len(value) for value in non_empty]
            profile.update(min_length=min(lengths), max_length=max(lengths), average_length=round(sum(lengths) / len(lengths), 2))
        profiles.append(profile)
    return profiles


def validity_score(profiles: list[dict[str, Any]]) -> float:
    if not profiles:
        return 100.0
    penalties = [min(100.0, item['missing_percentage'] + item['outlier_count'] * 2) for item in profiles]
    return max(0.0, 100.0 - sum(penalties) / len(penalties))


def consistency_score(rows: list[dict[str, str]], columns: list[str]) -> float:
    if not rows or not columns:
        return 100.0
    return sum(infer_type([row[column] for row in rows]) != 'empty' for column in columns) / len(columns) * 100


def quality_warnings(profiles: list[dict[str, Any]], score: float, outliers: dict[str, dict[str, Any]]) -> list[str]:
    warnings: list[str] = []
    if score < 60:
        warnings.append('Overall data quality is low. Review missing values and inconsistent columns.')
    warnings.extend(f"Column '{item['name']}' has {item['missing_percentage']}% missing values."
                    for item in profiles if item['missing_percentage'] >= 30)
    warnings.extend(f"Column '{column}' contains {detail['count']} potential outliers."
                    for column, detail in outliers.items())
    return warnings[:12]


def charts(rows: list[dict[str, str]], profiles: list[dict[str, Any]], status_column: str | None,
           status_counts: Counter[str], columns: list[str]) -> dict[str, list[dict[str, Any]]]:
    service = next((name for name in columns if name in {'service', 'source', 'application'}), None)
    timeline = next((name for name in columns if name in {'timestamp', 'date', 'time', 'created_at'}), None)
    categories: list[dict[str, Any]] = []
    for profile in profiles:
        if profile['inferred_type'] == 'category':
            counts = Counter(row.get(profile['name'], '') for row in rows if row.get(profile['name'], ''))
            categories += [{'column': profile['name'], 'name': name, 'value': value} for name, value in counts.most_common(5)]
    dates = Counter(row.get(timeline, '')[:10] for row in rows if timeline and re.match(r'^\d{4}-\d{2}-\d{2}', row.get(timeline, '')))
    return {
        'status_distribution': [{'name': name, 'value': status_counts[name]} for name in ('Success', 'Failed', 'Warning', 'Unknown')] if status_column else [],
        'missing_by_column': [{'name': item['name'], 'value': item['missing_count']} for item in profiles],
        'type_distribution': [{'name': name, 'value': value} for name, value in Counter(item['inferred_type'] for item in profiles).items()],
        'top_categories': categories[:20],
        'numeric_overview': [{'name': item['name'], 'min': item.get('min'), 'max': item.get('max'), 'mean': item.get('mean')} for item in profiles if item['inferred_type'] in {'integer', 'number'}],
        'service_distribution': [{'name': name, 'value': value} for name, value in Counter(row.get(service, '') or 'Unknown' for row in rows).most_common(20)] if service else [],
        'timeline_distribution': [{'name': name, 'value': value} for name, value in sorted(dates.items())],
    }
