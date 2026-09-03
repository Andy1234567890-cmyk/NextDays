"""Die öffentliche myNextDays-API (v1) — eigenständiger FastAPI-Service.

Was diesen Service von `apps/api` unterscheidet, ist nicht nur der Prozess:

  * **Sichtbares Schema.** `/openapi.json` und `/docs` sind hier ÖFFENTLICH. Die
    Haupt-API versteckt beides in Produktion (Schema-Disclosure, OWASP A8) — dort
    ist das richtig, weil ihre Endpunkte nur unsere eigenen Oberflächen bedienen.
    Bei einer veröffentlichten API ist das Schema das Produkt.
  * **Feste Versionierung.** Der Pfad trägt `/v1`. Eine brechende Änderung
    bekommt `/v2` und v1 eine Abkündigungsfrist — nicht „wir passen den Client
    mit an", wie es intern möglich ist.
  * **Andere Auth-Welt.** Kein Supabase-Login, keine Rollen, keine Cookies.
    Client-Credentials → kurzlebiges Token → Scopes (`core/auth.py`).
  * **Eigene Grenzen.** Rate-Limits je Zugang, harte Obergrenzen für Seiten und
    Zeiträume, Idempotenz beim Buchen.

Gemeinsam mit der Haupt-API sind nur die Datenbank und vier bewusst
byte-identische Dateien (siehe README). Es gibt KEINEN Import und keinen
HTTP-Aufruf zwischen beiden Diensten.
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, PlainTextResponse

from .core import errors
from .core.config import get_settings
from .core.logging import configure_logging, get_logger
from .core.middleware import (
    RateLimitMiddleware,
    RequestIdMiddleware,
    SicherheitsKopfMiddleware,
)
from .core.ratelimit import RateLimiter, build_redis
from .v1 import router as v1_router

log = get_logger("publicapi")

# Beschreibung für die veröffentlichte Referenz. Sie ist der Einstieg für jeden
# Entwickler und deshalb Teil des Codes, nicht nur der Doku-Seite: eine
# Beschreibung, die neben dem Schema liegt, veraltet weniger schnell.
BESCHREIBUNG = """
Die öffentliche REST-API von myNextDays. Sie gibt Zugriff auf Objekte,
Verfügbarkeit, Preise, Buchungen, Gäste und Aufgaben eines Betriebs.

## In fünf Minuten zum ersten Aufruf

1. Im Dashboard unter **Konto → API-Zugang** einen Zugang anlegen. Du erhältst
   `client_id` und `client_secret`. Das Secret wird **einmal** angezeigt.
2. Token holen:

   ```
   curl -X POST https://open-api.mynextdays.com/v1/oauth/token \\
     -H 'Content-Type: application/json' \\
     -d '{"grant_type":"client_credentials",
          "client_id":"mnd_live_id_…","client_secret":"mnd_live_…"}'
   ```

3. Aufrufen:

   ```
   curl https://open-api.mynextdays.com/v1/properties \\
     -H 'Authorization: Bearer <access_token>'
   ```

## Was du wissen musst

* **Das Datenmodell.** Ein *Objekt* (`property`) ist genau ein Einheiten-TYP —
  ein Zimmertyp im Hotel oder ein Ferienobjekt. Darunter hängen seine
  *Einheiten* (`units`), im Normalfall genau eine. Verkauft wird die Einheit,
  bepreist wird der Typ. Verfügbarkeit ist deshalb eine **Zahl** (freie
  Einheiten), keine Ja/Nein-Angabe.
* **Währung.** Jeder Betrag trägt seinen Währungscode. Es gibt keinen
  Standardwert — fehlt die Währung an einem Objekt, ist das ein Datenfehler und
  der Aufruf schlägt fehl.
* **Zeitangaben.** Zeitstempel sind UTC (ISO 8601 mit `Z`). Datumsfelder sind
  reine Kalendertage in der Zeitzone des Objekts.
