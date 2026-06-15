# apps/api/Dockerfile — FastAPI-Service für lokale Entwicklung
#
# Baut ein schlankes, zustandsloses Image. Der eigentliche Start (uvicorn)
# erfolgt über das `command` in docker-compose.yml, nicht hier — so kann
# Compose Reload-Mounts setzen, ohne das Image neu bauen zu müssen.

FROM python:3.12-slim AS base

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

# Kein CMD/ENTRYPOINT mit Auto-Start: der Start kommt aus docker-compose.yml.
# Fallback für Standalone-Nutzung (z. B. `docker run`):
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
