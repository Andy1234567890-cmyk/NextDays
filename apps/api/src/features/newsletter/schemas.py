"""Schemas des newsletter-Slice (Voranmeldungen von der Marketing-Seite)."""
from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class SubscribeRequest(BaseModel):
    """Eintragung aus dem Popup.

    `consent_text` ist der WORTLAUT, den der Besucher angehakt hat — er wird
    mitgeschickt und gespeichert, damit die Einwilligung später nachweisbar ist
    (DSGVO Art. 7 Abs. 1). Ändert sich der Text auf der Seite, bleibt bei
    Altfällen der alte erhalten.
    """

    email: EmailStr
    # Sprache der Seite (bestimmt die Bestätigungsmail).
    locale: str | None = Field(default=None, max_length=10)
    # Woher die Anmeldung kam ('popup_start', 'popup_preise' …).
    source: str | None = Field(default=None, max_length=50)
    consent_text: str | None = Field(default=None, max_length=1000)


class SubscribeResponse(BaseModel):
    """Antwort des Popups.

    IMMER dieselbe, egal ob die Adresse neu, schon angemeldet oder gesperrt ist —
    sonst wäre das Formular ein Orakel, mit dem sich prüfen ließe, wer bei uns
    eingetragen ist (E-Mail-Enumeration).
    """

    ok: bool = True
    detail: str


class ConfirmResponse(BaseModel):
    """Ergebnis des Bestätigungslinks."""

    ok: bool
    detail: str


class NewsletterOk(BaseModel):
    ok: bool = True
