"""Auth-Hülle: verifiziert Supabase-JWT und stellt AuthContext bereit.

Modernes Supabase signiert Access-Tokens mit **ES256** (asymmetrisch, JWKS).
Ältere Projekte nutzen **HS256** mit einem Shared Secret. Dieser Code unterstützt
beide: zuerst JWKS/ES256 (anhand des `kid` im Token-Header), sonst HS256-Fallback.

Die Rollen-/Tenant-Auflösung erfolgt aus den JWT-Claims (`app_metadata`) — keine
Platzhalter-Akzeptanz beliebiger Tokens.
"""
import secrets
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient
from pydantic import BaseModel

from .config import Settings, get_settings

# Erlaubte Signatur-Algorithmen (fail-closed). ES256/RS256 = modernes Supabase via
# JWKS, HS256 = Legacy-Shared-Secret. "none" ist bewusst NICHT enthalten.
_ALLOWED_ALGS = frozenset({"HS256", "ES256", "RS256"})


class AuthContext(BaseModel):
    user_id: str
    tenant_id: str | None = None
    role: str | None = None
    # Die GoTrue-Session-ID dieses Access-Tokens (Claim session_id). Erlaubt es
    # Endpunkten, die AKTUELLE Sitzung zu erkennen (z. B. „auf allen anderen
    # Geräten abmelden" ohne sich selbst auszusperren). Bei API-Client-Tokens None.
    session_id: str | None = None
    # Nur gesetzt, wenn der Request über einen Entwickler-API-Token kommt
    # (Client-Credentials), nicht über ein Supabase-Login-Token. Erlaubt den
    # Endpunkten, Scope + Objekt-Beschränkung des API-Clients durchzusetzen
    # (Wurzel 3/9). Bei normalem Login bleiben diese Felder None.
    api_scopes: list[str] | None = None
    api_property_ids: list[str] | None = None
    api_is_test: bool | None = None


@lru_cache
def _jwk_client(jwks_url: str) -> PyJWKClient:
    # Cacht die öffentlichen Schlüssel pro JWKS-URL (kein Fetch je Request).
    return PyJWKClient(jwks_url)


def _jwks_url(settings: Settings) -> str:
    return f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"


def _decode_token(token: str, settings: Settings) -> dict[str, object]:
    """Verifiziert ES256 (JWKS) oder HS256 (Shared Secret) je nach Token-Header."""
    try:
        alg = jwt.get_unverified_header(token).get("alg")
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültiges oder abgelaufenes Token.",
        ) from exc

    # Härtung (Security-Audit V2): Der Branch-Zweig unten wird durch den
    # angreiferkontrollierten `alg`-Header ausgewählt. Ein aktiver Algorithm-
    # Confusion-Angriff (Public Key als HMAC-Secret) ist bereits ausgeschlossen,
    # weil HS256 ein SEPARATES Shared Secret nutzt (nicht den JWKS-Public-Key).
    # Zusätzlich lehnen wir hier jeden nicht erwarteten Algorithmus (inkl. "none")
    # explizit VOR dem Verzweigen ab (fail-closed, kein Rückgriff auf Defaults).
    if alg not in _ALLOWED_ALGS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültiges oder abgelaufenes Token.",
        )

    try:
        if alg == "HS256":
            secret = settings.supabase_jwt_secret.get_secret_value()
            if not secret:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="JWT-Secret nicht konfiguriert.",
                )
            return jwt.decode(
                token, secret, algorithms=["HS256"], audience="authenticated"
            )
        # Asymmetrisch (ES256/RS256): öffentlichen Schlüssel via JWKS holen.
        signing_key = _jwk_client(_jwks_url(settings)).get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültiges oder abgelaufenes Token.",
        ) from exc


def decode_token(token: str, settings: Settings) -> dict[str, object]:
    """Öffentlicher Zugang zum verifizierten Token-Claim-Set (z. B. um die
    session_id/sub einer frisch ausgestellten Session zu lesen). Wirft dieselbe
    401-HTTPException wie der Guard, wenn das Token ungültig ist."""
    return _decode_token(token, settings)


