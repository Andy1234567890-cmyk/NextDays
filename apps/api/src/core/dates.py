"""Datums-Helfer für Belegungszeiträume — EINE Wahrheit für alle Slices.

Warum zentral: Die Umrechnung „Tagesliste ↔ Zeitraum" lag zuvor viermal im Code
(rates, calendar, external_calendar, reservations) — derselbe Algorithmus mit
ZWEI unterschiedlichen End-Konventionen. Genau daraus entsteht die
Off-by-one-Klasse, die bei Channex-Ranges schon Zertifizierungsthema war: ein
Zeitraum, der einen Tag zu lang oder zu kurz gepusht wird, sperrt oder öffnet
eine Nacht zu viel.

Die beiden Konventionen sind BEIDE legitim, sie gehören nur verschiedenen
Domänen:

  end INKLUSIV  — Channex/ARI-Ranges (`date_from`/`date_to` bezeichnen belegte
                  Tage; der letzte genannte Tag zählt mit).
  end EXKLUSIV  — iCal-DATE-Semantik (`DTEND` ist der Abreisetag und selbst
                  NICHT mehr belegt) sowie unsere Reservierungs-Spannen
                  (check_out = Abreisetag).

Deshalb ist die Konvention hier ein PFLICHT-Argument: Der Aufrufer muss sie
bewusst wählen, statt sie aus einem Funktionsnamen zu erraten.
"""
# SCHWESTERDATEI — byte-identisch in beiden Bäumen halten:
#     apps/api/src/core/dates.py
#     apps/public-api/src/core/dates.py
# Die öffentliche API ist ein EIGENER Service (apps/public-api/README.md) und
# importiert nichts aus apps/api. Diese Datei liegt dort als bewusste Kopie
# (Muster ADR-0019); der CI-Job `public-api-konsistenz` prüft die
# Byte-Gleichheit. Drift hier verschiebt die Nächte-Zählung: eine Fassung
# rechnet vier Nächte, die andere fünf — und damit weichen der Preis in der
# Vorschau und der Preis in der Buchung um eine Nacht ab.
from __future__ import annotations

from datetime import date, timedelta


def nights(check_in: date, check_out: date) -> list[date]:
    """Die belegten Nächte eines Aufenthalts: [check_in, check_out).

    Der Abreisetag zählt NICHT — wer am 3. abreist, belegt die Nacht vom 2. auf
    den 3. nicht mehr. Leere Liste, wenn check_out nicht nach check_in liegt.
    """
    days: list[date] = []
    cur = check_in
    while cur < check_out:
        days.append(cur)
        cur += timedelta(days=1)
    return days


def merge_day_ranges(
    days: list[date], *, end_exclusive: bool
) -> list[tuple[date, date]]:
    """Tage zu zusammenhängenden Zeiträumen bündeln.

    `days` wird sortiert und dedupliziert — der Aufrufer muss das nicht
    vorbereiten. `end_exclusive` wählt die Konvention (siehe Modul-Docstring):
    False → letzter belegter Tag (Channex/ARI), True → erster FREIER Tag
    (iCal DTEND).
    """
    if not days:
        return []
    ordered = sorted(set(days))
    ranges: list[tuple[date, date]] = []
    start = prev = ordered[0]
    for d in ordered[1:]:
        if d == prev + timedelta(days=1):
            prev = d
            continue
        ranges.append((start, prev + timedelta(days=1) if end_exclusive else prev))
        start = prev = d
    ranges.append((start, prev + timedelta(days=1) if end_exclusive else prev))
    return ranges
