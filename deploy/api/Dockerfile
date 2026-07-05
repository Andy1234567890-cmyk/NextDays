# deploy/api/Dockerfile — PRODUCTION-Image für den FastAPI-Service.
#
# Bewusst getrennt vom Dev-Dockerfile (apps/api/Dockerfile), damit die lokale
# Entwicklung (uvicorn --reload via docker-compose.yml) unberührt bleibt.
#
# Prod-Unterschiede zum Dev-Image:
#   - kein --reload, kein Code-Volume-Mount (Code ist fest im Image)
#   - mehrere uvicorn-Worker (UVICORN_WORKERS, Default 4)
#   - läuft als NON-ROOT-User (appuser)
#   - HEALTHCHECK auf /health (Endpoint: src/main.py)
#   - Multi-Stage: Build-Tools landen nicht im Runtime-Layer
#
# Build-Kontext ist apps/api (siehe deploy/docker-compose.prod.yml → build.context).

# --- Stage 1: Dependencies bauen ---------------------------------------------
FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1

WORKDIR /app

# Nur die Dependency-Deklaration zuerst (Layer-Caching).
COPY pyproject.toml ./
# In ein eigenständiges venv installieren, das wir in die Runtime kopieren.
RUN uv venv /opt/venv && \
    VIRTUAL_ENV=/opt/venv uv pip install --no-cache .

# --- Stage 2: schlankes Runtime-Image ----------------------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    VIRTUAL_ENV=/opt/venv \
    UVICORN_WORKERS=4

# curl nur für den HEALTHCHECK; danach Caches aufräumen (kleines Image).
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Non-Root-User: das Image läuft NICHT als root (Sicherheit).
RUN useradd --create-home --uid 10001 appuser

WORKDIR /app

# Fertiges venv aus dem Builder übernehmen.
COPY --from=builder /opt/venv /opt/venv

# Anwendungscode. .dockerignore (apps/api/.dockerignore) hält .env, .git,
# tests, Caches draußen — KEIN Secret-Leak in den Layer.
COPY . .

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Healthcheck gegen den bestehenden /health-Endpoint (src/main.py).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

# Prod-Start: mehrere Worker, KEIN --reload. Worker-Zahl per Env steuerbar.
CMD ["sh", "-c", "uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS}"]
