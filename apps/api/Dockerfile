# ==============================================================
# Teacher Console API — Production Dockerfile
# Build: Railway (build context = repo root, via railway.toml)
# Run:   port exposed by Railway $PORT env var
# ==============================================================
FROM node:20-alpine

# --- System deps ---
RUN apk add --no-cache git curl python3 make gcc g++ libc6-compat tini openssl bash

# --- pnpm ---
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.6.2 --activate

# --- Workspace ---
WORKDIR /workspace

# Copy monorepo manifest first (better layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# --- Install + build ---
RUN pnpm install --frozen-lockfile --ignore-scripts 2>&1 \
    && cd packages/shared && pnpm run build 2>/dev/null || (cd /workspace/packages/shared && npx tsc -p tsconfig.json --outDir dist 2>&1 || echo "shared build skipped") \
    && cd /workspace \
    && cd apps/api \
    && npx prisma generate 2>&1 \
    && pnpm run build 2>&1

# --- Entrypoint ---
WORKDIR /workspace/apps/api
RUN printf '%s\n' \
    '#!/bin/bash' \
    'echo "[entrypoint] pushing schema (prisma db push)..."' \
    'npx prisma db push --skip-generate' \
    'echo "[entrypoint] seed..."' \
    'pnpm db:seed || echo "seed skipped"' \
    'echo "[entrypoint] starting NestJS..."' \
    'exec node dist/main.js' \
    > entrypoint.sh && chmod +x entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/workspace/apps/api/entrypoint.sh"]
