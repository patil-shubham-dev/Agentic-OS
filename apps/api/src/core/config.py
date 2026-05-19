"""AgentOS Studio Configuration"""
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # App
    APP_NAME: str = "AgentOS Studio"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]

    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/agentos"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Auth
    JWT_SECRET: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION: int = 86400  # 24 hours

    # OpenClaude
    OPENCLAUDE_GRPC_HOST: str = "localhost"
    OPENCLAUDE_GRPC_PORT: int = 50051

    # Hermes
    HERMES_CONFIG_PATH: str = "~/.hermes"

    # Open Design
    OPEN_DESIGN_API_KEY: str = ""
    OPEN_DESIGN_ENDPOINT: str = "https://api.open-design.io"

    # LLM Providers (BYOD)
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    TOGETHER_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""

    # Vector DB
    QDRANT_URL: str = "http://localhost:6333"

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
