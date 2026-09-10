# apps/dac7-API/Dockerfile — die DAC7-Versand-API als eigenes Image
#
# Der einzige Dienst des Hauses, der mit der Steuerbehoerde spricht. Er
# haelt deren Zugangsdaten; je weniger Code daneben liegt, desto kleiner
# die Angriffsflaeche. Deshalb ein eigenes, sehr schmales Image: kein
# Supabase, kein Redis, kein Stripe, keine Datenbank.
#
# Basis per DIGEST gepinnt (CI-Vorgabe): ein Tag wie `3.12-slim` zeigt
# morgen auf ein anderes Image, und ein Build, der sich unter der Hand
# aendert, ist nicht nachvollziehbar. Digest identisch zu den
# Schwesterdiensten (21.08.2026).
FROM python:3.12-slim@sha256:2c941e860699f878900b0edc2403613c234d4b32eda3cc9fa7036991a2a63c4a AS base

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1

WORKDIR /app

COPY pyproject.toml ./
RUN uv pip install --system --no-cache .

COPY . .

RUN useradd --create-home --uid 10001 dac7api \
    && chown -R dac7api:dac7api /app
USER dac7api

EXPOSE 8000

# Zwei Arbeiter reichen: Ein Betrieb reicht seine Meldung einmal im Jahr
# ein. Der Dienst haelt keinen Zustand im Speicher (anders als die
# Empfangsstelle), mehrere Prozesse waeren also unbedenklich — nur eben
# ohne Nutzen.
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
