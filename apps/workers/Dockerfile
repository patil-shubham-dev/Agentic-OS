FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

CMD ["celery", "-A", "src.celery_app", "worker", "--loglevel=info", "--concurrency=4"]
