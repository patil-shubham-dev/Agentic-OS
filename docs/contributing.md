# Contributing to AgentOS Studio

## Development Setup

1. Fork and clone the repository
2. Run `./scripts/setup.sh`
3. Add your API keys to `apps/api/.env`
4. Run `./scripts/dev.sh`

## Code Style

- **Frontend**: ESLint + Prettier
- **Backend**: Black + isort + flake8
- **TypeScript**: Strict mode enabled

## Pull Request Process

1. Create a feature branch
2. Make your changes
3. Add tests
4. Update documentation
5. Submit PR with clear description

## Project Structure

```
agentos-studio/
├── apps/
│   ├── web/          # Next.js frontend
│   ├── api/          # FastAPI backend
│   └── workers/      # Celery background workers
├── packages/
│   ├── ui/           # Shared UI components
│   ├── model-router/ # LLM provider abstraction
│   ├── agent-core/   # Agent orchestration
│   ├── automation-engine/ # Workflow automation
│   ├── usage-tracker/ # Cost & token tracking
│   ├── design-engine/ # UI generation
│   └── integrations/  # Third-party integrations
│       ├── openclaude/
│       ├── opendesign/
│       └── hermes/
├── infra/            # Docker, K8s, Terraform
├── docs/             # Documentation
└── scripts/          # Setup and build scripts
```

## Integration Development

When adding new integrations:

1. Create adapter in `apps/api/src/integrations/`
2. Add configuration to `core/config.py`
3. Update health check in `main.py`
4. Add documentation
5. Write tests

## Testing

```bash
# Frontend tests
cd apps/web
pnpm test

# Backend tests
cd apps/api
pytest

# Integration tests
pytest tests/integration/
```

## License

MIT License - see LICENSE file
