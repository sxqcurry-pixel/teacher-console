# ---------- Installer stage ----------
FROM node:20-alpine AS installer
WORKDIR /workspace
RUN apk add --no-cache git curl python3 make gcc g++ libc6-compat

# Install pnpm globally via corepack (matches root packageManager field)
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.6.2 --activate

# Copy monorepo workspace manifest
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Fetch dependencies, then build shared and api only
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts \
    && pnpm --filter @spark/shared run build || pnpm --filter @spark/shared run tsc -p tsconfig.json \
    && pnpm --filter @spark/shared run build 2>/dev/null || true

# ---------- Prisma generator stage (needs prisma schema) ----------
FROM installer AS prisma-gen
WORKDIR /workspace/apps/api
# Generate Prisma Client for Alpine musl (this runs `prisma generate`)
RUN pnpm prisma generate

# ---------- Builder stage (turbo build api) ----------
FROM installer AS builder
WORKDIR /workspace
# Pre-populate Prisma Client generated in prisma-gen
COPY --from=prisma-gen /workspace/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma
COPY --from=prisma-gen /workspace/apps/api/node_modules/@prisma ./apps/api/node_modules/@prisma

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm --filter @spark/shared run build 2>/dev/null || pnpm --filter @spark/shared exec tsc -p tsconfig.json --outDir dist || true \
    && pnpm --filter api run build

# ---------- Runner ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.6.2 --activate \
    && apk add --no-cache tini curl libc6-compat openssl

# Minimal packages needed at runtime
COPY --from=builder /workspace/package.json /workspace/pnpm-workspace.yaml ./
COPY --from=builder /workspace/packages/shared ./packages/shared
COPY --from=builder /workspace/apps/api ./apps/api
COPY --from=builder /workspace/node_modules ./node_modules

# Prisma schema + migrations + generated client
COPY --from=prisma-gen /workspace/apps/api/prisma ./apps/api/prisma
COPY --from=prisma-gen /workspace/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma
COPY --from=prisma-gen /workspace/apps/api/node_modules/@prisma ./apps/api/node_modules/@prisma

WORKDIR /app/apps/api
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --prod --ignore-scripts --frozen-lockfile 2>/dev/null || true

# --------------------------------------------------------------------------
# 启动流程（entrypoint.sh）：
#   1. prisma migrate deploy   —— 从 prisma/migrations 建表/升级（幂等）
#   2. tsx prisma/seed.ts       —— 灌 demo teacher（存在即跳过）
#   3. node dist/main.js        —— NestJS 启动监听 PORT
# --------------------------------------------------------------------------
RUN printf '%s\n' \
    '#!/bin/sh' \
    'set -e' \
    'echo "[entrypoint] pushing schema to database (prisma db push)..."' \
    'pnpm prisma db push --skip-generate' \
    'echo "[entrypoint] running seed..."' \
    'pnpm db:seed || echo "[entrypoint] seed skipped"' \
    'echo "[entrypoint] starting NestJS..."' \
    'exec node dist/main.js' \
    > /app/apps/api/entrypoint.sh \
    && chmod +x /app/apps/api/entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/app/apps/api/entrypoint.sh"]
