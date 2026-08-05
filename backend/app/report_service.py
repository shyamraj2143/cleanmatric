import io
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def build_pdf_report(analysis: dict[str, Any]) -> bytes:
    output = io.BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=landscape(A4),
        rightMargin=14 * mm,
        leftMargin=14 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
        title=f"CleanMetric report - {analysis.get('filename', 'dataset')}",
        author='CleanMetric',
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='ReportTitle', parent=styles['Title'], alignment=TA_CENTER, textColor=colors.HexColor('#12372A')))
    styles.add(ParagraphStyle(name='Small', parent=styles['BodyText'], fontSize=8, leading=10))
    story = [
        Paragraph('CleanMetric Data Quality Report', styles['ReportTitle']),
        Paragraph(f"Dataset: {analysis.get('filename', 'Unknown')} &nbsp;&nbsp; | &nbsp;&nbsp; Analysis ID: {analysis.get('analysis_id', '—')}", styles['BodyText']),
        Spacer(1, 8),
    ]

    metrics = analysis.get('metrics', {})
    metric_rows = [
        ['Quality score', f"{metrics.get('quality_score', 0)}%", 'Rows', metrics.get('cleaned_records', 0), 'Columns', metrics.get('column_count', 0)],
        ['Completeness', f"{metrics.get('completeness_score', 0)}%", 'Duplicates removed', metrics.get('duplicates_removed', 0), 'Missing values', metrics.get('missing_values_count', 0)],
        ['Validity', f"{metrics.get('validity_score', 0)}%", 'Outliers detected', metrics.get('outliers_detected', 0), 'Empty rows removed', metrics.get('empty_rows_removed', 0)],
    ]
    summary_table = Table(metric_rows, colWidths=[34 * mm, 24 * mm, 38 * mm, 24 * mm, 38 * mm, 25 * mm])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F3F8F5')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#B9D4C7')),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#D7E6DE')),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTNAME', (4, 0), (4, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.extend([summary_table, Spacer(1, 10), Paragraph('Column profile', styles['Heading2'])])

    profile_rows = [['Column', 'Type', 'Missing', 'Unique', 'Outliers', 'Sample values']]
    for profile in metrics.get('column_profiles', [])[:60]:
        samples = ', '.join(str(value)[:24] for value in profile.get('sample_values', []))
        profile_rows.append([
            Paragraph(str(profile.get('name', '')), styles['Small']),
            profile.get('inferred_type', ''),
            f"{profile.get('missing_count', 0)} ({profile.get('missing_percentage', 0)}%)",
            profile.get('unique_count', 0),
            profile.get('outlier_count', 0),
            Paragraph(samples or '—', styles['Small']),
        ])
    profile_table = Table(profile_rows, repeatRows=1, colWidths=[45 * mm, 25 * mm, 32 * mm, 25 * mm, 24 * mm, 92 * mm])
    profile_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#12372A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#C9D8D0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F7FAF8')]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(profile_table)

    warnings = metrics.get('warnings') or []
    if warnings:
        story.extend([Spacer(1, 10), Paragraph('Quality warnings', styles['Heading2'])])
        for warning in warnings:
            story.append(Paragraph(f'• {warning}', styles['BodyText']))

    document.build(story)
    return output.getvalue()
