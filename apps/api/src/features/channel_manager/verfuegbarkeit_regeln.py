"""Verfügbarkeits-Formular → ARI-Restriktionen (der EINE Übersetzer).

Das Verfügbarkeits-Formular (`/objekte/{id}/verfuegbarkeit`) schreibt seine
Einstellungen nach `properties.type_attributes.availability`. Ein Teil davon
sind Channex-*property.settings* (cut_off_time, cut_off_days, max_day_advance,
min_stay_type) — die übersetzt `common._availability_settings` beim
Content-Sync. Der REST sind datumsbezogene *Restriktionen*, und die gehen über
`POST /restrictions` je Rate-Plan an die Portale:

- minStay             → min_stay_arrival / min_stay_through (Objekt-Grundwert)
- maxStay             → max_stay (0 = keine Obergrenze)
- unavailableCheckIn  → closed_to_arrival an diesen WOCHENTAGEN
- unavailableCheckOut → closed_to_departure an diesen Wochentagen

Warum ein eigenes Modul: dieselbe Übersetzung wird an ZWEI Stellen gebraucht —
im Delta-Push beim Speichern (`properties.service`) und im nächtlichen
Full-Sync (`full_sync`). Lägen sie doppelt vor, driften sie auseinander; genau
das war der Bug, den dieses Modul schließt (der Full-Sync setzte `max_stay`
stur auf 0 zurück und machte jeden im Formular gesetzten Maximalaufenthalt
über Nacht wieder zunichte — Wurzel 1: der Gegenzustand wurde nicht gepflegt).

Vorrang (bewusst, entspricht dem bestehenden Full-Sync-Verhalten): ein
tagesgenauer Override aus `rate_plan_restriction_overrides` /
`rate_plan_min_stay_overrides` sticht IMMER den Objekt-Grundwert aus dem
Formular. Das Formular liefert die Grundregel, der Kalender die Ausnahme.

Nicht hier übersetzt, weil Channex dafür kein Restriktionsfeld hat:
`preparationDays` (Puffer zwischen Buchungen) und `bookingWindowDays` /
`advanceNotice` je Kanal. Für Airbnb gibt es dafür einen EIGENEN Endpunkt
(`update_availability_rule`: turnover_days, booking_lead_time,
max_days_notice) — der läuft über `airbnb_direkt`, nicht über ARI.
"""

from __future__ import annotations

from datetime import date
from typing import Any

# Wochentags-Schlüssel des Formulars (`WeekdayFlags` in
# web/lib/availability-meta.ts) in der Reihenfolge von `date.weekday()`:
# Montag = 0 … Sonntag = 6. Diese Zuordnung ist die einzige Stelle, an der die
# Indexbasis festgelegt wird — Airbnb zählt anderswo ab Sonntag, deshalb hier
# nie über einen Zahlenindex gehen, sondern über den Namen.
_WOCHENTAGE: tuple[str, ...] = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


def availability_block(row: dict[str, Any]) -> dict[str, Any]:
    """`type_attributes.availability` aus einer properties-Zeile lesen.

    Fehlt der Block, ist das kein Fehler: das Objekt wurde nie im
    Verfügbarkeits-Formular gespeichert. Dann gilt überall der Grundwert
    „keine Einschränkung", NICHT ein erfundener Default (Wurzel 4).
    """
    attrs = row.get("type_attributes")
    if not isinstance(attrs, dict):
        return {}
    av = attrs.get("availability")
    return av if isinstance(av, dict) else {}


def availability_geaendert(alte_attrs: object, changes: dict[str, Any]) -> bool:
    """Hat sich der Verfügbarkeits-Block durch dieses Update geändert?

    Entscheidet, ob die Airbnb-eigenen Regeln nachgezogen werden — jeder Lauf
    ist ein GET+PUT gegen das Live-Listing, und ein Speichern an anderer Stelle
    (Fotos, Ausstattung, Texte) ist dafür kein Anlass.

    Bewusst KONSERVATIV, wie `laengenpreise_geaendert`: ist der Alt-Stand nicht
    ladbar, gilt „geändert" und der Job läuft. Ein Job zu viel kostet zwei
    Aufrufe; ein ausgelassener ließe bei Airbnb eine Regel stehen, die es bei
    uns nicht mehr gibt (Wurzel 1).
    """
    neu_attrs = changes.get("type_attributes")
    if not isinstance(neu_attrs, dict):
        return False
    if not isinstance(alte_attrs, dict):
        return True

    def block(attrs: dict[str, Any]) -> dict[str, Any]:
        av = attrs.get("availability")
        return av if isinstance(av, dict) else {}

    return block(neu_attrs) != block(alte_attrs)