def get_current_user(
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> AuthContext:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization-Header fehlt.",
        )
    token = authorization.split(" ", 1)[1]
    claims = _decode_token(token, settings)
    sub = claims.get("sub")
    if not isinstance(sub, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token ohne gültige sub-Claim.",
        )
    app_meta = claims.get("app_metadata") or {}
    tenant = app_meta.get("tenant_id") if isinstance(app_meta, dict) else None
    role = app_meta.get("role") if isinstance(app_meta, dict) else None
    session_id = claims.get("session_id")
    return AuthContext(
        user_id=sub,
        tenant_id=tenant if isinstance(tenant, str) else None,
        role=role if isinstance(role, str) else None,
        session_id=session_id if isinstance(session_id, str) else None,
    )


CurrentUser = Annotated[AuthContext, Depends(get_current_user)]


class GuestContext(BaseModel):
    """Kontext eines eingeloggten Portal-Gasts (Demand-Seite, /plattform).

    Getrennt von AuthContext (Vermieter/Staff): ein Gast hat KEINEN tenant_id
    und KEINE Rolle — er ist über seine auth.uid() (== portal_guests.id) und
    seine E-Mail (E-Mail-Match gegen reservations.guest_email) identifiziert.
    """
    guest_id: str
    email: str


def get_current_guest(
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> GuestContext:
    """Verifiziert ein Portal-Gast-Token (reguläres Supabase-JWT).

    Ein Gast-Token ist ein normales GoTrue-Access-Token (aud=authenticated),
    trägt aber KEINE app_metadata.tenant_id. Die Zugehörigkeit zu portal_guests
    prüft der jeweilige Service beim ersten DB-Zugriff (E-Mail-Match); der Guard
    liefert nur die identifizierenden Claims (sub + email), fail-closed bei
    fehlender E-Mail. Ob ein Tenant-Nutzer-Token hier durchkäme, ist unkritisch:
    jeder Gast-Endpunkt scoped ausschließlich über guest_id/email, sodass ein
    Tenant-Token nur seine EIGENEN (per E-Mail gematchten) Buchungen sähe.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization-Header fehlt.",
        )
    token = authorization.split(" ", 1)[1]
    claims = _decode_token(token, settings)
    sub = claims.get("sub")
    email = claims.get("email")
    if not isinstance(sub, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token ohne gültige sub-Claim.",
        )
    if not isinstance(email, str) or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token ohne E-Mail-Claim.",
        )
    return GuestContext(guest_id=sub, email=email.lower())


CurrentGuest = Annotated[GuestContext, Depends(get_current_guest)]


def secrets_match(provided: str | None, expected: str | None) -> bool:
    """Zeitkonstanter Vergleich zweier Secret-Strings, robust gegen nicht-ASCII.

    secrets.compare_digest wirft bei einem str mit Zeichen > 127 einen TypeError
    ('comparing strings with non-ASCII characters is not supported'). Der Wert
    kommt bei Webhook-/Cron-Guards aus einem angreiferkontrollierten Header —
    ein nicht-ASCII-Zeichen darf keinen 500 (unbehandelte Exception, Log-Flooding)
    auslösen, sondern muss schlicht als 'passt nicht' gelten. Byteweiser Vergleich
    (.encode()) umgeht das und bleibt zeitkonstant."""
    if not provided or not expected:
        return False
    return secrets.compare_digest(provided.encode("utf-8"), expected.encode("utf-8"))


def require_internal_cron_secret(provided: str | None) -> None:
    """Guard für interne Cron-Endpunkte (tenant-übergreifend, service_role).

    Eigenes INTERNAL_CRON_SECRET, das den Server NIE verlässt. Bewusst NICHT
    das CHANNEX_WEBHOOK_SECRET: das geht bei register_global_webhook OUTBOUND
    an Channex — wer es dort sieht, könnte sonst destruktive projektweite
    Aktionen (Massen-Mailversand, Preis-Push, Owner-Abrechnungen) auslösen.

    Kein Fallback: ohne konfiguriertes Secret sind die Cron-Endpunkte hart
    deaktiviert (503) statt still offen oder still auf ein Fremd-Secret
    zurückzufallen. Vergleich zeitkonstant (kein Timing-Seitenkanal).
    """
    expected = get_settings().internal_cron_secret.get_secret_value()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="INTERNAL_CRON_SECRET ist nicht konfiguriert.",
        )
    if not secrets_match(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Ungültiges Secret."
        )
