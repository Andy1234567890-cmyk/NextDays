"""ASGI-Middleware, die das gestaffelte Rate-Limiting durchsetzt.

Gestaffelt nach Sensitivität (default-deny-Geist: streng dort, wo es weh tut):
  * Auth (Login/Register)  — Brute-Force-Schutz, optional fail-closed.
  * Payments               — teuer/sensibel, optional fail-closed.
  * Listings/Such/Kalender — Scraper-/Lastschutz (der frühere N+1-Endpunkt).
  * globaler Default       — großzügig pro IP.
  * pro Tenant             — Fairness (ein Tenant leert den Pool nicht).

Health-Endpunkte sind ausgenommen (sonst kippt der Coolify-Healthcheck).

Schlüssel: pro echter Client-IP (hinter Traefik via X-Forwarded-For) und — bei
eingeloggten Requests — zusätzlich pro Tenant. IP-Limit ist die Sicherheitsgrenze;
das Tenant-Limit ist reine Fairness, daher genügt ein best-effort-Tenant-Read aus
dem (hier NICHT erneut signatur-geprüften) JWT — die echte Auth macht die Route.
"""
from __future__ import annotations

import asyncio
import json
from base64 import urlsafe_b64decode
from collections.abc import Callable
from hashlib import sha256

from starlette.requests import ClientDisconnect, Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

from .config import Settings
from .logging import get_logger
from .ratelimit import (
    Limit,
    RateDecision,
    RateLimiter,
    build_redis,
    client_ip_from_xff,
    parse_limit,
)

log = get_logger("nextdays.ratelimit")

# Von JEDEM Limit ausgenommen (volle request.url.path geprüft): Health/Root müssen
# immer durchgehen, sonst kippt der Coolify-Healthcheck. Slice-Health (*/health)
# zusätzlich über _is_exempt().
_EXEMPT_EXACT = frozenset({"/", "/health", "/docs", "/openapi.json", "/redoc"})


class _Buckets:
    """Geparste Limits, einmal pro App aufgelöst (keine Parse-Kosten je Request)."""

    def __init__(self, settings: Settings) -> None:
        self.default = parse_limit(settings.rate_limit_default)
        self.auth = parse_limit(settings.rate_limit_auth)
        self.auth_public = parse_limit(settings.rate_limit_auth_public)
        self.refresh = parse_limit(settings.rate_limit_refresh)
        self.payments = parse_limit(settings.rate_limit_payments)
        self.listings = parse_limit(settings.rate_limit_listings)
        self.listings_tenant = parse_limit(settings.rate_limit_listings_tenant)
        self.tenant = parse_limit(settings.rate_limit_tenant)
        self.ai = parse_limit(settings.rate_limit_ai)
        self.mcp_auth = parse_limit(settings.rate_limit_mcp_auth)
        self.mfa = parse_limit(settings.rate_limit_mfa)
        self.mfa_status = parse_limit(settings.rate_limit_mfa_status)
        self.public_support = parse_limit(settings.rate_limit_public_support)
        self.einladung_resend = parse_limit(settings.rate_limit_einladung_resend)


def _is_exempt(path: str) -> bool:
    if path in _EXEMPT_EXACT:
        return True
    # Slice-Health-Endpunkte (z. B. /api/v1/auth/health) ebenfalls ausnehmen.
    return path.endswith("/health")


# Credential-Endpunkte → strenger auth-Bucket (Brute-Force-/Stuffing-Schutz,
# Wurzel 2/7). Die Gast-Auth der Demand-Seite (/plattform) zählt genauso wie der
# Vermieter-Login; password-reset zusätzlich gegen E-Mail-Enumeration.
# /oauth/token ist der Client-Credentials-Tausch der Entwickler-API.
_AUTH_PATHS = (
    "/auth/login",
    "/auth/register",
    "/oauth/token",
    "/guest-auth/login",
    "/guest-auth/register",
    "/guest-auth/password-reset",
    # Anmeldung per Einmal-Code (19.08.2026). BEIDE Richtungen gehören in den
    # strengen Bucket: `/guest-auth/code` schickt eine Mail an ein FREMDES
    # Postfach (Spam-Verstärker), `/guest-auth/code/verify` prüft ein Geheimnis
    # (durchprobierbar). Der Teilstring deckt beide plus `/code/profil`.
    "/guest-auth/code",
    # Einladung ins Backoffice annehmen: öffentlich (die eingeladene Person hat
    # noch keine Sitzung) und setzt ein Passwort — also derselbe strenge Bucket
    # wie ein Login, sonst wäre der Token-Raum durchprobierbar.
    "/platform/team/accept",
    # Passwort-Reset des Backoffice: die Anfrage verschickt Mails an eine
    # fremde Adresse und antwortet neutral (Enumeration), das Einlösen probiert
    # einen Token durch. Beide gehören in denselben strengen Bucket wie ein
    # Login; die Sperrfrist je Konto sitzt zusätzlich im Service.
    "/platform/team/passwort-vergessen",
    "/platform/team/passwort-neu",
)

