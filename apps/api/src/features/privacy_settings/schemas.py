"""Schemas des privacy_settings-Slice (Airbnb „Konto → Datenschutz")."""
from __future__ import annotations

from pydantic import BaseModel


class PrivacySettings(BaseModel):
    """Die Datenschutz-Präferenzen eines Kontos. Entspricht den Spalten von
    public.privacy_settings; fehlt die Zeile, liefert der Service die Defaults."""

    message_read_receipts: bool = True
    listings_search_engine_indexing: bool = True
    review_show_home_city: bool = False
    review_show_trip_type: bool = False
    review_show_length_of_stay: bool = True
    review_show_booked_services: bool = False
    ai_features_contribution: bool = True


class PrivacySettingsUpdate(BaseModel):
    """Teil-Update: nur gesetzte Felder werden geändert (PATCH-Semantik). Alle
    Felder optional; None = unverändert lassen."""

    message_read_receipts: bool | None = None
    listings_search_engine_indexing: bool | None = None
    review_show_home_city: bool | None = None
    review_show_trip_type: bool | None = None
    review_show_length_of_stay: bool | None = None
    review_show_booked_services: bool | None = None
    ai_features_contribution: bool | None = None
