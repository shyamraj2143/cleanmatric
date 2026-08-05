# Security Policy

CleanMetric processes uploaded datasets and authenticated user information, so security reports should be handled carefully.

## Reporting a vulnerability

Do not publish sensitive vulnerability details, credentials, tokens, private datasets, or exploit steps in a public issue.

Instead, contact the repository owner privately through the GitHub profile associated with this repository. Include:

- A clear description of the issue.
- The affected route, component, or workflow.
- Reproduction steps using non-sensitive sample data.
- Potential impact.
- A suggested mitigation, when available.

## Sensitive information

Never commit or share:

- `.env` files or production environment values.
- JWT secrets, OAuth credentials, API keys, or access tokens.
- Production databases or database backups.
- Personal, financial, medical, academic, or otherwise confidential datasets.
- Logs containing credentials or private records.

## Supported version

Security fixes are applied to the current `main` branch. Older snapshots are not maintained as separate supported releases unless explicitly documented.
