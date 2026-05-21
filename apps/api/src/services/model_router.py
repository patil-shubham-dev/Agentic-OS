"""Universal Model Router - Provider-agnostic LLM routing layer.

Routes requests to any OpenAI-compatible endpoint, cloud or local.
No hardcoded provider SDKs — every provider implements the same async interface.
"""
from typing import Dict, Any, List, Optional, AsyncGenerator, Type
import os
import json
import httpx
from dataclasses import dataclass, field


# =============================================================================
# Known provider profiles — mirror of the TypeScript side's KNOWN_OPENAI_COMPATIBLE
# =============================================================================
KNOWN_PROFILES: Dict[str, Dict[str, Any]] = {
    "api.openai.com": {
        "name": "OpenAI",
        "type": "cloud",
        "known_models": [
            "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo",
            "o1", "o1-mini", "o3-mini", "gpt-4.1", "gpt-4.1-mini",
        ],
    },
    "api.deepseek.com": {
        "name": "DeepSeek",
        "type": "cloud",
        "known_models": ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"],
    },
    "api.groq.com": {
        "name": "Groq",
        "type": "cloud",
        "known_models": [
            "llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768",
            "gemma2-9b-it", "llama-3.2-90b-vision-preview",
        ],
    },
    "api.together.xyz": {
        "name": "Together AI",
        "type": "cloud",
        "known_models": ["mistralai/Mixtral-8x22B-Instruct-v0.1", "Qwen/Qwen2.5-72B-Instruct-Turbo"],
    },
    "openrouter.ai": {
        "name": "OpenRouter",
        "type": "cloud",
        "known_models": ["anthropic/claude-3.5-sonnet", "openai/gpt-4o", "google/gemini-pro-1.5"],
    },
    "api.fireworks.ai": {
        "name": "Fireworks",
        "type": "cloud",
        "known_models": ["accounts/fireworks/models/llama-v3p3-70b-instruct"],
    },
    "api.mistral.ai": {
        "name": "Mistral AI",
        "type": "cloud",
        "known_models": ["mistral-large-latest", "mistral-small-latest", "codestral-latest"],
    },
    "api.anthropic.com": {
        "name": "Anthropic",
        "type": "cloud",
        "known_models": ["claude-3-opus-latest", "claude-3-sonnet-latest", "claude-3-haiku-latest"],
    },
    "localhost:11434": {"name": "Ollama", "type": "local", "known_models": None},
    "localhost:1234": {"name": "LM Studio", "type": "local", "known_models": None},
}


@dataclass
class ProviderConfig:
    """Universal provider configuration — mirrors UniversalProviderConfig in TypeScript."""
    id: str
    name: str
    type: str  # "cloud" | "local" | "openai-compatible"
    base_url: str
    api_key: Optional[str] = None
    default_model: Optional[str] = None
    enabled: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)


# =============================================================================
# Capability detection from model ID — mirrors base-provider.ts logic
# =============================================================================
def detect_capabilities_from_id(model_id: str) -> set:
    caps = {"streaming"}
    lower = model_id.lower()

    if any(tok in lower for tok in ["gpt-4", "claude-3", "claude-4", "gemini",
                                     "llama", "mistral", "mixtral", "qwen", "deepseek"]):
        caps.update({"tools", "code", "function-calling"})

    if any(tok in lower for tok in ["vision", "claude-3", "gpt-4o", "gemini",
                                     "llama-3.2", "qwen-vl"]):
        caps.add("vision")

    if any(tok in lower for tok in ["reason", "deepseek-r1", "o1", "o3",
                                     "claude-3-opus", "thinking"]):
        caps.add("reasoning")

    if any(tok in lower for tok in ["gpt-4o-mini", "haiku", "flash",
                                     "llama-3.2", "qwen2.5"]):
        caps.add("fast-inference")

    return caps


def get_speed_from_context(model_id: str) -> str:
    lower = model_id.lower()
    if any(tok in lower for tok in ["128k", "claude-3", "claude-4"]):
        return "slow"
    if any(tok in lower for tok in ["32k", "gpt-4-32k"]):
        return "balanced"
    return "fast"


