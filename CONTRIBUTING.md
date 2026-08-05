# Contributing to CleanMetric

Thanks for helping improve CleanMetric. This repository values small, reviewable changes, clear reasoning, and reliable validation.

## Before opening a change

1. Search existing issues and pull requests.
2. Describe the data-quality problem or user impact clearly.
3. Keep unrelated refactors out of the same change.
4. Never commit secrets, `.env` files, database files, access tokens, or private datasets.

## Local validation

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
pytest -q
```

### Frontend

```bash
cd frontend
npm ci
npm test
npm run build
```

## Pull request standard

A strong pull request should include:

- A focused title that states the outcome.
- A concise explanation of the problem and solution.
- Screenshots for visible UI changes.
- Tests or validation notes for behavior changes.
- Confirmation that no secrets or personal datasets are included.

## Commit style

Use short, action-oriented commit messages:

```text
feat: add duplicate-resolution controls
fix: preserve analysis history after refresh
docs: improve deployment instructions
test: cover invalid spreadsheet uploads
```

## Review expectations

Reviewers may request changes for security, data integrity, accessibility, performance, maintainability, or incomplete validation. Keep discussion technical and respectful.
