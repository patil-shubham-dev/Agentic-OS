"""
AgentOS Studio API
FastAPI backend integrating OpenClaude, Hermes Agent, and Open Design
"""

import os
import json
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Dict, Any, List, Optional
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
import uvicorn

# Import integration adapters (these interface with the actual repos)
from integrations.openclaude.bridge import OpenClaudeBridge
from integrations.hermes.adapter import HermesAdapter
from integrations.opendesign.adapter import OpenDesignAdapter
from integrations.registry import get_integration_blueprint
from core.config import Settings
from core.database import init_db, get_db
from core.auth import verify_token
from services.usage_tracker import UsageTracker
from services.model_router import ModelRouter

settings = Settings()

# Initialize integrations
openclaude = OpenClaudeBridge(
    host=settings.OPENCLAUDE_GRPC_HOST,
    port=settings.OPENCLAUDE_GRPC_PORT,
)

hermes = HermesAdapter(
    config_path=settings.HERMES_CONFIG_PATH,
)

opendesign = OpenDesignAdapter(
    api_key=settings.OPEN_DESIGN_API_KEY,
    endpoint=settings.OPEN_DESIGN_ENDPOINT,
)

usage_tracker = UsageTracker()
model_router = ModelRouter()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    await init_db()
    
    try:
        await openclaude.connect()
        app.state.openclaude_status = "connected"
    except Exception as e:
        print(f"Warning: Failed to connect to OpenClaude: {e}. Running in mock mode.")
        app.state.openclaude_status = "mock"
        
    try:
        await hermes.initialize()
        app.state.hermes_status = "connected"
    except Exception as e:
        print(f"Warning: Failed to initialize Hermes: {e}. Running in mock mode.")
        app.state.hermes_status = "mock"
        
    print(f"AgentOS API started - integrations: OpenClaude={app.state.openclaude_status}, Hermes={app.state.hermes_status}")
    yield
    # Shutdown
    try:
        await openclaude.disconnect()
    except Exception:
        pass
        
    try:
        await hermes.shutdown()
    except Exception:
        pass
    print("AgentOS API stopped")


app = FastAPI(
    title="AgentOS Studio API",
    description="Unified AI workspace API integrating OpenClaude, Hermes Agent, and Open Design",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()


# ============== Models ==============

class ChatMessage(BaseModel):
    role: str
    content: str
    model: Optional[str] = None


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = None
    agent: Optional[str] = None
    tools: Optional[List[str]] = None
    stream: bool = True
    project_id: Optional[str] = None


class ChatResponse(BaseModel):
    id: str
    content: str
    model: str
    tool_calls: Optional[List[Dict]] = None
    usage: Optional[Dict[str, int]] = None
    finish_reason: Optional[str] = None


class AgentConfig(BaseModel):
    name: str
    description: str
    model: str
    system_prompt: Optional[str] = None
    tools: List[str] = []
    memory_scope: str = "project"
    approval_rules: Optional[Dict] = None


class AutomationConfig(BaseModel):
    name: str
    description: str
    trigger: Dict[str, Any]
    steps: List[Dict[str, Any]]
    notifications: Optional[List[Dict]] = None


class DesignRequest(BaseModel):
    prompt: str
    framework: str = "react"
    styling: str = "tailwind"
    theme: str = "default"
    accessibility: bool = True


class KnowledgeUpload(BaseModel):
    name: str
    type: str
    content: Optional[str] = None
    url: Optional[str] = None


def _usage_value(response: Dict[str, Any], key: str) -> int:
    usage = response.get("usage") or {}
    return int(usage.get(key, 0))


# ============== Routes ==============

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "integrations": {
            "openclaude": await openclaude.health(),
            "hermes": await hermes.health(),
            "opendesign": await opendesign.health(),
        }
    }


@app.get("/integrations/blueprint")
async def integrations_blueprint():
    """Expose the source-of-truth integration plan for the UI and docs."""
    return get_integration_blueprint()


# ============== Chat / Workspace ==============