# ÖFFENTLICHE Token-Vorgänge der Tenant-Nutzer (0334): Einladung annehmen,
# Passwort vergessen, neues Passwort setzen — plus die beiden Vorab-Prüfungen.
# Eigener, NOCH strengerer Bucket als `auth`, weil hier drei Dinge zusammenkommen,
# die es beim Login nicht gibt (Wurzel 8):
#   • Jeder Aufruf von /passwort-vergessen kann eine Mail an eine FREMDE Adresse
#     auslösen — im Login-Bucket (10/60) wäre das ein bequemer Mail-Bomber.
#   • Die Prüf-Endpunkte beantworten „gibt es diesen Token?" und wären sonst der
#     billigste Weg, den Token-Raum durchzuprobieren.
#   • Ein Treffer setzt ein Passwort, ist also mächtiger als ein Login-Versuch.
# Sensibel → fail-closed: lieber eine Anfrage abweisen als bei Redis-Ausfall den
# Zugangsweg zu jedem Konto öffnen.
# 2FA-Verifikation: eigener, strengster Bucket (Wurzel 8). Diese Pfade pruefen
# ein Geheimnis (Wiederherstellungscode) bzw. bauen den zweiten Faktor um —
# sie gehoeren nicht in den Default-Bucket und auch nicht in den laxeren
# Login-Bucket. Sensibel = bei Redis-Ausfall fail-CLOSED: lieber kein
# Code-Versuch als ein ungezaehlter.
_MFA_PATHS = (
    "/auth/mfa/",
)

# AUSNAHME davon, und sie muss VOR `_MFA_PATHS` stehen (erster Treffer gewinnt):
# `GET /auth/mfa/status` prueft KEIN Geheimnis. Es liest nur den eigenen
# 2FA-Zustand — Nutzer ausschliesslich aus dem Token, es gibt bewusst keinen
# `user_id`-Parameter (siehe auth/router.mfa_status). Es gibt dort also nichts
# zu erraten und nichts aufzuzaehlen, was ein strenges Limit schuetzen wuerde.
#
# Der Schaden war real (12.08.2026): Der Status wird im Dashboard-Layout bei
# jedem Seitenaufbau abgefragt. Der MFA-Bucket erlaubt 5/60 — nach wenigen
# `router.refresh()` in Folge antwortete `/auth/mfa/status` mit 429, ohne dass
# ein Angriff vorlag. Verschaerfend: der Aufruf ist `"use server"`, kommt also
# aus EINEM Next-Container ohne X-Forwarded-For, sodass ein IP-Zaehler fuer alle
# Nutzer aller Betriebe gemeinsam gilt. Dieser Bucket keyt deshalb pro NUTZER
# (siehe `_nutzer_aus_bearer` und das Keying im Guard).
#
# Bleibt `sensibel=True`, obwohl der Pfad nur liest: bei Redis-Ausfall lieber
# abweisen als ungezaehlt durchlassen — die Antwort verraet den 2FA-Zustand des
# eigenen Kontos, und fail-open ist bei /auth/* nie die richtige Richtung
# (Wurzel 5). Nur das LIMIT wird gelockert, nicht die Fehlerhaltung.
# `$` = exaktes Pfadende (siehe `_select_bucket`): ein künftiges
# `/auth/mfa/statusXY` soll dieses lockere Limit NICHT still erben.
_MFA_STATUS_PATHS = (
    "/auth/mfa/status$",
)

_AUTH_PUBLIC_PATHS = (
    "/auth/einladung/pruefen",
    "/auth/einladung/annehmen",
    "/auth/passwort-vergessen",
    "/auth/passwort-neu",
    # Vorfuehr-Zugang der Marketing-Seite (0407): stellt OHNE Anmeldung eine
    # echte Session aus. Genau deshalb hier und nicht im laxeren Login-Bucket —
    # ungebremst waere der Endpunkt ein kostenloser Token-Automat, und jede
    # Anfrage kostet einen GoTrue-Login. Die Session kann nichts aendern
    # (demo_gate), aber sie kann lesen, und das ist Last.
    "/auth/demo",
)

