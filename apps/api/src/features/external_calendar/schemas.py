"""Schemas für externe iCal-Kalender (Belegungs-Sync)."""
from __future__ import annotations

from pydantic import BaseModel


class SliceHealth(BaseModel):
    status: str
    slice: str = "external_calendar"


class ExternalCalendar(BaseModel):
    id: str
    property_id: str
    name: str
    ical_url: str
    is_active: bool
    last_synced_at: str | None = None
    last_status: str | None = None
    last_error: str | None = None
    last_event_count: int | None = None


class AddCalendarRequest(BaseModel):
    property_id: str
    name: str
    ical_url: str


class PropertyCalendars(BaseModel):
    """Ein Objekt + seine bereits verbundenen externen Kalender (Umzugs-Tab)."""
    property_id: str
    title: str
    status: str | None = None
    calendars: list[ExternalCalendar] = []
