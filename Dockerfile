# syntax=docker/dockerfile:1.7-labs
FROM node:26.8-alpine3.24 AS base

# Install postgres client dependencies
RUN apk --update add make g++ python3 libpq libpq-dev parallel

# Create app directory
ENV NODE_ENV=production
WORKDIR /var/app

# Prepare pnpm according to the root package.json
COPY --parents package.json pnpm-installer .
ENV PNPM_HOME=/pnpm PATH="/pnpm/bin:$PATH"
RUN npm ci --prefix=pnpm-installer && env \
    ENV="$HOME/.shrc" \
    SHELL=/bin/sh \
    PNPM_VERSION=$(node -p '/@([^\+]+)\+/.exec(require("./package.json").packageManager)[1]') \
    node pnpm-installer/node_modules/.bin/get-pnpm

# Install dependencies with pnpm
COPY pnpm-lock.yaml pnpm-workspace.yaml .
COPY --parents apps/*/package.json .
COPY --parents packages/*/package.json .
RUN pnpm install

# Copy the app
COPY . .

CMD [ "/bin/sh", "-c", "parallel --jobs 2 --line-buffer --halt now,done=1 node {} ::: apps/api/src/index.ts apps/worker/src/index.ts" ]