@app.post("/chat")
async def chat(request: ChatRequest, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Non-streaming chat endpoint."""
    user = await verify_token(credentials.credentials)

    # Track usage
    await usage_tracker.start_session(user["id"], request.project_id)
    response: Dict[str, Any]

    if request.agent and request.agent in ["coding", "terminal", "file_ops"]:
        chunks: List[Dict[str, Any]] = []
        async for chunk in openclaude.stream_chat(
            prompt=request.messages[-1].content,
            model=request.model,
            tools=request.tools,
            context={"project_id": request.project_id},
        ):
            chunks.append(chunk)
        last_chunk = chunks[-1] if chunks else {}
        response = {
            "content": "".join(chunk.get("content", "") for chunk in chunks if chunk.get("content")),
            "tool_calls": last_chunk.get("tool_calls", []),
            "usage": last_chunk.get("usage", {}),
        }
    elif request.agent and request.agent in ["research", "memory", "skills"]:
        chunks = []
        async for chunk in hermes.chat(
            message=request.messages[-1].content,
            session_id=None,
            context={"project_id": request.project_id},
        ):
            chunks.append(chunk)
        response = {
            "content": "".join(chunk.get("content", "") for chunk in chunks if chunk.get("content")),
            "tool_calls": chunks[-1].get("tool_calls", []) if chunks else [],
            "usage": {},
        }
    else:
        provider = model_router.get_provider(request.model or "default")
        response = await provider.chat(
            messages=[m.model_dump() for m in request.messages],
            model=request.model,
            tools=request.tools,
        )

    # Track token usage
    await usage_tracker.record_usage(
        user["id"],
        request.project_id,
        model=request.model or "default",
        input_tokens=_usage_value(response, "prompt_tokens"),
        output_tokens=_usage_value(response, "completion_tokens"),
    )

    return response


@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """WebSocket streaming chat with full tool support."""
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_json()
            request = ChatRequest(**data)

            # Determine which integration to use based on agent/tools
            if request.agent and request.agent in ["coding", "terminal", "file_ops"]:
                # Use OpenClaude for coding tasks (better tool support)
                stream = openclaude.stream_chat(
                    prompt=request.messages[-1].content,
                    model=request.model,
                    tools=request.tools,
                    context={"project_id": request.project_id},
                )
            elif request.agent and request.agent in ["research", "memory", "skills"]:
                # Use Hermes for research/memory tasks
                stream = hermes.chat(
                    message=request.messages[-1].content,
                    session_id=data.get("session_id"),
                    context={"project_id": request.project_id},
                )
            else:
                # Default routing
                provider = model_router.get_provider(request.model or "default")
                stream = provider.stream_chat(
                    messages=[m.model_dump() for m in request.messages],
                    model=request.model,
                )

            # Stream response chunks
            async for chunk in stream:
                await websocket.send_json({
                    "type": "chunk",
                    "data": chunk,
                })

            await websocket.send_json({"type": "done"})

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "message": str(e),
        })


# ============== Agents ==============

@app.get("/agents")
async def list_agents(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """List all available agents (built-in + custom)."""
    await verify_token(credentials.credentials)

    # Get built-in agents from Hermes
    hermes_agents = await hermes.list_agents()

    # Get custom agents from database
    # custom_agents = await db.agents.find_many(where={"user_id": user.id})

    return {
        "built_in": hermes_agents,
        "custom": [],  # From DB
    }


@app.post("/agents")
async def create_agent(config: AgentConfig, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Create a new custom agent."""
    await verify_token(credentials.credentials)

    # Create in Hermes
    agent = await hermes.create_agent(
        name=config.name,
        description=config.description,
        model=config.model,
        system_prompt=config.system_prompt,
        tools=config.tools,
        memory_scope=config.memory_scope,
    )

    # Save to database
    # await db.agents.create({...})

    return agent


@app.post("/agents/{agent_id}/run")
async def run_agent(
    agent_id: str,
    prompt: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Run an agent with a specific prompt."""
    await verify_token(credentials.credentials)

    # Get agent config
    agent = await hermes.get_agent(agent_id)

    # Run with appropriate provider
    if agent.get("model") in ["gpt-4o", "gpt-3.5-turbo", "gpt-5"]:
        result = await openclaude.execute_agent(agent_id, prompt)
    else:
        result = await hermes.run_agent(agent_id, prompt)

    return result


# ============== Automations ==============

@app.get("/automations")
async def list_automations(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """List all automations."""
    await verify_token(credentials.credentials)

    # Get from Hermes scheduler + database
    hermes_schedules = await hermes.list_scheduled_tasks()

    return {
        "automations": hermes_schedules,
    }


@app.post("/automations")
async def create_automation(
    config: AutomationConfig,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create a new automation workflow."""
    await verify_token(credentials.credentials)
    job: Dict[str, Any]

    if config.trigger.get("type") == "schedule":
        # Use Hermes cron scheduler
        job = await hermes.schedule_task(
            cron=config.trigger.get("expression") or config.trigger.get("cron") or "0 * * * *",
            prompt=_build_automation_prompt(config.steps),
            platform="web",
        )
    elif config.trigger.get("type") == "webhook":
        # Use Celery for webhook triggers
        job = {
            "id": f"webhook-{config.name.lower().replace(' ', '-')}",
            "status": "pending",
            "trigger": config.trigger,
        }
    else:
        job = {
            "id": f"manual-{config.name.lower().replace(' ', '-')}",
            "status": "draft",
            "trigger": config.trigger,
        }

    return {"id": job.get("id"), "status": job.get("status", "created")}


def _build_automation_prompt(steps: List[Dict]) -> str:
    """Build a natural language prompt from automation steps."""
    return "\n".join([
        f"Step {i+1}: Use {step.get('agent', 'default')} to {step.get('prompt', 'perform task')}"
        for i, step in enumerate(steps)
    ])


# ============== Design ==============

@app.post("/design/generate")
async def generate_design(request: DesignRequest):
    """Generate UI component from prompt using Open Design."""
    result = await opendesign.generate_component(
        prompt=request.prompt,
        framework=request.framework,
        styling=request.styling,
        theme=request.theme,
        accessibility=request.accessibility,
    )
    return result


@app.post("/design/screenshot")
async def screenshot_to_design(image_url: str):
    """Convert screenshot to design using Open Design."""
    result = await opendesign.screenshot_to_design(image_url)
    return result


@app.post("/design/system")
async def generate_design_system(name: str, colors: List[str]):
    """Generate a complete design system."""
    result = await opendesign.generate_design_system(name, colors)
    return result


# ============== Knowledge Base ==============

@app.post("/knowledge/upload")
async def upload_knowledge(
    upload: KnowledgeUpload,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Upload document to knowledge base."""
    await verify_token(credentials.credentials)

    # Process with Hermes memory system
    if upload.type == "url":
        # Placeholder until the real Hermes memory manager is mounted.
        if not upload.url:
            raise HTTPException(status_code=400, detail="Missing URL for url knowledge upload")
    else:
        if not upload.content:
            raise HTTPException(status_code=400, detail="Missing content for document upload")

    # Also index in vector store (Qdrant/pgvector)
    # await vector_store.upsert(...)

    return {"status": "indexed", "id": "doc-" + str(hash(upload.name))}


@app.get("/knowledge/search")
async def search_knowledge(
    q: str,
    limit: int = 10,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Semantic search across knowledge base."""
    await verify_token(credentials.credentials)

    # Hybrid search: Hermes FTS5 + Vector search
    fts_results = await hermes.search_memory(q, limit)
    # vector_results = await vector_store.search(q, limit)

    return {
        "query": q,
        "results": fts_results,
    }


# ============== Usage Tracking ==============

@app.get("/usage")
async def get_usage(
    period: str = "7d",
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get usage analytics."""
    user = await verify_token(credentials.credentials)

    stats = await usage_tracker.get_stats(user["id"], period)
    return stats


@app.get("/usage/providers")
async def get_provider_usage(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get cost breakdown by provider."""
    user = await verify_token(credentials.credentials)

    return await usage_tracker.get_provider_breakdown(user["id"])


# ============== File Operations (OpenClaude) ==============

@app.get("/files")
async def list_files(path: str = "/workspace"):
    """List files in workspace."""
    return await openclaude.list_files(path)


@app.get("/files/read")
async def read_file(path: str):
    """Read file contents."""
    return await openclaude.read_file(path)


@app.post("/files/write")
async def write_file(path: str, content: str):
    """Write file contents."""
    return await openclaude.write_file(path, content)


@app.post("/files/execute")
async def execute_command(command: str, cwd: Optional[str] = None):
    """Execute terminal command."""
    return await openclaude.execute_bash(command, cwd)


# ============== Main ==============

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=1 if settings.DEBUG else 4,
    )
