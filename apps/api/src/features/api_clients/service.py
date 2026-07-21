"""Service für den Entwickler-API-Zugang (Booking-„Machine Account"-Modell).

Erzeugt/verwaltet API-Clients (Client-ID + gehashtes Secret) pro Tenant und
tauscht Client-Credentials gegen ein kurzlebiges Access-Token (1 h). Alle
Schreib-/Lesezugriffe laufen über service_role — die Tabelle ist gegen
anon/authenticated gesperrt (Wurzel 6). Secret-Vergleich zeitkonstant/
fail-closed (Wurzel 5). Jeder Zugriff ist tenant-gescopet (Wurzel 3).
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import jwt
from supabase import Client

from src.core.config import Settings, get_settings
from src.core.logging import get_logger
from src.core.security import AuthContext, secrets_match

from .schemas import API_SCOPES

log = get_logger("nextdays.api_clients")

# Kurzlebiges Access-Token: 1 h (wie Booking.com). Ein widerrufener Client kann
# keine neuen Tokens tauschen; ausgegebene Tokens verfallen binnen dieser Frist.
_TOKEN_TTL_SECONDS = 3600
# Eigene Audience trennt API-Tokens strikt von Supabase-Login-Tokens (Wurzel 7).
_TOKEN_AUDIENCE = "mynextdays-api"  # noqa: S105 — JWT-Audience, kein Secret


class ApiClientError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _hash_secret(secret: str) -> str:
    """SHA-256 des Secrets. Für ein rein zufälliges 256-Bit-Token ist SHA-256
    ausreichend (kein Brute-Force-Risiko wie bei Passwörtern)."""
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


class ApiClientsService:
    slice_name = "api_clients"

    def __init__(self, *, service_client: Client | None = None) -> None:
        self._db = service_client
        self._settings: Settings = get_settings()

    def health(self):  # noqa: ANN201
        from .schemas import SliceHealth
        return SliceHealth(status="ok")

    def _require(self, ctx: AuthContext) -> tuple[Client, str]:
        if not ctx.tenant_id:
            raise ApiClientError("Kein Tenant im Token.", status_code=403)
        if self._db is None:
            raise ApiClientError("DB nicht verfügbar.", status_code=500)
        return self._db, ctx.tenant_id

    # -- Verwaltung (Dashboard) ---------------------------------------------
    def list_clients(self, ctx: AuthContext) -> list[dict]:
        db, tenant_id = self._require(ctx)
        rows = (
            db.table("api_clients")
            .select(
                "id, client_id, name, is_test, scopes, property_ids, "
                "secret_last4, revoked_at, last_used_at, created_at"
            )
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .execute()
        ).data
        return rows

    def create_client(
        self,
        ctx: AuthContext,
        *,
        name: str,
        is_test: bool,
        scopes: list[str],
        property_ids: list[str],
    ) -> dict:
        db, tenant_id = self._require(ctx)
        self._validate_scopes(scopes)
        self._validate_property_ids(db, tenant_id, property_ids)
        client_id, secret = self._new_credentials(is_test)
        row = {
            "tenant_id": tenant_id,
            "client_id": client_id,
            "secret_hash": _hash_secret(secret),
            "secret_last4": secret[-4:],
            "name": name.strip(),
            "is_test": is_test,
            "scopes": scopes,
            "property_ids": property_ids,
        }
        res = db.table("api_clients").insert(row).execute().data
        if not res:
            raise ApiClientError(
                "API-Client konnte nicht angelegt werden.", status_code=500
            )
        log.info(
            "api_client_created",
            tenant_id=tenant_id,
            client_id=client_id,
            is_test=is_test,
        )
        # Klartext-Secret NUR hier zurückgeben (show-once).
        return {**res[0], "client_secret": secret}

    def rotate_secret(self, ctx: AuthContext, client_pk: str) -> dict:
        """Neues Secret vergeben (altes wird sofort ungültig). Gibt das neue
        Klartext-Secret einmalig zurück."""
        db, tenant_id = self._require(ctx)
        row = self._own_client(db, tenant_id, client_pk)
        _, secret = self._new_credentials(bool(row.get("is_test")))
        upd = (
            db.table("api_clients")
            .update({"secret_hash": _hash_secret(secret), "secret_last4": secret[-4:]})
            .eq("tenant_id", tenant_id)
            .eq("id", client_pk)
            .execute()
        ).data
        if not upd:
            raise ApiClientError("API-Client nicht gefunden.", status_code=404)
        log.info("api_client_rotated", tenant_id=tenant_id, client_id=row["client_id"])
        return {**upd[0], "client_secret": secret}

    def revoke_client(self, ctx: AuthContext, client_pk: str) -> None:
        db, tenant_id = self._require(ctx)
        self._own_client(db, tenant_id, client_pk)
        db.table("api_clients").update(
            {"revoked_at": datetime.now(UTC).isoformat()}
        ).eq("tenant_id", tenant_id).eq("id", client_pk).is_(
            "revoked_at", "null"
        ).execute()
        log.info("api_client_revoked", tenant_id=tenant_id, client_pk=client_pk)

    def _own_client(self, db: Client, tenant_id: str, client_pk: str) -> dict:
        rows = (
            db.table("api_clients").select("*")
            .eq("id", client_pk).eq("tenant_id", tenant_id)
            .limit(1).execute()
        ).data
        if not rows:
            raise ApiClientError("API-Client nicht gefunden.", status_code=404)
        return rows[0]

    def _validate_scopes(self, scopes: list[str]) -> None:
        unknown = [s for s in scopes if s not in API_SCOPES]
        if unknown:
            raise ApiClientError(
                f"Unbekannte Scopes: {', '.join(sorted(unknown))}", status_code=422
            )

    def _validate_property_ids(
        self, db: Client, tenant_id: str, property_ids: list[str]
    ) -> None:
        """Objekt-Beschränkung darf nur EIGENE Objekte referenzieren (Wurzel 3:
        sonst könnte ein Client auf fremde property_ids gescopet werden)."""
        if not property_ids:
            return
        owned = {
            str(r["id"])
            for r in (
                db.table("properties").select("id")
                .eq("tenant_id", tenant_id).execute()
            ).data
        }
        foreign = [p for p in property_ids if p not in owned]
        if foreign:
            raise ApiClientError(
                "property_ids enthält fremde/unbekannte Objekte.", status_code=422
            )

    def _new_credentials(self, is_test: bool) -> tuple[str, str]:
        env = "test" if is_test else "live"
        client_id = f"mnd_{env}_id_{secrets.token_hex(12)}"
        # 32 Byte Entropie, URL-sicher; Prefix trägt Marke + Umgebung.
        secret = f"mnd_{env}_{secrets.token_urlsafe(32)}"
        return client_id, secret

    # -- Token-Tausch (Client-Credentials) ----------------------------------
    def issue_token(self, *, client_id: str, client_secret: str) -> dict:
        """Client-ID + Secret → kurzlebiges Access-Token (1 h). Fail-closed:
        unbekannter/widerrufener Client oder falsches Secret → identischer 401
        (keine Auskunft, welcher Teil falsch war). Der Secret-Vergleich ist
        zeitkonstant (Wurzel 5)."""
        if self._db is None:
            raise ApiClientError("DB nicht verfügbar.", status_code=500)
        api_secret = self._settings.api_token_secret.get_secret_value()
        if not api_secret:
            # Ohne Signier-Secret KEIN Token ausgeben (fail-closed, Wurzel 5/7).
            raise ApiClientError(
                "API-Token-Ausgabe nicht konfiguriert.", status_code=503
            )
        rows = (
            self._db.table("api_clients")
            .select("id, tenant_id, secret_hash, scopes, property_ids, "
                    "is_test, revoked_at")
            .eq("client_id", client_id)
            .limit(1).execute()
        ).data
        row = rows[0] if rows else None
        # Immer hashen und vergleichen (auch bei unbekanntem Client), damit die
        # Antwortzeit nicht verrät, ob der client_id existiert.
        expected = row["secret_hash"] if row else _hash_secret("dummy")
        ok = secrets_match(_hash_secret(client_secret), expected)
        if not row or row.get("revoked_at") is not None or not ok:
            raise ApiClientError(
                "Ungültige Client-Zugangsdaten.", status_code=401
            )
        scopes = list(row.get("scopes") or [])
        if not scopes:
            raise ApiClientError(
                "Client hat keine Scopes.", status_code=403
            )
        now = datetime.now(UTC)
        token = jwt.encode(
            {
                "sub": row["client_id"] if row.get("client_id") else client_id,
                "aud": _TOKEN_AUDIENCE,
                "tenant_id": str(row["tenant_id"]),
                "scopes": scopes,
                "property_ids": [str(p) for p in (row.get("property_ids") or [])],
                "is_test": bool(row.get("is_test")),
                "cid": str(row["id"]),
                "iat": now,
                "exp": now + timedelta(seconds=_TOKEN_TTL_SECONDS),
            },
            api_secret,
            algorithm="HS256",
        )
        # Best-effort last_used (kippt den Token-Tausch nie, Wurzel 5).
        try:
            self._db.table("api_clients").update(
                {"last_used_at": now.isoformat()}
            ).eq("id", row["id"]).execute()
        except Exception:  # noqa: BLE001 — best-effort Audit
            log.warning("api_client_last_used_update_failed", client_pk=row["id"])
        return {
            "access_token": token,
            "expires_in": _TOKEN_TTL_SECONDS,
            "scope": " ".join(scopes),
        }

    @staticmethod
    def decode_token(token: str, *, api_secret: str) -> dict:
        """API-Access-Token verifizieren (HS256, eigene Audience). Wirft
        jwt.PyJWTError bei ungültig/abgelaufen — der Caller macht daraus 401."""
        return jwt.decode(
            token, api_secret, algorithms=["HS256"], audience=_TOKEN_AUDIENCE
        )