def _ganzzahl(av: dict[str, Any], key: str, mindest: int) -> int | None:
    """Einen ganzzahligen Formularwert lesen, oder None wenn nicht gesetzt/ungültig.

    `bool` ist in Python ein `int` — deshalb explizit ausschließen, sonst würde
    ein versehentliches `true` als 1 durchgehen.
    """
    wert = av.get(key)
    if isinstance(wert, bool) or not isinstance(wert, (int, float)):
        return None
    try:
        zahl = int(wert)
    except (TypeError, ValueError):
        return None
    return zahl if zahl >= mindest else None


def min_stay_grundwert(av: dict[str, Any]) -> int | None:
    """Mindestaufenthalt aus dem Formular (Nächte), oder None wenn nicht gesetzt.

    < 1 Nacht ergibt keinen Sinn und wird verworfen statt korrigiert.
    """
    return _ganzzahl(av, "minStay", 1)


def max_stay_grundwert(av: dict[str, Any]) -> int:
    """Maximalaufenthalt aus dem Formular (Nächte); 0 = keine Obergrenze.

    Anders als `min_stay_grundwert` gibt es hier kein None: 0 ist ein
    gültiger, bedeutungstragender Wert („Obergrenze entfernt"), und genau der
    muss auch gepusht werden, damit das Entfernen bei den Portalen ankommt
    (Wurzel 1).
    """
    return _ganzzahl(av, "maxStay", 0) or 0


def _flags(av: dict[str, Any], key: str) -> frozenset[str]:
    """Gesperrte Wochentage als Menge von Schlüsseln ('mon', 'sat', …)."""
    roh = av.get(key)
    if not isinstance(roh, dict):
        return frozenset()
    return frozenset(tag for tag in _WOCHENTAGE if roh.get(tag) is True)


def gesperrte_anreisetage(av: dict[str, Any]) -> frozenset[str]:
    """Wochentage, an denen keine ANREISE möglich ist (→ closed_to_arrival)."""
    return _flags(av, "unavailableCheckIn")


def gesperrte_abreisetage(av: dict[str, Any]) -> frozenset[str]:
    """Wochentage, an denen keine ABREISE möglich ist (→ closed_to_departure)."""
    return _flags(av, "unavailableCheckOut")


def ist_gesperrt(tag: date, gesperrte: frozenset[str]) -> bool:
    """Fällt dieses Datum auf einen gesperrten Wochentag?"""
    if not gesperrte:
        return False
    return _WOCHENTAGE[tag.weekday()] in gesperrte


class Wochentagsregel:
    """Die Wochentags-Sperren eines Objekts, vorberechnet für einen Push-Lauf.

    Der Full-Sync fragt das pro Rate-Plan und pro Tag ab (500 Tage × n Pläne).
    Einmal die Mengen bilden statt in jeder Schleifenrunde das jsonb neu zu
    zerlegen.
    """

    __slots__ = ("anreise", "abreise", "min_stay", "max_stay")

    def __init__(self, av: dict[str, Any]) -> None:
        self.anreise = gesperrte_anreisetage(av)
        self.abreise = gesperrte_abreisetage(av)
        self.min_stay = min_stay_grundwert(av)
        self.max_stay = max_stay_grundwert(av)

    @classmethod
    def aus_zeile(cls, row: dict[str, Any]) -> Wochentagsregel:
        """Direkt aus einer properties-Zeile bauen."""
        return cls(availability_block(row))

    @property
    def hat_wochentagssperren(self) -> bool:
        """True, wenn überhaupt ein Wochentag gesperrt ist."""
        return bool(self.anreise or self.abreise)

    def cta(self, tag: date) -> bool:
        """closed_to_arrival für dieses Datum (aus der Wochentagsregel)."""
        return ist_gesperrt(tag, self.anreise)

    def ctd(self, tag: date) -> bool:
        """closed_to_departure für dieses Datum (aus der Wochentagsregel)."""
        return ist_gesperrt(tag, self.abreise)
