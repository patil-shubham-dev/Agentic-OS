# Hermes Agent Integration for AgentOS Studio

This package integrates [Hermes Agent](https://github.com/NousResearch/hermes-agent) by Nous Research into AgentOS Studio.

## Architecture

Hermes Agent provides:
- **Self-improving AI agent** with built-in learning loop
- **Skill creation** from experience with automatic improvement
- **Persistent memory** with FTS5 session search and LLM summarization
- **Multi-platform gateway**: Telegram, Discord, Slack, WhatsApp, Signal, Email
- **Cron scheduling** for unattended automations
- **Subagent delegation** for parallel workstreams
- **MCP integration** for extended capabilities
- **40+ built-in tools** with toolset system
- **7 terminal backends**: local, Docker, SSH, Singularity, Modal, Daytona, Vercel Sandbox

## Integration Points

### 1. Agent Core (packages/agent-core/)

```python
# packages/agent-core/src/hermes_adapter.py
import asyncio
import json
from typing import AsyncGenerator, Dict, Any
from hermes.agent import Agent
from hermes.config import Config
from hermes.memory import MemoryManager
from hermes.skills import SkillsManager

class HermesAdapter:
    """Adapter between Hermes Agent and AgentOS Studio."""

    def __init__(self, config_path: str = None):
        self.config = Config.load(config_path)
        self.agent = Agent(self.config)
        self.memory = MemoryManager(self.config.memory_path)
        self.skills = SkillsManager(self.config.skills_path)

    async def chat(
        self, 
        message: str, 
        session_id: str = None,
        context: Dict[str, Any] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream chat responses from Hermes."""

        # Load session context
        if session_id:
            session = await self.memory.load_session(session_id)
            self.agent.set_context(session)

        # Inject project context
        if context:
            self.agent.add_context_files(context.get('files', []))

        # Stream response
        async for chunk in self.agent.stream(message):
            yield {
                'id': chunk.id,
                'content': chunk.text,
                'tool_calls': [
                    {
                        'id': tc.id,
                        'name': tc.name,
                        'args': tc.arguments,
                        'status': tc.status,
                        'result': tc.result,
                    }
                    for tc in (chunk.tool_calls or [])
                ],
                'skills_used': chunk.skills,
                'memory_updates': chunk.memory_updates,
                'finish_reason': chunk.finish_reason,
            }

    async def create_skill(self, name: str, description: str, examples: list):
        """Create a new skill from examples."""
        return await self.skills.create(
            name=name,
            description=description,
            examples=examples,
            auto_improve=True
        )

    async def search_sessions(self, query: str, limit: int = 10):
        """Search past sessions using FTS5."""
        return await self.memory.search(query, limit=limit)

    async def schedule_task(self, cron: str, prompt: str, platform: str = None):
        """Schedule a recurring automation."""
        return await self.agent.scheduler.add(
            cron=cron,
            prompt=prompt,
            platform=platform or 'web',
        )

    async def spawn_subagent(self, task: str, model: str = None):
        """Spawn an isolated subagent for parallel work."""
        subagent = await self.agent.spawn_subagent(
            task=task,
            model=model or self.config.default_model,
        )
        return subagent
```

### 2. Memory Integration (packages/agent-core/src/memory/)

```python
# packages/agent-core/src/memory/hermes_memory.py
from hermes.memory import FTS5Search, SessionStore
from qdrant_client import QdrantClient

class AgentOSMemory:
    """Unified memory system combining Hermes FTS5 + Qdrant vector search."""

    def __init__(self, hermes_path: str, qdrant_url: str):
        self.fts5 = FTS5Search(hermes_path)
        self.sessions = SessionStore(hermes_path)
        self.vector = QdrantClient(qdrant_url)

    async def add(self, content: str, metadata: dict = None):
        """Add content to both FTS5 and vector stores."""
        # FTS5 for keyword search
        await self.fts5.insert(content, metadata)

        # Vector for semantic search
        embedding = await self.embed(content)
        self.vector.upsert(
            collection_name="agentos_memory",
            points=[{
                'id': metadata['id'],
                'vector': embedding,
                'payload': metadata,
            }]
        )

    async def search(self, query: str, limit: int = 10):
        """Hybrid search across FTS5 and vector."""
        # FTS5 keyword search
        fts_results = await self.fts5.search(query, limit)

        # Vector semantic search
        query_embedding = await self.embed(query)
        vector_results = self.vector.search(
            collection_name="agentos_memory",
            query_vector=query_embedding,
            limit=limit,
        )

        # Merge and deduplicate
        return self._merge_results(fts_results, vector_results)

    async def get_user_model(self, user_id: str):
        """Get Honcho dialectic user model."""
        return await self.sessions.get_user_profile(user_id)
```

### 3. Skills Hub (packages/agent-core/src/skills/)

```typescript
// packages/agent-core/src/skills/skills-hub.ts
export class SkillsHub {
  """AgentOS Skills Hub - compatible with agentskills.io standard."""

  private hermesSkills: HermesSkillsManager;
  private registry: Map<string, Skill> = new Map();

  constructor(hermesPath: string) {
    this.hermesSkills = new HermesSkillsManager(hermesPath);
    this.loadSkills();
  }

  async loadSkills() {
    // Load from Hermes skills directory
    const skills = await this.hermesSkills.list();
    for (const skill of skills) {
      this.registry.set(skill.name, {
        ...skill,
        source: 'hermes',
        autoImproving: true,
      });
    }
  }

  async execute(skillName: string, args: Record<string, any>) {
    const skill = this.registry.get(skillName);
    if (!skill) throw new Error(`Skill ${skillName} not found`);

    // Execute via Hermes
    return await this.hermesSkills.execute(skillName, args);
  }

  async createFromConversation(conversationId: string, name: string) {
    """Auto-create skill from a conversation."""
    return await this.hermesSkills.create_from_session(
      session_id=conversationId,
      name=name,
      auto_improve=true
    );
  }

  async importSkill(skillJson: string) {
    """Import skill from agentskills.io format."""
    const skill = JSON.parse(skillJson);
    return await this.hermesSkills.import_skill(skill);
  }

  async exportSkill(skillName: string): Promise<string> {
    """Export skill to agentskills.io format."""
    const skill = this.registry.get(skillName);
    return JSON.stringify(skill, null, 2);
  }
}

interface Skill {
  name: string;
  description: string;
  parameters: Record<string, any>;
  code: string;
  source: 'hermes' | 'custom' | 'marketplace';
  autoImproving: boolean;
  usageCount: number;
  rating: number;
}
```

### 4. Gateway Bridge (apps/api/src/integrations/hermes/)

```python
# apps/api/src/integrations/hermes/gateway_bridge.py
from hermes.gateway import Gateway
from hermes.platforms import TelegramBot, DiscordBot, SlackBot

class HermesGatewayBridge:
    """Bridge Hermes messaging gateway to AgentOS web UI."""

    def __init__(self):
        self.gateway = Gateway()
        self.web_clients = set()

    async def start(self):
        """Start all platform gateways."""
        await self.gateway.start()

        # Forward messages to web clients
        self.gateway.on_message(self._on_gateway_message)

    async def _on_gateway_message(self, platform: str, user_id: str, message: str):
        """Forward gateway messages to connected web clients."""
        event = {
            'type': 'gateway_message',
            'platform': platform,
            'user_id': user_id,
            'message': message,
            'timestamp': datetime.utcnow().isoformat(),
        }

        for client in self.web_clients:
            await client.send_json(event)

    async def send_to_platform(self, platform: str, user_id: str, message: str):
        """Send message from web UI to external platform."""
        await self.gateway.send(platform, user_id, message)

    def register_web_client(self, websocket):
        self.web_clients.add(websocket)

    def unregister_web_client(self, websocket):
        self.web_clients.discard(websocket)
```

### 5. Cron Automation Engine (packages/automation-engine/)

```python
# packages/automation-engine/src/hermes_scheduler.py
from hermes.scheduler import CronScheduler
from celery import Celery

class AutomationEngine:
    """Automation engine powered by Hermes cron + Celery."""

    def __init__(self, hermes_config: dict, celery_app: Celery):
        self.hermes_scheduler = CronScheduler(hermes_config)
        self.celery = celery_app

    async def create_automation(
        self,
        name: str,
        trigger: dict,  # {type: 'cron'|'webhook'|'manual', ...}
        steps: list,    # [{agent: str, prompt: str, tools: [...]}]
        notifications: list = None,
    ):
        """Create a new automation workflow."""

        if trigger['type'] == 'cron':
            # Use Hermes built-in scheduler
            job = await self.hermes_scheduler.add(
                cron=trigger['expression'],
                prompt=self._build_prompt(steps),
                platform='web',
            )
        elif trigger['type'] == 'webhook':
            # Use Celery for webhook triggers
            job = self.celery.task(self._run_automation).apply_async(
                args=[steps],
                queue='webhooks',
            )

        return {
            'id': job.id,
            'name': name,
            'status': 'scheduled',
            'next_run': job.next_run,
        }

    async def _run_automation(self, steps: list):
        """Execute automation steps."""
        for step in steps:
            agent = await self.get_agent(step['agent'])
            result = await agent.run(step['prompt'], tools=step.get('tools'))

            # Store result
            await self.store_result(step['id'], result)

    def _build_prompt(self, steps: list) -> str:
        """Build a natural language prompt from steps."""
        return '\n'.join([
            f"Step {i+1}: Use {step['agent']} to {step['prompt']}"
            for i, step in enumerate(steps)
        ])
```

## Setup

### Install Hermes as dependency

```bash
# Using uv (recommended by Hermes)
curl -LsSf https://astral.sh/uv/install.sh | sh
uv venv .venv --python 3.11
source .venv/bin/activate
uv pip install -e "git+https://github.com/NousResearch/hermes-agent.git#egg=hermes[all]"

# Or as git submodule
git submodule add https://github.com/NousResearch/hermes-agent.git packages/integrations/hermes/vendor
```

### Environment Variables

```env
# Hermes Configuration
HERMES_CONFIG_PATH=~/.hermes
HERMES_MODEL=openrouter:anthropic/claude-3-opus
HERMES_TOOLS=all
HERMES_MEMORY_PATH=./data/hermes/memory
HERMES_SKILLS_PATH=./data/hermes/skills

# Platform Gateways (optional)
TELEGRAM_BOT_TOKEN=...
DISCORD_BOT_TOKEN=...
SLACK_BOT_TOKEN=...

# MCP Servers
MCP_SERVERS='{"filesystem": {"command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]}}'
```

### Initialize Hermes

```bash
# Run Hermes setup wizard
hermes setup

# Or programmatically
python -c "from hermes import setup; setup.run()"
```

## Usage in AgentOS

```typescript
import { HermesAdapter } from '@agentos/integrations/hermes';

// Initialize
const hermes = new HermesAdapter({
  configPath: process.env.HERMES_CONFIG_PATH,
});

// Chat with streaming
const stream = hermes.chat({
  message: 'Research the latest AI trends',
  sessionId: 'session-123',
  context: {
    files: ['./docs/project.md'],
  },
});

for await (const chunk of stream) {
  console.log(chunk.content);
  console.log(chunk.toolCalls);
  console.log(chunk.skillsUsed);
}

// Create automation
const automation = await hermes.scheduleTask({
  cron: '0 9 * * 1',  // Every Monday at 9am
  prompt: 'Generate weekly competitor research report',
  platform: 'web',
});

// Search memory
const memories = await hermes.searchSessions('React best practices');
```

## Migration from OpenClaw

Hermes can migrate from OpenClaw automatically:

```bash
# In AgentOS, run migration
hermes claw migrate --dry-run

# Or via API
POST /api/integrations/hermes/migrate
{
  "source": "~/.openclaw",
  "target": "~/.hermes",
  "preset": "full"
}
```

What gets imported:
- SOUL.md persona file
- Memories (MEMORY.md, USER.md)
- User-created skills
- Command allowlist
- Platform configs
- API keys (allowlisted)
