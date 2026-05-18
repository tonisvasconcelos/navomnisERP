# Imagem partilhada: API HTTP (main) ou worker BullMQ (worker.main).
# Build: docker build -t navomnis-api .
# Run API: docker run -e DATABASE_URL=... -e REDIS_URL=... -e PROCESS_ROLE=api ... navomnis-api
# Run worker: docker run ... -e PROCESS_ROLE=worker ... navomnis-api node apps/api/dist/worker.main.js

FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY apps/api/prisma apps/api/prisma
COPY packages/config packages/config
COPY packages/i18n packages/i18n
COPY packages/ui packages/ui

RUN pnpm install --frozen-lockfile

COPY apps/api apps/api

RUN pnpm exec turbo build --filter=@navomnis/api

ENV NODE_ENV=production
WORKDIR /app

# Prisma client gerado no postinstall; migrar em release (Railway) com migrate:deploy.
CMD ["node", "apps/api/dist/main.js"]
