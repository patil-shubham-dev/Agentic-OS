"""
Open Design adapter for AgentOS Studio.

This adapter keeps the integration boundary small and explicit so we can
swap between a local Open Design deployment, a hosted endpoint, or a mocked
response during development.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import aiohttp


class OpenDesignAdapter:
    """Bridge to Open Design's artifact-oriented generation APIs."""

    def __init__(self, api_key: str = "", endpoint: str = "https://api.open-design.io"):
        self.api_key = api_key
        self.endpoint = endpoint.rstrip("/")

    async def health(self) -> Dict[str, Any]:
        """Return a lightweight health payload.

        We intentionally do not fail hard when an API key is missing so the rest
        of AgentOS Studio can boot in self-hosted development mode.
        """
        if not self.api_key:
            return {
                "status": "mock",
                "message": "OPEN_DESIGN_API_KEY not configured; using mock responses",
            }

        return {"status": "configured", "endpoint": self.endpoint}

    async def generate_component(
        self,
        prompt: str,
        framework: str = "react",
        styling: str = "tailwind",
        theme: str = "default",
        accessibility: bool = True,
    ) -> Dict[str, Any]:
        payload = {
            "prompt": prompt,
            "framework": framework,
            "styling": styling,
            "theme": theme,
            "accessibility": accessibility,
        }
        response = await self._post("/generate", payload)
        if response is not None:
            return response

        return {
            "id": "od-mock-component",
            "artifact": {
                "type": "component",
                "prompt": prompt,
                "framework": framework,
                "styling": styling,
                "theme": theme,
            },
            "code": self._mock_component(prompt, framework),
            "preview_url": None,
            "design_tokens": {
                "colors": {
                    "primary": "#0f766e",
                    "surface": "#08111b",
                    "accent": "#f59e0b",
                },
                "radius": {"lg": "1rem"},
            },
            "a11y_report": {
                "enabled": accessibility,
                "score": 0.94,
                "notes": ["Mock response generated locally"],
            },
        }

    async def screenshot_to_design(self, image_url: str) -> Dict[str, Any]:
        response = await self._post("/vision", {"image": image_url, "mode": "screenshot_to_design"})
        if response is not None:
            return response

        return {
            "id": "od-mock-vision",
            "source": image_url,
            "code": self._mock_component("Screenshot-derived layout", "react"),
            "assets": [],
            "layers": [
                {"name": "hero", "kind": "section"},
                {"name": "features", "kind": "grid"},
            ],
        }

    async def generate_design_system(self, name: str, colors: List[str]) -> Dict[str, Any]:
        response = await self._post("/design-system", {"name": name, "colors": colors})
        if response is not None:
            return response

        seed = colors or ["#0f766e", "#f59e0b", "#111827"]
        return {
            "id": "od-mock-system",
            "name": name,
            "tokens": {
                "colors": {
                    "brand": seed[0],
                    "accent": seed[1] if len(seed) > 1 else seed[0],
                    "ink": seed[2] if len(seed) > 2 else "#111827",
                },
                "spacing": {"sm": "0.5rem", "md": "1rem", "lg": "1.5rem"},
            },
            "components": ["button", "card", "sidebar", "command-bar"],
        }

    async def _post(self, path: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not self.api_key:
            return None

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with aiohttp.ClientSession(headers=headers) as session:
                async with session.post(f"{self.endpoint}{path}", json=payload, timeout=20) as response:
                    if response.status >= 400:
                        return {
                            "status": "error",
                            "code": response.status,
                            "message": await response.text(),
                        }
                    return await response.json()
        except Exception:
            return None

    def _mock_component(self, prompt: str, framework: str) -> str:
        if framework.lower() != "react":
            return f"// Mock Open Design output for {framework}\n// Prompt: {prompt}\n"

        return f"""export function GeneratedArtifact() {{
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950 p-8 text-slate-50 shadow-2xl">
      <p className="text-xs uppercase tracking-[0.3em] text-teal-300">Open Design Artifact</p>
      <h2 className="mt-4 text-3xl font-semibold">Generated for: {prompt}</h2>
      <p className="mt-3 max-w-2xl text-sm text-slate-300">
        This mock artifact keeps AgentOS Studio functional in local development while
        the upstream Open Design runtime is not yet attached.
      </p>
    </section>
  );
}}"""