# EINGELOGGTE Endpunkte, die eine Einladungsmail an eine FREMDE Adresse
# auslösen: „erneut senden" für Mitarbeiter (/konto/nutzer) und für Eigentümer
# (/eigentuemer). Sie standen bis hierher im Default-Bucket (300/60) — für einen
# Vorgang, der ein fremdes Postfach befüllt, ist das kein Dach (Wurzel 8).
#
# Die Sperrfrist je Konto im Dienst (`_RESEND_COOLDOWN`, 1 Minute) bleibt die
# eigentliche Bremse und deckt den Doppelklick ab; sie hängt aber am ZIELKONTO.
# Dieser Bucket deckt die andere Achse: EIN Aufrufer, der reihum viele
# verschiedene Empfänger anschreibt — dagegen hilft keine Sperrfrist je Konto.
# Sensibel → fail-closed: fällt Redis aus, ist eine abgewiesene Einladung
# harmlos (der Betreiber klickt gleich noch einmal), ein ungezählter
# Mailversand an fremde Postfächer nicht.
_EINLADUNG_RESEND_PATHS = (
    "/invite/",
    "/portalzugang/erneut-senden",
)

# Token-Erneuerung. Eigener Bucket, gekeyt PRO NUTZER statt pro IP (siehe
# `rate_limit_refresh` in config.py und `_subject_from_refresh_body`): das ist
# kein Credential-Rateweg, sondern der Normalbetrieb jeder angemeldeten Sitzung.
# Nicht sensibel → bei Redis-Ausfall fail-OPEN: ein 503 auf diesem Pfad meldet
# sonst alle gerade aktiven Nutzer ab (Wurzel 5 — ein Ausfall des Zählers darf
# den Hauptpfad nicht kippen).
_REFRESH_PATHS = ("/auth/refresh", "/guest-auth/refresh")

# Endpunkte, die eine KOSTENPFLICHTIGE Fremd-API anstoßen (Groq bzw. Google
# Translate). Im Default-Bucket könnte ein einzelner eingeloggter Nutzer
# erhebliche Kosten verursachen — eigener strenger Bucket (Wurzel 8).
# `/uebersetzen` ist der Ankündigungs-Übersetzungslauf: EIN Aufruf löst bis zu
# 23 Sprachen à zwei Google-Requests aus — der teuerste Einzelaufruf des
# Systems. Er steht ohne führenden Pfad in der Liste, weil die ID dazwischen
# liegt (`/platform/announcements/{id}/uebersetzen`) und hier per Teilstring
# verglichen wird.
_AI_PATHS = ("/dashboard/voice", "/content/translate", "/uebersetzen")

# OAuth-Vorgänge des MCP-Connectors (0385). `/mcp/token` löst Autorisierungs-
# codes ein und rotiert Refresh-Token — beides durchprobierbar; `/mcp/authorize`
# stößt einen ausgehenden Fetch auf eine fremde URL an (Verstärkung). Der
# MCP-Endpunkt `/api/v1/mcp` SELBST steht bewusst NICHT hier: ein Gespräch macht
# viele Werkzeugaufrufe, ein 20/60-Dach würde es mitten im Satz abwürgen.
_MCP_AUTH_PATHS = ("/mcp/token", "/mcp/authorize", "/mcp/consent")

# UNAUTHENTIFIZIERTE Kontaktaufnahme von der Marketing-Seite. Jeder Aufruf legt
# einen Datensatz an bzw. schreibt in einen fremden Verlauf — im
# Default-Bucket (300/60) wäre das ein bequemer Spam- und Token-Rateweg.
# Deshalb ein eigener, strenger Bucket (Wurzel 8: teure/öffentliche Endpunkte
# bekommen ein eigenes Dach) — und sensibel, also fail-closed: lieber eine
# Anfrage abweisen als bei Redis-Ausfall die Schleusen öffnen.
_PUBLIC_SUPPORT_PATHS = ("/support/public",)

# Öffentliche Newsletter-Endpunkte der Marketing-Seite: jede Anfrage kann eine
# Mail an eine FREMDE Adresse auslösen bzw. probiert einen Token durch — daher
# derselbe strenge Bucket wie beim öffentlichen Support-Chat.
_NEWSLETTER_PATHS = ("/newsletter/subscribe", "/newsletter/confirm",
                     "/newsletter/unsubscribe")

