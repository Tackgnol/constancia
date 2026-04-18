FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json .npmrc turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci

ARG WORKSPACE
ENV WORKSPACE=${WORKSPACE}

WORKDIR /app/${WORKSPACE}
