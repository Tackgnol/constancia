# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json .npmrc turbo.json tsconfig.base.json orval.config.ts ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
RUN npm ci

FROM deps AS build
RUN npx turbo run build --filter=@constancia/backend...

FROM build AS migrate
WORKDIR /app/packages/db
ENV NODE_ENV=production
CMD ["npm", "run", "db:deploy"]

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
RUN npm prune --omit=dev \
  && mkdir -p /app/data/uploads \
  && chown -R node:node /app
USER node
WORKDIR /app/apps/backend
CMD ["node", "dist/index.js"]
