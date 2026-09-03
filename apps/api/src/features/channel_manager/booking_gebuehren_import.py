"""Bookings Gebühren aus der Buchung in unsere Objekt-Gebühren übernehmen.

WARUM ES DIESE DATEI GIBT (03.09.2026): Eine Booking-Buchung brachte
„Stromkosten DKK 125,00" mit — eine Gebühr, die am Objekt „Feriehus Kornblomst"
nicht gepflegt war (dort standen Resort, Reinigung, Haustier). Die
Eigentümer-Abrechnung blockierte mit „Die Gebührenart `electricity` ist nicht
zugeordnet" und verlangte, dass jemand sie von Hand nachträgt — für eine
Angabe, die Booking bei JEDER Buchung mitliefert.

Ausdrückliche Anweisung des Nutzers: *„Channex liefert die daten unser system
muss sie automatisch erkennen und schreiben"*.

DAS IST **NICHT** DER AIRBNB-WEG (`airbnb_gebuehren_import.py`), und nichts
hier ist von ihm abgeleitet. Airbnb und Booking sind zwei getrennte Portale mit
zwei getrennten Datenmodellen (CLAUDE.md: „NIE ein Portal aus einem anderen
ableiten"). Die Unterschiede, die das erzwingen:

  * Airbnb liefert die Gebühren am INSERAT (`pricing_settings.standard_fees`,
    ein eigener Endpunkt) — Booking liefert sie an der BUCHUNG, im Payload
    unter ``rooms[].meta``. Für Booking gibt es keinen Inserats-Abruf; das
    Extranet hat keinen Rücklesepfad, und Channex' ``GET /taxes`` liefert nur
    unsere eigenen hochgeschickten Gebühren.
  * Airbnb nennt die Art im Klartext-Enum (`PASS_THROUGH_CLEANING_FEE`) —
    Booking nennt sie zweimal verschieden: sprachabhängig in
    ``tax_description`` („Stromkosten"/„Cleaning fee") und sprachneutral als
    Schlüssel in ``meta.charge_periods`` (``ELECTRICITYFEE``).
  * Airbnbs Betrag kommt in zwei Größenordnungen (ganze Einheit ODER Mikro) —
    Bookings ``amount`` ist IMMER Minor Units mit ``decimal_places``.
  * Die Berechnungsart heißt bei Airbnb ``charge_type``/``charge_period``, bei
    Booking ``charge_frequency`` mit Zahlcodes.

WAS BOOKING WIRKLICH LIEFERT — gemessen 03.09.2026 an allen 788 Payloads der
Live-DB, 82 Posten:

    tax_description        charge_frequency   Vorkommen
    Reinigungsgebühr / Cleaning fee     12    36
    Haustiergebühr                      12     3
    Mehrwertsteuer (25%)                12     8
    Resortgebühr / Resort fee           19    33
    Stromkosten                         19     1
    Übernachtungssteuer (10%)           12     1

``charge_frequency`` ist trennscharf und deckt sich mit den am Objekt
gepflegten Basiswerten desselben Betriebs: **12 = pro Aufenthalt** (Reinigung
„Pro Aufenthalt", Haustier „Pro Aufenthalt"), **19 = pro Nacht** (Resort „Pro
Nacht"). Der ``amount`` ist dabei die SUMME für den Aufenthalt, nicht der
Satz je Nacht: Stromkosten stehen mit 12500 (= 125,00 DKK) bei fünf Nächten,
nicht mit 62500. Deshalb wird der Nacht-Satz geteilt.

``excluded`` aus ``meta.charge_periods`` sagt die LAGE: ``true`` = eigener
Posten obendrauf (Booking zeigt ihn über dem Strich), ``false`` = im
Zimmerpreis enthalten (Bookings „Rate Included"). Nur ``excluded: true``
gehört als Objekt-Gebühr angelegt — eine im Preis enthaltene Steuer ist keine
zusätzliche Leistung.

WAS NICHT ÜBERNOMMEN WIRD, und warum das kein Mangel ist (Wurzel 4):
Steuern und Abgaben (``VAT``, ``CITYTAX``) sind keine Gebühren für eine
Leistung des Objekts — sie laufen durch. Sie stehen deshalb nicht im
Schlüssel-Katalog des Lesers und kommen hier nie an.
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from src.features.properties.gebuehren import FEE_TYPE_LABEL

# Bookings ``charge_frequency`` → unsere Basis.
#
# Nur die zwei Codes, die live vorkommen. Ein unbekannter Code wird NICHT auf
# „pro Aufenthalt" geraten (Wurzel 4): die Basis entscheidet, ob ein Betrag
# einmal oder fünfmal in die Rechnung geht, und ein falscher Ratewert wäre ein
# Geldfehler, den niemand als Bug erkennt.
BOOKING_FREQUENZ_AUF_BASIS: dict[str, str] = {
    "12": "per_stay",
    "19": "per_night",
}


def betrag_aus_booking(posten: dict[str, Any]) -> Decimal | None:
    """``amount`` in Minor Units → Betrag in der Währung. None = unbrauchbar.

    ``decimal_places`` steht am Posten selbst und ist live durchgängig 2; es
    wird trotzdem gelesen statt angenommen — eine Währung ohne Dezimalstellen
    (JPY, ISK) käme sonst hundertfach zu hoch an.
    """
    roh = posten.get("amount")
    if roh is None:
        return None
    try:
        minor = Decimal(str(roh))
    except (ArithmeticError, ValueError):
        return None
    if minor <= 0:
        return None
    try:
        stellen = int(posten.get("decimal_places") or 2)
    except (TypeError, ValueError):
        return None
    if stellen < 0 or stellen > 6:
        return None
    return minor / (Decimal(10) ** stellen)


def fee_aus_booking(
    art: str,
    posten: dict[str, Any],
    *,
    naechte: int,
) -> dict[str, Any] | None:
    """Ein Booking-Posten als unsere Objekt-Gebühr. None = nicht übernehmbar.

    Verworfen wird:
      * eine unbekannte ``charge_frequency`` — die Basis wäre geraten,
      * ein Betrag ≤ 0 oder unlesbare Minor Units,
      * ``naechte <= 0`` bei einer Nacht-Gebühr: der Satz wäre nicht teilbar.

    ``name`` kommt aus ``tax_description``, wenn vorhanden — das ist der Text,
    den der Gast bei Booking gesehen hat („Stromkosten"). Nur wenn er fehlt,
    tritt das Katalog-Label ein. Ein maschinell übersetzter Gasttext wäre
    geraten, deshalb wird ``names`` allein für Deutsch gefüllt; die übrigen 23
    Sprachen pflegt der Betrieb im Editor nach.
    """
    frequenz = str(posten.get("charge_frequency") or "").strip()
    basis = BOOKING_FREQUENZ_AUF_BASIS.get(frequenz)
    if basis is None:
        return None
    gesamt = betrag_aus_booking(posten)
    if gesamt is None:
        return None
    if basis == "per_night":
        if naechte <= 0:
            return None
        # Booking liefert die SUMME; unsere Nacht-Basis erwartet den Satz.
        betrag = gesamt / Decimal(naechte)
    else:
        betrag = gesamt

    name = str(posten.get("tax_description") or "").strip() or FEE_TYPE_LABEL.get(
        art, art
    )
    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "names": {"de": name},
        "feeType": art,
        "mode": "amount",
        "basis": basis,
        "optional": False,
        "amount": float(betrag),
    }
