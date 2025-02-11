# Hoof

Backend services for Playful Programming's content management system.

## Overview

This monorepo contains two services:

- **API**: REST API built with Fastify
- **Worker**: Background task processor using BullMQ

## Prerequisites

- Node.js 22 LTS
- Docker
- pnpm 9.15.0

## Quick Start

Install pnpm and project dependencies:

```bash
# Install pnpm globally
npm install -g pnpm@9.15.0

# Install project dependencies
pnpm install
```

Set up your environment:

```bash
cp .env.example .env
```

Start the services:

```bash
# Terminal 1: API
cd api && pnpm run dev

# Terminal 2: Worker
cd worker && pnpm run dev
```

## Project Structure

```text
/hoof
├── api                 # Fastify REST API
│   ├── src             # API source code
│   │   ├── plugins     # Fastify plugins
│   │   └── routes      # API endpoints
│   └── package.json
├── worker              # Background processing service
│   ├── src
│   │   └── url-metadata # URL metadata extraction
│   └── package.json
├── pnpm-workspace.yaml # Workspace configuration
├── Dockerfile          # Multi-stage build for both services
└── entrypoint.sh       # Service selector script
```

## Development

This project uses pnpm workspaces. The workspace configuration:

```yaml
# filepath: /home/phaseon/src/hoof/pnpm-workspace.yaml
packages:
  - "api"
  - "worker"
```

### Available Scripts

API service:
```bash
cd api
pnpm run dev    # Start development server
pnpm run test   # Run tests
pnpm run build  # Build for production
```

Worker service:
```bash
cd worker
pnpm run dev    # Start development worker
pnpm run build  # Build for production
```

## Deployment

The project uses a multi-stage Dockerfile that builds both services. The entrypoint script determines which service to run based on the `PROCESS_TYPE` environment variable.

Deploy to Fly.io:

```bash
fly deploy
```

Process groups are configured in `fly.toml` to run API and Worker as separate processes each in their own VM:

```toml
# filepath: /home/phaseon/src/hoof/fly.toml
[processes]
  api = "pnpm --filter api start"
  worker = "pnpm --filter worker start"
```

## Environment Variables

Key variables needed in `.env`:

```bash
# Redis (for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# Storage
S3_BUCKET=hoof-storage
S3_PUBLIC_URL=https://fly.storage.tigris.dev

# Database
POSTGRES_URL=postgresql://localhost:5432/hoof
```