# =============================================================================
# Universal OpenAI-compatible provider (no SDK dependencies)
# =============================================================================
class UniversalProvider:
    """Single provider class for all OpenAI-compatible endpoints.

    Works with: OpenAI, Anthropic, DeepSeek, Groq, Together, OpenRouter,
    Fireworks, Mistral, Ollama, LM Studio, vLLM, llama.cpp, and any
    custom endpoint.
    """
    def __init__(self, config: ProviderConfig):
        self.config = config
        self._profile = self._detect_profile()

    def _detect_profile(self) -> Optional[Dict[str, Any]]:
        host = self.config.base_url.replace("https://", "").replace("http://", "").split("/")[0]
        return KNOWN_PROFILES.get(host)

    @property
    def name(self) -> str:
        return (self._profile or {}).get("name") or self.config.name

    @property
    def supports_tools(self) -> bool:
        return True

    @property
    def supports_streaming(self) -> bool:
        return True

    @property
    def supports_vision(self) -> bool:
        lower = (self._profile or {}).get("name", "").lower()
        return "openai" in lower or "anthropic" in lower or "groq" in lower or "openrouter" in lower

    def _build_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        extra_headers = self.config.metadata.get("headers")
        if extra_headers:
            try:
                headers.update(json.loads(extra_headers) if isinstance(extra_headers, str) else extra_headers)
            except (json.JSONDecodeError, TypeError):
                pass
        return headers

    def _build_url(self, path: str) -> str:
        base = self.config.base_url.rstrip("/")
        url = f"{base}{path}"
        query_params = self.config.metadata.get("queryParameters")
        if query_params:
            try:
                params = json.loads(query_params) if isinstance(query_params, str) else query_params
                if params:
                    qs = "&".join(f"{k}={v}" for k, v in params.items())
                    url += f"?{qs}"
            except (json.JSONDecodeError, TypeError):
                pass
        return url

    async def list_models(self) -> List[Dict[str, Any]]:
        known = (self._profile or {}).get("known_models")
        if known:
            return [
                {
                    "id": mid,
                    "name": mid.split("/")[-1] or mid,
                    "capabilities": list(detect_capabilities_from_id(mid)),
                    "speed": get_speed_from_context(mid),
                }
                for mid in known
            ]

        fallback = self.config.default_model or "gpt-4o"
        return [{"id": fallback, "name": fallback, "capabilities": ["streaming"], "speed": "balanced"}]

    async def chat(self, messages: List[Dict], model: Optional[str] = None, **kwargs) -> Dict[str, Any]:
        model = model or self.config.default_model or "gpt-4o"
        body = {
            "model": model,
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", 4096),
        }
        tools = kwargs.get("tools")
        if tools:
            body["tools"] = [{"type": "function", "function": t} if isinstance(t, dict) else t for t in tools]

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                self._build_url("/chat/completions"),
                headers=self._build_headers(),
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()
            choice = data["choices"][0]["message"] if data.get("choices") else {}

        return {
            "content": choice.get("content") or "",
            "tool_calls": choice.get("tool_calls"),
            "usage": data.get("usage", {}),
        }

    async def stream_chat(self, messages: List[Dict], model: Optional[str] = None, **kwargs) -> AsyncGenerator[Dict, None]:
        model = model or self.config.default_model or "gpt-4o"
        body = {
            "model": model,
            "messages": messages,
            "stream": True,
            "max_tokens": kwargs.get("max_tokens", 4096),
        }
        tools = kwargs.get("tools")
        if tools:
            body["tools"] = [{"type": "function", "function": t} if isinstance(t, dict) else t for t in tools]

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                self._build_url("/chat/completions"),
                headers=self._build_headers(),
                json=body,
            ) as response:
                if not response.is_success:
                    err_text = await response.aread()
                    yield {"type": "error", "content": f"API error {response.status_code}: {err_text.decode() if isinstance(err_text, bytes) else err_text}"}
                    return

                buffer = ""
                async for chunk in response.aiter_bytes():
                    buffer += chunk.decode()
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        line = line.strip()
                        if not line or not line.startswith("data: "):
                            continue
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            yield {"type": "done", "content": ""}
                            return
                        try:
                            parsed = json.loads(data_str)
                            choice = parsed.get("choices", [{}])[0]
                            delta = choice.get("delta", {})
                            if delta.get("content"):
                                yield {"type": "text", "content": delta["content"], "model": model}
                            if delta.get("tool_calls"):
                                for tc in delta["tool_calls"]:
                                    if tc.get("function", {}).get("name"):
                                        yield {
                                            "type": "tool_call",
                                            "tool_name": tc["function"]["name"],
                                            "arguments": tc["function"].get("arguments", "{}"),
                                            "tool_call_id": tc.get("id", f"tc_{id(tc)}"),
                                        }
                            if choice.get("finish_reason"):
                                yield {"type": "done", "finish_reason": choice["finish_reason"]}
                        except json.JSONDecodeError:
                            continue


