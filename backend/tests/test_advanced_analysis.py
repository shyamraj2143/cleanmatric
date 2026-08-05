import io
import json

from openpyxl import Workbook

from app.analysis_service import clean_and_analyze, parse_file, validate_upload
from app.report_service import build_pdf_report


def test_generic_csv_cleaning_and_quality_profile() -> None:
    content = b'Name,Age,City\n Asha ,20,Patna\nAsha,20,Patna\nRavi,,Delhi\n,,'
    filename, file_type = validate_upload('students.csv', content)
    assert file_type == 'csv'
    records = parse_file(filename, content)
    cleaned, metrics, charts = clean_and_analyze(records, {'remove_duplicates': True})
    assert cleaned == [
        {'name': 'Asha', 'age': '20', 'city': 'Patna'},
        {'name': 'Ravi', 'age': '', 'city': 'Delhi'},
    ]
    assert metrics['duplicates_removed'] == 1
    assert metrics['empty_rows_removed'] == 1
    assert metrics['column_count'] == 3
    assert 0 <= metrics['quality_score'] <= 100
    assert charts['missing_by_column'][1]['value'] == 1


def test_json_and_xlsx_parsing() -> None:
    json_records = parse_file('records.json', json.dumps([{'First Name': 'Asha', 'Score': 95}]).encode())
    assert json_records == [{'first_name': 'Asha', 'score': '95'}]

    workbook = Workbook()
    sheet = workbook.active
    sheet.append(['Name', 'Score'])
    sheet.append(['Ravi', 88])
    output = io.BytesIO()
    workbook.save(output)
    xlsx_records = parse_file('records.xlsx', output.getvalue())
    assert xlsx_records == [{'name': 'Ravi', 'score': '88'}]


def test_pdf_report_is_valid_pdf() -> None:
    analysis = {
        'analysis_id': 'test-id', 'filename': 'data.csv',
        'metrics': {
            'quality_score': 92, 'cleaned_records': 2, 'column_count': 2,
            'completeness_score': 100, 'duplicates_removed': 1, 'missing_values_count': 0,
            'validity_score': 96, 'outliers_detected': 0, 'empty_rows_removed': 0,
            'column_profiles': [{'name': 'name', 'inferred_type': 'text', 'missing_count': 0, 'missing_percentage': 0, 'unique_count': 2, 'outlier_count': 0, 'sample_values': ['Asha', 'Ravi']}],
            'warnings': [],
        },
    }
    assert build_pdf_report(analysis).startswith(b'%PDF')
