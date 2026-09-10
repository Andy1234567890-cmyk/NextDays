"""FastAPI App-Einstieg. App-Factory; registriert alle Vertical Slices.

Startet keinen Server beim Import (PROJECT.md). Lokaler Start via uvicorn:
    uvicorn src.main:app --reload
"""
import contextlib
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
import structlog
from fastapi import APIRouter, FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError as PostgrestAPIError
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .core.config import get_settings
from .core.logging import configure_logging, get_logger
from .core.ratelimit_middleware import RateLimitMiddleware
from .core.request_context import merke_ursache as _merke_fehlerursache
from .core.request_context import neue_request_id
from .features.account_deletion.router import (
    router as account_deletion_router,
)
from .features.addons.router import router as addons_router
from .features.affiliates.router import router as affiliates_router
from .features.affiliates.router_backoffice import router as affiliates_backoffice_router
from .features.affiliates.router_reichweite import router as affiliates_reichweite_router
from .features.affiliates.router_reichweite import (
    router_backoffice as affiliates_reichweite_backoffice_router,
)
from .features.announcements.router import (
    platform_router as announcements_platform_router,
)
from .features.announcements.router import router as announcements_router
from .features.api_clients.router import router as api_clients_router
from .features.auswertung.router import router as auswertung_router
from .features.auth.router import router as auth_router
from .features.booking_conditions.router import router as booking_conditions_router
from .features.booking_engine.router import router as booking_engine_router
from .features.booking_offers.router import oeffentlich as booking_offers_public_router
from .features.booking_offers.router import router as booking_offers_router
from .features.buchhaltung.router import router as buchhaltung_router
from .features.calendar.router import router as calendar_router
from .features.channel_manager.router import router as channel_manager_router
from .features.channel_manager.sandbox_ota import router as sandbox_ota_router
from .features.cohosts.router import router as cohosts_router
from .features.contact.router import router as contact_router
from .features.content.router import router as content_router
from .features.crm.router import router as crm_router
from .features.dashboard.router import router as dashboard_router
from .features.dashboard_layout.router import (
    router as dashboard_layout_router,
)
from .features.diagnostics.router import router as diagnostics_router
from .features.donations.router import router as donations_router
from .features.external_calendar.router import router as external_calendar_router
from .features.guest_auth.router import router as guest_auth_router
from .features.guest_blocks.router import router as guest_blocks_router
from .features.guest_bookings.router import router as guest_bookings_router
from .features.guest_messages.router import router as guest_messages_router
from .features.guest_reviews.router import router as guest_reviews_router
from .features.guest_stay.router import router as guest_stay_router
from .features.guest_wishlist.router import router as guest_wishlist_router
from .features.guests.router import router as guests_router
from .features.host_messages.router import router as host_messages_router
from .features.host_profiles.router import router as host_profiles_router
from .features.inbox import scheduler as inbox_scheduler
from .features.inbox.router import router as inbox_router
from .features.login_devices.router import router as login_devices_router
from .features.mcp.router import discovery_router as mcp_discovery_router
from .features.mcp.router import router as mcp_router
from .features.media.router import router as media_router
from .features.newsletter.router import router as newsletter_router
from .features.notification_settings.router import (
    router as notification_settings_router,
)
from .features.ocr.router import router as ocr_router
from .features.owner_billing.router import router as owner_billing_router
from .features.owner_chat.fehler import OwnerChatError
from .features.owner_chat.router import router as owner_chat_router
from .features.owner_reporting.router import router as owner_reporting_router
from .features.owner_statements.router import router as owner_statements_router
from .features.owners.router import router as owners_router
from .features.payments.router import router as payments_router
from .features.payouts.router import router as payouts_router
from .features.personal.router import router as personal_router
from .features.platform_admin.router import router as platform_admin_router
from .features.pricing.router import router as pricing_router
from .features.privacy_settings.router import router as privacy_settings_router
from .features.produktwissen.router import router as produktwissen_router
from .features.properties.router import router as properties_router
from .features.property_custom_fields.router import (
    router as property_custom_fields_router,
)
from .features.property_discounts.router import router as property_discounts_router
from .features.property_dossier.router import router as property_dossier_router
from .features.property_portal.router import router as property_portal_router
from .features.property_taxes.router import router as property_taxes_router
from .features.public_portal.router import router as public_portal_router
from .features.rates.router import router as rates_router
from .features.reservations.router import router as reservations_router
from .features.reviews.router import router as reviews_router
from .features.schloesser.router import router as schloesser_router
from .features.schloesser.webhook import router as schloesser_webhook_router
from .features.site_config.ki_router import ki_router as site_config_ki_router
from .features.site_config.router import manage_router as site_config_manage_router
from .features.site_config.router import public_router as site_config_public_router
from .features.subscriptions.router import router as subscriptions_router
from .features.support.router import router as support_router
from .features.tasks.router import router as tasks_router
from .features.taxpayer.dac7.router import router as dac7_router
from .features.taxpayer.router import router as taxpayer_router
from .features.travel_agencies.router import router as travel_agencies_router
from .features.whatsapp.router import router as whatsapp_router

