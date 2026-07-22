"""Pydantic-Schemas für den guest_messages-Slice (Gast↔Host-Chat, /plattform).

Der Gast liest hierüber seine Threads/Nachrichten und sendet Nachrichten an den
Gastgeber. sender wird NIE aus dem Request übernommen (Wurzel 3/6) — der Server
setzt ihn auf 'guest'. body wird server-seitig gecappt und sanitisiert (Wurzel 8).
"""
from datetime import date, datetime

from pydantic import BaseModel, Field


class SliceHealth(BaseModel):
    """Health-Antwort des Slices."""

    status: str = "ok"
    slice: str = "guest_messages"


class GuestThreadSummary(BaseModel):
    """Ein Chat-Thread des Gasts in der Übersichtsliste.

    Angereichert um objekt- und reservierungsbezogene Anzeigefelder sowie die
    Zahl ungelesener Host-Nachrichten (Gast-Sicht: sender='host' & read_at null).
    """

    id: str
    reservation_id: str
    property_id: str
    property_title: str | None = None
    check_in: date | None = None
    check_out: date | None = None
    last_message_at: datetime | None = None
    unread_count: int = 0
    created_at: datetime


class GuestThreadListResponse(BaseModel):
    """Liste aller Threads des eingeloggten Gasts."""

    threads: list[GuestThreadSummary] = []


class GuestMessageView(BaseModel):
    """Eine einzelne Nachricht innerhalb eines Threads."""

    id: str
    thread_id: str
    sender: str
    body: str
    read_at: datetime | None = None
    created_at: datetime


class GuestThreadDetail(BaseModel):
    """Ein Thread inklusive seiner Nachrichten (chronologisch)."""

    id: str
    reservation_id: str
    property_id: str
    last_message_at: datetime | None = None
    messages: list[GuestMessageView] = []


class CreateThreadRequest(BaseModel):
    """Anlage-Wunsch eines Threads für eine konkrete Reservierung des Gasts.

    tenant_id/property_id werden NICHT vom Client übernommen — der Server leitet
    sie aus der Reservierung ab (Wurzel 3). Existiert bereits ein Thread für
    (reservation_id, guest), wird dieser idempotent zurückgegeben (Wurzel 2).
    """

    reservation_id: str


class SendMessageRequest(BaseModel):
    """Vom Gast gesendete Nachricht. sender wird NICHT übernommen (Wurzel 3/6).

    body ist Pflicht und nicht leer; die harte Längen-Obergrenze (Wurzel 8) prüft
    zusätzlich der Service nach dem Trimmen/Sanitisieren, um bei Überlänge sauber
    mit 422 zu antworten statt roh zu persistieren.
    """

    body: str = Field(min_length=1)
