#!/bin/bash
set -e

echo "Building AgentOS Studio for production..."

# Build frontend
cd apps/web
pnpm build
cd ../..

# Build backend Docker image
cd apps/api
docker build -t agentos/api:latest .
cd ../..

# Build worker Docker image
cd apps/workers
docker build -t agentos/workers:latest .
cd ../..

echo "Build complete!"
