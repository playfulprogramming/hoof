# syntax=docker/dockerfile:1.7-labs
FROM node:26.8-alpine3.24 AS base

# Install postgres client dependencies
RUN apk --update add make g++ python3 libpq libpq-dev parallel openssl

# Create app directory
ENV NODE_ENV=production
WORKDIR /var/app

# Prepare pnpm according to the root package.json
COPY package.json .
ENV PNPM_HOME=/pnpm PATH="/pnpm/bin:$PATH"
RUN wget -qO /tmp/pnpm-install.sh https://get.pnpm.io/install.sh \
    && echo "44dfbba11a70a9751090894a07f8d64c9f7954cb782dfe39a1f2b2753e1d5eea  /tmp/pnpm-install.sh" | sha256sum -c - \
    && env ENV="$HOME/.shrc" SHELL=/bin/sh sh /tmp/pnpm-install.sh \
    && rm /tmp/pnpm-install.sh

# Install dependencies with pnpm
COPY pnpm-lock.yaml pnpm-workspace.yaml .
COPY --parents apps/*/package.json .
COPY --parents packages/*/package.json .
RUN pnpm install

# Copy & build the app
COPY . .
RUN pnpm build:all

CMD [ "/bin/sh", "-c", "parallel --jobs 2 --line-buffer --halt now,done=1 node --experimental-strip-types {} ::: apps/api/src/index.ts apps/worker/src/index.ts" ]
