"""Auth der öffentlichen API: Client-Credentials → Access-Token → Scope-Prüfung.

Der Ablauf, den ein Entwickler durchläuft:

  1. Der Betrieb legt im Dashboard einen Zugang an (`/konto/api-zugang`) und
     erhält Client-ID + Client-Secret. Das Secret wird genau EINMAL angezeigt;
     in der Datenbank steht nur sein SHA-256-Hash.
  2. Der Entwickler tauscht beides an `POST /v1/oauth/token` gegen ein
     Access-Token (1 h Gültigkeit, HS256, eigene Audience).
  3. Jeder Aufruf trägt `Authorization: Bearer <token>`. Der Endpunkt verlangt
     einen Scope; zusätzlich gilt die Objekt-Beschränkung des Zugangs.

Warum kurzlebige Tokens statt eines statischen API-Keys wie bei Lodgify
(`X-ApiKey`, unbegrenzt gültig): ein abgeflossener statischer Key ist bis zum
manuellen Widerruf gültig, und niemand merkt den Abfluss. Hier läuft ein
abgeflossenes Token binnen einer Stunde ab, und ein Widerruf im Dashboard wirkt
für neue Tokens sofort. Hostaway wählt zwar auch client_credentials, gibt dem
Token aber 24 MONATE — das ist ein statischer Key mit Extraschritt.

Fail-closed an jeder Stelle (Wurzel 5/7): fehlendes Signier-Secret, fehlendes
Token, ungültige Signatur, abgelaufen, fehlender Scope, unbekannter Zugang →
401/403/503. Nie „im Zweifel durchlassen".
"""
from __future__ import annotations

import hashlib
import secrets
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import Depends, Header, Request

from . import errors
from .config import Settings, get_settings
from .db import service_db
from .logging import get_logger

log = get_logger("publicapi.auth")

# 1 h. Lang genug, dass ein Token nicht bei jedem Aufruf getauscht wird, kurz
# genug, dass ein Widerruf im Dashboard schnell greift.
TOKEN_TTL_SEKUNDEN = 3600
# Eigene Audience trennt diese Tokens strikt von Supabase-Login-Tokens
# (Wurzel 7): ein Login-Token darf hier nichts können, ein API-Token dort nichts.
TOKEN_AUDIENCE = "mynextdays-api"  # noqa: S105 — JWT-Audience, kein Secret


def _hash_secret(secret: str) -> str:
    """SHA-256 des Client-Secrets.

    MUSS mit `apps/api/src/features/api_clients/service.py::_hash_secret`
    übereinstimmen — dort entsteht der Hash, hier wird er geprüft. Der
    gemeinsame Vertrag ist die Spalte `api_clients.secret_hash`, nicht
    gemeinsamer Code. Für ein zufälliges 256-Bit-Secret ist SHA-256 ausreichend
    (kein Brute-Force-Risiko wie bei Passwörtern).
    """
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def _secrets_match(geliefert: str | None, erwartet: str | None) -> bool:
    """Zeitkonstanter Vergleich, robust gegen nicht-ASCII.

    `secrets.compare_digest` wirft bei einem str mit Zeichen > 127 einen
    TypeError. Der Wert kommt aus einem angreiferkontrollierten Feld — ein
    Sonderzeichen darf keinen 500 auslösen, sondern schlicht „passt nicht"
    bedeuten (Wurzel 5). Byteweiser Vergleich umgeht das und bleibt zeitkonstant.
    """
    if not geliefert or not erwartet:
        return False
    return secrets.compare_digest(geliefert.encode("utf-8"), erwartet.encode("utf-8"))


@dataclass(frozen=True)
class ApiKontext:
    """Wer ruft — aufgelöst aus dem Access-Token.

    `property_ids` leer = alle Objekte des Betriebs erlaubt (wie Booking.coms
    „add properties to a machine account"); sonst ausschließlich die gelisteten.
    """

    tenant_id: str
    client_pk: str
    client_id: str
    scopes: list[str] = field(default_factory=list)
    property_ids: list[str] = field(default_factory=list)
    is_test: bool = False

    def darf_objekt(self, property_id: str) -> bool:
        """True, wenn dieser Zugang dieses Objekt anfassen darf."""
        if not self.property_ids:
            return True
        return str(property_id) in self.property_ids

    def objekt_pruefen(self, property_id: str) -> None:
        """Wirft 403, wenn das Objekt außerhalb der Beschränkung liegt.

        Zu benutzen in JEDEM Endpunkt, der eine property_id aus der Anfrage
        entgegennimmt — die Tenant-Prüfung allein reicht nicht (Wurzel 9: der
        Item-Pfad muss denselben Scope prüfen wie der Listen-Pfad).
        """
        if not self.darf_objekt(property_id):
            raise errors.objekt_nicht_erlaubt(str(property_id))


