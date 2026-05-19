"""Integration registry and provenance map for AgentOS Studio."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, List


@dataclass(frozen=True)
class IntegrationCapability:
    id: str
    name: str
    upstream_repo: str
    category: str
    responsibilities: List[str]
    adapted_modules: List[str]
    custom_code_reason: str


INTEGRATION_CAPABILITIES: List[IntegrationCapability] = [
    IntegrationCapability(
        id="openclaude-workspace",
        name="OpenClaude workspace runtime",
        upstream_repo="https://github.com/Gitlawb/openclaude",
        category="workspace",
        responsibilities=[
            "provider-flexible tool loops",
            "file editing and shell execution",
            "streaming coding sessions",
        ],
        adapted_modules=[
            "README provider model",
            "src/bridge",
            "src/tools",
            "src/utils/tokenAnalytics.ts",
        ],
        custom_code_reason="AgentOS needs a web-facing FastAPI facade and project-scoped RBAC on top of the upstream terminal-first runtime.",
    ),
    IntegrationCapability(
        id="hermes-agent-core",
        name="Hermes agent orchestration",
        upstream_repo="https://github.com/NousResearch/hermes-agent",
        category="agents",
        responsibilities=[
            "specialist agent definitions",
            "memory and skills primitives",
            "cron-backed automation execution",
        ],
        adapted_modules=[
            "agent/conversation_loop.py",
            "tools/session_search_tool.py",
            "toolsets.py",
            "website/docs/user-guide/features/memory",
        ],
        custom_code_reason="AgentOS introduces multi-project workspace semantics, approval policies, and a dashboard-oriented presentation layer.",
    ),
    IntegrationCapability(
        id="open-design-artifacts",
        name="Open Design artifact pipeline",
        upstream_repo="https://github.com/nexu-io/open-design",
        category="design",
        responsibilities=[
            "prompt-to-design generation",
            "artifact and history persistence",
            "design-system and screenshot workflows",
        ],
        adapted_modules=[
            "docs/architecture.md",
            "docs/skills-protocol.md",
            "artifact store conventions",
        ],
        custom_code_reason="AgentOS wraps the upstream artifact-first workflow inside the shared workspace, knowledge, and automation surfaces.",
    ),
]


def get_integration_blueprint() -> Dict[str, Any]:
    """Return a serializable integration blueprint for docs and APIs."""
    return {
        "product": "AgentOS Studio",
        "guiding_principle": "Integrate first, adapt second, build last.",
        "capabilities": [asdict(capability) for capability in INTEGRATION_CAPABILITIES],
    }
