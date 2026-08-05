"""Airbnb-Anfragen beantworten: die Formen sind NICHT gleich.

Warum diese Tests: Airbnb verlangt für die drei Anfragearten drei verschiedene
Formen. Bei Reservation Request ist `accept` ein BOOLEAN, bei Alteration ein
STRING. Wer beides über eine Funktion schickt, sendet `true` statt `"accept"` —
Airbnb antwortet 422, die 24-Stunden-Frist läuft weiter und der Auto-Decline
schlägt zu. Diese Tests halten die Formen getrennt.

Quellen: `docs/OTA/Airbnb/Airbnb Reservation Request.pdf`,
`Airbnb Alteration Request.pdf`, `Airbnb Inquiry.pdf`.
"""
from __future__ import annotations

import pytest

from src.features.channel_manager import airbnb_anfragen as aa

# --- Reservation Request: accept ist ein BOOLEAN ---------------------------


def test_annehmen_ist_boolean_true():
    resolution = aa.reservation_request_annehmen()
    assert resolution == {"accept": True}
    # Ausdrücklich: KEIN String. Das ist der Unterschied zur Alteration.
    assert resolution["accept"] is True
    assert not isinstance(resolution["accept"], str)


def test_ablehnen_mit_grund_und_nachrichten():
    assert aa.reservation_request_ablehnen(
        grund=aa.ABLEHNUNG_DATEN_BELEGT,
        nachricht_an_gast="Leider belegt.",
        nachricht_an_airbnb="Kalender war nicht aktuell.",
    ) == {
        "accept": False,
        "reason": "dates_not_available",
        "decline_message_to_guest": "Leider belegt.",
        "decline_message_to_airbnb": "Kalender war nicht aktuell.",
    }


def test_ablehnen_ohne_nachrichten():
    """Beide Nachrichten sind optional — leere Felder werden weggelassen."""
    assert aa.reservation_request_ablehnen(grund=aa.ABLEHNUNG_UNPASSEND) == {
        "accept": False,
        "reason": "not_a_good_fit",
    }
    assert aa.reservation_request_ablehnen(
        grund=aa.ABLEHNUNG_UNPASSEND, nachricht_an_gast="   "
    ) == {"accept": False, "reason": "not_a_good_fit"}


def test_alle_vier_gruende_erlaubt():
    assert len(aa.ABLEHNUNGSGRUENDE) == 4
    for grund in aa.ABLEHNUNGSGRUENDE:
        assert aa.reservation_request_ablehnen(grund=grund)["reason"] == grund


def test_eigener_grund_wird_abgewiesen():
    """Wurzel 5: fail-closed. Ein Freitext-Grund wäre ein 422 — und die Anfrage
    bliebe offen, bis Airbnb sie selbst ablehnt."""
    with pytest.raises(aa.AnfrageFehler, match="unbekannt"):
        aa.reservation_request_ablehnen(grund="passt_mir_nicht")


def test_zu_lange_nachricht_wird_nicht_still_gekappt():
    """Abschneiden würde die Aussage des Gastgebers verfälschen."""
    with pytest.raises(aa.AnfrageFehler, match="höchstens"):
        aa.reservation_request_ablehnen(
            grund=aa.ABLEHNUNG_UNWOHL, nachricht_an_gast="x" * 2001
        )


# --- Alteration: accept ist ein STRING ------------------------------------


def test_alteration_ist_string_nicht_boolean():
    """Die zentrale Falle. `true` statt `"accept"` ist ein 422."""
    for entscheidung in ("accept", "decline", "cancel"):
        resolution = aa.alteration_entscheiden(entscheidung)
        assert resolution == {"accept": entscheidung}
        assert isinstance(resolution["accept"], str)
        assert resolution["accept"] is not True


def test_alteration_boolean_wird_abgewiesen():
    with pytest.raises(aa.AnfrageFehler):
        aa.alteration_entscheiden("true")


def test_alle_drei_alteration_entscheidungen():
    assert aa.ALTERATION_ENTSCHEIDUNGEN == frozenset({"accept", "decline", "cancel"})


def test_zuruecknehmen_ist_nicht_ablehnen():
    """`cancel` zieht den EIGENEN Änderungswunsch zurück, `decline` weist den des
    Gastes ab. Zwei verschiedene Vorgänge, gleiche Form."""
    assert aa.alteration_entscheiden(aa.ALTERATION_ZURUECKZIEHEN) == {"accept": "cancel"}
    assert aa.alteration_entscheiden(aa.ALTERATION_ABLEHNEN) == {"accept": "decline"}


# --- Inquiry: type-basiert ------------------------------------------------


def test_vorab_genehmigen():
    assert aa.inquiry_vorab_genehmigen(sofortbuchung_sperren=True) == {
        "type": "preapproval",
        "block_instant_booking": True,
    }
    assert aa.inquiry_vorab_genehmigen(sofortbuchung_sperren=False) == {
        "type": "preapproval",
        "block_instant_booking": False,
    }


def test_sonderpreis_in_minor_units():
    """Airbnb: „10000 for 100.00 USD" — Ganzzahl in der kleinsten Einheit."""
    assert aa.inquiry_sonderpreis(gesamtpreis_minor=10000) == {
        "type": "special_offer",
        "total_price": 10000,
    }


def test_sonderpreis_weist_haupteinheiten_ab():
    """100.00 statt 10000 wäre ein Faktor-100-Fehler zu Lasten des Betriebs."""
    with pytest.raises(aa.AnfrageFehler, match="Minor Units"):
        aa.inquiry_sonderpreis(gesamtpreis_minor=100.0)
    with pytest.raises(aa.AnfrageFehler, match="Minor Units"):
        aa.inquiry_sonderpreis(gesamtpreis_minor="10000")


def test_sonderpreis_weist_bool_ab():
    """`True` ist in Python ein int — hier aber kein Betrag."""
    with pytest.raises(aa.AnfrageFehler, match="Minor Units"):
        aa.inquiry_sonderpreis(gesamtpreis_minor=True)


@pytest.mark.parametrize("betrag", [0, -1, -10000])
def test_sonderpreis_muss_positiv_sein(betrag):
    with pytest.raises(aa.AnfrageFehler, match="größer als 0"):
        aa.inquiry_sonderpreis(gesamtpreis_minor=betrag)


def test_aufloesbare_events():
    """Genau die drei Anfragearten — nichts anderes darf hier landen."""
    assert aa.AUFLOESBARE_EVENTS == frozenset(
        {"reservation_request", "inquiry", "alteration_request"}
    )