# Öffentlicher Löschantrag (Play-Store-Pflicht, 0413). Genau dieselbe Gefahr wie
# beim Newsletter, nur mit höherem Schaden: jeder Aufruf kann eine Mail an eine
# FREMDE Adresse auslösen, und der Bestätigungs-Endpunkt ist ein Token, den man
# durchprobieren kann. Ohne eigenes Dach wäre das Formular ein Mailversender
# gegen beliebige Postfächer (Wurzel 8). Fail-closed wie der Newsletter: lieber
# einen Antrag abweisen als bei Redis-Ausfall ungedeckelt Mails verschicken.
_KONTO_LOESCHUNG_PATHS = ("/account-deletion/request",
                          "/account-deletion/confirm")

# Kontaktformular der Marketing-Seite (0414). Jeder Aufruf löst eine Mail an
# UNSER Postfach aus und kostet zusätzlich eine reCAPTCHA-Bewertung (kostenlos
# nur bis 10.000/Monat je Organisation). Ohne eigenes Dach könnte ein einzelner
# Bot beides erschöpfen: unser Posteingang und das Bewertungs-Kontingent, mit
# dem der Spamschutz aller Formulare hängt. Fail-closed wie die übrigen
# öffentlichen Formulare — bei Redis-Ausfall lieber abweisen.
_KONTAKT_PATHS = ("/contact/message",)

# Öffentliche Such-/Kalender-Endpunkte → Scraper-Schutz pro IP. Der iCal-Export
# ist nicht eingeloggt (ein Kalender-Client schickt kein JWT).
_LISTINGS_PATHS = (
    # Öffentliche Preisliste der Marketing-Seite (nicht eingeloggt): reines
    # Lesen unserer eigenen Preise, im Service zusätzlich TTL-gecacht. Gehört
    # in den Scraper-Bucket, nicht in den Default — und fail-OPEN ist hier
    # richtig: ein Redis-Ausfall darf die Preisseite nicht abschalten.
    "/subscriptions/public/",
    "/booking-engine/listings",
    "/booking-engine/availability",
    "/calendar",
    "/external-calendar/export/",
)

# EINGEHENDE Provider-Webhooks. Sie werden weiterhin gezählt (Missbrauchsschutz),
# laufen bei Redis-Ausfall aber fail-OPEN statt fail-closed.
#
# Begründung: Jeder dieser Endpunkte prüft selbst eine Signatur bzw. ein
# geteiltes Secret (Stripe `construct_event`, PayPal `verify_webhook`, Channex
# X-Channex-Webhook-Secret, WhatsApp verify_token) — das Rate-Limit ist dort
# NICHT die Zugangskontrolle. Ein 503 wegen nicht erreichbarem Redis wirft
# dagegen echte Ereignisse weg: Stripe wiederholt nur ~3 Tage, danach ist das
# Event verloren. Genau so blieb am 29.07.2026 ein bezahltes Abo dauerhaft auf
# „Kein Abo" stehen — 10 von 10 `customer.subscription.created`-Zustellungen
# wurden mit 503 abgewiesen, weil der Limiter-Client auf einem fremden Redis
# hing. Ein Zahlungsereignis darf nicht an der Verfügbarkeit einer
# Hilfskomponente scheitern (Wurzel 5: Kontroll-Signal nicht verschlucken).
_WEBHOOK_PATHS = (
    "/payments/webhook",
    "/payments/paypal/webhook",
    "/channel-manager/webhook",
    "/whatsapp/webhook",
)


