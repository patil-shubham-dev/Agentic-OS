# Source Provenance

AgentOS Studio follows the rule: integrate first, adapt second, build last.

## Upstream Reuse Matrix

### OpenClaude

- Repository: https://github.com/Gitlawb/openclaude
- Reused patterns:
  - Provider-flexible runtime with BYOD profiles
  - Tool-driven coding loops for shell, file, grep, glob, MCP, and task flows
  - Session-oriented streaming output and token accounting
- Adapted in AgentOS Studio:
  - [apps/api/src/integrations/openclaude/bridge.py](/C:/Users/91808/Desktop/AgentOS%20Studio/apps/api/src/integrations/openclaude/bridge.py)
  - [packages/integrations/openclaude/README.md](/C:/Users/91808/Desktop/AgentOS%20Studio/packages/integrations/openclaude/README.md)
- Custom code justification:
  - AgentOS Studio needs a browser-first SaaS facade, project-scoped permissions, and dashboard-visible usage analytics.

### Hermes Agent

- Repository: https://github.com/NousResearch/hermes-agent
- Reused patterns:
  - Specialist agent loop and toolset model
  - Persistent memory, session search, and skills system
  - Cron-backed automation and gateway-ready orchestration
- Adapted in AgentOS Studio:
  - [apps/api/src/integrations/hermes/adapter.py](/C:/Users/91808/Desktop/AgentOS%20Studio/apps/api/src/integrations/hermes/adapter.py)
  - [packages/integrations/hermes/README.md](/C:/Users/91808/Desktop/AgentOS%20Studio/packages/integrations/hermes/README.md)
- Custom code justification:
  - AgentOS Studio adds project/workspace boundaries, UI-level approval rules, and product analytics not present in upstream Hermes.

### Open Design

- Repository: https://github.com/nexu-io/open-design
- Reused patterns:
  - Artifact-first design workflow
  - Plain-file persistence with `artifact.json` and `history.jsonl`
  - Screenshot-to-design and design-system generation
- Adapted in AgentOS Studio:
  - [apps/api/src/integrations/opendesign/adapter.py](/C:/Users/91808/Desktop/AgentOS%20Studio/apps/api/src/integrations/opendesign/adapter.py)
  - [packages/integrations/opendesign/README.md](/C:/Users/91808/Desktop/AgentOS%20Studio/packages/integrations/opendesign/README.md)
- Custom code justification:
  - AgentOS Studio must present design generation inside a unified workspace alongside chats, code, automations, and knowledge artifacts.

## Product-Specific Glue

- [apps/api/src/integrations/registry.py](/C:/Users/91808/Desktop/AgentOS%20Studio/apps/api/src/integrations/registry.py) centralizes which upstream systems own which capabilities.
- [apps/web/src/lib/product-blueprint.ts](/C:/Users/91808/Desktop/AgentOS%20Studio/apps/web/src/lib/product-blueprint.ts) defines the shared SaaS blueprint that powers dashboard, agents, and automations.
- Custom code exists primarily to unify UX, security, tenancy, and observability across the three upstream systems.
