"""Usage tracking and cost analytics"""
from typing import Dict, Any, List
from datetime import datetime, timedelta
from collections import defaultdict

# Token pricing per 1K tokens (approximate)
PRICING = {
    "gpt-4o": {"input": 0.005, "output": 0.015},
    "gpt-4-turbo": {"input": 0.01, "output": 0.03},
    "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015},
    "claude-3-opus": {"input": 0.015, "output": 0.075},
    "claude-3-sonnet": {"input": 0.003, "output": 0.015},
    "claude-3-haiku": {"input": 0.00025, "output": 0.00125},
    "gemini-pro": {"input": 0.0005, "output": 0.0015},
    "llama-3.3-70b": {"input": 0.00059, "output": 0.00079},
}

class UsageTracker:
    """Track token usage and costs across providers."""

    def __init__(self):
        self._sessions = {}
        self._records = []

    async def start_session(self, user_id: str, project_id: str = None):
        """Start a new usage tracking session."""
        session_id = f"{user_id}-{datetime.utcnow().timestamp()}"
        self._sessions[session_id] = {
            "user_id": user_id,
            "project_id": project_id,
            "start_time": datetime.utcnow(),
            "total_tokens": 0,
            "total_cost": 0.0,
        }
        return session_id

    async def record_usage(self, user_id: str, project_id: str, model: str, 
                          input_tokens: int, output_tokens: int):
        """Record token usage."""
        pricing = PRICING.get(model, {"input": 0.0, "output": 0.0})
        cost = (input_tokens / 1000 * pricing["input"] + 
                output_tokens / 1000 * pricing["output"])

        record = {
            "user_id": user_id,
            "project_id": project_id,
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
            "cost": cost,
            "timestamp": datetime.utcnow(),
        }
        self._records.append(record)
        return record

    async def get_stats(self, user_id: str, period: str = "7d") -> Dict[str, Any]:
        """Get usage statistics for a user."""
        # Parse period
        days = int(period[:-1]) if period.endswith("d") else 7
        cutoff = datetime.utcnow() - timedelta(days=days)

        # Filter records
        user_records = [r for r in self._records 
                       if r["user_id"] == user_id and r["timestamp"] > cutoff]

        # Calculate stats
        total_tokens = sum(r["total_tokens"] for r in user_records)
        total_cost = sum(r["cost"] for r in user_records)
        total_requests = len(user_records)

        # Daily breakdown
        daily = defaultdict(lambda: {"tokens": 0, "cost": 0})
        for r in user_records:
            day = r["timestamp"].strftime("%Y-%m-%d")
            daily[day]["tokens"] += r["total_tokens"]
            daily[day]["cost"] += r["cost"]

        # Model breakdown
        by_model = defaultdict(lambda: {"tokens": 0, "cost": 0, "requests": 0})
        for r in user_records:
            by_model[r["model"]]["tokens"] += r["total_tokens"]
            by_model[r["model"]]["cost"] += r["cost"]
            by_model[r["model"]]["requests"] += 1

        return {
            "period": period,
            "total_tokens": total_tokens,
            "total_cost": round(total_cost, 4),
            "total_requests": total_requests,
            "daily": dict(daily),
            "by_model": dict(by_model),
        }

    async def get_provider_breakdown(self, user_id: str) -> List[Dict[str, Any]]:
        """Get cost breakdown by provider."""
        provider_map = {
            "gpt-4o": "OpenAI",
            "gpt-4-turbo": "OpenAI",
            "gpt-3.5-turbo": "OpenAI",
            "claude-3-opus": "Anthropic",
            "claude-3-sonnet": "Anthropic",
            "claude-3-haiku": "Anthropic",
            "gemini-pro": "Google",
            "llama-3.3-70b": "Groq",
        }

        by_provider = defaultdict(lambda: {"cost": 0, "tokens": 0})
        for r in self._records:
            if r["user_id"] == user_id:
                provider = provider_map.get(r["model"], "Other")
                by_provider[provider]["cost"] += r["cost"]
                by_provider[provider]["tokens"] += r["total_tokens"]

        return [
            {"provider": k, "cost": round(v["cost"], 4), "tokens": v["tokens"]}
            for k, v in by_provider.items()
        ]
