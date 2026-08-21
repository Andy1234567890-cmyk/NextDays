# apps/public-api/Dockerfile — die öffentliche API als eigenes Image
#
# Getrennt vom Image der Haupt-API, und das ist der Punkt: dieser Service
# installiert nur, was er braucht (kein Stripe, kein Twilio, kein Firebase, kein
# Pillow). Das Image ist dadurch ein Bruchteil so groß, startet schneller und
# hat eine kleinere Angriffsfläche — bei einem öffentlich erreichbaren Dienst der
# wichtigere Teil.
#
# DASSELBE Image bedient beide Prozesse:
#   Web       uvicorn src.main:app          (Standard-CMD)
#   Zusteller python -m src.zusteller.dispatcher
# Zwei Container aus einem Image, weil sie denselben Code und dieselbe
# Konfiguration brauchen, aber getrennt skalieren: ein langsamer Kunden-Endpunkt
# darf keine API-Anfrage aufhalten.

# Basis per DIGEST gepinnt (CI-Vorgabe): ein Tag wie `3.12-slim` zeigt morgen auf
# ein anderes Image, und ein Build, der sich unter der Hand ändert, ist nicht
# nachvollziehbar.
# Digest vom 21.08.2026 (`docker inspect python:3.12-slim`). Wer die
# Python-Version hebt, holt den neuen Digest AB — nicht schätzen: ein falscher
# Digest bricht den Build mit einer Meldung, die nach Netzproblem aussieht.
FROM python:3.12-slim@sha256:2c941e860699f878900b0edc2403613c234d4b32eda3cc9fa7036991a2a63c4a AS base

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1

WORKDIR /app

# Abhängigkeiten zuerst (Layer-Caching).
COPY pyproject.toml ./
RUN uv pip install --system --no-cache .

COPY . .

# Nicht als root laufen. Ein öffentlich erreichbarer Prozess mit root-Rechten
# macht aus jeder Lücke im Prozess eine Lücke im Container.
RUN useradd --create-home --uid 10001 publicapi \
    && chown -R publicapi:publicapi /app
USER publicapi

EXPOSE 8000

# Vier Prozesse als Standard. Uvicorn arbeitet synchron gegen PostgREST, ein
# einzelner Prozess würde Anfragen seriell abarbeiten.
ENV UVICORN_WORKERS=4
CMD ["sh", "-c", "uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS}"]
