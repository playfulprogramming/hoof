# Base stage with Node.js and pnpm
FROM node:22-alpine AS base
RUN npm install -g pnpm@10.10.0
WORKDIR /app

# Dependencies stage - install all dependencies
FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY api/package.json api/
COPY worker/package.json worker/
RUN pnpm install --frozen-lockfile

# Builder stage - build both services
FROM deps AS builder
COPY . .
RUN pnpm -r run build

# Production stage - create minimal image
FROM node:22-alpine AS runner
RUN npm install -g pnpm@10.10.0
WORKDIR /app

# Copy production dependencies and built assets
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/api/node_modules ./api/node_modules
COPY --from=deps /app/worker/node_modules ./worker/node_modules
COPY --from=builder /app/api/dist ./api/dist
COPY --from=builder /app/worker/dist ./worker/dist

# Copy package files needed for production
COPY package.json pnpm-workspace.yaml ./
COPY api/package.json ./api/
COPY worker/package.json ./worker/

# Copy the entrypoint script
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

ENV NODE_ENV=production

# Use entrypoint script to determine which service to run
ENTRYPOINT ["./entrypoint.sh"]
