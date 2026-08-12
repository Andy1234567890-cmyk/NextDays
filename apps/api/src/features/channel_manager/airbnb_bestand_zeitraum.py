"""Welchen Zeitraum ein Nachpflege-Abruf bei Airbnb wirklich braucht.

DER IRRTUM (12.08.2026, live gemessen): Die vier Nachpflege-Schritte fragten
alle denselben festen Zeitraum ab — `heute.year - 6` bis `heute.year + 2`, also
2020-01-01 bis 2028-12-31. `etappen_planen` macht daraus 36 Etappen.

Der echte Bestand des Beta-Betriebs:

    ältester Airbnb-check_in    2024-03-17
    jüngster Airbnb-check_out   2027-07-15

Vier der acht Jahre waren also garantiert leer und wurden trotzdem alle fünf
Minuten abgefragt. Ein fester Zeitraum kann das nicht wissen — deshalb kommt er
hier aus den DATEN.

WARUM NICHT EINFACH KLEINER HARDCODEN (Wurzel 4): „drei Jahre reichen wohl" wäre
derselbe Fehler mit einer kleineren Zahl. Ein Betrieb, der 2019 anfing, verliert
damit stillschweigend seine Historie — und niemand sieht es, weil ein zu kurzer
Abruf wie „keine Buchungen" aussieht. Der Zeitraum muss den Bestand DECKEN, sonst
heilt die Nachpflege nur einen Teil.

WIE DER RAND GESICHERT IST: Ein Polster von einem Jahr auf beiden Seiten. Es
deckt zwei Fälle ab, die ohne Polster durchs Raster fielen — eine Buchung, deren
`check_in` wir noch nicht kennen, weil sie GENAU die ist, die geheilt werden
soll; und eine Reservierung, die weiter in der Zukunft liegt als alles, was schon
in der Datenbank steht. Airbnb filtert nach `start_date`, unsere Grenzen kommen
aus `check_in`/`check_out` — dieselbe Achse, deshalb genügt ein Jahr.

WENN DER BESTAND LEER IST: Dann gibt es nichts zu heilen, und der Aufrufer
bekommt `None`. Ein leerer Bestand mit einem Standard-Zeitraum abzufragen wäre
der teuerste mögliche Weg, um „nichts" zu erfahren.
"""

from __future__ import annotations

from datetime import date
from typing import Final

from supabase import Client

from src.core.logging import get_logger

log = get_logger("nextdays.channel_manager.airbnb_bestand_zeitraum")

# Polster an beiden Rändern. Ein Jahr, nicht ein Monat: die zu heilende Buchung
# ist genau die, deren Daten wir noch nicht haben (siehe Modul-Docstring).
_POLSTER_JAHRE: Final = 1

# Notbremse. Selbst aus den Daten abgeleitet darf der Zeitraum nicht beliebig
# wachsen (Wurzel 8) — eine einzelne Zeile mit einem Tippfehler im Jahr (2099)
# würde sonst 70 Jahre Etappen planen.
_MAX_JAHRE: Final = 12


def _jahr(wert: object) -> int | None:
    """Das Jahr aus einem ISO-Datum/Zeitstempel — None, wenn nichts brauchbar ist."""
    if not isinstance(wert, str) or len(wert) < 4:
        return None
    try:
        jahr = int(wert[:4])
    except ValueError:
        return None
    # Ein Jahr ausserhalb jeder Plausibilität ist ein Datenfehler, kein Zeitraum.
    return jahr if 2000 <= jahr <= 2100 else None


def _grenze(db: Client, tabelle: str, spalte: str, filter_spalte: str,
            filter_wert: str, *, aufsteigend: bool) -> int | None:
    """Das kleinste bzw. grösste Jahr einer Spalte — in EINER Abfrage.

    `order` + `limit(1)` statt `min()`/`max()`: PostgREST kennt keine Aggregate
    ohne `select=…`-Kunstgriffe, und eine Zeile zu holen ist billiger als der
    Umweg.
    """
    zeilen = (
        db.table(tabelle)
        .select(spalte)
        .eq(filter_spalte, filter_wert)
        .not_.is_(spalte, "null")
        .order(spalte, desc=not aufsteigend)
        .limit(1)
        .execute()
    ).data or []
    return _jahr(zeilen[0].get(spalte)) if zeilen else None


def bestandszeitraum(db: Client) -> tuple[date, date] | None:
    """Der Zeitraum, der den echten Airbnb-Bestand deckt — oder None.

    Gelesen wird aus `reservations` (An-/Abreise), weil das die Achse ist, auf
    der Airbnb filtert. `channex_booking.booked_at` wäre die falsche: eine
    Buchung von 2026 für einen Aufenthalt 2027 würde einen Zeitraum ergeben, in
    dem der Aufenthalt selbst nicht liegt.
    """
    frueh = _grenze(db, "reservations", "check_in", "channel", "airbnb",
                    aufsteigend=True)
    spaet = _grenze(db, "reservations", "check_out", "channel", "airbnb",
                    aufsteigend=False)
    if frueh is None or spaet is None:
        # Kein Airbnb-Bestand → nichts zu heilen, also auch nichts abzurufen.
        return None

    von_jahr = frueh - _POLSTER_JAHRE
    bis_jahr = spaet + _POLSTER_JAHRE
    # Heute muss immer drin liegen: neue Buchungen entstehen jetzt, auch wenn der
    # Bestand nur Vergangenheit enthält.
    heute = date.today()
    von_jahr = min(von_jahr, heute.year)
    bis_jahr = max(bis_jahr, heute.year + _POLSTER_JAHRE)

    if bis_jahr - von_jahr > _MAX_JAHRE:
        log.warning(
            "airbnb_bestandszeitraum_gekappt",
            von=von_jahr, bis=bis_jahr, max_jahre=_MAX_JAHRE,
        )
        von_jahr = bis_jahr - _MAX_JAHRE

    return date(von_jahr, 1, 1), date(bis_jahr, 12, 31)
