# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json .npmrc turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm ci

FROM deps AS build
RUN npx turbo run build --filter=@constancia/frontend...

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
RUN npm prune --omit=dev \
  && chown -R node:node /app
USER node
WORKDIR /app/apps/frontend
CMD ["npm", "run", "start"]
