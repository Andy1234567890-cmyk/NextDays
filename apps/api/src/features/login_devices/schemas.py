"""Schemas des login_devices-Slice."""
from __future__ import annotations

from pydantic import BaseModel, Field


class LoginDevice(BaseModel):
    """Ein Gerät im Geräteverlauf. ip/country/city können None sein (unbekannt) —
    das UI rendert dann „—", nie einen Ersatzwert (Wurzel 4)."""

    id: str
    ip: str | None = None
    user_agent: str | None = None
    country: str | None = None
    city: str | None = None
    created_at: str | None = None
    last_seen_at: str | None = None
    is_current: bool = False


class RevokeOthersResponse(BaseModel):
    revoked: int


class GeoRange(BaseModel):
    """Ein selbst gepflegter IP→Ort-Bereich."""

    id: str
    ip_from: str
    ip_to: str
    country: str
    city: str | None = None
    created_at: str | None = None


class GeoRangeCreate(BaseModel):
    """Neuer IP→Ort-Bereich. Validierung der IP-Ordnung geschieht zusätzlich in
    der DB (check-constraint ip_from <= ip_to)."""

    ip_from: str = Field(min_length=3, max_length=45)
    ip_to: str = Field(min_length=3, max_length=45)
    country: str = Field(min_length=1, max_length=100)
    city: str | None = Field(default=None, max_length=100)
