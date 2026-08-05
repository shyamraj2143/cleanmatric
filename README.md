# CleanMetric

CleanMetric is a full-stack data quality workspace for cleaning, profiling, visualising, exporting, and tracking structured datasets.

## What it does

- Imports CSV, TSV, Excel, JSON, TXT, and LOG files up to 20 MB.
- Normalises column names, trims values, removes empty/duplicate rows, and applies configurable missing-value, casing, date, and outlier rules.
- Produces completeness, uniqueness, validity, consistency, and overall quality scores.
- Detects missing values, duplicate rows, inferred data types, category distributions, numeric summaries, and IQR outliers.
- Stores analysis history per authenticated user in SQLite.
- Provides dashboards for volume, quality, issues, trends, and file-type distribution.
- Exports cleaned data as CSV, XLSX, or JSON and creates a PDF data-quality report.
- Supports searchable, paginated cleaned-record previews and an auditable cleaning summary.

## Stack

- Backend: FastAPI, Pandas, SQLite, OpenPyXL, ReportLab
- Frontend: React, Vite, React Router, Recharts
- Authentication: email/password and optional Google Identity

## Run locally

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
export JWT_SECRET="replace-with-a-long-random-secret"
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm ci
cp .env.example .env 2>/dev/null || true
npm run dev
```

Set `VITE_API_BASE_URL=http://127.0.0.1:8000` when the backend runs locally.

## Important environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | SQLite URL | `sqlite:///./metricflow.db` |
| `JWT_SECRET` | Token-signing secret; required in production | generated only outside production |
| `ALLOWED_ORIGIN` | Comma-separated frontend origins | `http://localhost:3000` |
| `GOOGLE_WEB_CLIENT_ID` | Optional Google sign-in client ID | unset |
| `VITE_API_BASE_URL` | Frontend API URL | `http://127.0.0.1:8000` |

For Railway frontend deployments, set these service variables:

- `VITE_API_BASE_URL`: your Railway backend URL, for example `https://amusing-renewal-production.up.railway.app`
- `VITE_GOOGLE_WEB_CLIENT_ID`: your Google OAuth Web client ID

For Railway backend deployments, set:

- `JWT_SECRET`
- `ALLOWED_ORIGIN`: your frontend domain, for example `https://cleanmatric.site`
- `GOOGLE_WEB_CLIENT_ID`: the same Google OAuth Web client ID

## API highlights

- `POST /api/v1/files/analyze` — upload and clean a dataset; optional multipart `cleaning_config` JSON.
- `GET /api/v1/analyses` — paginated analysis history.
- `GET /api/v1/analyses/{id}/records` — searchable, paginated cleaned records.
- `GET /api/v1/analyses/{id}/export/{csv|xlsx|json|pdf}` — exports.
- `GET /api/v1/dashboard/summary` and related dashboard endpoints.
- `GET /health` — service health.

Interactive API documentation is available at `/docs` while the backend is running.

## Validation

```bash
cd backend && pytest -q
cd frontend && npm test && npm run build
```

Never commit `.env`, database files, access tokens, or production secrets.
