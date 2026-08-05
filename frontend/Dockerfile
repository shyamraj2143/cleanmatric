# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS build

ENV NODE_ENV=development \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build


FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    VITE_USE_API_PROXY=true \
    API_PROXY_TARGET=http://amusing-renewal.railway.internal:8080,http://amusing-renewal:8080,https://amusing-renewal-production.up.railway.app \
    VITE_GOOGLE_WEB_CLIENT_ID=776507506876-vjrrc9m5eer82k6digta7ie2phd4l1f8.apps.googleusercontent.com

RUN addgroup -S metricflow && adduser -S -G metricflow metricflow

WORKDIR /app

COPY --from=build --chown=metricflow:metricflow /app/dist ./dist
COPY --chown=metricflow:metricflow server.mjs ./server.mjs

USER metricflow

EXPOSE 3000

STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "server.mjs"]
