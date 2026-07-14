"""Pydantic-Schemas für das Bilder-Modul (PM „Bilder").

Aggregiert Foto-Nachweise aus mehreren Quellen zu einer einheitlichen Karte:
Objektfotos (property_photos, public URL) + Buchungs-/Aufgabenfotos
(checklist_photos, privater Bucket → signierte URL). KEINE erfundenen Quellen
(Zahlungsbilder existieren im Datenmodell nicht → nicht ausgeliefert).
"""
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel


class MediaKind(StrEnum):
    booking = "booking"      # Buchungs-/Aufgabenfoto (checklist_photos)
    property = "property"    # Objektfoto (property_photos)


class MediaItem(BaseModel):
    id: str
    kind: MediaKind
    url: str                       # public ODER signierte URL (zeitlich begrenzt)
    property_id: str | None = None
    property_title: str | None = None
    reservation_id: str | None = None
    task_title: str | None = None
    author: str | None = None
    uploaded_at: datetime | None = None
    # Buchungszeitraum (nur bei kind=booking mit reservation)
    check_in: str | None = None
    check_out: str | None = None


class MediaListResponse(BaseModel):
    items: list[MediaItem] = []


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
