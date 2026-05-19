#!/bin/bash

# Start all services in development mode

echo "Starting AgentOS Studio development environment..."

# Start backend
cd apps/api
source .venv/bin/activate
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000 &
API_PID=$!
cd ../..

# Start workers
cd apps/workers
source .venv/bin/activate
celery -A src.celery_app worker --loglevel=info &
WORKER_PID=$!
cd ../..

# Start frontend
cd apps/web
pnpm dev &
WEB_PID=$!
cd ../..

echo "All services started!"
echo "Frontend: http://localhost:3000"
echo "API: http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap "kill $API_PID $WORKER_PID $WEB_PID; exit" INT
wait
