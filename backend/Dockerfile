# syntax=docker/dockerfile:1.7

FROM python:3.12-slim-bookworm AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /build

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt ./requirements.txt
RUN pip install --upgrade pip setuptools wheel \
    && pip install --requirement requirements.txt


FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PATH="/opt/venv/bin:$PATH" \
    NODE_ENV=production \
    PORT=8080 \
    DATABASE_URL="sqlite:////data/metricflow.db"

RUN apt-get update \
    && apt-get install --yes --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 cleanmetric \
    && useradd --uid 10001 --gid cleanmetric --create-home --shell /usr/sbin/nologin cleanmetric \
    && mkdir --parents /app /data \
    && chown --recursive cleanmetric:cleanmetric /app /data \
    && printf '%s\n' \
        '#!/bin/sh' \
        'set -eu' \
        'umask 027' \
        'if [ "$(id -u)" = "0" ]; then' \
        '  mkdir -p /data' \
        '  chown -R cleanmetric:cleanmetric /data' \
        '  exec gosu cleanmetric "$@"' \
        'fi' \
        'exec "$@"' \
        > /usr/local/bin/docker-entrypoint.sh \
    && chmod 0755 /usr/local/bin/docker-entrypoint.sh

WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
COPY --chown=cleanmetric:cleanmetric app ./app

EXPOSE 8080

STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.getenv('PORT', '8080') + '/health', timeout=3).read()" || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1 --proxy-headers --forwarded-allow-ips='*' --timeout-keep-alive 75 --no-server-header"]