* **Fehler.** Immer `application/problem+json` (RFC 9457) mit stabilem `code`.
* **Rate-Limits.** Je Zugang, in drei Eimern, mit `RateLimit-*`-Headern.
* **Idempotenz.** `Idempotency-Key` ist beim Anlegen einer Buchung Pflicht.
"""

TAGS = [
    {"name": "Auth", "description": "Access-Token holen."},
    {"name": "Objekte", "description": "Objekte (Einheiten-Typen) und ihre Einheiten."},
    {"name": "Verfügbarkeit", "description": "Freie Einheiten je Tag; sperren und freigeben."},
    {"name": "Preise", "description": "Tagespreise und Aufenthaltsregeln."},
    {"name": "Buchungen", "description": "Buchungen lesen und anlegen."},
    {"name": "Gäste", "description": "Gästestammdaten."},
    {"name": "Aufgaben", "description": "Reinigung und Wartung."},
    {"name": "Webhooks", "description": "Ereignis-Abos."},
    {"name": "Betrieb", "description": "Erreichbarkeit und Selbstauskunft."},
]


@asynccontextmanager
async def lebenszyklus(app: FastAPI) -> AsyncIterator[None]:
    """Redis-Verbindung für den Limiter auf- und abbauen.

    Der Limiter hängt an der App, nicht an einem Modul-Global: bei mehreren
    Uvicorn-Workern bekommt jeder seine Verbindung, aber alle zählen auf
    denselben Redis-Schlüssel.
    """
    settings = get_settings()
    configure_logging(settings.log_level, json_logs=settings.json_logs)
    redis = build_redis(settings.redis_url)
    app.state.limiter = RateLimiter(redis)
    log.info("publicapi_start", env=settings.app_env, basis=settings.public_base_url)
    try:
        yield
    finally:
        await app.state.limiter.aclose()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="myNextDays Public API",
        version="1.0.0",
        description=BESCHREIBUNG,
        openapi_tags=TAGS,
        lifespan=lebenszyklus,
        # Öffentlich — im Gegensatz zur Haupt-API. Das Schema IST hier das
        # Produkt; es zu verstecken hieße, die API unbenutzbar zu machen.
        docs_url="/docs",
        openapi_url="/openapi.json",
        # Redoc zusätzlich: die Referenz liest sich dort besser, `/docs` kann
        # dafür Aufrufe absenden. Zwei Ansichten auf EIN Schema, keine zweite
        # Wahrheit.
        redoc_url="/referenz",
        servers=[{"url": settings.public_base_url, "description": "Produktion"}],
    )

    # Reihenfolge: Starlette führt die ZULETZT hinzugefügte Middleware als
    # ERSTE aus. Die Request-ID muss zuerst stehen, damit auch ein 429 aus dem
    # Limiter sie schon trägt.
    app.add_middleware(
        RateLimitMiddleware,
        # Der Limiter entsteht erst im Lifespan (Redis-Verbindung); die
        # Middleware holt ihn deshalb zur Laufzeit statt beim Bau der Kette.
        limiter_quelle=lambda: app.state.limiter,
        settings=settings,
    )
    app.add_middleware(RequestIdMiddleware)
    # Zuletzt hinzugefuegt = zuerst ausgefuehrt: so tragen auch die
    # Antworten, die der Limiter selbst erzeugt (429), die Kopfzeilen.
    app.add_middleware(SicherheitsKopfMiddleware)

    app.include_router(v1_router, prefix="/v1")

    # -- Fehler einheitlich als problem+json ---------------------------------
    @app.exception_handler(errors.ApiFehler)
    async def _api_fehler(request: Request, exc: errors.ApiFehler) -> JSONResponse:
        if exc.status >= 500:
            log.error("api_fehler", code=exc.code, pfad=request.url.path)
        return errors.problem_antwort(request, exc)

    @app.exception_handler(RequestValidationError)
    async def _validierung(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """Pydantic-Validierungsfehler in dasselbe Format übersetzen.

        Ohne diesen Handler liefert FastAPI sein eigenes `{"detail": [...]}` —
        ein zweites Fehlerformat in derselben API, das jeder Client zusätzlich
        behandeln müsste.
        """
        felder = [
            {
                "feld": ".".join(str(t) for t in f.get("loc", ()) if t != "body"),
                "problem": f.get("msg", ""),
            }
            for f in exc.errors()
        ]
        return errors.problem_antwort(
            request,
            errors.ApiFehler(
                status=422,
                code="validierung_fehlgeschlagen",
                detail="Die Anfrage entspricht nicht dem Schema.",
                titel="Validierung fehlgeschlagen",
                extra={"felder": felder},
            ),
        )

    @app.get("/health", tags=["Betrieb"], include_in_schema=False)
    def health() -> dict[str, str]:
        """Erreichbarkeit für Monitoring. Ohne Auth, ohne DB-Zugriff — eine
        Prüfung, die die Datenbank anfasst, meldet bei jedem DB-Wackler einen
        toten Service."""
        return {"status": "ok", "service": "public-api", "version": "1.0.0"}

    @app.get(
        "/robots.txt",
        tags=["Betrieb"],
        include_in_schema=False,
        response_class=PlainTextResponse,
    )
    def robots() -> str:
        """robots.txt fuer die API-Domaene.

        Sie fehlte bis zum 03.09.2026 ganz: die Google Search Console meldete
        fuer `https://open-api.mynextdays.com/robots.txt` „Nicht abgerufen —
        Nicht gefunden (404)". Ohne die Datei crawlt Google die Domaene nach
        eigenem Ermessen, also auch die `/v1`-Endpunkte. Die antworten ohne
        Token mit 401 — ein Crawl-Budget, das ausschliesslich Fehlerseiten
        einsammelt, und in Googles Bericht sieht die Domaene dauerhaft kaputt
        aus.

        Was hier ERLAUBT ist, ist eine bewusste Entscheidung: `/docs`,
        `/referenz` und `/openapi.json` SIND die oeffentliche
        Entwicklerdokumentation. Wer nach „myNextDays API" sucht, ist ein
        moeglicher Integrationspartner und soll sie finden — dieselbe
        Begruendung, aus der `/entwickler` in der Sitemap der Marketing-Seite
        steht.

        Gesperrt ist alles unter `/v1`: Nutzdaten hinter Auth, die in keinen
        Index gehoeren.

        Kein `Host:` und keine erfundene Direktive: Die Search Console meldet
        fuer `Host:` „Regel wird von Googlebot ignoriert" (gemessen am
        29.08.2026 auf der Marketing-Domaene). Eine wirkungslose Zeile, die
        eine dauerhafte Warnung erzeugt, verdeckt die naechste echte.
        """
        zeilen = [
            "User-agent: *",
            "Allow: /docs",
            "Allow: /referenz",
            "Allow: /openapi.json",
            "Disallow: /v1",
            "",
            "# Entwicklerdokumentation: https://www.mynextdays.com/entwickler",
            "",
        ]
        return "\n".join(zeilen)

    _schema_mit_auth(app)
    return app


def _schema_mit_auth(app: FastAPI) -> None:
    """Traegt `bearerAuth` in die veroeffentlichte Spec nach.

    Die Auth haengt an einem `Header`-Parameter (core/auth.py), nicht an
    FastAPIs `Security(...)` — dadurch stand `components.securitySchemes` leer
    und `security` fehlte ganz. Funktional war das harmlos, fuer einen Partner
    aber nicht: ein aus der Spec generierter Client kennt dann keinen
    Auth-Mechanismus und schickt Anfragen ohne Token, bis jemand die Doku liest.

    Nachtragen statt umbauen: die Auth-Kette ist geprueft, und ein Wechsel auf
    `Security(HTTPBearer())` wuerde jede Abhaengigkeit anfassen, ohne am
    Verhalten etwas zu aendern.
    """
    urspruenglich = app.openapi

    def openapi() -> dict[str, object]:
        schema = urspruenglich()
        komponenten = schema.setdefault("components", {})
        komponenten.setdefault("securitySchemes", {})["bearerAuth"] = {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": (
                "Kurzlebiges Zugriffstoken aus `POST /v1/oauth/token` "
                "(client_credentials). Gueltig 3600 Sekunden."
            ),
        }
        # Global, mit Ausnahme des Token-Endpunkts selbst: er ist der EINE Weg
        # hinein und darf kein Token verlangen, sonst kaeme niemand an eines.
        schema["security"] = [{"bearerAuth": []}]
        token_pfad = schema.get("paths", {}).get("/v1/oauth/token", {})
        for operation in token_pfad.values():
            if isinstance(operation, dict):
                operation["security"] = []
        return schema

    app.openapi = openapi  # type: ignore[method-assign]


app = create_app()
