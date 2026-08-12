"""Eigener Marktplatz (myBestDays) als Kanal-Detailfläche.

Der Marktplatz ist ein gleichrangiger Buchungskanal (CLAUDE.md „Vertriebskanäle"),
hat aber KEIN Channex-Mapping: Sichtbarkeit ist das lokale Flag
`properties.listed_on_marketplace` (0159) UND die Freigabe des Betreibers
(`moderation_status='approved'`, 0203). Deshalb liegt seine Detailfläche nicht im
OTA-Weg (`channel_detail`), sondern hier — mit genau den drei Achsen, die auf dem
Marktplatz über Sichtbarkeit entscheiden.

DER ANLASS (11.08.2026): Airbnb und Booking hatten je eine Seite
(/channels/BookingCom), myBestDays nur eine Karte, die auf /objekte sprang. Wo 17
Objekte auf Freigabe warteten, war das nirgends zu sehen.
"""
from __future__ import annotations

from typing import Any

from src.core.config import get_settings
from src.core.security import AuthContext

from .common import log
from .veroeffentlichen import MARKTPLATZ_CODE, portal_label

# Buchungen des eigenen Marktplatzes tragen `channel='portal'` (CLAUDE.md;
# Altbestand per 0239 nachgezogen). `ota_name` ist zusätzlich 'myBestDays', wird
# hier aber NICHT zur Bedingung gemacht: eine Portal-Buchung ohne gesetzten
# Namen ist trotzdem eine Marktplatz-Buchung, und ein zweiter Filter würde sie
# stillschweigend unterschlagen.
_MARKTPLATZ_KANAL = "portal"


class MarktplatzMixin:
    """Detailfläche des eigenen Marktplatzes (lesend, tenant-lokal)."""

    def marketplace_detail(self, ctx: AuthContext) -> dict[str, Any]:
        """Objekt-Tabelle des Marktplatz-Kanals: je Objekt Sichtbarkeit,
        Freigabe-Stand und die Zahl seiner Marktplatz-Buchungen.

        Keine erfundenen Werte: fehlt `marketplace_base_url`, kommt eine leere
        URL zurück und die Oberfläche zeigt keinen Link, statt auf eine geratene
        Domain zu verweisen (Wurzel 4).
        """
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()

        rows = (
            db.table("properties")
            .select(
                "id, title, city, country, status, listed_on_marketplace, "
                "moderation_status, photos"
            )
            .eq("tenant_id", tenant_id)
            .order("title")
            .execute()
        ).data or []

        # Buchungen je Objekt in EINER Query (kein N+1 über die Objektliste).
        buchungen: dict[str, int] = {}
        for r in (
            db.table("reservations")
            .select("property_id")
            .eq("tenant_id", tenant_id)
            .eq("channel", _MARKTPLATZ_KANAL)
            .execute()
        ).data or []:
            pid = str(r.get("property_id") or "")
            if pid:
                buchungen[pid] = buchungen.get(pid, 0) + 1

        basis = (get_settings().marketplace_base_url or "").rstrip("/")
        items = [_zeile(r, basis, buchungen) for r in rows]
        gelistet = sum(1 for i in items if i["state"] == "active")
        wartet = sum(1 for i in items if i["state"] == "pending")
        log.info(
            "marketplace_detail_read",
            tenant_id=tenant_id,
            objekte=len(items),
            gelistet=gelistet,
            wartet=wartet,
        )
        return {
            "code": MARKTPLATZ_CODE,
            "label": portal_label(MARKTPLATZ_CODE),
            # "" = nicht konfiguriert → kein Link in der Oberfläche.
            "marketplace_url": basis,
            "listed_count": gelistet,
            "pending_count": wartet,
            "items": items,
        }


def _zustand(status: str | None, gelistet: bool, moderation: str | None) -> str:
    """Derselbe Zustand wie der Chip auf der Objektkarte
    (`properties._marketplace_channel_state`) und dieselbe Bedingung wie der
    öffentliche Marktplatz (`booking_engine.list_listings`)."""
    if status != "active" or not gelistet:
        return "paused"
    if moderation != "approved":
        return "pending"
    return "active"


def _zeile(
    r: dict[str, Any], basis: str, buchungen: dict[str, int]
) -> dict[str, Any]:
    pid = str(r["id"])
    gelistet = bool(r.get("listed_on_marketplace"))
    zustand = _zustand(r.get("status"), gelistet, r.get("moderation_status"))
    fotos = r.get("photos") or []
    return {
        "property_id": pid,
        "title": r.get("title") or "",
        "city": r.get("city"),
        "country": r.get("country"),
        "status": r.get("status"),
        "listed": gelistet,
        "moderation_status": r.get("moderation_status"),
        "state": zustand,
        # Link NUR auf eine wirklich existierende öffentliche Seite: solange das
        # Objekt nicht freigegeben ist, gibt der Marktplatz dort 404.
        "listing_url": (
            f"{basis}/inserat/{pid}" if basis and zustand == "active" else None
        ),
        "photo": fotos[0] if fotos else None,
        "bookings_count": buchungen.get(pid, 0),
    }
