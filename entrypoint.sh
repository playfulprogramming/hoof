#!/bin/sh

set -e

# Execute command-line arguments (if any)
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

# Determine which process to start based on PROCESS_TYPE
if [ "$PROCESS_TYPE" = "worker" ]; then
  echo "Starting Worker process..."
  exec pnpm --filter worker start
else
  echo "Starting API process..."
  exec pnpm --filter api start
fi