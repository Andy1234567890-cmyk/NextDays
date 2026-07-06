"""Pydantic-Schemas für den content-Slice (inkl. Übersetzung)."""
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class TranslateLang(StrEnum):
    """Unterstützte Sprachen für die Mietvertrags-/Texte-Übersetzung."""

    da = "da"
    en = "en"
    de = "de"


class TranslateRequest(BaseModel):
    # max_length deckelt die nach Zeichen abgerechnete (kostenpflichtige) Google-
    # Translate-API: ohne Obergrenze könnte ein eingeloggter Nutzer/kompromittiertes
    # Token beliebig große Payloads schicken (Kostenmissbrauch). 50 000 Zeichen
    # decken einen langen Mietvertragstext bequem ab.
    text: str = Field(min_length=1, max_length=50_000)
    target: TranslateLang
    source: TranslateLang | None = None  # None = automatische Erkennung
    # Format-Whitelist (nicht freier String, der ungeprüft an Google geht).
    # HTML, weil der Rich-Text-Editor Markup liefert (B/I/U/Links); text = plain.
    fmt: Literal["html", "text"] = "html"


class TranslateResponse(BaseModel):
    text: str
    detected_source: str | None = None


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
