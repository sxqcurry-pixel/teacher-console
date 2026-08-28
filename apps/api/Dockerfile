# ==============================================================
# Teacher Console API — Production Dockerfile
# Railway build: root context, via railway.toml dockerfilePath
# ==============================================================
FROM node:20-alpine

RUN apk add --no-cache git curl python3 make gcc g++ libc6-compat tini openssl bash

# pnpm
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.6.2 --activate

WORKDIR /workspace

# Copy manifest first
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Install (allow lockfile drift on Railway — sometimes pnpm lock format differs)
RUN pnpm install --no-frozen-lockfile --ignore-scripts 2>&1

# Build shared lib
RUN pnpm --filter @spark/shared run build 2>&1 || echo "shared build fallback..." && cd packages/shared && npx tsc -p tsconfig.json 2>&1 || echo "shared skipped"

# Build API — use pnpm exec to ensure locked prisma version
WORKDIR /workspace/apps/api
RUN pnpm exec prisma generate 2>&1
RUN pnpm run build 2>&1

# Entrypoint
RUN printf '%s\n' \
    '#!/bin/bash' \
    'cd /workspace/apps/api' \
    'echo "[entrypoint] pushing schema..."' \
    'pnpm exec prisma db push --skip-generate' \
    'echo "[entrypoint] seed..."' \
    'pnpm db:seed || echo "seed skipped"' \
    'echo "[entrypoint] starting NestJS..."' \
    'exec node dist/main.js' \
    > entrypoint.sh && chmod +x entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/workspace/apps/api/entrypoint.sh"]
