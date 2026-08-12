"""Soll gegen Ist: steht die Gebühr wirklich beim Portal?

Die Fälle sind die live gemessenen (11.08.2026, Konto AirSmil, Objekt
„FeWo *Stjerneskud*", Airbnb-Inserat 54087677): bei uns 795 DKK, am Inserat
1.590 DKK — und niemand sah es.
"""
from __future__ import annotations

from src.features.channel_manager.gebuehren_stand import (
    STATUS_ABWEICHEND,
    STATUS_FEHLT,
    STATUS_ONLINE,
    _vergleich,
)


def test_gleicher_betrag_ist_online() -> None:
    """Dort steht genau unser Betrag — das ist der Beleg, den die Zeile trägt."""
    schluessel, status, soll, ist = _vergleich(
        "fee-1", 795.0, "cleaning", {"PASS_THROUGH_CLEANING_FEE": 795.0}
    )
    assert (schluessel, status, soll, ist) == ("fee-1", STATUS_ONLINE, 795.0, 795.0)


def test_anderer_betrag_ist_abweichend_mit_beiden_zahlen() -> None:
    """Der Live-Fall: 795 bei uns, 1.590 dort.

    Beide Zahlen müssen in den Stand — „stimmt nicht" ohne den fremden Betrag
    zwingt den Betrieb, im Extranet nachzusehen, was der Chip gerade meint.
    """
    _key, status, soll, ist = _vergleich(
        "fee-1", 795.0, "cleaning", {"PASS_THROUGH_CLEANING_FEE": 1590.0}
    )
    assert status == STATUS_ABWEICHEND
    assert (soll, ist) == (795.0, 1590.0)


def test_gebuehr_fehlt_beim_portal() -> None:
    """Dort steht die Art gar nicht — `betrag_ist` bleibt None (kein 0-Ersatz)."""
    _key, status, soll, ist = _vergleich("fee-1", 150.0, "pet", {})
    assert status == STATUS_FEHLT
    assert (soll, ist) == (150.0, None)


def test_summierte_kategorie_traegt_den_kategorie_schluessel() -> None:
    """Zwei Reinigungsgebühren gehen als EINE an Airbnb.

    Der Stand hängt dann am Kategorie-Schlüssel; die Oberfläche zeigt ihn an
    beiden Zeilen (`_live_fuer`). Verglichen wird die Summe, weil genau die
    beim Portal steht.
    """
    schluessel, status, soll, ist = _vergleich(
        "cat:cleaning", 1590.0, "cleaning", {"PASS_THROUGH_CLEANING_FEE": 1590.0}
    )
    assert schluessel == "cat:cleaning"
    assert (status, soll, ist) == (STATUS_ONLINE, 1590.0, 1590.0)


def test_cent_abweichung_gilt_als_gleich() -> None:
    """Beträge gehen als Zeichenkette raus und kommen als Zahl zurück.

    Ein halber Cent Unterschied ist Formatierung, kein Befund — sonst stünde an
    jeder korrekt übertragenen Gebühr ein roter Chip.
    """
    _key, status, _soll, _ist = _vergleich(
        "fee-1", 795.0, "cleaning", {"PASS_THROUGH_CLEANING_FEE": 795.004}
    )
    assert status == STATUS_ONLINE


def test_unbekannte_kategorie_meldet_nicht_online() -> None:
    """Ohne Airbnb-Entsprechung gibt es keinen Beleg — dann nie „online"."""
    _key, status, _soll, ist = _vergleich(
        "fee-1", 10.0, None, {"PASS_THROUGH_CLEANING_FEE": 795.0}
    )
    assert status == STATUS_FEHLT
    assert ist is None
