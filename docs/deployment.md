# Deployment Guide

## Prerequisites

- Docker & Docker Compose
- Node.js 20+
- Python 3.11+
- PostgreSQL 16
- Redis 7
- Qdrant

## Quick Start (Docker Compose)

```bash
# Clone the repository
git clone https://github.com/patil-shubham-dev/AgentOS-Studio.git
cd AgentOS-Studio

# Copy environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Add your API keys to apps/api/.env
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...

# Start all services
docker-compose up -d

# Access the application
# Frontend: http://localhost:3000
# API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

## Manual Setup

### 1. Database Setup

```bash
# Start PostgreSQL
docker run -d --name agentos-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=agentos \
  -p 5432:5432 \
  postgres:16-alpine

# Start Redis
docker run -d --name agentos-redis \
  -p 6379:6379 \
  redis:7-alpine

# Start Qdrant
docker run -d --name agentos-qdrant \
  -p 6333:6333 \
  qdrant/qdrant:latest
```

### 2. Backend Setup

```bash
cd apps/api

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start server
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Worker Setup

```bash
cd apps/workers

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start Celery worker
celery -A src.celery_app worker --loglevel=info
```

### 4. Frontend Setup

```bash
cd apps/web

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Production Deployment

### Kubernetes

```bash
# Apply manifests
kubectl apply -f infra/kubernetes/

# Or use Helm
helm install agentos ./infra/helm
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `JWT_SECRET` | Secret for JWT signing | Yes |
| `OPENAI_API_KEY` | OpenAI API key | No |
| `ANTHROPIC_API_KEY` | Anthropic API key | No |
| `GROQ_API_KEY` | Groq API key | No |
| `OPEN_DESIGN_API_KEY` | Open Design API key | No |

## SSL/TLS

For production, use a reverse proxy like Nginx or Traefik:

```nginx
server {
    listen 443 ssl;
    server_name agentos.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
    }

    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Monitoring

Prometheus metrics available at `/metrics`:

```bash
# Scrape configuration
scrape_configs:
  - job_name: 'agentos-api'
    static_configs:
      - targets: ['api:8000']
```

## Backup

```bash
# Database backup
docker exec agentos-postgres pg_dump -U postgres agentos > backup.sql

# Restore
docker exec -i agentos-postgres psql -U postgres agentos < backup.sql
```
