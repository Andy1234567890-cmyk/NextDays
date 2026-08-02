"""Pydantic-Schemas für den guest_reviews-Slice.

Gast-Bewertungen der eigenen Plattform (/plattform). Der öffentliche Lesepfad
liefert ausschließlich maskierte Daten (Vorname/Initiale, NIE voller Name/E-Mail/
guest_id — Recon-Schutz, Wurzel 9). Der Schreibpfad validiert rating (1-5) und
cappt die Textlänge (Wurzel 8); property_id wird NIE aus dem Request akzeptiert,
sondern server-seitig aus der Reservierung abgeleitet (Wurzel 3).
"""
from datetime import datetime

from pydantic import BaseModel, Field

# Harte Obergrenze für den Bewertungstext (Wurzel 8): unbegrenzter Client-Input,
# der öffentlich gerendert wird, bekommt eine Kappung → 422 statt stiller Trunkierung.
MAX_TEXT_LEN = 2000

# Obergrenze der öffentlichen Liste (Wurzel 8): unauth Endpunkt darf keine
# unbegrenzte Antwortgröße bauen. Pagination über offset.
MAX_PAGE_SIZE = 50
DEFAULT_PAGE_SIZE = 20


class SliceHealth(BaseModel):
    status: str = "ok"
    slice: str = "guest_reviews"


class CategoryScores(BaseModel):
    """Booking-Kategorie-Sub-Scores (je 1..5). Alle optional — Alt-Bewertungen
    tragen nur das Gesamt-rating (None bleibt None, kein Fallback, Wurzel 4)."""

    cleanliness: int | None = Field(default=None, ge=1, le=5)
    communication: int | None = Field(default=None, ge=1, le=5)
    location: int | None = Field(default=None, ge=1, le=5)
    value: int | None = Field(default=None, ge=1, le=5)
    accuracy: int | None = Field(default=None, ge=1, le=5)
    checkin: int | None = Field(default=None, ge=1, le=5)


class PublicReview(BaseModel):
    """Öffentlich sichtbare Bewertung — MASKIERT.

    Enthält bewusst KEINE portal_guest_id, KEINE E-Mail, KEINEN vollen Namen.
    `author` ist der maskierte Anzeigename (Vorname oder Initiale, sonst „Gast").
    """

    id: str
    rating: int
    text: str | None = None
    host_reply: str | None = None
    host_reply_at: datetime | None = None
    author: str
    scores: CategoryScores = Field(default_factory=CategoryScores)
    created_at: datetime


class PublicReviewsResponse(BaseModel):
    """Öffentliche Bewertungsliste eines Objekts inkl. Aggregat."""

    property_id: str
    average: float | None = None
    count: int = 0
    # Durchschnitt je Kategorie über die veröffentlichten Reviews mit gesetztem
    # Sub-Score. None, wenn keine Bewertung diese Kategorie trägt (kein Fallback).
    category_averages: CategoryScores | None = None
    reviews: list[PublicReview] = []


class MyReview(BaseModel):
    """Eigene Bewertung des eingeloggten Gasts (volle Sicht auf seine Daten)."""

    id: str
    property_id: str
    reservation_id: str | None = None
    rating: int
    text: str | None = None
    host_reply: str | None = None
    host_reply_at: datetime | None = None
    scores: CategoryScores = Field(default_factory=CategoryScores)
    # Sichtbarkeit (Airbnb double-blind): None = noch verdeckt (Gegenseite fehlt
    # + Frist läuft). Der Gast sieht sein eigenes Review IMMER, auch verdeckt.
    published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime | None = None


class MyReviewsResponse(BaseModel):
    reviews: list[MyReview] = []


class CreateReviewRequest(BaseModel):
    """Abgabe einer Bewertung. property_id kommt NIE aus dem Request (Wurzel 3),
    sondern wird server-seitig aus der Reservierung abgeleitet."""

    reservation_id: str
    rating: int = Field(ge=1, le=5)
    text: str | None = Field(default=None, max_length=MAX_TEXT_LEN)
    scores: CategoryScores = Field(default_factory=CategoryScores)


class UpdateReviewRequest(BaseModel):
    """Änderung einer eigenen Bewertung. Nur rating/text/scores — host_reply ist
    Tenant-Seite und hier NICHT setzbar."""

    rating: int | None = Field(default=None, ge=1, le=5)
    text: str | None = Field(default=None, max_length=MAX_TEXT_LEN)
    scores: CategoryScores | None = None


# Die Betriebs-Seite (Host-Sicht, Antwort, Gast bewerten) lebt im Slice
# `reviews` — myNextDays-Cockpit über ALLE Kanäle. Hier steht bewusst nur noch
# die myBestDays-Gast-Seite.
