"""Die Kennungen einer Meldung — Aufbau und Erzeugung.

Diese Zeichenketten sind mehr als Bezeichner: `CORR_DOC_REF_ID` einer
späteren Korrektur verweist auf genau die `RS_DOC_REF_ID`, die in der
Erstmeldung stand. Wer sie nicht speichert oder nicht reproduzierbar bildet,
kann eine abgegebene Meldung nie wieder korrigieren.

AUFBAU nach Vorgabe der Vorlage:

    MSG_MESSAGE_REF_ID   DK<Jahr>DK<Steuernummer><Referenz>
    <...>_DOC_REF_ID     DK<Jahr><Steuernummer><Referenz>

Der Unterschied ist das zweite `DK` in der Nachrichtenkennung — ein
Detail, das beim Abtippen verlorengeht und die Datei ablehnen lässt.
Deshalb steht der Aufbau hier an genau einer Stelle.

Die Referenz muss innerhalb der Kombination eindeutig sein und darf nur
Ziffern und Buchstaben enthalten, höchstens 100 Zeichen.
"""
from __future__ import annotations

import re

# Alles, was nicht Ziffer oder Buchstabe ist, fällt aus der Referenz heraus.
_UNZULAESSIG = re.compile(r"[^0-9A-Za-z]")
_REF_MAXLAENGE = 100


def referenz_saeubern(roh: str) -> str:
    """Eine beliebige Zeichenkette in eine zulässige Referenz überführen.

    UUIDs mit Bindestrichen sind der Normalfall bei uns; die Bindestriche
    müssen weg. Die Kürzung auf 100 Zeichen greift erst danach, damit nicht
    ein abgeschnittener Rest durch das Entfernen wieder kürzer wird.
    """
    sauber = _UNZULAESSIG.sub("", roh)
    return sauber[:_REF_MAXLAENGE]


def nachrichtenkennung(land: str, jahr: int, steuernummer: str, referenz: str) -> str:
    """Die Kennung der Nachricht (MSG_MESSAGE_REF_ID).

    Beachte das doppelte Länderkürzel — so verlangt es die Vorlage.
    """
    return (
        f"{land.upper()}{jahr}{land.upper()}"
        f"{referenz_saeubern(steuernummer)}{referenz_saeubern(referenz)}"
    )


def satzkennung(land: str, jahr: int, steuernummer: str, referenz: str) -> str:
    """Die Kennung eines Datensatzes (PO_/RS_DOC_REF_ID)."""
    return (
        f"{land.upper()}{jahr}"
        f"{referenz_saeubern(steuernummer)}{referenz_saeubern(referenz)}"
    )


def anbieterkennung(
    land: str, jahr: int, steuernummer: str, laufende_nummer: int
) -> str:
    """Die Kennung eines Anbieters, aus einer laufenden Nummer gebildet.

    Eine laufende Nummer statt einer UUID, weil die Kennung in der Datei
    lesbar bleiben soll und die Eindeutigkeit bereits aus Jahr und
    Steuernummer folgt. Dreistellig aufgefüllt, damit die Sortierung der
    Datei der Reihenfolge der Anbieter entspricht.
    """
    return satzkennung(land, jahr, steuernummer, f"{laufende_nummer:03d}")
