"""Schemas des notification_settings-Slice (Airbnb „Konto → Benachrichtigungen").

Die Feldliste wird NICHT von Hand gepflegt, sondern aus dem Katalog erzeugt —
sonst laufen Migration, Schema und UI auseinander (Wurzel 4).
"""
from __future__ import annotations

from pydantic import BaseModel, create_model

from .katalog import KATALOG, Kanal, Kategorie

# --- dynamisch erzeugte Modelle -------------------------------------------
# Pro Kategorie×Kanal ein bool-Feld, benannt wie die Spalte. Die Defaults
# spiegeln die Migration: E-Mail an, SMS/Telefon aus — Ausnahme
# listing_activity_sms (Airbnb-Default an, siehe Screenshot „Listing activity:
# On: Email and SMS").

_SMS_DEFAULT_AN = frozenset({"listing_activity_sms"})


def _default(kategorie: Kategorie, kanal: Kanal) -> bool:
    if kanal is Kanal.EMAIL:
        return True
    return kategorie.spalte(kanal) in _SMS_DEFAULT_AN


_FELDER: dict[str, tuple[type, bool]] = {
    k.spalte(kanal): (bool, _default(k, kanal))
    for k in KATALOG
    for kanal in k.kanaele
}

NotificationSettings = create_model(
    "NotificationSettings",
    __base__=BaseModel,
    __doc__=(
        "Benachrichtigungs-Präferenzen eines Kontos. Entspricht den Spalten von "
        "public.notification_settings; fehlt die Zeile, liefert der Service die "
        "Defaults."
    ),
    marketing_unsubscribed_all=(bool, False),
    **_FELDER,
)

NotificationSettingsUpdate = create_model(
    "NotificationSettingsUpdate",
    __base__=BaseModel,
    __doc__=(
        "Teil-Update: nur gesetzte Felder werden geändert (PATCH-Semantik). "
        "None = unverändert lassen."
    ),
    marketing_unsubscribed_all=(bool | None, None),
    **{name: (bool | None, None) for name in _FELDER},
)


# --- statische Beschreibung für die UI ------------------------------------


class KanalInfo(BaseModel):
    """Ein Kanal einer Kategorie: Zustand plus ob er änderbar ist."""

    kanal: str
    aktiv: bool
    # False = Schalter ist an und gesperrt (rechtlich/vertraglich nötige Mail).
    aenderbar: bool = True


class KategorieInfo(BaseModel):
    """Eine Zeile der Benachrichtigungs-Liste, wie die UI sie rendert."""

    schluessel: str
    tab: str
    gruppe: str
    kanaele: list[KanalInfo]


class NotificationOverview(BaseModel):
    """Die volle Sicht für den Konto-Tab: alle Kategorien mit ihren Kanälen.

    Die UI braucht keine eigene Kategorie-Liste — sie rendert, was hier steht.
    Texte kommen aus den i18n-Keys, gebildet aus `schluessel`/`gruppe`.
    """

    kategorien: list[KategorieInfo]
    marketing_unsubscribed_all: bool
