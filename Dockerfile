# syntax=docker/dockerfile:1.7-labs
FROM node:24-alpine3.22 AS base

# Install postgres client dependencies
RUN apk --update add make g++ python3 libpq libpq-dev parallel

# Create app directory
ENV NODE_ENV=production
WORKDIR /var/app

# Prepare pnpm according to the root package.json
COPY package.json .
RUN corepack enable
RUN corepack install

# Install dependencies with pnpm
COPY pnpm-lock.yaml pnpm-workspace.yaml .
COPY --parents apps/*/package.json .
COPY --parents packages/*/package.json .
RUN pnpm install

# Copy & build the app
COPY . .
RUN pnpm build:all

CMD [ "/bin/sh", "-c", "parallel --jobs 2 --line-buffer --halt now,done=1 node --experimental-strip-types {} ::: apps/api/src/index.ts apps/worker/src/index.ts" ]
