"""Der ECHTE Buchungszeitpunkt — nie unsere eigene Uhr (0291/0292).

DER VORFALL, den diese Tests für immer ausschließen sollen (06.08.2026): Der
Posteingang zeigte 22 Airbnb-Buchungen als „heute 10:48". Real gebucht waren
sie am 23.03., 01.06. und 26.07. — die älteste viereinhalb Monate alt. Alle 22
trugen dieselbe Sekunde, weil der Feed sie in einem Rutsch abholte und die
Anzeige unseren Anlagezeitpunkt zeigte. Die Sortierung „letzte Aktivität" war
damit wertlos, und der Betrieb sah einen Posteingang voller vermeintlich neuer
Buchungen.

DIE REGEL, die daraus folgt: Ein Zeitstempel, den WIR setzen, beschreibt unsere
Verarbeitung — nie die Handlung des Gastes. Fehlt der echte Wert, ist die
Antwort None; die Oberfläche sagt dann „Eingang bei uns", statt einen
plausiblen falschen Zeitpunkt zu behaupten (Wurzel 4).
"""
from __future__ import annotations

from src.features.channel_manager.common import ota_buchungszeitpunkt


def test_airbnb_booked_at_gewinnt() -> None:
    """Airbnbs `booked_at` ist die Wahrheit — live gemessen an HMPKWNHQNF."""
    assert ota_buchungszeitpunkt({
        "booked_at": "2026-03-23T15:24:55.612Z",
        "created_at": "2026-03-23T15:24:47.996Z",
    }) == "2026-03-23T15:24:55.612Z"


def test_created_at_der_reservierung_als_ersatz() -> None:
    """Airbnbs eigenes Anlagedatum stammt aus DERSELBEN Quelle und liegt live
    wenige Sekunden vor `booked_at` — brauchbar, wenn letzteres fehlt."""
    assert ota_buchungszeitpunkt(
        {"created_at": "2026-03-23T15:24:47.996Z"}
    ) == "2026-03-23T15:24:47.996Z"


def test_ohne_portal_zeit_kommt_none() -> None:
    """KEIN Rückfall auf unsere Uhr. Genau dieser Rückfall war der Fehler.

    Ein `inserted_at` (Eingang beim Aggregator) darf hier nichts auslösen — er
    stand bei allen 22 Buchungen auf derselben Sekunde.
    """
    assert ota_buchungszeitpunkt({"inserted_at": "2026-08-06T08:48:57"}) is None
    assert ota_buchungszeitpunkt({}) is None


def test_leerer_wert_ist_kein_wert() -> None:
    """Channex liefert `ota_booked_at` als leeres Feld (live geprüft) — das
    darf nicht als gesetzter Zeitpunkt durchgehen."""
    assert ota_buchungszeitpunkt({"booked_at": "", "ota_booked_at": None}) is None


def test_zone_wird_ergaenzt() -> None:
    """Ohne Zone wäre der Zeitpunkt zwei Stunden falsch (CEST): eine Buchung
    um 08:48 UTC ist 10:48 beim Betrieb — genau die Zahl aus dem Vorfall."""
    assert ota_buchungszeitpunkt(
        {"booked_at": "2026-03-23T15:24:55"}
    ) == "2026-03-23T15:24:55Z"


def test_reihenfolge_ist_verlaesslichkeit() -> None:
    """Steht beides, gewinnt das Feld des Portals — nicht das zuerst gefundene."""
    assert ota_buchungszeitpunkt({
        "ota_booked_at": "2026-01-01T00:00:00Z",
        "booked_at": "2026-03-23T15:24:55Z",
    }) == "2026-03-23T15:24:55Z"
