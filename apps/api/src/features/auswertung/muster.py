"""Muster-Berichte der Auswertung — Buchungsfenster, Aufenthaltsdauer, Storno-Vorlauf.

Die Eimer und die Verteilungslogik liegen hier, damit `service.py` die
Rechenwege behält und nicht die Tabellen. Alles DB-frei: die Aufrufer laden
ihre Zeilen selbst.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any

from .schemas import VerteilungZeile, WochentagZeile


def zahl(wert: Any) -> float:  # noqa: ANN401 - kommt roh aus der DB
    """Zahl aus der DB — None und Leerstring werden 0.0, nie ein Fehler."""
    try:
        return float(wert or 0)
    except (TypeError, ValueError):
        return 0.0


def naechte(check_in: str, check_out: str) -> int:
    """Nächte einer Buchung. Ungültige Daten ergeben 0, keinen Absturz."""
    try:
        a = date.fromisoformat(str(check_in)[:10])
        b = date.fromisoformat(str(check_out)[:10])
    except (TypeError, ValueError):
        return 0
    return max((b - a).days, 0)


def datum(roh: Any) -> date | None:  # noqa: ANN401 - kommt roh aus der DB
    """ISO-Datum oder -Zeitstempel → `date`, sonst None."""
    if not roh:
        return None
    try:
        return date.fromisoformat(str(roh)[:10])
    except (TypeError, ValueError):
        return None


def zeitpunkt(roh: Any) -> datetime | None:  # noqa: ANN401 - kommt roh aus der DB
    if not roh:
        return None
    try:
        return datetime.fromisoformat(str(roh).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


# Eimer des Buchungsfensters (Tage zwischen Buchung und Anreise) und der
# Aufenthaltsdauer (Nächte). Obergrenze `None` = offen. Dieselben Stufen, die
# SiteMinder und Lighthouse in ihren Berichten führen.
_FENSTER_EIMER: tuple[tuple[str, int, int | None], ...] = (
    ("0-3", 0, 3),
    ("4-7", 4, 7),
    ("8-14", 8, 14),
    ("15-30", 15, 30),
    ("31-60", 31, 60),
    ("61-90", 61, 90),
    ("91+", 91, None),
)
_DAUER_EIMER: tuple[tuple[str, int, int | None], ...] = (
    ("1", 1, 1),
    ("2", 2, 2),
    ("3-4", 3, 4),
    ("5-6", 5, 6),
    ("7", 7, 7),
    ("8-13", 8, 13),
    ("14+", 14, None),
)
# Storno-Vorlauf (Tage zwischen Storno und geplanter Anreise).
_STORNO_EIMER: tuple[tuple[str, int, int | None], ...] = (
    ("0-1", 0, 1),
    ("2-7", 2, 7),
    ("8-30", 8, 30),
    ("31+", 31, None),
)


def _eimer_fuer(
    wert: int, eimer: tuple[tuple[str, int, int | None], ...]
) -> str | None:
    for key, von, bis in eimer:
        if wert >= von and (bis is None or wert <= bis):
            return key
    return None


def _verteilung(
    buchungen: list[dict[str, Any]],
    eimer: tuple[tuple[str, int, int | None], ...],
    wert_von: Any,  # noqa: ANN401 - Callable auf rohe Zeilen
) -> list[VerteilungZeile]:
    """Buchungen in feste Eimer legen. Buchungen ohne Wert fallen heraus,
    statt in einen falschen Eimer zu rutschen (Wurzel 5b)."""
    zeilen = {key: VerteilungZeile(schluessel=key, von=von, bis=bis) for key, von, bis in eimer}
    gesamt = 0
    for b in buchungen:
        w = wert_von(b)
        if w is None:
            continue
        key = _eimer_fuer(w, eimer)
        if key is None:
            continue
        z = zeilen[key]
        z.buchungen += 1
        z.naechte += naechte(b.get("check_in"), b.get("check_out"))
        z.umsatz = round(z.umsatz + zahl(b.get("total_amount")), 2)
        gesamt += 1
    for z in zeilen.values():
        z.anteil_pct = round(z.buchungen * 100 / gesamt, 2) if gesamt else 0.0
    return list(zeilen.values())


def _vorlauf_tage(b: dict[str, Any]) -> int | None:
    """Tage zwischen echtem Buchungszeitpunkt und Anreise — nur wo `booked_at`
    echt ist (Wurzel 5b: `created_at` ist UNSER Eingang)."""
    gebucht = zeitpunkt(b.get("booked_at"))
    anreise = datum(b.get("check_in"))
    if gebucht is None or anreise is None:
        return None
    tage = (anreise - gebucht.date()).days
    return tage if tage >= 0 else None


def _storno_vorlauf_tage(b: dict[str, Any]) -> int | None:
    storniert = zeitpunkt(b.get("cancelled_at"))
    anreise = datum(b.get("check_in"))
    if storniert is None or anreise is None:
        return None
    tage = (anreise - storniert.date()).days
    return tage if tage >= 0 else 0

def quote(zaehler: float, nenner: float) -> float | None:
    """Prozentwert oder None — ein Nenner von 0 ist keine 0, sondern nichts."""
    return round(zaehler * 100 / nenner, 2) if nenner else None


def teil(zaehler: float, nenner: float) -> float | None:
    return round(zaehler / nenner, 2) if nenner else None


def wochentage(
    gueltig: list[dict[str, Any]],
    kalender: dict[str, dict[str, set[str]]],
    von: date,
    bis: date,
    erlaubt: set[str],
) -> list[WochentagZeile]:
    """Leistung je Wochentag (SiteMinder „Day of week").

    Nenner je Wochentag: alle Tage dieses Wochentags im Zeitraum × Objekte,
    abzüglich gesperrter und verkaufsgesperrter Tage — derselbe Nenner wie
    die Auslastung, nur nach Wochentag geschnitten. Umsatz je Wochentag
    verteilt den Buchungsbetrag gleichmäßig auf seine Nächte, weil die
    Portale keinen Preis je Nacht liefern; das steht in der Oberfläche.
    """
    zeilen = {w: WochentagZeile(wochentag=w) for w in range(7)}
    tag = von
    tage_je_wt: dict[int, int] = defaultdict(int)
    while tag <= bis:
        tage_je_wt[tag.weekday()] += 1
        tag += timedelta(days=1)
    for w, z in zeilen.items():
        z.naechte_buchbar = tage_je_wt[w] * len(erlaubt)
    for pid in erlaubt:
        k = kalender.get(pid)
        if not k:
            continue
        for t in k["gesperrt"] | k["stop_sell"]:
            d = datum(t)
            if d is not None:
                zeilen[d.weekday()].naechte_buchbar -= 1
        for t in k["gebucht"]:
            d = datum(t)
            if d is not None:
                zeilen[d.weekday()].naechte_gebucht += 1
    umsatz_naechte: dict[int, int] = defaultdict(int)
    for b in gueltig:
        a = datum(b.get("check_in"))
        n = naechte(b.get("check_in"), b.get("check_out"))
        if a is None or n <= 0:
            continue
        zeilen[a.weekday()].anreisen += 1
        je_nacht = zahl(b.get("total_amount")) / n
        for i in range(n):
            w = (a + timedelta(days=i)).weekday()
            zeilen[w].umsatz += je_nacht
            umsatz_naechte[w] += 1
    for w, z in zeilen.items():
        z.umsatz = round(z.umsatz, 2)
        z.naechte_buchbar = max(z.naechte_buchbar, 0)
        z.auslastung_pct = quote(z.naechte_gebucht, z.naechte_buchbar)
        z.adr = teil(z.umsatz, umsatz_naechte[w])
    return [zeilen[w] for w in range(7)]
