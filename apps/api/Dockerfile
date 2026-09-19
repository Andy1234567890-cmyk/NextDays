# apps/api/Dockerfile — FastAPI-Service für lokale Entwicklung
#
# Baut ein schlankes, zustandsloses Image. Der eigentliche Start (uvicorn)
# erfolgt über das `command` in docker-compose.yml, nicht hier — so kann
# Compose Reload-Mounts setzen, ohne das Image neu bauen zu müssen.

FROM python:3.12-slim@sha256:2c941e860699f878900b0edc2403613c234d4b32eda3cc9fa7036991a2a63c4a AS base

# uv: schneller, deterministischer Python-Paketmanager.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1

WORKDIR /app

# Abhängigkeiten zuerst (Layer-Caching): nur pyproject ändert selten.
COPY pyproject.toml ./
RUN uv pip install --system --no-cache .

# Quellcode. Im Dev wird /app zusätzlich per Volume gemountet (Compose),
# wodurch lokale Änderungen ohne Rebuild greifen.
COPY . .

EXPOSE 8000

# Kein CMD/ENTRYPOINT mit Auto-Start: im Dev überschreibt das docker-compose.yml
# den command (uvicorn --reload). Der Fallback hier greift, wenn KEIN command
# gesetzt ist (z. B. der Prod-Deploy über deploy/supabase/docker-compose.yml, der
# dieses Image baut). Deshalb MUSS er die Worker-Zahl respektieren — sonst läuft
# die API mit nur einem Prozess (alle Requests seriell → CPU-Spike bei Last).
ENV UVICORN_WORKERS=4
CMD ["sh", "-c", "uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS}"]
