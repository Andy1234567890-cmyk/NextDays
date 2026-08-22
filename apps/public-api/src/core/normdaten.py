"""Länder und Währungen — die Normdaten, gegen die ein Client seine Auswahl baut.

Warum das ein Endpunkt ist und keine Liste in der Doku: ein Client, der ein
Land- oder Währungsfeld anbietet, muss wissen, welche Werte wir annehmen. Steht
die Liste nur in einem Text, ist sie am Tag nach der ersten Erweiterung falsch —
und der Client schickt einen Wert, den wir mit 422 ablehnen. Lodgify hat dafür
dieselbe Gruppe („Global": Ländercodes, Land nach Code, Währungscodes, Währung
nach Code); übernommen ist der Zuschnitt, die Daten sind unsere.

Umfang: die 27 EU-Staaten plus CH und GB — genau der Satz, den auch
`packages/laender` und `apps/api/src/core/countries.py` führen. Diese Datei ist
KEINE Kopie davon: sie trägt die englischen Namen (die API ist englisch) und
die Zuordnung Land → Währung in EINER Struktur, weil der Endpunkt beides
zusammen ausliefert. Wird der Länderkreis erweitert, sind alle drei Stellen
dran; der Grund für die Trennung ist die Regel, dass diese API nichts aus
`apps/api` importiert.

Die Währungsnamen und Nachkommastellen stammen aus ISO 4217. Sie werden NICHT
geraten: eine erfundene Stellenzahl macht aus 1050 Öre entweder 10,50 oder
1050,00 (Wurzel 4).
"""
from __future__ import annotations

from typing import NamedTuple


class Land(NamedTuple):
    """Ein Land in der Form, in der die API es ausliefert."""

    code: str
    name: str
    currency: str


class Waehrung(NamedTuple):
    """Eine Währung samt der Stellenzahl, mit der Beträge zu lesen sind."""

    code: str
    name: str
    decimal_digits: int


# ISO-3166-1 alpha-2 → englischer Name + Landeswährung (ISO 4217).
# Reihenfolge: alphabetisch nach Code, damit die Antwort stabil ist.
LAENDER: tuple[Land, ...] = (
    Land("AT", "Austria", "EUR"),
    Land("BE", "Belgium", "EUR"),
    Land("BG", "Bulgaria", "BGN"),
    Land("CH", "Switzerland", "CHF"),
    Land("CY", "Cyprus", "EUR"),
    Land("CZ", "Czechia", "CZK"),
    Land("DE", "Germany", "EUR"),
    Land("DK", "Denmark", "DKK"),
    Land("EE", "Estonia", "EUR"),
    Land("ES", "Spain", "EUR"),
    Land("FI", "Finland", "EUR"),
    Land("FR", "France", "EUR"),
    Land("GB", "United Kingdom", "GBP"),
    Land("GR", "Greece", "EUR"),
    Land("HR", "Croatia", "EUR"),
    Land("HU", "Hungary", "HUF"),
    Land("IE", "Ireland", "EUR"),
    Land("IT", "Italy", "EUR"),
    Land("LT", "Lithuania", "EUR"),
    Land("LU", "Luxembourg", "EUR"),
    Land("LV", "Latvia", "EUR"),
    Land("MT", "Malta", "EUR"),
    Land("NL", "Netherlands", "EUR"),
    Land("PL", "Poland", "PLN"),
    Land("PT", "Portugal", "EUR"),
    Land("RO", "Romania", "RON"),
    Land("SE", "Sweden", "SEK"),
    Land("SI", "Slovenia", "EUR"),
    Land("SK", "Slovakia", "EUR"),
)

# ISO 4217 → englischer Name + Nachkommastellen.
WAEHRUNGEN: tuple[Waehrung, ...] = (
    Waehrung("BGN", "Bulgarian lev", 2),
    Waehrung("CHF", "Swiss franc", 2),
    Waehrung("CZK", "Czech koruna", 2),
    Waehrung("DKK", "Danish krone", 2),
    Waehrung("EUR", "Euro", 2),
    Waehrung("GBP", "Pound sterling", 2),
    Waehrung("HUF", "Hungarian forint", 2),
    Waehrung("PLN", "Polish złoty", 2),
    Waehrung("RON", "Romanian leu", 2),
    Waehrung("SEK", "Swedish krona", 2),
)

_LAENDER_JE_CODE = {eintrag.code: eintrag for eintrag in LAENDER}
_WAEHRUNGEN_JE_CODE = {eintrag.code: eintrag for eintrag in WAEHRUNGEN}


def land(code: str) -> Land | None:
    """Ein Land nach ISO-2-Code. Unbekannt → `None` (der Aufrufer antwortet 404)."""
    return _LAENDER_JE_CODE.get(code.strip().upper())


def waehrung(code: str) -> Waehrung | None:
    """Eine Währung nach ISO-4217-Code. Unbekannt → `None`."""
    return _WAEHRUNGEN_JE_CODE.get(code.strip().upper())
