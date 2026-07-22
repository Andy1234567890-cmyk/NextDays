"""Pydantic-Schemas für den guest_wishlist-Slice.

Merkzettel (wishlists) und deren Einträge (wishlist_items) eines Portal-Gasts.
Angezeigte Objekt-Infos sind gast-sicher (Titel/Foto/Ort/Währung/ab-Preis) —
keine internen Felder, kein €-/Preis-Fallback (Wurzel 4): fehlt der Preis, bleibt
er ``None``, nie 0/Fantasiewert.
"""
from datetime import datetime

from pydantic import BaseModel, Field

# Längen-Obergrenzen (Wurzel 8): unbegrenzter Client-Text wird serverseitig
# gespeichert → hart cappen, sonst 422 (Pydantic wirft bei Überlänge).
_MAX_NAME_LEN = 120
_MAX_NOTE_LEN = 500


class WishlistCreateRequest(BaseModel):
    """Anlage eines neuen Merkzettels (nur der Name)."""

    name: str = Field(min_length=1, max_length=_MAX_NAME_LEN)


class WishlistSummary(BaseModel):
    """Listendarstellung eines Merkzettels mit Anzahl enthaltener Objekte."""

    id: str
    name: str
    item_count: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None


class WishlistListResponse(BaseModel):
    items: list[WishlistSummary] = []
    total: int = 0


class WishlistItem(BaseModel):
    """Ein Eintrag eines Merkzettels, angereichert mit gast-sicherer Objekt-Info.

    ``bookable`` = True nur, wenn das Objekt aktuell buchbar ist (status='active'
    UND auf dem Marktplatz gelistet). ``price_from``/``currency`` kommen aus den
    Objektdaten; fehlt ein Preis, bleibt ``price_from`` None (kein Fallback).
    Ein zwischenzeitlich gelöschtes Objekt liefert nur die IDs/Note zurück
    (``title``/``photo``/``city`` None, ``bookable`` False).
    """

    property_id: str
    note: str | None = None
    created_at: datetime | None = None
    title: str | None = None
    photo: str | None = None
    city: str | None = None
    country: str | None = None
    currency: str = ""
    price_from: float | None = None
    bookable: bool = False


class WishlistDetailResponse(BaseModel):
    id: str
    name: str
    items: list[WishlistItem] = []


class WishlistItemAddRequest(BaseModel):
    """Objekt (+ optionale Notiz) einem Merkzettel hinzufügen."""

    property_id: str = Field(min_length=1)
    note: str | None = Field(default=None, max_length=_MAX_NOTE_LEN)


class MessageResponse(BaseModel):
    """Schlichte Bestätigung für Lösch-/Idempotenz-Operationen."""

    ok: bool = True
    detail: str = ""


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
