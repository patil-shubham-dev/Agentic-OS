"""Database models for AgentOS Studio"""
from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, Text, Boolean, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    avatar_url = Column(String, nullable=True)
    role = Column(String, default="user")  # user, admin
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    projects = relationship("Project", back_populates="owner")
    api_keys = relationship("ApiKey", back_populates="user")

class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True)
    name = Column(String)
    description = Column(Text, nullable=True)
    owner_id = Column(String, ForeignKey("users.id"))
    status = Column(String, default="active")  # active, archived
    settings = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="projects")
    chats = relationship("Chat", back_populates="project")
    files = relationship("File", back_populates="project")
    automations = relationship("Automation", back_populates="project")

class Chat(Base):
    __tablename__ = "chats"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"))
    title = Column(String)
    model = Column(String)
    agent_id = Column(String, nullable=True)
    messages = Column(JSON, default=list)
    usage = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="chats")

class File(Base):
    __tablename__ = "files"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"))
    name = Column(String)
    path = Column(String)
    content = Column(Text, nullable=True)
    size = Column(Integer, default=0)
    language = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="files")

class Agent(Base):
    __tablename__ = "agents"

    id = Column(String, primary_key=True)
    name = Column(String)
    description = Column(Text)
    type = Column(String, default="custom")  # built-in, custom
    model = Column(String)
    system_prompt = Column(Text, nullable=True)
    tools = Column(JSON, default=list)
    memory_scope = Column(String, default="project")
    config = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

class Automation(Base):
    __tablename__ = "automations"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"))
    name = Column(String)
    description = Column(Text)
    status = Column(String, default="draft")  # draft, active, paused, error
    trigger = Column(JSON)
    steps = Column(JSON, default=list)
    runs = Column(Integer, default=0)
    success_rate = Column(Float, default=100.0)
    last_run = Column(DateTime, nullable=True)
    next_run = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="automations")

class UsageRecord(Base):
    __tablename__ = "usage_records"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    model = Column(String)
    provider = Column(String)
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    cost = Column(Float, default=0.0)
    duration_ms = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))
    provider = Column(String)  # openai, anthropic, etc.
    key_hash = Column(String)
    key_preview = Column(String)  # Last 4 chars
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="api_keys")

class KnowledgeItem(Base):
    __tablename__ = "knowledge_items"

    id = Column(String, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"))
    name = Column(String)
    type = Column(String)  # pdf, doc, code, url, image
    source = Column(String)
    size = Column(Integer, default=0)
    chunks = Column(Integer, default=0)
    embedding_id = Column(String, nullable=True)
    metadata = Column(JSON, default=dict)
    status = Column(String, default="processing")  # processing, indexed, error
    created_at = Column(DateTime, default=datetime.utcnow)

# Database initialization
engine = None
SessionLocal = None

def init_db(database_url: str = None):
    global engine, SessionLocal
    from core.config import settings

    url = database_url or settings.DATABASE_URL
    engine = create_engine(url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return engine

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
