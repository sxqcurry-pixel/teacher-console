# ---------- Installer stage ----------
FROM node:20-alpine AS installer
WORKDIR /workspace
RUN apk add --no-cache git curl python3 make gcc g++ libc6-compat

ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.6.2 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Install the whole workspace so Next can resolve @spark/shared during build
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# ---------- Builder (Next standalone build) ----------
FROM installer AS builder
WORKDIR /workspace
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm --filter web run build

# ---------- Runner ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache tini curl libc6-compat

# Next standalone output lives under .next/standalone
COPY --from=builder /workspace/apps/web/public ./apps/web/public
COPY --from=builder /workspace/apps/web/.next/standalone ./
COPY --from=builder /workspace/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENTRYPOINT ["/sbin/tini", "--"]
# Next standalone creates a server.js at the app root (./apps/web/server.js) for App Router
CMD ["node", "apps/web/server.js"]
