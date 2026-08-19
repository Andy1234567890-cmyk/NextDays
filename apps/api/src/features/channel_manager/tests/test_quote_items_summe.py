"""Die Preisaufschlüsselung muss aufgehen — oder es gibt keine.

DER ANLASS (19.08.2026): Von 96 Buchungen mit Aufstellung addierten sich 5 auf
einen anderen Betrag als ihre Rechnungssumme; zusammen 6.666,11 DKK. Drei
Booking-Buchungen wiesen die Reinigungsgebühr (1.275,00) zusätzlich aus, obwohl
`amount` sie nicht enthielt; zwei Airbnb-Buchungen zeigten eine Übernachtung,
die GRÖSSER war als der Gesamtbetrag — dort ist `amount` der Netto-Payout.

WARUM DIE PRÜFUNG UND KEINE REGEL: `is_inclusive` unterscheidet die Fälle nicht.
An 16 Live-Payloads geprüft: es gibt Buchungen mit `is_inclusive: true`, deren
Summe aufgeht, und drei mit `true`, deren nicht. In der Nutzlast gibt es kein
Merkmal, aus dem sich ableiten liesse, welche Gebühr im Gesamtbetrag steckt.

Diese Positionen landen auf der Rechnung. Eine Aufstellung, deren Zeilen sich zu
einem anderen Betrag addieren als die Summe darunter, ist dort schlimmer als
keine.
"""
from __future__ import annotations

from typing import Any

from src.features.channel_manager.bookings_sync import BookingsSyncMixin


class _Sync(BookingsSyncMixin):
    """Nur die Prüf-Methode; die Import-Umgebung wird nicht gebraucht."""


def _posten(*paare: tuple[str, float]) -> list[dict[str, Any]]:
    return [
        {"label": label, "amount": betrag, "kind": "lodging" if i == 0 else "fee"}
        for i, (label, betrag) in enumerate(paare)
    ]


_ATTRS = {"booking_id": "CHX-1", "ota_name": "BookingCom", "ota_reservation_code": "X"}


def test_aufgehende_aufstellung_bleibt() -> None:
    """Der Regelfall — 13 von 16 Live-Payloads sehen so aus."""
    items = _posten(("Übernachtung", 4268.0), ("Resort fee", 150.0), ("Cleaning fee", 955.0))
    assert _Sync()._geprueft(items, 5373.0, _ATTRS) == items  # noqa: SLF001


def test_der_live_fall_wird_verworfen() -> None:
    """Genau die Buchung, die den Fund ausgelöst hat (Gun Heibø, 6707719914).

    4.830 + 75 + 1.275 = 6.180, die Rechnung nennt 4.905 — die Reinigungsgebühr
    steckt nicht im Gesamtbetrag.
    """
    items = _posten(("Übernachtung", 4830.0), ("Resort fee", 75.0), ("Cleaning fee", 1275.0))
    assert _Sync()._geprueft(items, 4905.0, _ATTRS) == []  # noqa: SLF001


def test_airbnb_payout_gegen_gastpreis_wird_verworfen() -> None:
    """Bei Airbnb ist `amount` der Netto-Payout, die Positionen sind Gastpreise.

    Die ausgewiesene Übernachtung ist dort GRÖSSER als der Gesamtbetrag. Eine
    solche Aufstellung neben einer Summe zu zeigen, behauptet einen Zusammenhang,
    den es nicht gibt.
    """
    items = _posten(("Übernachtung", 13581.26), ("Reinigung", 1275.0))
    assert _Sync()._geprueft(items, 12553.54, _ATTRS) == []  # noqa: SLF001


def test_ein_cent_rundung_ist_erlaubt() -> None:
    """Die Beträge kommen als TEXT aus der Nutzlast und laufen über `float` —
    eine Aufstellung wegen eines halben Cents zu verwerfen wäre Unsinn."""
    items = _posten(("Übernachtung", 100.005), ("Gebühr", 10.0))
    assert _Sync()._geprueft(items, 110.0, _ATTRS) == items  # noqa: SLF001


def test_zwei_cent_sind_kein_rundungsfehler() -> None:
    items = _posten(("Übernachtung", 100.0), ("Gebühr", 10.0))
    assert _Sync()._geprueft(items, 110.02, _ATTRS) == []  # noqa: SLF001


def test_ohne_gesamtbetrag_wird_nicht_geprueft() -> None:
    """Ohne Bezugsgrösse gibt es nichts zu prüfen — dann bleibt die Aufstellung,
    statt gegen eine Unbekannte verworfen zu werden."""
    items = _posten(("Übernachtung", 100.0), ("Gebühr", 10.0))
    assert _Sync()._geprueft(items, None, _ATTRS) == items  # noqa: SLF001


def test_leere_aufstellung_bleibt_leer() -> None:
    assert _Sync()._geprueft([], 100.0, _ATTRS) == []  # noqa: SLF001


def test_nur_uebernachtung_geht_auf() -> None:
    """76 der 96 Live-Buchungen haben keine Gebührenzeile — dort ist die
    Übernachtung der Gesamtbetrag, und keine davon wich ab."""
    items = _posten(("Übernachtung", 2810.0))
    assert _Sync()._geprueft(items, 2810.0, _ATTRS) == items  # noqa: SLF001