# Reihenfolge ist bedeutungstragend: der ERSTE Treffer gewinnt.
# Die Webhooks stehen VOR dem /payments/-Eintrag, weil der Stripe-Webhook unter
# /payments/ liegt und sonst als sensibel eingestuft und fail-closed abgewiesen
# würde. Tabelle statt Kette von if/return, damit ein weiterer Bucket keine
# weitere Verzweigung bedeutet.
_BUCKET_REGELN: tuple[tuple[str, tuple[str, ...], str, bool], ...] = (
    ("payments", _WEBHOOK_PATHS, "payments", False),
    # VOR "auth": /auth/refresh würde sonst über den Teilstring-Vergleich
    # ("/auth/login" ist nicht enthalten, aber die Reihenfolge entscheidet
    # generell) am falschen Bucket landen. Eigener Bucket, eigenes Keying.
    ("refresh", _REFRESH_PATHS, "refresh", False),
    # VOR "auth": diese Pfade beginnen alle mit /auth/ und würden sonst im
    # laxeren Login-Bucket landen. Der erste Treffer gewinnt.
    # VOR "mfa": `/auth/mfa/status` ist ein Teilstring von `/auth/mfa/` und
    # landete sonst im strengsten Bucket (5/60), obwohl er nur den eigenen
    # 2FA-Zustand LIEST und kein Geheimnis prueft. Genau daran scheiterte die
    # Oberflaeche am 12.08.2026 mit 429 ohne Angriff (siehe _MFA_STATUS_PATHS).
    # Bleibt sensibel=True: nur das Limit ist gelockert, die fail-closed-Haltung
    # bei Redis-Ausfall nicht.
    ("mfa_status", _MFA_STATUS_PATHS, "mfa_status", True),
    # VOR "auth": /auth/mfa/* beginnt mit /auth/ und wuerde sonst im laxeren
    # Login-Bucket landen. Der erste Treffer gewinnt.
    ("mfa", _MFA_PATHS, "mfa", True),
    ("auth_public", _AUTH_PUBLIC_PATHS, "auth_public", True),
    # VOR "auth": `/auth/invite/{id}/resend` beginnt mit /auth/ und läge sonst
    # im Login-Bucket. Der erste Treffer gewinnt.
    ("einladung_resend", _EINLADUNG_RESEND_PATHS, "einladung_resend", True),
    ("auth", _AUTH_PATHS, "auth", True),
    ("payments", ("/payments/",), "payments", True),
    ("public_support", _PUBLIC_SUPPORT_PATHS, "public_support", True),
    ("public_support", _NEWSLETTER_PATHS, "public_support", True),
    ("public_support", _KONTO_LOESCHUNG_PATHS, "public_support", True),
    ("public_support", _KONTAKT_PATHS, "public_support", True),
    ("ai", _AI_PATHS, "ai", False),
    # sensibel=True: bei Redis-Ausfall lieber abweisen als den Code-/Token-
    # Tausch ungedeckelt durchlassen (fail-closed, Wurzel 5).
    ("mcp_auth", _MCP_AUTH_PATHS, "mcp_auth", True),
    ("listings", _LISTINGS_PATHS, "listings", False),
)


def _select_bucket(path: str, buckets: _Buckets) -> tuple[str, Limit, bool]:
    """Pfad → (Bucket-Name, Limit, sensibel?). Sensibel = Kandidat für fail-closed.

    Muster matchen per Teilstring. EIN Muster mit `$` am Ende verlangt ein
    EXAKTES Pfadende — nötig, wo ein Muster ein LOCKERERES Limit vergibt als die
    Regel darunter: `/auth/mfa/status` liegt bei 120/60, `/auth/mfa/` bei 5/60.
    Per Teilstring erbte ein künftiger Endpunkt `/auth/mfa/statusXY` oder
    `/auth/mfa/status/reset` still das lockere Limit, ohne dass es jemandem
    auffällt. Bei den übrigen Regeln ist Teilstring richtig: sie verschärfen.
    """
    for name, pfade, attribut, sensibel in _BUCKET_REGELN:
        for muster in pfade:
            treffer = (
                path.endswith(muster[:-1]) if muster.endswith("$")
                else muster in path
            )
            if treffer:
                return name, getattr(buckets, attribut), sensibel
    return "default", buckets.default, False


def _receive_mit_body(original: Callable, body: bytes | None) -> Callable:
    """`receive`, das einen bereits gelesenen Body noch einmal ausliefert.

    Wurde der Body in der Middleware nicht angefasst (`body is None`), bleibt
    das originale `receive` unverändert — kein Umweg für die 99 % der Requests,
    die den refresh-Bucket gar nicht treffen.
    """
    if body is None:
        return original

    gesendet = False

    async def receive() -> dict:
        nonlocal gesendet
        if not gesendet:
            gesendet = True
            return {"type": "http.request", "body": body, "more_body": False}
        # Nach dem Body weiter am echten Stream horchen (http.disconnect).
        return await original()

    return receive


async def _sitzung_aus_refresh_body(request: Request) -> str | None:
    """Stabiler Schlüssel je SITZUNG für den refresh-Bucket (oder None).

    Warum nicht die IP: die Frontends sind BFFs, ihre Refresh-Aufrufe kommen
    server-zu-server aus EINEM Container. Eine IP = alle Nutzer, und der
    Zehnerzähler des auth-Buckets war nach zehn fremden Erneuerungen voll — der
    nächste echte Nutzer bekam 429 und flog raus.

    Warum nicht der `sub`-Claim: ein GoTrue-Refresh-Token ist ein OPAKER String,
    kein JWT — es gibt darin keine Claims zu lesen. Der Token-Wert selbst ist
    aber pro Sitzung stabil genug für ein Fairness-Fenster. Er wird gehasht, um
    kein Geheimnis in einen Redis-Schlüssel (und damit in Logs/`MONITOR`) zu
    schreiben.

    Der Body wird über `request.body()` gelesen; Starlette cacht ihn in
    `request._body`, und da die Middleware dasselbe Request-Objekt-Scope
    weiterreicht, bleibt er für die Route lesbar (siehe `_guard`-Aufrufer).
    """
    try:
        roh = await request.body()
    except (ClientDisconnect, RuntimeError):
        return None
    if not roh:
        return None
    try:
        daten = json.loads(roh)
    except (ValueError, json.JSONDecodeError):
        return None
    token = daten.get("refresh_token") if isinstance(daten, dict) else None
    if not isinstance(token, str) or not token:
        return None
    return sha256(token.encode("utf-8")).hexdigest()[:32]


