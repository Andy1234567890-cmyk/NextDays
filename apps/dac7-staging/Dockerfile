# apps/dac7-staging/Dockerfile — die simulierte Empfangsstelle als eigenes Image
#
# Getrennt vom Image der Haupt-API, und das ist hier nicht nur Hygiene: Dieser
# Dienst spielt eine FREMDE Gegenstelle. Er gehoert auf einen anderen Server als
# das PMS, damit die Einreichung eine echte Netzwerkstrecke ist —
# Zeitueberschreitungen, Verbindungsabbrueche und TLS-Fehler treten dann
# wirklich auf, statt im selben Prozess wegoptimiert zu werden.
#
# Das Image ist winzig: kein Supabase, kein Redis, kein Stripe, keine Datenbank.
# Die Behoerde kennt unsere Tabellen nicht.

# Basis per DIGEST gepinnt (CI-Vorgabe): ein Tag wie `3.12-slim` zeigt morgen auf
# ein anderes Image, und ein Build, der sich unter der Hand aendert, ist nicht
# nachvollziehbar. Digest identisch zu apps/public-api (21.08.2026) — wer die
# Python-Version hebt, holt den neuen Digest AB, nicht schaetzen.
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

RUN useradd --create-home --uid 10001 dac7staging \
    && chown -R dac7staging:dac7staging /app
USER dac7staging

EXPOSE 8000

# GENAU EIN ARBEITER — anders als bei den Schwesterdiensten.
#
# Das Empfangsprotokoll liegt im Arbeitsspeicher des Prozesses (siehe
# core/protokoll.py: eingereichte Dateien enthalten CPR-Nummern, sie gehoeren
# nicht in eine Datenbank). Mit mehreren Arbeitern haette jeder sein eigenes
# Protokoll, und eine Quittung waere nur in dem Prozess abrufbar, der sie
# ausgestellt hat — mal gefunden, mal 404, je nachdem welcher Arbeiter die
# Anfrage bekommt.
#
# Die Last rechtfertigt keinen zweiten Prozess: Ein Betrieb reicht seine
# Meldung einmal im Jahr ein.
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
