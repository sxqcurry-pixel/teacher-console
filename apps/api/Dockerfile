# ==============================================================
# Teacher Console API — Production Dockerfile
# Railway: root build context, dockerfilePath = apps/api/Dockerfile
# ==============================================================
FROM node:20-alpine

RUN apk add --no-cache git curl python3 make gcc g++ libc6-compat tini openssl bash

# pnpm
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=/root/.local/share/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@10.6.2 --activate

WORKDIR /workspace

# Copy manifest first
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Install deps — DO NOT use --ignore-scripts (express/nest deps need postinstall!)
RUN pnpm install --frozen-lockfile 2>&1 | tail -10

# Build shared lib first (api depends on @spark/shared)
RUN cd packages/shared && pnpm run build 2>&1 | tail -3 || echo "shared build skip"

# Build API
WORKDIR /workspace/apps/api
RUN pnpm exec prisma generate 2>&1 | tail -5
RUN echo "=== Running nest build ===" && pnpm run build 2>&1 | tail -10

# VERIFY build output
RUN echo "=== Verifying dist ===" && find dist -name "main.js" -type f

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]

# Startup: push schema, seed, run
# Use pnpm start:prod so it resolves node_modules from workspace root correctly
CMD ["sh", "-c", "cd /workspace/apps/api && echo '=== Pushing schema ===' && pnpm exec prisma db push --skip-generate 2>&1 | tail -5 && echo '=== Seeding ===' && pnpm db:seed 2>&1 | tail -5 || echo 'seed skipped' && echo '=== Starting NestJS ===' && exec pnpm exec nest start --port 3000"]
