#!/bin/bash
set -e

echo "Setting up AgentOS Studio..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is recommended but not installed." >&2; }

# Install pnpm if not present
if ! command -v pnpm &> /dev/null; then
    echo "Installing pnpm..."
    npm install -g pnpm
fi

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd apps/web
pnpm install
cd ../..

# Install backend dependencies
echo "Installing backend dependencies..."
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ../..

# Install worker dependencies
echo "Installing worker dependencies..."
cd apps/workers
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ../..

# Setup environment files
echo "Setting up environment files..."
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env

echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add your API keys to apps/api/.env"
echo "2. Start PostgreSQL, Redis, and Qdrant (or use Docker Compose)"
echo "3. Run: pnpm dev"
