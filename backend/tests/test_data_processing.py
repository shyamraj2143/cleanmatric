import pytest

from app.data_processing import DataProcessingError, process_uploaded_data


def test_csv_processing_cleans_values_and_duplicates() -> None:
    result = process_uploaded_data(
        'metrics.csv',
        b' Name ,Score\n Asha , 90 \nAsha,90\n,\nRavi,\n',
    )

    assert result['columns'] == ['Name', 'Score']
    assert result['preview'] == [{'Name': 'Asha', 'Score': '90'}, {'Name': 'Ravi', 'Score': ''}]
    assert result['stats'] == {
        'total_rows': 4,
        'cleaned_rows': 2,
        'removed_blank_rows': 1,
        'removed_duplicate_rows': 1,
        'trimmed_values': 2,
        'missing_values': 1,
    }


def test_rejects_unsupported_files() -> None:
    with pytest.raises(DataProcessingError, match='Only CSV and TXT'):
        process_uploaded_data('metrics.xlsx', b'data')