# =============================================================================
# Dynamic Model Router — matches all configured providers by capability
# =============================================================================
class ModelRouter:
    """Routes requests to the appropriate LLM provider with capability matching.

    Eliminates all hardcoded provider SDK imports. Every provider is
    an OpenAI-compatible endpoint configured via ProviderConfig.
    """
    def __init__(self):
        self._providers: Dict[str, UniversalProvider] = {}
        self._init_providers()

    def _init_providers(self):
        """Initialize providers from config / environment.

        Supports both the old env-var style (single keys per provider)
        and the new multi-provider config from the settings API.
        """
        from core.config import settings

        configs = self._load_provider_configs(settings)
        for cfg in configs:
            if cfg.api_key or cfg.type == "local":
                self._providers[cfg.id] = UniversalProvider(cfg)

    def _load_provider_configs(self, settings) -> List[ProviderConfig]:
        configs = []

        # Auto-detect from environment variables (backward compat)
        env_map = {
            "openai": ("api.openai.com", settings.OPENAI_API_KEY, "gpt-4o"),
            "anthropic": ("api.anthropic.com", settings.ANTHROPIC_API_KEY, "claude-3-opus"),
            "deepseek": ("api.deepseek.com", settings.DEEPSEEK_API_KEY, "deepseek-chat"),
            "groq": ("api.groq.com", settings.GROQ_API_KEY, "llama-3.3-70b-versatile"),
            "openrouter": ("openrouter.ai", settings.OPENROUTER_API_KEY, "openai/gpt-4o"),
            "togetherai": ("api.together.xyz", settings.TOGETHER_API_KEY, "mistralai/Mixtral-8x22B-Instruct-v0.1"),
        }
        for pid, (host, key, model) in env_map.items():
            if key:
                configs.append(ProviderConfig(
                    id=pid,
                    name=KNOWN_PROFILES.get(host, {}).get("name", pid),
                    type=KNOWN_PROFILES.get(host, {}).get("type", "cloud"),
                    base_url=f"https://{host}",
                    api_key=key,
                    default_model=model,
                ))

        return configs

    def get_provider(self, name: Optional[str] = None) -> UniversalProvider:
        """Get provider by name or return first available."""
        if name and name in self._providers:
            return self._providers[name]
        if name:
            normalized = name.lower()
            for pid, prov in self._providers.items():
                if pid in normalized or normalized in pid:
                    return prov
        if self._providers:
            return list(self._providers.values())[0]
        raise ValueError("No LLM providers configured. Add API keys in Settings or configure a provider.")

    def list_providers(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": pid,
                "name": prov.name,
                "models": prov.list_models(),
                "type": prov.config.type,
            }
            for pid, prov in self._providers.items()
        ]

    def add_provider(self, config: ProviderConfig) -> UniversalProvider:
        """Register a new provider at runtime (e.g., from Settings API)."""
        provider = UniversalProvider(config)
        self._providers[config.id] = provider
        return provider

    def remove_provider(self, provider_id: str) -> bool:
        """Remove a provider by ID."""
        return self._providers.pop(provider_id, None) is not None
