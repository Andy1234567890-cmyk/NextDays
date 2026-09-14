"""Perioden-Schlüssel der Steuer-Auswertung: `2026-08`, `2026-Q3`, `2026`.

Ein Ort für Parsen und Grenzen, damit Auswertung, Freeze und Export dieselbe
Periode meinen. Grenzen sind INKLUSIV (`period_end` ist der letzte Tag).
Harte Obergrenze: eine Periode ist höchstens ein Jahr (Wurzel 8 — kein
unbegrenzter Datums-Span), Jahre 2000..2100.
"""

from __future__ import annotations

import calendar
import re
from dataclasses import dataclass
from datetime import date

_MONAT = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")
_QUARTAL = re.compile(r"^(\d{4})-Q([1-4])$", re.IGNORECASE)
_JAHR = re.compile(r"^(\d{4})$")
_JAHR_MIN, _JAHR_MAX = 2000, 2100


class PeriodeUngueltig(ValueError):
    """Der Schlüssel ist kein Monat, Quartal oder Jahr (→ 422 im Router)."""


@dataclass(frozen=True)
class Periode:
    key: str
    kind: str  # month | quarter | year
    start: date
    end: date

    @property
    def year(self) -> int:
        return self.start.year


def _jahr_pruefen(jahr: int) -> None:
    if not _JAHR_MIN <= jahr <= _JAHR_MAX:
        raise PeriodeUngueltig(f"Jahr {jahr} liegt außerhalb von {_JAHR_MIN}–{_JAHR_MAX}.")


def periode_parsen(roh: str) -> Periode:
    """`2026-08` → Monat, `2026-Q3` → Quartal, `2026` → Jahr; sonst PeriodeUngueltig."""
    text = (roh or "").strip()
    if m := _MONAT.match(text):
        jahr, monat = int(m.group(1)), int(m.group(2))
        _jahr_pruefen(jahr)
        letzter = calendar.monthrange(jahr, monat)[1]
        return Periode(
            f"{jahr:04d}-{monat:02d}", "month", date(jahr, monat, 1), date(jahr, monat, letzter)
        )
    if m := _QUARTAL.match(text):
        jahr, q = int(m.group(1)), int(m.group(2))
        _jahr_pruefen(jahr)
        erster_monat = (q - 1) * 3 + 1
        letzter_monat = erster_monat + 2
        letzter = calendar.monthrange(jahr, letzter_monat)[1]
        return Periode(
            f"{jahr:04d}-Q{q}",
            "quarter",
            date(jahr, erster_monat, 1),
            date(jahr, letzter_monat, letzter),
        )
    if m := _JAHR.match(text):
        jahr = int(m.group(1))
        _jahr_pruefen(jahr)
        return Periode(f"{jahr:04d}", "year", date(jahr, 1, 1), date(jahr, 12, 31))
    raise PeriodeUngueltig(f"Periode »{roh}« nicht erkannt — erwartet YYYY-MM, YYYY-Qn oder YYYY.")


def aktuelle_periode(heute: date, kind: str) -> str:
    """Vorbelegung der Seite: die laufende Periode im Rhythmus des Betriebs."""
    if kind == "month":
        return f"{heute.year:04d}-{heute.month:02d}"
    if kind == "year":
        return f"{heute.year:04d}"
    return f"{heute.year:04d}-Q{(heute.month - 1) // 3 + 1}"
