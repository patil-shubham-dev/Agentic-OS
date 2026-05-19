"""Model Router - Routes requests to appropriate LLM provider"""
from typing import Dict, Any, List, AsyncGenerator
import os

class BaseProvider:
    """Base class for LLM providers."""

    name: str = "base"
    supports_tools: bool = False
    supports_streaming: bool = False
    supports_vision: bool = False

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.api_key = config.get("api_key")

    async def chat(self, messages: List[Dict], model: str = None, **kwargs) -> Dict[str, Any]:
        raise NotImplementedError

    async def stream_chat(self, messages: List[Dict], model: str = None, **kwargs) -> AsyncGenerator[Dict, None]:
        raise NotImplementedError

    async def list_models(self) -> List[Dict[str, Any]]:
        raise NotImplementedError

class OpenAIProvider(BaseProvider):
    name = "openai"
    supports_tools = True
    supports_streaming = True
    supports_vision = True

    async def chat(self, messages, model="gpt-4o", **kwargs):
        import openai
        client = openai.AsyncOpenAI(api_key=self.api_key)
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            tools=kwargs.get("tools"),
        )
        return {
            "content": response.choices[0].message.content,
            "tool_calls": response.choices[0].message.tool_calls,
            "usage": response.usage.dict() if response.usage else {},
        }

    async def stream_chat(self, messages, model="gpt-4o", **kwargs):
        import openai
        client = openai.AsyncOpenAI(api_key=self.api_key)
        stream = await client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
            tools=kwargs.get("tools"),
        )
        async for chunk in stream:
            yield {
                "content": chunk.choices[0].delta.content or "",
                "tool_calls": chunk.choices[0].delta.tool_calls,
            }

    async def list_models(self):
        return [
            {"id": "gpt-4o", "name": "GPT-4o"},
            {"id": "gpt-4-turbo", "name": "GPT-4 Turbo"},
            {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo"},
        ]

class AnthropicProvider(BaseProvider):
    name = "anthropic"
    supports_tools = True
    supports_streaming = True
    supports_vision = True

    async def chat(self, messages, model="claude-3-opus", **kwargs):
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=self.api_key)
        response = await client.messages.create(
            model=model,
            max_tokens=4096,
            messages=messages,
        )
        return {
            "content": response.content[0].text if response.content else "",
            "usage": {"input_tokens": response.usage.input_tokens, "output_tokens": response.usage.output_tokens},
        }

    async def list_models(self):
        return [
            {"id": "claude-3-opus", "name": "Claude 3 Opus"},
            {"id": "claude-3-sonnet", "name": "Claude 3 Sonnet"},
            {"id": "claude-3-haiku", "name": "Claude 3 Haiku"},
        ]

class ModelRouter:
    """Routes requests to the appropriate LLM provider."""

    PROVIDERS = {
        "openai": OpenAIProvider,
        "anthropic": AnthropicProvider,
        # Add more providers as needed
    }

    def __init__(self):
        self._providers = {}
        self._init_providers()

    def _init_providers(self):
        """Initialize available providers from environment."""
        from core.config import settings

        if settings.OPENAI_API_KEY:
            self._providers["openai"] = OpenAIProvider({"api_key": settings.OPENAI_API_KEY})
        if settings.ANTHROPIC_API_KEY:
            self._providers["anthropic"] = AnthropicProvider({"api_key": settings.ANTHROPIC_API_KEY})

    def get_provider(self, name: str = None) -> BaseProvider:
        """Get provider by name or default."""
        if name:
            normalized = name.lower()
            if "claude" in normalized and "anthropic" in self._providers:
                return self._providers["anthropic"]
            if any(token in normalized for token in ["gpt", "openai"]) and "openai" in self._providers:
                return self._providers["openai"]
        if name and name in self._providers:
            return self._providers[name]

        # Return first available provider
        if self._providers:
            return list(self._providers.values())[0]

        raise ValueError("No LLM providers configured. Add API keys in Settings.")

    def list_providers(self) -> List[Dict[str, Any]]:
        """List all configured providers."""
        return [
            {"name": name, "models": provider.list_models()}
            for name, provider in self._providers.items()
        ]
