"""Schemas des pro_tools-Slice — „Professionelle Tools" und Massenbearbeitung.

Zwei Vorbilder, beide am 17.09.2026 nachgelesen:

    Airbnb (Hilfe-Artikel 2499)      EIN Schalter „Professionelle Tools
                                     nutzen" in den Kontoeinstellungen.
    Booking.com (Gruppen-Extranet)   Kein Schalter, aber ein Kriterium
                                     („mehr als eine Unterkunft") und die
                                     MASSENBEARBEITUNG als Herzstück.

Hier ist beides zusammengelegt: der Schalter gibt die Massenbearbeitung frei,
und einschalten lässt er sich erst ab zwei Objekten.
"""
from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field, model_validator

# Wie viele Objekte eine Massenänderung höchstens treffen darf. Ohne harte
# Grenze ist „wende das auf alles an" ein unbegrenzter Auftrag aus Client-Hand
# (Wurzel 8). 200 ist reichlich für einen Bestand und klein genug, dass der
# Aufruf in einem Request bleibt.
MAX_OBJEKTE = 200

# Bookings Kriterium, wörtlich: „Sie müssen mehr als eine Unterkunft auf
# Booking.com verwalten."
MINDEST_OBJEKTE = 2


class Massenfeld(StrEnum):
    """Was sich auf einmal ändern lässt.

    Die Auswahl ist nicht frei gewählt, sondern das, was Booking unter
    „Massenbearbeitung" nennt (Check-in-Zeiten, Richtlinien, Angebote) —
    übersetzt in die Felder, die es bei uns wirklich gibt und die bis zu den
    Portalen durchschlagen. Alles andere wäre ein Schalter ohne Wirkung.
    """

    mindestaufenthalt = "mindestaufenthalt"
    hoechstaufenthalt = "hoechstaufenthalt"
    vorlaufzeit = "vorlaufzeit"
    buchungsfenster = "buchungsfenster"
    stornobedingung = "stornobedingung"


# Untere und obere Schranke je Zahlenfeld. Sie stehen HIER und nicht in der
# Oberfläche, weil der Client nicht die Instanz ist, die Grenzen einhält.
# 0 heißt bei Höchstaufenthalt und Buchungsfenster „keine Grenze" — deshalb
# beginnt deren Bereich bei 0 und der des Mindestaufenthalts bei 1.
ZAHLENGRENZEN: dict[Massenfeld, tuple[int, int]] = {
    Massenfeld.mindestaufenthalt: (1, 365),
    Massenfeld.hoechstaufenthalt: (0, 365),
    Massenfeld.vorlaufzeit: (0, 365),
    Massenfeld.buchungsfenster: (0, 1095),
}


class ProfiTools(BaseModel):
    """Stand des Schalters plus der Grund, warum er ggf. nicht umlegbar ist."""

    aktiv: bool
    objekte: int
    mindest_objekte: int = MINDEST_OBJEKTE


class ProfiToolsUpdate(BaseModel):
    aktiv: bool


class Massenaenderung(BaseModel):
    """Ein Wert, viele Objekte.

    `zahl` und `auswahl` stehen nebeneinander statt eines gemeinsamen `wert`,
    weil die Prüfung sonst erst im Dienst stattfände: eine Nacht ist eine Zahl
    mit Grenzen, eine Stornierungsbedingung eine Kennung. Ein gemeinsames Feld
    müsste beides annehmen und könnte keines von beidem prüfen.
    """

    feld: Massenfeld
    zahl: int | None = None
    auswahl: str | None = None
    property_ids: list[str] = Field(min_length=1, max_length=MAX_OBJEKTE)

    @model_validator(mode="after")
    def _passend(self) -> Massenaenderung:
        # Doppelte Kennungen würden dasselbe Objekt zweimal zählen und die
        # Rückmeldung verfälschen („18 geändert" bei 12 Objekten).
        if len(set(self.property_ids)) != len(self.property_ids):
            raise ValueError("Jedes Objekt darf nur einmal vorkommen.")
        if self.feld is Massenfeld.stornobedingung:
            if not (self.auswahl or "").strip():
                raise ValueError("Bitte eine Stornierungsbedingung wählen.")
            if self.zahl is not None:
                raise ValueError("Die Stornierungsbedingung ist keine Zahl.")
            return self
        if self.auswahl is not None:
            raise ValueError("Für dieses Feld wird eine Zahl erwartet.")
        if self.zahl is None:
            raise ValueError("Bitte einen Wert angeben.")
        unten, oben = ZAHLENGRENZEN[self.feld]
        if not unten <= self.zahl <= oben:
            raise ValueError(f"Erlaubt sind {unten} bis {oben}.")
        return self


class Fehlschlag(BaseModel):
    property_id: str
    grund: str


class MassenErgebnis(BaseModel):
    """Was WIRKLICH passiert ist — je Objekt.

    Drei Listen statt einer Erfolgsmeldung, weil eine Massenänderung
    teilweise scheitern kann und ein stilles „fertig" bei 12 von 20 Objekten
    derselbe Fehler wäre wie ein verschluckter Exception (Wurzel 5). Der
    Gastgeber sähe sonst acht unveränderte Objekte und hielte es für einen
    Anzeigefehler.

    `unveraendert` ist kein Beiwerk: es ist der Unterschied zwischen „hat nicht
    geklappt" und „stand schon so".
    """

    geaendert: list[str]
    unveraendert: list[str]
    fehlgeschlagen: list[Fehlschlag]
