"""Zwei zusätzliche Booking-Leser: der ROHE Posten und die LAGE im Preis.

Ausgelagert aus ``gebuehren_quelle``, weil jenes Modul die pylint-Zeilengrenze
(1500) riss. Fachlich gehören beide dorthin — sie lesen denselben Payload mit
derselben Erkennung; die Grenze zu unterdrücken wäre die schlechtere Antwort.

``gebuehren_quelle`` re-exportiert beide, damit Aufrufer eine Adresse haben.

WOFÜR SIE DA SIND: ``booking_gebuehren`` gibt nur (Art, Betrag) heraus. Wer die
Gebühr am OBJEKT anlegen will (``properties.booking_gebuehren``), braucht
zusätzlich die Berechnungsart (``charge_frequency``: 12 = je Aufenthalt, 19 = je
Nacht), den Gastnamen (``tax_description``) und die Lage im Preis
(``charge_periods[].excluded``). Statt den Payload ein zweites Mal auszulegen —
zwei Leser wären zwei Wahrheiten — reichen diese Funktionen die Posten durch,
die dieselbe Erkennung passiert haben.
"""

from __future__ import annotations

from typing import Any

from .booking_gebuehrenarten import (
    _BOOKING_ABGABEN_NAMEN,
    _BOOKING_ARTEN,
    _BOOKING_STEUER_NAMEN,
)


def booking_rohposten(raw: object) -> dict[str, dict[str, Any]]:
    """Der ROHE Posten je erkannter Gebührenart — für den Objekt-Übernahmeweg.

    ``booking_gebuehren`` gibt nur (Art, Betrag) heraus; wer die Gebühr am
    OBJEKT anlegen will, braucht zusätzlich ``charge_frequency`` (12 = je
    Aufenthalt, 19 = je Nacht) und ``tax_description`` als Gastnamen. Statt den
    Payload ein zweites Mal auszulegen — zwei Leser wären zwei Wahrheiten —
    reicht diese Funktion die Posten durch, die dieselbe Erkennung passiert
    haben.

    Steuern und Abgaben erscheinen NICHT: sie laufen durch und sind keine
    Leistung des Objekts (siehe ``booking_gebuehren``).
    """
    # Lokal: `gebuehren_quelle` re-exportiert diese Datei, ein Modul-Import
    # wäre ein Zirkel.
    from .gebuehren_quelle import (  # noqa: PLC0415
        _BOOKING_STEUER_TYPEN,
        _booking_posten,
    )

    posten = _booking_posten(raw)
    if posten is None:
        return {}
    out: dict[str, dict[str, Any]] = {}
    for p in posten:
        if not isinstance(p, dict):
            continue
        text = str(p.get("tax_description") or "").strip()
        klein = text.casefold()
        if klein in _BOOKING_ABGABEN_NAMEN:
            continue
        if klein.startswith(_BOOKING_STEUER_NAMEN):
            continue
        if str(p.get("type") or "").strip().casefold() in _BOOKING_STEUER_TYPEN:
            continue
        art = _BOOKING_ARTEN.get(klein)
        if art is None or art in out:
            continue
        out[art] = p
    return out


def booking_gebuehren_lage(raw: object) -> dict[str, bool]:
    """Je Gebührenart: liegt sie OBENDRAUF (``True``) oder im Zimmerpreis?

    Quelle ist ``rooms[].meta.charge_periods[<SCHLUESSEL>][].excluded``:
    ``true`` = eigener Posten über dem Strich (Bookings Darstellung), ``false``
    = „Rate Included". Der Wert variiert je BUCHUNG derselben Art (live
    ``CLEANINGFEE`` 30× true / 5× false), beschreibt also diese Buchung und
    keine Objekt-Einstellung.

    Nur eine Gebühr, die obendrauf kommt, ist eine zusätzliche Leistung und
    gehört als Objekt-Gebühr angelegt. Eine Art ohne Eintrag fehlt in der
    Rückgabe — der Aufrufer legt sie dann nicht an, statt „obendrauf" zu
    unterstellen (Wurzel 4).
    """
    from .gebuehren_quelle import _BOOKING_SCHLUESSEL_ARTEN  # noqa: PLC0415

    if not isinstance(raw, dict):
        return {}
    zimmer = raw.get("rooms")
    if not isinstance(zimmer, list):
        return {}
    out: dict[str, bool] = {}
    for z in zimmer:
        if not isinstance(z, dict):
            continue
        perioden = (z.get("meta") or {}).get("charge_periods")
        if not isinstance(perioden, dict):
            continue
        for schluessel, spannen in perioden.items():
            art = _BOOKING_SCHLUESSEL_ARTEN.get(str(schluessel).strip().upper())
            if art is None or art in out or not isinstance(spannen, list):
                continue
            werte = [
                s.get("excluded") for s in spannen if isinstance(s, dict)
            ]
            if not werte or any(w is None for w in werte):
                continue
            out[art] = all(w is True for w in werte)
    return out
