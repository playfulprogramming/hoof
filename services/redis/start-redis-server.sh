#!/bin/sh

set -e

sysctl vm.overcommit_memory=1 || true
sysctl net.core.somaxconn=1024 || true

: ${MAXMEMORY_POLICY:="noeviction"}
: ${APPENDONLY:="no"}
: ${FLY_VM_MEMORY_MB:=256}
: ${SAVE:="3600 1 300 100 60 10000"}

# Set maxmemory to 10% of available memory
MAXMEMORY=$(($FLY_VM_MEMORY_MB*90/100))

redis-server \
  --requirepass $REDIS_PASSWORD \
  --dir /data/ \
  --maxmemory "${MAXMEMORY}mb" \
  --maxmemory-policy $MAXMEMORY_POLICY \
  --appendonly $APPENDONLY \
  --save "$SAVE"
