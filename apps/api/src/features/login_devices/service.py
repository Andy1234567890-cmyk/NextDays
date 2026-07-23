"""Login-Geräte / Geräteverlauf — Erfassung, Anzeige, Widerruf.

Beim erfolgreichen Login schreibt der Server GENAU EINE Zeile in login_devices
mit der echten Client-IP (selbst aus X-Forwarded-For ermittelt), dem rohen
User-Agent und dem über die eigene ip_geo_ranges-Tabelle aufgelösten Ort. Der
Geräteverlauf liest daraus (nicht aus auth.sessions, wo die Server-IP stünde).

Widerruf koppelt über session_id an die GoTrue-Session: „Gerät abmelden" löscht
die auth.sessions-Zeile (kaskadiert auf refresh_tokens) UND die login_devices-
Zeile. Scope IMMER auf user_id (Wurzel 3/9) — nie fremde Geräte les-/löschbar.
"""
from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .geo import IpGeoResolver

log = get_logger("nextdays.login_devices")


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


class LoginDeviceService:
    def __init__(self, db: Client) -> None:
        self._db = db
        self._geo = IpGeoResolver(db)

    # -- Erfassung beim Login ----------------------------------------------

    def record_login(
        self,
        user_id: str,
        session_id: str | None,
        ip: str | None,
        user_agent: str | None,
    ) -> None:
        """Eine Login-Geräte-Zeile schreiben (best effort — ein Fehler hier darf
        den Login nicht kippen). Idempotent je Session: existiert schon eine Zeile
        mit dieser session_id, wird nur last_seen_at aktualisiert (verhindert das
        Doppel-Session-Problem, wenn derselbe Login mehrere GoTrue-Sessions macht).

        Der Ort wird über die eigene ip_geo_ranges-Tabelle aufgelöst; kein Treffer
        → country/city bleiben None (kein Fake, Wurzel 4)."""
        try:
            if session_id and self._touch_existing(session_id):
                return
            place = self._geo.resolve(ip)
            self._db.table("login_devices").insert(
                {
                    "user_id": user_id,
                    "session_id": session_id,
                    "ip": ip,
                    "user_agent": user_agent,
                    "country": place.country,
                    "city": place.city,
                }
            ).execute()
            log.info("login_device_recorded", user_id=user_id)
        except Exception as exc:  # noqa: BLE001 — Erfassung ist best effort
            log.warning("login_device_record_failed", user_id=user_id, error=str(exc))

    def _touch_existing(self, session_id: str) -> bool:
        """last_seen_at einer bestehenden Zeile mit dieser session_id auffrischen.
        True, wenn es sie gab (dann KEINE zweite Zeile für denselben Login)."""
        existing = (
            self._db.table("login_devices")
            .select("id")
            .eq("session_id", session_id)
            .limit(1)
            .execute()
        )
        if not existing.data:
            return False
        self._db.table("login_devices").update({"last_seen_at": _now_iso()}).eq(
            "session_id", session_id
        ).execute()
        return True

    # -- Anzeige -----------------------------------------------------------

    def list_devices(self, ctx: AuthContext) -> list[dict]:
        """Aktive Geräte des eingeloggten Nutzers, neueste zuerst. is_current
        markiert die Sitzung, aus der der aktuelle Request kommt (session_id aus
        dem Token). Nur Geräte, deren GoTrue-Session noch existiert, gelten als
        aktiv — verwaiste Zeilen (Session abgelaufen/widerrufen) werden gefiltert."""
        rows = (
            self._db.table("login_devices")
            .select("id, session_id, ip, user_agent, country, city, "
                    "created_at, last_seen_at")
            .eq("user_id", ctx.user_id)
            .order("last_seen_at", desc=True)
            .execute()
        ).data or []

        active_ids = self._active_session_ids(ctx.user_id)
        out: list[dict] = []
        for r in rows:
            sid = r.get("session_id")
            # Zeilen ohne (noch) gültige Session ausblenden — aber Zeilen ohne
            # session_id (Erfassung ohne Session-ID) trotzdem zeigen.
            if sid is not None and sid not in active_ids:
                continue
            r["is_current"] = bool(ctx.session_id and sid == ctx.session_id)
            r["ip"] = str(r["ip"]) if r.get("ip") is not None else None
            out.append(r)
        return out

    def _active_session_ids(self, user_id: str) -> set[str]:
        """IDs der noch gültigen GoTrue-Sessions dieses Nutzers (über die
        gescopte RPC aus Migration 0191)."""
        res = self._db.rpc(
            "host_list_own_sessions", {"p_user_id": user_id}
        ).execute()
        return {row["id"] for row in (res.data or [])}

    # -- Widerruf ----------------------------------------------------------

    def revoke_device(self, ctx: AuthContext, device_id: str) -> None:
        """Ein Gerät abmelden: zugehörige GoTrue-Session widerrufen (kaskadiert
        auf refresh_tokens) UND die login_devices-Zeile entfernen. Scope auf
        user_id in beiden Schritten (Wurzel 9). 0 betroffene Zeilen → 404."""
        row = (
            self._db.table("login_devices")
            .select("id, session_id")
            .eq("id", device_id)
            .eq("user_id", ctx.user_id)
            .limit(1)
            .execute()
        )
        if not row.data:
            raise LoginDeviceError("Gerät nicht gefunden.", status_code=404)
        session_id = row.data[0].get("session_id")
        if session_id:
            self._db.rpc(
                "host_revoke_session",
                {"p_user_id": ctx.user_id, "p_session_id": session_id},
            ).execute()
        self._db.table("login_devices").delete().eq("id", device_id).eq(
            "user_id", ctx.user_id
        ).execute()
        log.info("login_device_revoked", user_id=ctx.user_id)

    def revoke_other_devices(self, ctx: AuthContext) -> int:
        """Alle anderen Geräte abmelden: andere GoTrue-Sessions widerrufen +
        deren login_devices-Zeilen löschen. Die aktuelle Sitzung bleibt."""
        res = self._db.rpc(
            "host_revoke_other_sessions",
            {"p_user_id": ctx.user_id, "p_keep_session_id": ctx.session_id},
        ).execute()
        revoked = res.data if isinstance(res.data, int) else 0
        # login_devices aufräumen: alle Zeilen außer der aktuellen entfernen.
        query = self._db.table("login_devices").delete().eq("user_id", ctx.user_id)
        if ctx.session_id:
            query = query.neq("session_id", ctx.session_id)
        query.execute()
        log.info("login_devices_other_revoked", user_id=ctx.user_id, count=revoked)
        return revoked


class LoginDeviceError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
