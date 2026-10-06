FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /backend

# Install dependencies first for better layer caching.
#
# git is NOT present in python:3.13-slim, and services/pipeline.py clones
# connected repos to disk so the analyzer has a durable checkout. Without
# it every POST /repos/{id}/analyze failed silently (the orchestrator only
# logs) and no snapshot was ever created.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml alembic.ini ./
COPY app ./app
COPY scripts ./scripts

RUN pip install --no-cache-dir .

EXPOSE 8000

# Apply pending Alembic migrations before serving. Render overrides this with
# its own dockerCommand (also migration-first), but the Dockerfile stays
# correct for anyone running the image directly. ${PORT:-8000} picks up the
# port Render injects while defaulting to 8000 outside Render.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]