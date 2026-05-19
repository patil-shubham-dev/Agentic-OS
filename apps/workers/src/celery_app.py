"""Celery configuration for AgentOS Studio"""
from celery import Celery
from celery.signals import task_prerun, task_postrun
import os

app = Celery("agentos")

app.conf.update(
    broker_url=os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0"),
    result_backend=os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0"),
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)

# Auto-discover tasks
app.autodiscover_tasks(["src.tasks"])

@task_prerun.connect
def task_prerun_handler(task_id, task, args, kwargs, **extras):
    print(f"Task {task.name}[{task_id}] started")

@task_postrun.connect
def task_postrun_handler(task_id, task, args, kwargs, retval, state, **extras):
    print(f"Task {task.name}[{task_id}] finished with state: {state}")
