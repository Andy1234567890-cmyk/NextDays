"""Contracts des property_custom_fields-Slice (Migration 0242)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

FieldType = Literal["text", "textarea", "number", "select", "checkbox"]


class CustomFieldBase(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    field_type: FieldType = "text"
    # Nur für field_type='select' — bei allen anderen Typen leer.
    options: list[str] = Field(default_factory=list)
    # Reines Merkmal, KEINE Freischaltung (siehe Migration 0242): wer das Feld
    # im Gastportal zeigt, prüft die Sichtbarkeit an seiner eigenen Stelle.
    is_public: bool = False
    sort_order: int = 0

    @model_validator(mode="after")
    def _optionen_passen_zum_typ(self) -> CustomFieldBase:
        if self.field_type == "select" and not self.options:
            raise ValueError(
                "Ein Auswahlfeld braucht mindestens eine Auswahlmöglichkeit."
            )
        if self.field_type != "select" and self.options:
            raise ValueError("Auswahlmöglichkeiten gibt es nur beim Auswahlfeld.")
        return self


class CustomFieldCreate(CustomFieldBase):
    """Neues Zusatzfeld. Der Schlüssel wird serverseitig aus dem Label
    abgeleitet — ein Client-gelieferter Schlüssel könnte fremde Felder
    überschreiben oder mit Automations-Verweisen kollidieren (Wurzel 3)."""


class CustomFieldUpdate(BaseModel):
    """Teil-Änderung. Der Schlüssel bleibt IMMER unverändert: an ihm hängen
    Automationen und Exporte, ein Umbenennen bräche sie still."""

    label: str | None = Field(default=None, min_length=1, max_length=120)
    options: list[str] | None = None
    is_public: bool | None = None
    sort_order: int | None = None


class CustomField(CustomFieldBase):
    id: str
    tenant_id: str
    field_key: str


class CustomFieldWithValue(BaseModel):
    """Ein Zusatzfeld MIT dem Wert eines konkreten Objekts."""

    field: CustomField
    # None = für dieses Objekt nie gesetzt (die UI zeigt „—", nicht „0"/„nein").
    value: str | None = None


class CustomFieldValueUpdate(BaseModel):
    # Alle Typen kommen als Text (siehe Migration 0242). None löscht den Wert.
    value: str | None = Field(default=None, max_length=10_000)