def _tenant_from_bearer(auth_header: str | None) -> str | None:
    """Best-effort: ``app_metadata.tenant_id`` aus dem JWT lesen, OHNE Signatur-
    prüfung (nur fürs Fairness-Keying; die echte Auth prüft die Route). Bei jedem
    Fehler → None (dann greift nur das IP-Limit)."""
    if not auth_header or not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header.split(" ", 1)[1]
    parts = token.split(".")
    if len(parts) != 3:
        return None
    try:
        padded = parts[1] + "=" * (-len(parts[1]) % 4)
        claims = json.loads(urlsafe_b64decode(padded))
    except (ValueError, json.JSONDecodeError):
        return None
    meta = claims.get("app_metadata") if isinstance(claims, dict) else None
    tenant = meta.get("tenant_id") if isinstance(meta, dict) else None
    return tenant if isinstance(tenant, str) and tenant else None


def _nutzer_aus_bearer(auth_header: str | None) -> str | None:
    """Best-effort: ``sub`` aus dem JWT lesen, OHNE Signaturprüfung.

    Wie `_tenant_from_bearer` nur fürs Keying — die echte Auth prüft die Route.
    Gefälschter `sub` schadet nicht: der Angreifer füllt damit den Zähler eines
    fremden Nutzers, aber der Schlüssel enthält zusätzlich die IP (siehe
    `_mfa_status_key`), also trifft es dessen echte Sitzungen nicht.
    """
    if not auth_header or not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header.split(" ", 1)[1]
    parts = token.split(".")
    if len(parts) != 3:
        return None
    try:
        padded = parts[1] + "=" * (-len(parts[1]) % 4)
        claims = json.loads(urlsafe_b64decode(padded))
    except (ValueError, json.JSONDecodeError):
        return None
    sub = claims.get("sub") if isinstance(claims, dict) else None
    return sub if isinstance(sub, str) and sub else None