# ---------------------------------------------------------------------------
# Token-Ausgabe
# ---------------------------------------------------------------------------
def token_ausgeben(*, client_id: str, client_secret: str) -> dict[str, object]:
    """Client-ID + Secret → Access-Token.

    Fail-closed und ohne Auskunft, welcher Teil falsch war: unbekannter Zugang,
    widerrufener Zugang und falsches Secret führen zum identischen 401. Der
    Hash wird AUCH bei unbekanntem `client_id` berechnet und verglichen, damit
    die Antwortzeit nicht verrät, ob eine Client-ID existiert.
    """
    settings = get_settings()
    signier_secret = settings.api_token_secret.get_secret_value()
    if not signier_secret:
        raise errors.nicht_konfiguriert(
            "Die Token-Ausgabe ist auf diesem Server nicht eingerichtet."
        )

    db = service_db()
    zeilen = (
        db.table("api_clients")
        .select(
            "id, tenant_id, client_id, secret_hash, scopes, property_ids, "
            "is_test, revoked_at"
        )
        .eq("client_id", client_id)
        .limit(1)
        .execute()
    ).data
    zeile = zeilen[0] if zeilen else None

    erwartet = zeile["secret_hash"] if zeile else _hash_secret("kein-solcher-zugang")
    passt = _secrets_match(_hash_secret(client_secret), erwartet)
    if not zeile or zeile.get("revoked_at") is not None or not passt:
        log.info("token_abgelehnt", client_id=client_id[:16])
        raise errors.ApiFehler(
            status=401,
            code="ungueltige_zugangsdaten",
            detail="Client-ID oder Client-Secret ist falsch, oder der Zugang ist widerrufen.",
            titel="Ungültige Zugangsdaten",
        )

    scopes = [str(s) for s in (zeile.get("scopes") or [])]
    if not scopes:
        # Ein Zugang ohne Scopes könnte nichts tun. Ein Token dafür auszugeben
        # wäre irreführend: der Entwickler bekäme 200 beim Tausch und dann
        # ausschließlich 403.
        raise errors.ApiFehler(
            status=403,
            code="zugang_ohne_scopes",
            detail=(
                "Diesem Zugang ist kein Scope zugeordnet. "
                "Im Dashboard unter Konto → API-Zugang ergänzen."
            ),
            titel="Zugang ohne Scopes",
        )

    jetzt = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": str(zeile["client_id"]),
            "aud": TOKEN_AUDIENCE,
            "tenant_id": str(zeile["tenant_id"]),
            "scopes": scopes,
            "property_ids": [str(p) for p in (zeile.get("property_ids") or [])],
            "is_test": bool(zeile.get("is_test")),
            "cid": str(zeile["id"]),
            "iat": jetzt,
            "exp": jetzt + timedelta(seconds=TOKEN_TTL_SEKUNDEN),
        },
        signier_secret,
        algorithm="HS256",
    )

    # Best-effort: „zuletzt benutzt" für die Anzeige im Dashboard. Darf den
    # Token-Tausch nie kippen (Wurzel 5 — Logging/Audit ist best effort).
    try:
        db.table("api_clients").update({"last_used_at": jetzt.isoformat()}).eq(
            "id", zeile["id"]
        ).execute()
    except Exception:  # noqa: BLE001 — best-effort Audit, nie den Hauptpfad kippen
        log.warning("last_used_at_nicht_gesetzt", client_pk=str(zeile["id"]))

    return {
        "access_token": token,
        "token_type": "Bearer",
        "expires_in": TOKEN_TTL_SEKUNDEN,
        "scope": " ".join(scopes),
    }


# ---------------------------------------------------------------------------
# Token-Prüfung
# ---------------------------------------------------------------------------
def kontext_aus_token(token: str, settings: Settings) -> ApiKontext:
    """Access-Token → `ApiKontext`. Wirft 401/503, nie fail-open."""
    signier_secret = settings.api_token_secret.get_secret_value()
    if not signier_secret:
        # Ohne Secret ist KEIN Token gültig — nicht „alle".
        raise errors.nicht_konfiguriert(
            "Die Token-Prüfung ist auf diesem Server nicht eingerichtet."
        )
    try:
        claims = jwt.decode(
            token, signier_secret, algorithms=["HS256"], audience=TOKEN_AUDIENCE
        )
    except jwt.PyJWTError as exc:
        raise errors.nicht_authentifiziert() from exc

    tenant_id = claims.get("tenant_id")
    scopes = claims.get("scopes")
    if not isinstance(tenant_id, str) or not isinstance(scopes, list):
        raise errors.nicht_authentifiziert("Token ohne gültige Angaben.")

    prop_ids = claims.get("property_ids")
    return ApiKontext(
        tenant_id=tenant_id,
        client_pk=str(claims.get("cid") or ""),
        client_id=str(claims.get("sub") or ""),
        scopes=[str(s) for s in scopes],
        property_ids=[str(p) for p in prop_ids] if isinstance(prop_ids, list) else [],
        is_test=bool(claims.get("is_test")),
    )


def scope_erforderlich(scope: str) -> Callable[..., ApiKontext]:
    """Dependency-Fabrik: prüft Token UND erzwingt genau diesen Scope.

    Jeder Endpunkt hängt an einem Scope — auch die rein lesenden. Ein Endpunkt
    mit „nur Token gültig" wäre Authentifizierung ohne Autorisierung (Wurzel 9).
    """

    def _dep(
        request: Request,
        settings: Annotated[Settings, Depends(get_settings)],
        authorization: Annotated[str | None, Header()] = None,
    ) -> ApiKontext:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise errors.nicht_authentifiziert("Authorization-Header fehlt.")
        ctx = kontext_aus_token(authorization.split(" ", 1)[1], settings)
        if scope not in ctx.scopes:
            raise errors.scope_fehlt(scope)
        # Für Rate-Limit-Schlüssel und Protokoll: der Zugang, nicht die IP, ist
        # die Einheit, die wir begrenzen (eine Agentur sitzt hinter einer IP).
        request.state.api_client_pk = ctx.client_pk
        request.state.api_tenant_id = ctx.tenant_id
        return ctx

    return _dep
