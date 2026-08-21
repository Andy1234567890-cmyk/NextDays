"""Projektion einer `properties`-Zeile in die API-Antwort.

Reine Umformung ohne Datenbankzugriff: DB-Zeile → Response-Schema
(`_row`/`row`) und die abgeleiteten Kanal-Zustaende fuer die drei Chips
(`_derive_channels`/`derive_channels`).

Eigenes Modul, damit `service.py` unter der Zeilengrenze bleibt (pylint C0302)
und weil die Ableitung der Kanal-Zustaende eine eigene fachliche Begruendung
traegt (welcher Kanal gilt wann als sichtbar) — die gehoert nicht zwischen die
Datenbank-Methoden.
"""
from __future__ import annotations

from .schemas import ChannelState, PropertyChannels


def _local_channel_state(status: str | None, flag: bool | None) -> ChannelState:
    """Zustand eines LOKALEN Kanals (Website/Plattform) ableiten. Diese Kanäle
    können keinen Sync-Fehler haben (kein externer Push) → nur active/paused.
    Sichtbar (active) nur, wenn status='active' UND das Kanal-Flag an ist; sonst
    paused. Der Lebenszyklus (status) wird auf der Karte separat als Badge oben
    gezeigt; hier zählt nur die pro-Kanal-Sichtbarkeit."""
    if status == "active" and bool(flag):
        return ChannelState.active
    return ChannelState.paused


def _marketplace_channel_state(
    status: str | None, flag: bool | None, moderation: str | None
) -> ChannelState:
    """Zustand des EIGENEN Marktplatzes (myBestDays). Hängt zusätzlich an der
    Freigabe des Betreibers (`moderation_status='approved'`, 0203) — dieselbe
    Bedingung wie im öffentlichen `booking_engine.list_listings`. Ohne Freigabe
    `pending`, nie `active`: das Objekt steht dort nicht. Live 11.08.2026: 17
    gelistete Objekte trugen den grünen Punkt, der Marktplatz zeigte sie nie."""
    if status != "active" or not bool(flag):
        return ChannelState.paused
    if moderation != "approved":
        return ChannelState.pending
    return ChannelState.active


def _derive_channels(
    r: dict, portals: ChannelState | None
) -> PropertyChannels:
    """Kanal-Zustände (Ebene B) für die drei Chips: Website aus dem lokalen Flag,
    Plattform zusätzlich über die Marktplatz-Freigabe (0203), Portale aus dem
    Channex/OTA-Aggregat (None → not_connected, kein erfundener Wert)."""
    status = r.get("status")
    return PropertyChannels(
        website=_local_channel_state(status, r.get("listed_on_website")),
        marketplace=_marketplace_channel_state(
            status, r.get("listed_on_marketplace"), r.get("moderation_status")
        ),
        portals=portals or ChannelState.not_connected,
    )


def _row(r: dict) -> dict:
    """DB-Zeile in das Response-Schema überführen (None-Listen/-Objekte glätten)."""
    return {
        **r,
        "id": str(r["id"]),
        "tenant_id": str(r["tenant_id"]),
        "amenities": r.get("amenities") or [],
        "photos": r.get("photos") or [],
        "type_attributes": r.get("type_attributes") or {},
        "created_at": str(r["created_at"]) if r.get("created_at") else None,
        "updated_at": str(r["updated_at"]) if r.get("updated_at") else None,
        # timestamptz → Text, wie die Zeitstempel darüber (Archiv, 0416).
        "archived_at": str(r["archived_at"]) if r.get("archived_at") else None,
    }
