"""Schemas des notification_settings-Slice (Airbnb „Konto → Benachrichtigungen").

Die Feldliste wird NICHT von Hand gepflegt, sondern aus dem Katalog erzeugt —
sonst laufen Migration, Schema und UI auseinander (Wurzel 4).
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, create_model

from .katalog import KATALOG, Kanal, Kategorie

# --- dynamisch erzeugte Modelle -------------------------------------------
# Pro Kategorie×Kanal ein bool-Feld, benannt wie die Spalte. Die Defaults
# spiegeln die Migration: E-Mail an, PUSH an, SMS/Telefon aus — Ausnahme
# listing_activity_sms (Airbnb-Default an, siehe Screenshot „Listing activity:
# On: Email and SMS").
#
# PUSH stand hier bis zum 09.09.2026 auf `False` und widersprach damit ALLEN
# 17 `*_push`-Spalten, die in den Migrationen `not null default true` tragen
# (0414, 0532 u. a.). Zwei Wahrheiten für denselben Wert — Wurzel 4.
#
# Warum das flächendeckend Push abschaltete, statt nur neue Konten zu
# betreffen: `notification_settings` hat live NULL Zeilen (gemessen
# 09.09.2026). `soll_senden` fällt dann auf `getattr(NotificationSettings(),
# spalte)` zurück, also genau auf diesen Code-Default — es gab keinen
# einzigen Nutzer, dessen gespeichertes `true` ihn hätte überstimmen können.
# Der Dispatcher verwarf JEDEN Push als abgewählt, ohne den Versandpfad auch
# nur zu betreten: acht registrierte Geräte, kein einziger Versuch, und im
# Protokoll stand lediglich „uebersprungen: push" — der stille Fehler aus
# Wurzel 5, der wie eine Nutzerentscheidung aussieht.

_SMS_DEFAULT_AN = frozenset({"listing_activity_sms"})


def _default(kategorie: Kategorie, kanal: Kanal) -> bool:
    if kanal in (Kanal.EMAIL, Kanal.PUSH):
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


class GlockeEintrag(BaseModel):
    """Eine In-App-Benachrichtigung, wie die Glocke sie zeigt."""

    id: str
    kategorie: str
    titel: str
    text: str | None = None
    # Relativer Pfad; die UI hängt keine Domäne davor (Wechsel .com → .dk).
    ziel_pfad: str | None = None
    property_id: str | None = None
    gelesen_am: str | None = None
    created_at: str


class GlockeListe(BaseModel):
    """Die Meldungen plus der Zähler — beides in EINEM Aufruf.

    Getrennt wären es zwei Anfragen für eine Ansicht, und der Zähler könnte
    kurzzeitig nicht zur Liste passen.
    """

    eintraege: list[GlockeEintrag]
    ungelesen: int


class PushGeraetRegistrierung(BaseModel):
    """Ein Geraet meldet sein FCM-Token an (Migration 0414).

    `tenant_id` kommt NICHT vom Client — der Server nimmt sie aus dem Token
    (Wurzel 3: der Anfrage nicht vertrauen, Scope serverseitig erzwingen).
    """

    token: str = Field(min_length=10, max_length=4096)
    platform: Literal["ios", "android"]
    # Welche der DREI Apps (ADR-0019/0022). Ohne diese Angabe landete eine
    # Betriebs-Meldung auf dem Gast-Telefon derselben Person — oder, seit es
    # die Eigentuemer-App gibt, eine Verwaltungs-Meldung beim Eigentuemer.
    app: Literal["mynextdays", "mybestdays", "mynextdaysowner"]


class PushGeraetAbmeldung(BaseModel):
    """Abmelden beim Logout. Nur der Token — der Nutzer kommt aus der Session."""

    token: str = Field(min_length=10, max_length=4096)