# Wie lange ein Client warten soll, bevor er einen wegen Nichterreichbarkeit
# der Datenbank abgewiesenen Aufruf wiederholt (`Retry-After` bei 503). Kurz
# genug, dass eine Sekundenstörung nicht als Ausfall durchschlägt, lang genug,
# dass ein wirklich toter Host nicht sofort neu angestürmt wird.
_RETRY_AFTER_S = 5

_SLICE_ROUTERS = [
    auth_router,
    buchhaltung_router,
    properties_router,
    property_custom_fields_router,
    property_portal_router,
    property_dossier_router,
    owners_router,
    owner_statements_router,
    owner_billing_router,
    # Reporting für Eigentümer (0365): Bericht → Zahlung → Teilzahlung, Pläne,
    # Bilanzstatistik. Baut auf owner_billing (Vertrag/Portal-Sätze) auf.
    auswertung_router,
    owner_reporting_router,
    addons_router,
    rates_router,
    pricing_router,
    property_discounts_router,
    calendar_router,
    reservations_router,
    guests_router,
    # Bewertungs-Cockpit des Betriebs: Portale + myBestDays in EINER Liste.
    reviews_router,
    # Gast-/Kunden-Dashboard der Plattform-Demand-Seite (/plattform).
    guest_auth_router,
    guest_blocks_router,
    guest_bookings_router,
    guest_stay_router,
    guest_messages_router,
    guest_wishlist_router,
    guest_reviews_router,
    host_messages_router,
    host_profiles_router,
    inbox_router,
    login_devices_router,
    mcp_router,
    notification_settings_router,
    privacy_settings_router,
    payments_router,
    payouts_router,
    # Plattform-Backoffice: mandantenübergreifende Router. Beide arbeiten
    # bewusst quer zu allen Betrieben und tragen deshalb denselben Schutz —
    # Guard CurrentPlatformAdmin, DB-geprüfte Rolle, require_platform_write vor
    # jedem Schreibzugriff, vollständiges Audit-Log. Ein Endpunkt hier ohne
    # diesen Guard wäre ein Totalausfall der Mandantentrennung.
    platform_admin_router,
    # Redaktion der offiziellen Ankündigungen (0337).
    announcements_platform_router,
    # Zugehöriger Kunden-Lesepfad — tenant-gescopt, nicht übergreifend.
    announcements_router,
    subscriptions_router,
    account_deletion_router,
    newsletter_router,
    # Kontaktformular der Marketing-Seite (0414) — öffentlich, Bucket
    # `public_support`, reCAPTCHA-geprüft.
    contact_router,
    support_router,
    # Produktberater der Marketing-Seite (0626): beantwortet Fragen zur
    # Software aus den Hilfe-Artikeln, bevor ein Ticket entsteht. Liegt im
    # Support-Praefix, damit der strenge Bucket `public_support` greift.
    produktwissen_router,
    property_taxes_router,
    taxpayer_router,
    # DAC7-Meldung: erzeugt aus den Buchungen die Datei fuer die Behoerde.
    dac7_router,
    external_calendar_router,
    schloesser_router,
    schloesser_webhook_router,
    cohosts_router,
    donations_router,
    diagnostics_router,
    api_clients_router,
    channel_manager_router,
    sandbox_ota_router,
    booking_engine_router,
    # Buchungsangebot (0586, Lastenheft §2.2): interne Verwaltung und die
    # öffentliche Annahmeseite des Gastes (Token statt Anmeldung).
    booking_offers_router,
    booking_offers_public_router,
    booking_conditions_router,
    site_config_manage_router,
    site_config_public_router,
    site_config_ki_router,
    ocr_router,
    owner_chat_router,
    public_portal_router,
    tasks_router,
    # Personal & Dienstplan (0540/0541, ADR-0023): Akte, Dienstplan,
    # Abwesenheit, Zeiterfassung, Lohnvorbereitung.
    personal_router,
    media_router,
    travel_agencies_router,
    crm_router,
    dashboard_router,
    dashboard_layout_router,
    content_router,
    whatsapp_router,
    # Partnerprogramm (0517): Partner-Welt (/affiliates) und Backoffice
    # (/platform/affiliates).
    affiliates_router,
    affiliates_backoffice_router,
    # Reichweite (0521): Beiträge, Kanalanbindung, Auswertung.
    affiliates_reichweite_router,
    affiliates_reichweite_backoffice_router,
]


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Sekundengenauer Scheduler für geplante Posteingang-Nachrichten:
    # beim Start offene pending-Nachrichten (neu) timern, beim Stop abbrechen.
    #
    # Er darf hier bleiben, der KI-Takt nicht: dieser Scheduler timert nur, was
    # im EIGENEN Prozess über `schedule()` aus dem Request-Pfad hereinkam, und
    # `dispatch_due_scheduled` claimt atomar.
    await inbox_scheduler.start()
    # DER KI-TAKT LÄUFT IM WORKER, NICHT HIER (`worker.py`,
    # `_ki_autoantwort_tick`). Er stand bis zum 09.09.2026 an dieser Stelle —
    # und dieser Lifespan läuft JE UVICORN-WORKER. Bei `UVICORN_WORKERS=4`
    # (Compose-Vorgabe) taktete er vierfach auf derselben Warteschlange, der
    # Guard im Takt-Modul ist prozesslokal und sah die anderen drei nicht.
    # Zusammen mit dem damals fehlenden Claim im Versand gingen KI-Antworten
    # mehrfach hinaus. Wer den Takt hier wieder anwirft, stellt genau das
    # wieder her (ADR-0030,
    # `docs/decisions/0030-takte-im-worker-nicht-in-der-api.md`).
    try:
        yield
    finally:
        await inbox_scheduler.stop()
        limiter_mw = getattr(app.state, "rate_limit_middleware", None)
        if limiter_mw is not None:
            await limiter_mw.aclose()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level, json_logs=not settings.is_local)
    log = get_logger("nextdays.api")

    # Schema-Disclosure (OWASP A8): /docs, /redoc, /openapi.json nur lokal. In
    # Prod exponiert das sonst die gesamte API-Struktur (kein Datenleck, aber
    # Angreifer-Aufklärung) — die Endpunkte selbst bleiben ohnehin auth-geschützt.
    _docs = {} if settings.is_local else {
        "docs_url": None, "redoc_url": None, "openapi_url": None,
    }
    app = FastAPI(
        title="NextDays API", version="0.1.0", lifespan=_lifespan, **_docs
    )

    # CORS default-deny: mit allow_credentials=True würde Starlettes allow_methods=["*"]
    # die Request-Methode reflektieren und damit JEDE Methode (inkl. neuer wie QUERY,
    # RFC 10008) für credential-tragende Browser-Requests freigeben. Stattdessen eine
    # explizite Allowlist der real genutzten Methoden + OPTIONS (Preflight). Eine
    # unbekannte Methode fällt so durch den Preflight, statt automatisch erlaubt zu sein.
    # (CORS ist Browser-Schutz, keine Server-Autorisierung — die erzwingt der Auth-
    #  Dependency pro Route; diese Allowlist hält das Prinzip dennoch konsistent.)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
        allow_headers=["*"],
        # Ohne expose_headers bleibt X-Request-Id für Browser-JS unsichtbar
        # (CORS gibt nur die einfachen Antwort-Header frei). Der Diagnose-
        # Reporter braucht ihn, um einen Fehler der Backend-Ursache zuzuordnen.
        #
        # X-MFA-Required / X-MFA-Enrollment-Required steuern die 2FA-Oberfläche:
        # Der Browser MUSS unterscheiden können, ob ein 401 „Sitzung abgelaufen"
        # (→ /login) oder „zweiter Faktor fehlt" (→ Faktor lösen bzw. einrichten)
        # bedeutet. Ohne den Eintrag hier liest JS den Header nicht — der
        # Header wird zwar gesendet, ist aber für die App unsichtbar, und die
        # Oberfläche würde den Nutzer bei fehlender 2FA auf den Login werfen.
        expose_headers=[
            "X-Request-Id",
            "X-MFA-Required",
            "X-MFA-Enrollment-Required",
        ],
    )

    # Host-Header-Injection (Cache-Poisoning, Password-Reset-Poisoning): nur die
    # deklarierten Hosts akzeptieren. Lokal offen (localhost/127.0.0.1 wechseln).
    if not settings.is_local and settings.trusted_host_list:
        app.add_middleware(
            TrustedHostMiddleware, allowed_hosts=settings.trusted_host_list
        )

    # Security-Header auf JEDE Antwort. Die API rendert kein HTML (reines JSON),
    # deshalb default-src 'none' + frame-ancestors 'none' (nie einbettbar). HSTS
    # setzt der TLS-terminierende Proxy (Traefik), NICHT hier — sonst Duplikat.
    @app.middleware("http")
    async def _security_headers(request: Request, call_next):  # noqa: ANN001,ANN202
        # Request-ID zuerst: Sie muss stehen, BEVOR ein Handler fehlschlagen
        # kann — sonst hätte ausgerechnet der Fehlerfall keine ID. Ein vom
        # Client mitgeschickter Wert wird bewusst ignoriert: Die ID landet im
        # Log und in der Diagnose, sie darf nicht angreiferkontrolliert sein
        # (Log-Injection, Wurzel 3).
        request.state.request_id = neue_request_id()
        # Kontext dieses Requests zuruecksetzen, BEVOR er laeuft. Ohne das
        # traegt ein Request die Bindungen (tenant/user) des vorigen weiter,
        # solange der Worker-Task wiederverwendet wird — und genau dann zeigt
        # das Log den falschen Betrieb, was die Diagnose ins Gegenteil
        # verkehrt.
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request.state.request_id)

        _beginn = time.perf_counter()
        resp = await call_next(request)

        # ZUGRIFFSZEILE mit Betrieb. Uvicorns eigene Zeile ("GET /properties
        # 200 OK") nennt Pfad und Status, aber nicht, WESSEN Sitzung sie
        # bekommen hat — und das war am 29.08.2026 die eine fehlende Angabe,
        # als im Onboarding eines frischen Betriebs die 18 Objekte eines
        # fremden Betriebs standen. Der `tenant` kommt aus dem Kontext, den
        # `core.security._sitzung_protokollieren` beim Auflesen des Tokens
        # gebunden hat; bei oeffentlichen Routen bleibt er leer.
        # `suppress`: faellt das Logging aus, laesst sich das nicht loggen —
        # die Antwort geht trotzdem hinaus (Wurzel 5, best-effort-Zweig).
        with contextlib.suppress(Exception):
            log.info(
                "zugriff",
                # `getattr` mit Vorgabe: oeffentliche Routen (Login, Health,
                # Webhooks) durchlaufen `get_current_user` nie, dort ist die
                # Angabe zu Recht leer. Ein "-" macht sichtbar, dass es KEINE
                # Sitzung gab — ein fehlendes Feld saehe aus wie ein Fehler.
                tenant=getattr(request.state, "log_tenant", "-"),
                user=getattr(request.state, "log_user", "-"),
                rolle=getattr(request.state, "log_rolle", "-"),
                method=request.method,
                pfad=request.url.path,
                status=resp.status_code,
                dauer_ms=round((time.perf_counter() - _beginn) * 1000),
            )

        # 2FA-Aufforderung: Der Guard (features.auth.mfa_gate) hat den Request
        # durchgelassen, weil die Einrichtungsfrist noch läuft — die
        # Oberfläche soll aber JETZT auffordern, nicht erst am Fristende. Der
        # Wert steht am request.state, weil eine Dependency keine Header an
        # eine erfolgreiche Antwort hängen kann. Fehlt er, passiert nichts
        # (kein erfundener Default, Wurzel 4).
        faellig = getattr(request.state, "mfa_enrollment_required", None)
        if faellig:
            resp.headers["X-MFA-Enrollment-Required"] = str(faellig)

        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "no-referrer")
        resp.headers.setdefault(
            "Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"
        )
        # Damit der Browser die ID melden kann. CORS blendet nicht-einfache
        # Header sonst aus — expose_headers in der CORS-Konfiguration gibt sie
        # frei.
        resp.headers.setdefault("X-Request-Id", request.state.request_id)
        return resp

    # Fail-closed & kein Stacktrace-Leak (Wurzel 5): unerwartete Exceptions werden
    # serverseitig geloggt (der Handler-Stack im Log), der Client bekommt nur einen
    # generischen 500 ohne interne Details. HTTPException/Validation bleiben davon
    # unberührt (FastAPI behandelt sie eigenständig mit klaren Statuscodes).
    #
    # Die Request-ID ist die Brücke zur Support-Diagnose: Sie steht im Log UND in
    # der Antwort, sodass der Support einen Frontend-Fehler der konkreten
    # Backend-Ursache zuordnen kann. Der Client erfährt weiterhin NUR die ID,
    # niemals Exception-Typ oder Stacktrace — die Zuordnung passiert im
    # Backoffice, nicht im Browser.
    # Validierungsfehler (422) sind der häufigste Fall im Alltag — und ohne
    # diesen Handler der undurchsichtigste: Der Client sah nur „422", nicht
    # WELCHES Feld abgelehnt wurde. FastAPIs Standardantwort enthält das zwar,
    # aber sie trägt keine Request-ID, mit der sich der Fall im Backoffice
    # wiederfinden ließe. Deshalb hier ergänzt.
    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):  # noqa: ANN202
        rid = getattr(request.state, "request_id", None)
        log.info(
            "validation_error",
            path=request.url.path,
            request_id=rid,
            felder=[".".join(str(p) for p in e.get("loc", ())) for e in exc.errors()],
        )
        return JSONResponse(
            status_code=422,
            content=jsonable_encoder(
                {"detail": exc.errors(), "request_id": rid}
            ),
            headers={"X-Request-Id": rid} if rid else None,
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):  # noqa: ANN202
        rid = getattr(request.state, "request_id", None)
        log.exception(
            "unhandled_error",
            path=request.url.path,
            error=type(exc).__name__,
            request_id=rid,
        )
        # Ursache für die Support-Diagnose hinterlegen — bewusst NUR
        # Exception-Typ und Herkunftsmodul, nie die Nachricht: die kann
        # Kundendaten oder Secrets enthalten.
        _merke_fehlerursache(rid, exc)
        return JSONResponse(
            status_code=500,
            content={"detail": "internal_error", "request_id": rid},
            headers={"X-Request-Id": rid} if rid else None,
        )

    # Die Datenbank war nicht erreichbar — das ist KEIN Programmfehler, sondern
    # ein vorübergehend nicht verfügbarer Dienst. Als 500 gemeldet heißt es für
    # den Nutzer „da ist etwas kaputt" und für jeden Client „nicht erneut
    # versuchen"; beides ist falsch. 503 + `Retry-After` sagt die Wahrheit und
    # erlaubt einen zweiten Versuch.
    #
    # Live am 16.08.2026: der TCP-Connect zu Kong lief in einen Timeout. Weil
    # das Auth-Gate auf jeder geschützten Route eine DB-Runde macht, kippten
    # `/auth/me` und `/dashboard/onboarding` gleichzeitig mit 500 — die
    # Oberfläche zeigte „Interner Fehler" statt „Dienst gerade nicht
    # erreichbar".
    #
    # `TransportError` deckt Verbindungsaufbau, Timeouts, Netzwerk- und
    # Protokollabbrüche ab — ausdrücklich NICHT `HTTPStatusError`: eine
    # geantwortete 4xx/5xx der Datenbank ist ein echter Fehler und bleibt einer.
    @app.exception_handler(httpx.TransportError)
    async def _db_nicht_erreichbar(request: Request, exc: httpx.TransportError):  # noqa: ANN202
        rid = getattr(request.state, "request_id", None)
        # `warning`, nicht `exception`: der Stacktrace einer Netzstörung ist bei
        # jedem Vorkommen derselbe und sagt nichts über die Ursache. Der Typ
        # (ConnectTimeout vs. ReadTimeout) unterscheidet „Host weg" von „Abfrage
        # zu langsam" — das ist die Information, die zählt.
        log.warning(
            "datenbank_nicht_erreichbar",
            path=request.url.path,
            error=type(exc).__name__,
            request_id=rid,
        )
        _merke_fehlerursache(rid, exc)
        headers = {"Retry-After": str(_RETRY_AFTER_S)}
        if rid:
            headers["X-Request-Id"] = rid
        return JSONResponse(
            status_code=503,
            content={"detail": "service_unavailable", "request_id": rid},
            headers=headers,
        )

    # Ein Pfad-/Query-Parameter, den der Client frei setzt, landet ungeprüft als
    # Wert in PostgREST. Ist er kein gültiger UUID/Zahl/Datumswert, antwortet
    # Postgres mit 22P02 („invalid input syntax") — bislang ein 500. Ein
    # kaputter Client-Wert ist aber ein Eingabefehler des Aufrufers, kein
    # Serverfehler: angreiferkontrollierter Input darf keinen 500 werfen
    # (Wurzel 5). Deshalb zentral auf 422 abbilden, statt in jedem Slice einzeln
    # zu prüfen. Jeder andere PostgREST-Fehler bleibt ein echter 500.
    #
    # NICHT jedes 22P02 ist aber ein Client-Wert — und diese Gleichsetzung hat
    # live drei Tage Diagnose gekostet (23.08.2026): ein Trigger auf
    # `public.tasks` verglich ein Enum mit dem Leerstring
    # (`coalesce(old.status, '')`, 0418) und ließ JEDES Update auflaufen mit
    #   invalid input value for enum public.task_status: ""
    # Der Handler hier machte daraus „Ungültiger Wert im Aufruf." (422) und ein
    # `log.info` OHNE die Postgres-Meldung. In der App stand damit „Zustand
    # nicht geändert · Ungültiger Wert im Aufruf" — es sah nach einem Fehler der
    # App aus, obwohl die App fehlerfrei war, und im Server-Log stand nichts,
    # womit man es hätte finden können.
    #
    # Die Trennung läuft deshalb über die Fehlerklasse, nicht über den Code:
    #   * „invalid input syntax for type <typ>" — ein LITERAL, das der Aufrufer
    #     geliefert hat (Pfad-UUID, Datum, Zahl), passt nicht auf den Spaltentyp
    #     → Eingabefehler → 422.
    #   * alles andere, insbesondere „invalid input value for enum" — ein
    #     Enum-Wert aus dem Body ist von Pydantic geprüft, bevor er hier ankommt.
    #     Kommt trotzdem ein ungültiger in der DB an, stammt er von UNS: ein
    #     Trigger, ein von Hand gebauter PostgREST-Filter (siehe
    #     `sperrantrag_kollisionen`, 12.08.2026) oder eine fehlende Migration
    #     → Serverfehler → 500, mit Stacktrace im Log.
    # In BEIDEN Fällen wandert die Postgres-Meldung ins Log (serverseitig, nie
    # in die Antwort): ohne sie ist ein 22P02 nicht zu unterscheiden von jedem
    # anderen und die Ursache bleibt unsichtbar.
    # `OwnerChatError` trägt seinen Statuscode selbst (503 fehlender
    # Chat-Schlüssel, 415 falscher Anhangstyp, 422 leere Nachricht). Die
    # Router fangen ihn dort, wo sie ihn erwarten — aber nicht überall: die
    # Antwort-Erzeugung (`_verlauf_antwort`, `_zu_nachricht`) läuft NACH dem
    # try-Block und entschlüsselt dabei. Fehlt `OWNER_CHAT_SCHLUESSEL`, warf
    # der Verlaufsabruf dort einen 503, der als 500 beim Nutzer ankam — ein
    # Konfigurationsmangel, der wie ein Serverfehler aussieht (Wurzel 5).
    # Dieser Handler ist der Rückhalt für jeden Pfad, der ihn nicht selbst
    # fängt.
    @app.exception_handler(OwnerChatError)
    async def _owner_chat(request: Request, exc: OwnerChatError):  # noqa: ANN202
        del request
        return JSONResponse(
            status_code=exc.status_code, content={"detail": exc.message}
        )

    @app.exception_handler(PostgrestAPIError)
    async def _postgrest(request: Request, exc: PostgrestAPIError):  # noqa: ANN202
        if getattr(exc, "code", None) != "22P02":
            return await _unhandled(request, exc)
        meldung = str(getattr(exc, "message", "") or "")
        if "invalid input syntax for type" not in meldung:
            # Kein Client-Literal → unser Fehler. `_unhandled` loggt mit
            # Stacktrace und antwortet 500 — genau das, was den Trigger-Bruch
            # am ersten Tag sichtbar gemacht hätte.
            return await _unhandled(request, exc)
        rid = getattr(request.state, "request_id", None)
        log.warning(
            "ungueltiger_parameter",
            path=request.url.path,
            request_id=rid,
            db_meldung=meldung,
        )
        return JSONResponse(
            status_code=422,
            content={"detail": "Ungültiger Wert im Aufruf.", "request_id": rid},
            headers={"X-Request-Id": rid} if rid else None,
        )

    # Redis-backed Rate-Limiting (Infra-Runbook Punkt 8): schützt vor Brute-Force
    # (Login), Scrapern und Lastspitzen, sodass ein einzelner missbrauchter/teurer
    # Endpunkt nicht den ganzen Server mitreißt. Redis-backed, weil bei mehreren
    # Uvicorn-Workern ein In-Memory-Limiter pro Worker getrennt zählen würde. Die
    # Middleware baut ihren Redis-Client lazy pro Event-Loop (loop-sicher).
    app.add_middleware(RateLimitMiddleware, settings=settings)

    api_v1 = APIRouter(prefix="/api/v1")
    for r in _SLICE_ROUTERS:
        api_v1.include_router(r)
    app.include_router(api_v1)

    # OAuth-Discovery des MCP-Connectors: MUSS auf der Domain-Wurzel liegen.
    # Clients (claude.ai) suchen `/.well-known/oauth-protected-resource`, nicht
    # `/api/v1/.well-known/...` — unter dem Präfix fände die Erkennung nichts
    # und die Verbindung schlüge mit „Couldn't reach the MCP server" fehl.
    app.include_router(mcp_discovery_router)

    @app.get("/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "nextdays-api"}

    @app.get("/", tags=["meta"])
    def root() -> dict[str, str]:
        return {"service": "nextdays-api", "docs": "/docs"}

    log.info("app_created", slices=len(_SLICE_ROUTERS), env=settings.app_env)
    return app


app = create_app()
