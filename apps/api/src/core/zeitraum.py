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
