"""Die wählbaren Auswertungszeiträume — EINE Definition für alle Slices.

Vorher stand die Menge nur in `inbox/kennzahlen.py`. Mit dem zweiten Nutzer
(den KPI-Kacheln der Startseite) wäre daraus eine Kopie geworden, und Kopien
driften: ein Slice kennt „3m", der andere nicht, und die Oberfläche bietet
einen Zeitraum an, den das Backend mit 422 abweist.

Geschlossene Menge und kein freier Tageswert: sonst wäre der Zeitraum ein
offener Hebel, über den ein einzelner Aufruf beliebig weit zurückzählt
(Wurzel 8). Die Preset-Familie folgt der, die Hostaway in seinem Katalog
führt (`Past 7 days / Past 30 days / Past 3 months / Past 12 months`) — eigene
Fantasie-Zeiträume wären eine dritte Konvention neben denen, die der Betrieb
schon kennt.
"""
from __future__ import annotations

from datetime import date
from typing import Final

ZEITRAEUME: Final[dict[str, int]] = {
    "7d": 7,
    "30d": 30,
    "3m": 90,
    "12m": 365,
}
STANDARD_ZEITRAUM: Final = "30d"


class UnbekannterZeitraum(ValueError):
    """Der übergebene Zeitraum steht nicht in `ZEITRAEUME`."""


def tage_fuer(zeitraum: str) -> int:
    """Tageszahl eines Zeitraum-Schlüssels.

    Ein unbekannter Wert wirft, statt still auf den Standard zu fallen: sonst
    zeigte die Kachel „12 Monate" die Zahlen von 30 Tagen, und niemand sähe
    den Unterschied (Wurzel 4/5). Die Slices fangen das und antworten 422.
    """
    tage = ZEITRAEUME.get(zeitraum)
    if tage is None:
        raise UnbekannterZeitraum(f"Unbekannter Zeitraum: {zeitraum}")
    return tage


def jahre_datumsgleich(tag: date, jahre: int) -> date:
    """Derselbe Kalendertag, `jahre` Jahre früher — die Basis jedes Jahresvergleichs.

    ZENTRAL, weil zwei Slices sie brauchen: `auswertung` (Vorjahresspalten aller
    Reiter) und `reservations.property_stats` (die Kacheln des Reiters
    „Kennzahlen"). Zwei Kopien wären zwei Konventionen — und der Betrieb sähe
    auf einer Seite den 28.02. und auf der anderen den 01.03. als Vorwert
    desselben Tages.

    DATUMSGLEICH, nicht wochentagsgleich (Entscheidung des Betreibers,
    03.09.2026): der Vorwert steht auf denselben Kalendertagen, also gleiche
    Feiertage und gleiche Saisonlage. Die Alternative (52 Wochen zurück, damit
    Wochenenden aufeinanderfallen) ließe das Datum um bis zu drei Tage wandern
    und verschöbe Monatsgrenzen — in einem nach Monaten gegliederten Bericht
    die schlechtere Wahl.

    Kein `timedelta(days=365 * jahre)`: das läuft über die dazwischenliegenden
    Schaltjahre aus dem Datum heraus, und WIE WEIT hängt vom Startdatum ab.
    Gemessen: 2026-09-29 landet 5·365 Tage früher auf dem 30.09.2021 (ein Tag
    daneben), 2025-01-15 auf dem 17.01.2020 (zwei Tage). Ein Vorjahreswert,
    der mal einen und mal zwei Tage verrutscht, ist nicht prüfbar.

    Der 29.02. ist der einzige Tag ohne datumsgleichen Partner in einem
    Nicht-Schaltjahr; er wird auf den 28.02. gelegt. Ein Ausweichen auf den
    01.03. verschöbe ihn in den nächsten MONAT und damit in einen anderen
    Balken der Zeitreihe.
    """
    try:
        return tag.replace(year=tag.year - jahre)
    except ValueError:
        # Nur der 29.02. kann hier landen.
        return tag.replace(year=tag.year - jahre, day=28)