class RateLimitMiddleware:
    """Setzt die gestaffelten Limits vor jedem Request durch.

    Der Redis-Client wird LAZY pro Event-Loop gebaut, nicht im Konstruktor:
    ``redis.asyncio`` bindet seinen Connection-Pool an den Loop, in dem er zuerst
    benutzt wird — würde man ihn beim App-Bau (anderer Loop) erzeugen, bricht jeder
    spätere Request im echten Worker-Loop mit „Future attached to a different loop".
    Tests injizieren stattdessen einen fertigen ``limiter`` (Fake-Redis).
    """

    def __init__(
        self,
        app: ASGIApp,
        *,
        settings: Settings,
        limiter: RateLimiter | None = None,
    ) -> None:
        self._app = app
        self._settings = settings
        self._buckets = _Buckets(settings)
        self._injected_limiter = limiter
        # Ein Limiter (mit eigenem Redis-Client) pro Event-Loop, lazy aufgebaut.
        self._limiters: dict[int, RateLimiter] = {}

    def _limiter_for_loop(self) -> RateLimiter:
        if self._injected_limiter is not None:
            return self._injected_limiter
        loop_id = id(asyncio.get_running_loop())
        limiter = self._limiters.get(loop_id)
        if limiter is None:
            limiter = RateLimiter(build_redis(self._settings.redis_url))
            self._limiters[loop_id] = limiter
        return limiter

    async def aclose(self) -> None:
        """Alle loop-lokalen Redis-Clients schließen (Lifespan-Shutdown)."""
        for limiter in self._limiters.values():
            await limiter.aclose()
        self._limiters.clear()

    async def __call__(self, scope: dict, receive: Callable, send: Callable) -> None:
        if scope["type"] != "http" or not self._settings.rate_limit_enabled:
            await self._app(scope, receive, send)
            return
        # Einmalig für den Lifespan-Shutdown auffindbar machen.
        app = scope.get("app")
        if app is not None and getattr(app.state, "rate_limit_middleware", None) is None:
            app.state.rate_limit_middleware = self
        request = Request(scope, receive=receive)
        if _is_exempt(request.url.path):
            await self._app(scope, receive, send)
            return

        response = await self._guard(request)
        # Der refresh-Bucket liest den Request-Body, um pro Sitzung zu keyen.
        # Damit ist der ASGI-`receive`-Stream aufgebraucht — die Route würde
        # einen LEEREN Body sehen und jeden Refresh mit 422 abweisen. Deshalb
        # den gepufferten Body als frisches `receive` nachreichen. Starlette
        # cacht ihn nur auf DIESEM Request-Objekt; die Route baut ein eigenes.
        weiter = _receive_mit_body(receive, getattr(request, "_body", None))
        if response is not None:
            await response(scope, weiter, send)
            return
        await self._app(scope, weiter, send)

    async def _guard_refresh(
        self, request: Request, limit: Limit, sensitive: bool, path: str
    ) -> tuple[bool, Response | None]:
        """Zählt eine Token-Erneuerung PRO SITZUNG statt pro IP.

        Rückgabe ``(fertig, antwort)``: ``fertig=True`` heißt, der Fall ist hier
        entschieden (``antwort`` ist dann die Ablehnung oder ``None`` für
        „durchlassen"). ``fertig=False`` heißt, im Body stand kein verwertbares
        Token — dann greift der normale IP-Pfad des Aufrufers. Zwei getrennte
        Werte, weil ein blankes ``None`` beide Bedeutungen hätte.
        """
        sitzung = await _sitzung_aus_refresh_body(request)
        if not sitzung:
            return False, None
        decision = await self._limiter_for_loop().check(
            f"refresh:sitzung:{sitzung}", limit
        )
        if decision.degraded:
            return True, self._handle_degraded(sensitive, path)
        if not decision.allowed:
            return True, self._reject(decision, "refresh", path, scope="sitzung")
        return True, None

    async def _guard_listings_ip(
        self, ip: str | None, sensitive: bool, path: str
    ) -> Response | None:
        """Scraper-Guard pro IP, der VOR dem Tenant-Limit greift (eingeloggte
        listings-Requests). Ablehnung als Response, sonst None."""
        decision = await self._limiter_for_loop().check(
            f"listings:ip:{ip or 'unknown'}", self._buckets.listings
        )
        if decision.degraded:
            return self._handle_degraded(sensitive, path)
        if not decision.allowed:
            return self._reject(decision, "listings", path, scope="ip")
        return None

    async def _guard(self, request: Request) -> Response | None:
        """Gibt eine 429/503-Response zurück, wenn blockiert; sonst None."""
        path = request.url.path
        bucket_name, limit, sensitive = _select_bucket(path, self._buckets)
        limiter = self._limiter_for_loop()

        # Token-Erneuerung: pro Sitzung keyen, nicht pro IP (BFF-Aufrufe kommen
        # alle aus einem Container). Ohne lesbares Token fällt es unten auf den
        # IP-Key zurück.
        if bucket_name == "refresh":
            fertig, antwort = await self._guard_refresh(
                request, limit, sensitive, path
            )
            if fertig:
                return antwort

        tenant = _tenant_from_bearer(request.headers.get("authorization"))

        ip = client_ip_from_xff(
            request.headers.get("x-forwarded-for"),
            request.client.host if request.client else None,
            self._settings.rate_limit_trusted_proxy_hops,
        )

        # listings/Kalender EINGELOGGT → pro (TENANT, IP) keyen. Das großzügige
        # Tenant-Limit (1200/60) verhindert, dass ein Betrieb sich selbst aussperrt
        # und Büro-NAT (mehrere Mitarbeiter, eine IP) am strengen IP-Limit scheitert.
        # Nicht-eingeloggte listings-Requests (öffentlicher Marktplatz) bleiben pro
        # IP (Scraper-Schutz). Alle anderen Buckets: IP.
        #
        # WICHTIG (Cross-Tenant-DoS): Der Tenant-Schlüssel enthält die IP
        # (`listings:tenant:{tenant}:ip:{ip}`), NICHT nur die tenant_id. Die
        # tenant_id stammt aus einem NICHT signaturgeprüften JWT — ein rein globaler
        # `listings:tenant:{tenant}`-Zähler ließe sich mit der REALEN Opfer-tenant_id
        # von MEHREREN IPs gemeinsam vollschreiben (jede IP unter ihrem IP-Limit,
        # zusammen über dem Tenant-Fenster) und würde so die echten Mitarbeiter des
        # Opfers von IHREN sauberen IPs aussperren. Mit der IP im Schlüssel füllt ein
        # Angreifer nur seinen eigenen (Opfer-Tenant, Angreifer-IP)-Zähler; die echten
        # Mitarbeiter haben andere IPs → eigener Zähler, keine Aussperrung. Analog zum
        # Nicht-listings-Fairness-Bucket unten. Der IP-Scraper-Guard bleibt zusätzlich.
        if bucket_name == "listings" and tenant:
            scraper_antwort = await self._guard_listings_ip(ip, sensitive, path)
            if scraper_antwort is not None:
                return scraper_antwort

            primary_key = f"listings:tenant:{tenant}:ip:{ip or 'unknown'}"
            limit = self._buckets.listings_tenant
            primary_scope = "listings-tenant"
        elif bucket_name == "mfa_status" and (nutzer := _nutzer_aus_bearer(
            request.headers.get("authorization")
        )):
            # PRO NUTZER, nicht pro IP — dieselbe Lehre wie beim refresh-Bucket:
            # `web/lib/mfa.ts` ist `"use server"`, der Aufruf kommt also
            # server-zu-server aus EINEM Next-Container und setzt kein
            # X-Forwarded-For. Die Peer-IP ist die Container-IP, ein IP-Zähler
            # wäre für ALLE Nutzer ALLER Betriebe gemeinsam. Der Aufruf sitzt im
            # Dashboard-Layout und feuert pro Navigation; `realtime-refresh.tsx`
            # löst ihn über sechs Hooks mit hook-lokalem Debounce aus, die nicht
            # koaleszieren. Ein einzelner Nutzer mit offener Kalenderseite konnte
            # damit das gemeinsame Fenster erschöpfen und alle anderen aussperren.
            #
            # IP bleibt im Schlüssel (wie beim Tenant-Fairness-Limit): der `sub`
            # stammt aus einem NICHT signaturgeprüften JWT. Ohne die IP ließe
            # sich der Zähler eines echten Nutzers mit gefälschtem `sub` von
            # außen vollschreiben und ihn aussperren.
            primary_key = f"mfa_status:sub:{nutzer}:ip:{ip or 'unknown'}"
            primary_scope = "nutzer"
        else:
            primary_key = f"{bucket_name}:ip:{ip or 'unknown'}"
            primary_scope = "ip"
        decision = await limiter.check(primary_key, limit)

        if decision.degraded:
            return self._handle_degraded(sensitive, path)
        if not decision.allowed:
            return self._reject(decision, bucket_name, path, scope=primary_scope)

        # Zusätzliches Tenant-Fairness-Limit für eingeloggte Requests. Der
        # Schlüssel wird PRO IP gekeyt (tenant:{tenant}:ip:{ip}), NICHT global
        # pro Tenant: die tenant_id stammt aus einem unsignierten JWT
        # (_tenant_from_bearer). Ein globaler tenant:{tenant}-Zähler ließe sich
        # sonst mit einer gefälschten Opfer-tenant_id von außen füllen und würde
        # so echte Nutzer dieses Tenants tenant-weit aussperren (Cross-Tenant-
        # DoS). Pro-IP-Keying begrenzt einen Angreifer auf sein eigenes Fenster
        # und erhält den Fairness-Zweck (Büro-NAT: eine IP, mehrere Mitarbeiter).
        # Beim listings-Bucket ist das Tenant-Keying schon das Primärlimit oben.
        if tenant and bucket_name != "listings":
            t_decision = await limiter.check(
                f"tenant:{tenant}:ip:{ip or 'unknown'}", self._buckets.tenant
            )
            if not t_decision.degraded and not t_decision.allowed:
                return self._reject(t_decision, "tenant", path, scope="tenant")
        return None

    def _handle_degraded(self, sensitive: bool, path: str) -> Response | None:
        """Redis weg: sensible Endpunkte optional fail-CLOSED, sonst fail-OPEN."""
        if sensitive and self._settings.rate_limit_fail_closed_sensitive:
            log.warning("rate_limit_fail_closed", path=path)
            return JSONResponse(
                {"detail": "Dienst vorübergehend nicht verfügbar."},
                status_code=503,
                headers={"Retry-After": "5"},
            )
        log.warning("rate_limit_fail_open", path=path)
        return None

    def _reject(
        self, decision: RateDecision, bucket: str, path: str, *, scope: str
    ) -> JSONResponse:
        log.info(
            "rate_limited",
            bucket=bucket,
            scope=scope,
            path=path,
            limit=decision.limit.max,
            window=decision.limit.window_seconds,
        )
        return JSONResponse(
            {"detail": "Zu viele Anfragen. Bitte später erneut versuchen."},
            status_code=429,
            headers={
                "Retry-After": str(decision.retry_after),
                "X-RateLimit-Limit": str(decision.limit.max),
                "X-RateLimit-Remaining": str(decision.remaining),
            },
        )
