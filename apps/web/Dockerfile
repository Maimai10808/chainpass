FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apk add --no-cache libc6-compat \
  && npm install --global pnpm@12.6.0 turbo@2.11.5

WORKDIR /app

FROM base AS pruner

COPY . .

RUN turbo prune web --docker

FROM base AS dependencies

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --trust-lockfile

FROM dependencies AS builder

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_AUTH_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_CHAIN_ID
ARG NEXT_PUBLIC_CHAINPASS_CONTRACT_ADDRESS
ARG NEXT_PUBLIC_REOWN_PROJECT_ID=""

ENV NODE_ENV="production"
ENV NEXT_TELEMETRY_DISABLED="1"
ENV NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL"
ENV NEXT_PUBLIC_AUTH_URL="$NEXT_PUBLIC_AUTH_URL"
ENV NEXT_PUBLIC_APP_URL="$NEXT_PUBLIC_APP_URL"
ENV NEXT_PUBLIC_CHAIN_ID="$NEXT_PUBLIC_CHAIN_ID"
ENV NEXT_PUBLIC_CHAINPASS_CONTRACT_ADDRESS="$NEXT_PUBLIC_CHAINPASS_CONTRACT_ADDRESS"
ENV NEXT_PUBLIC_REOWN_PROJECT_ID="$NEXT_PUBLIC_REOWN_PROJECT_ID"

COPY --from=pruner /app/out/full/ .

RUN test -n "$NEXT_PUBLIC_API_URL" \
  && test -n "$NEXT_PUBLIC_AUTH_URL" \
  && test -n "$NEXT_PUBLIC_APP_URL" \
  && test -n "$NEXT_PUBLIC_CHAIN_ID" \
  && test -n "$NEXT_PUBLIC_CHAINPASS_CONTRACT_ADDRESS" \
  && pnpm --filter web build

FROM node:24-alpine AS runner

ENV NODE_ENV="production"
ENV NEXT_TELEMETRY_DISABLED="1"
ENV HOSTNAME="0.0.0.0"
ENV PORT="3000"

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

WORKDIR /app

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "apps/web/server.js"]
