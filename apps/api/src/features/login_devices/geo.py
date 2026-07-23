"""Eigener IP→Ort-Resolver (kein Fremddienst, keine externe Datenbank).

Die Zuordnung IP→Land/Stadt kommt ausschließlich aus der selbst gepflegten
Tabelle ``public.ip_geo_ranges``: jeder Eintrag ist ein IP-Bereich
(``ip_from``..``ip_to``) mit Land und optional Stadt. Der Resolver nimmt den
Bereich, in dem die Client-IP liegt (der spezifischste: größtes ``ip_from``, das
noch ``<= ip`` ist, mit ``ip_to >= ip``).

Kein Treffer → Ort bleibt ``None`` (kein erfundener Ersatzwert, Wurzel 4). Die
Bereiche pflegt der Betrieb selbst über ``GeoRangeService`` — es wird nichts von
extern geladen oder abgefragt.
"""
from __future__ import annotations

from dataclasses import dataclass

from supabase import Client

from src.core.logging import get_logger

log = get_logger("nextdays.login_devices.geo")


@dataclass(frozen=True)
class ResolvedPlace:
    """Aufgelöster Ort einer IP. Beide Felder können None sein (unbekannt)."""

    country: str | None
    city: str | None


class IpGeoResolver:
    """Löst eine Client-IP über die eigene ip_geo_ranges-Tabelle in Land/Stadt auf."""

    def __init__(self, db: Client) -> None:
        self._db = db

    def resolve(self, ip: str | None) -> ResolvedPlace:
        """Land/Stadt für eine IP. Kein passender Bereich → beides None.

        Nie ein Fehler nach außen: taugt die IP nicht (leer/kaputt) oder gibt es
        keinen Bereich, ist das schlicht „Ort unbekannt" — der Login/Geräteeintrag
        darf daran nicht scheitern (best effort, Wurzel 5)."""
        if not ip:
            return ResolvedPlace(country=None, city=None)
        try:
            res = (
                self._db.table("ip_geo_ranges")
                .select("country, city")
                .lte("ip_from", ip)
                .gte("ip_to", ip)
                .order("ip_from", desc=True)
                .limit(1)
                .execute()
            )
        except Exception as exc:  # noqa: BLE001 — Auflösung ist best effort
            log.warning("ip_geo_lookup_failed", error=str(exc))
            return ResolvedPlace(country=None, city=None)
        if not res.data:
            return ResolvedPlace(country=None, city=None)
        row = res.data[0]
        return ResolvedPlace(country=row.get("country"), city=row.get("city"))


class GeoRangeService:
    """Verwaltung der selbst gepflegten IP→Ort-Bereiche (anlegen/listen/löschen).

    Referenzdaten, kein tenant-Bezug — nur Admins des Betriebs (Guard im Router)
    pflegen sie. Der Client ist service_role (RLS auf ip_geo_ranges verbietet
    jeden Nicht-service_role-Zugriff, Wurzel 6)."""

    def __init__(self, db: Client) -> None:
        self._db = db

    def list_ranges(self) -> list[dict]:
        res = (
            self._db.table("ip_geo_ranges")
            .select("id, ip_from, ip_to, country, city, created_at")
            .order("ip_from")
            .execute()
        )
        return res.data or []

    def add_range(
        self, ip_from: str, ip_to: str, country: str, city: str | None
    ) -> dict:
        res = (
            self._db.table("ip_geo_ranges")
            .insert(
                {
                    "ip_from": ip_from,
                    "ip_to": ip_to,
                    "country": country,
                    "city": city,
                }
            )
            .execute()
        )
        return res.data[0]

    def delete_range(self, range_id: str) -> None:
        self._db.table("ip_geo_ranges").delete().eq("id", range_id).execute()
