FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apk add --no-cache libc6-compat \
  && npm install --global pnpm@12.6.0 turbo@2.11.5

WORKDIR /app

FROM base AS migrate

COPY apps/api/prisma ./prisma
COPY apps/api/prisma7.config.ts ./prisma7.config.ts

RUN npm install --no-save prisma@7.10.0 dotenv@18.0.4

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 prisma \
  && chown -R prisma:nodejs /app

USER prisma

CMD ["./node_modules/.bin/prisma", "migrate", "deploy", "--config", "prisma7.config.ts"]

FROM base AS pruner

COPY . .

# Keep server packaging independent of Expo's hoisted development layout.
RUN pnpm config set nodeLinker isolated --location project \
  && turbo prune api --docker

FROM base AS dependencies

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --trust-lockfile

FROM dependencies AS builder

COPY --from=pruner /app/out/full/ .

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm --filter api exec prisma generate \
  && pnpm --filter api build \
  && pnpm --filter api deploy --prod --legacy --trust-lockfile --prefer-offline /prod/api

FROM node:24-alpine AS runner

ENV NODE_ENV="production"
ENV PORT="3001"

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nestjs

WORKDIR /app

COPY --from=builder --chown=nestjs:nodejs /prod/api ./
COPY --from=builder --chown=nestjs:nodejs /app/packages/schemas ./packages/schemas
COPY --from=builder --chown=nestjs:nodejs /app/packages/web3 ./packages/web3

# Node does not type-strip TypeScript below node_modules. Point the two runtime
# workspace packages at their copied source outside node_modules instead.
RUN unlink node_modules/@chainpass/schemas \
  && unlink node_modules/@chainpass/web3 \
  && ln -s ../../packages/schemas node_modules/@chainpass/schemas \
  && ln -s ../../packages/web3 node_modules/@chainpass/web3

USER nestjs

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "dist/main.js"]
