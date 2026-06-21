"""Pydantic-Schemas für den dashboard-Slice."""
from __future__ import annotations

from pydantic import BaseModel, Field


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"


class OnboardingStatus(BaseModel):
    """Onboarding-Fortschritt des Tenants. Das Dashboard zeigt den Assistenten,
    bis `completed` true ist."""

    has_ota: bool | None = None
    selected_portals: list[str] = Field(default_factory=list)
    object_created: bool = False
    price_set: bool = False
    channels_done: bool = False
    completed: bool = False


class OnboardingUpdate(BaseModel):
    """Teil-Update des Onboarding-Status (nur gesetzte Felder werden geschrieben)."""

    has_ota: bool | None = None
    selected_portals: list[str] | None = None
    object_created: bool | None = None
    price_set: bool | None = None
    channels_done: bool | None = None
    completed: bool | None = None
