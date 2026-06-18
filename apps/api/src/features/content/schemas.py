"""Pydantic-Schemas für den content-Slice (inkl. Übersetzung)."""
from enum import StrEnum

from pydantic import BaseModel, Field


class TranslateLang(StrEnum):
    """Unterstützte Sprachen für die Mietvertrags-/Texte-Übersetzung."""

    da = "da"
    en = "en"
    de = "de"


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1)
    target: TranslateLang
    source: TranslateLang | None = None  # None = automatische Erkennung
    # HTML, weil der Rich-Text-Editor Markup liefert (B/I/U/Links).
    fmt: str = "html"


class TranslateResponse(BaseModel):
    text: str
    detected_source: str | None = None


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
