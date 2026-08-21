"""Verwaltung der Entwickler-Zugänge (Booking-„Machine Account"-Modell).

Erzeugt und verwaltet API-Clients (Client-ID + gehashtes Secret) pro Tenant:
anlegen, auflisten, Secret rotieren, widerrufen. Alle Zugriffe laufen über
service_role — die Tabelle ist gegen anon/authenticated gesperrt (Wurzel 6).
Jeder Zugriff ist tenant-gescopet (Wurzel 3).

Der TAUSCH von Client-ID + Secret gegen ein Access-Token steht NICHT mehr hier,
sondern im eigenen Service `apps/public-api` (dort `core/auth.py`). Er ist
umgezogen, nicht kopiert: zwei Stellen, die Tokens ausgeben, wären zwei
Wahrheiten über Gültigkeitsdauer, Audience und Widerruf. Diese Datei erzeugt das
Secret und schreibt seinen SHA-256-Hash; der öffentliche Service liest genau
diesen Hash. Der gemeinsame Vertrag ist damit die Spalte `secret_hash`, nicht
gemeinsamer Code.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime

from supabase import Client

from src.core.config import Settings, get_settings
from src.core.logging import get_logger
from src.core.security import AuthContext

from .scopes import unbekannte_scopes

log = get_logger("nextdays.api_clients")

class ApiClientError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _hash_secret(secret: str) -> str:
    """SHA-256 des Secrets. Für ein rein zufälliges 256-Bit-Token ist SHA-256
    ausreichend (kein Brute-Force-Risiko wie bei Passwörtern).

    GELESEN wird der Hash vom öffentlichen Service (`apps/public-api`) beim
    Token-Tausch. Wer das Verfahren hier ändert, macht damit jeden bestehenden
    Zugang ungültig — das ist eine Migration, kein Einzeiler.
    """
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
        unknown = unbekannte_scopes(scopes)
        if unknown:
            raise ApiClientError(
                f"Unbekannte Scopes: {', '.join(unknown)}", status_code=422
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
