"""Airbnb-Übernahme: die ECHTE `mapping_details`-Antwortform.

Die Beispieldaten hier sind nicht erfunden — sie sind am autorisierten Kanal des
Beta-Betriebs live gemessen (04.08.2026, 18 Listings). Genau diese Form hat der
Code vorher NICHT gelesen: er suchte `listings`/`rooms`/`room_types` und bekam
darum immer eine leere Liste, obwohl Channex mit HTTP 200 antwortete — die UI
meldete „Das Portal liefert keine Zimmer. Prüfe die Zugangsdaten."
"""
from __future__ import annotations

import pytest

from src.features.channel_manager.airbnb_uebernahme import AirbnbUebernahmeMixin
from src.features.channel_manager.channels import ChannelsMixin
from src.features.channel_manager.common import ChannelManagerError
from src.features.channel_manager.oauth_channels import OAuthChannelsMixin

# Zwei Listings aus der echten Antwort, unverändert bis auf die Kürzung.
ECHTE_ANTWORT = {
    "data": {
        "listing_id_dictionary": {
            "values": [
                {
                    "id": "1133122057704952480",
                    "type": "house",
                    "title": "013 Rævlingevej · The Fox House",
                    "city": "Bindslev",
                    "quality_status": "educate",
                    "country_code": "DK",
                    "occupancies": [1, 2, 3, 4, 5, 6],
                    "synchronization_category": None,
                },
                {
                    "id": "1313677925363759741",
                    "type": "apartment",
                    "title": "011 Mosbjergvej 439 (kode 7811) · Fewo-Mosbjerg",
                    "city": "Sindal",
                    "quality_status": "good",
                    "country_code": "DK",
                    "occupancies": [1, 2],
                    "synchronization_category": None,
                },
            ]
        }
    }
}


def test_listings_aus_echter_antwort() -> None:
    werte = AirbnbUebernahmeMixin.airbnb_listings_aus_mapping_details(ECHTE_ANTWORT)
    assert len(werte) == 2
    assert werte[0]["id"] == "1133122057704952480"


def test_fehlender_schluessel_ist_fehler_keine_leere_uebernahme() -> None:
    """Wurzel 5: kein stilles „0 Objekte übernommen", wenn der Abruf misslang."""
    with pytest.raises(ChannelManagerError) as exc:
        AirbnbUebernahmeMixin.airbnb_listings_aus_mapping_details({"data": {}})
    assert exc.value.status_code == 502


def test_listing_zu_objekt_nimmt_nur_echte_felder() -> None:
    """max_guests = Maximum der `occupancies`; nichts erfunden (Wurzel 4).

    Währung und Zeitzone stehen dabei, weil sie aus dem `country_code` FOLGEN:
    Dänemark rechnet in DKK und liegt in Europe/Copenhagen. Das ist kein
    geratener Ersatzwert, sondern eine Tatsache über das Land — und ohne beides
    ging weder ein Preisplan (`rate_plans.currency` NOT NULL) noch die
    Aktivierung bei Channex („timezone required").
    """
    row = AirbnbUebernahmeMixin._listing_zu_objekt(  # noqa: SLF001
        ECHTE_ANTWORT["data"]["listing_id_dictionary"]["values"][0]
    )
    assert row == {
        "airbnb_listing_id": "1133122057704952480",
        "title": "013 Rævlingevej · The Fox House",
        "city": "Bindslev",
        "country": "DK",
        "max_guests": 6,
        "currency": "DKK",
        "timezone": "Europe/Copenhagen",
    }
    # Kein Preis, keine Adresse, keine Beschreibung — Airbnb liefert sie nicht.
    # (Live gemessen: `mapping_details` gibt genau sieben belegte Felder her.)
    assert not {"address", "postal_code", "description", "lat", "lng"} & set(row)


def test_mehrzoniges_land_bekommt_keine_zeitzone() -> None:
    """Spanien hat Europe/Madrid UND Atlantic/Canary — daraus darf nichts
    gespeichert werden, sonst verschiebt ein Objekt auf Teneriffa jede
    Automation um eine Stunde (Migration 0258 verlangt genau das). Die Währung
    ist dagegen eindeutig und kommt mit."""
    row = AirbnbUebernahmeMixin._listing_zu_objekt(  # noqa: SLF001
        {"id": "9", "title": "Casa Sol", "country_code": "ES", "city": "Adeje"}
    )
    assert row is not None
    assert row["currency"] == "EUR"
    assert "timezone" not in row


def test_unbekanntes_land_erfindet_keine_waehrung() -> None:
    """Wurzel 4: ohne bekannte Landeswährung bleibt das Feld leer — ein
    unterstelltes „EUR" auf einem Nicht-Euro-Objekt verkauft die Nacht im
    falschen Geld."""
    row = AirbnbUebernahmeMixin._listing_zu_objekt(  # noqa: SLF001
        {"id": "9", "title": "Haus", "country_code": "ZZ"}
    )
    assert row is not None
    assert "currency" not in row
    assert "timezone" not in row


def test_gepflegte_werte_werden_nicht_ueberschrieben() -> None:
    """Wurzel 1: der Kunde hat auf Teneriffa Atlantic/Canary gesetzt — ein
    erneuter Abruf darf das nicht auf die Landes-Hauptzone zurückdrehen."""
    gefiltert = AirbnbUebernahmeMixin._ohne_gepflegte_felder(  # noqa: SLF001
        {"title": "Casa", "currency": "EUR", "timezone": "Europe/Madrid"},
        {"currency": "EUR", "timezone": "Atlantic/Canary"},
    )
    assert gefiltert == {"title": "Casa"}


def test_leere_felder_werden_gefuellt() -> None:
    """Umkehrung: was leer ist, darf die Ableitung setzen."""
    gefiltert = AirbnbUebernahmeMixin._ohne_gepflegte_felder(  # noqa: SLF001
        {"title": "Casa", "currency": "DKK", "timezone": "Europe/Copenhagen"},
        {"currency": None, "timezone": ""},
    )
    assert gefiltert["currency"] == "DKK"
    assert gefiltert["timezone"] == "Europe/Copenhagen"


def test_listing_ohne_titel_wird_uebersprungen() -> None:
    assert AirbnbUebernahmeMixin._listing_zu_objekt(  # noqa: SLF001
        {"id": "1", "title": "  "}
    ) is None


def test_normalize_mapping_rooms_kennt_die_listing_form() -> None:
    """Der prepare-Pfad muss dieselbe Form verstehen, sonst bleibt die
    Zuordnungs-Maske leer."""
    rooms = ChannelsMixin._normalize_mapping_rooms(ECHTE_ANTWORT)  # noqa: SLF001
    assert [r["id"] for r in rooms] == [
        "1133122057704952480", "1313677925363759741",
    ]
    # Ein Listing hat keine Raten-Ebene: eine Rate je Listing, dieselbe ID.
    assert rooms[0]["rates"][0]["id"] == rooms[0]["id"]
    assert rooms[0]["rates"][0]["max_persons"] == 6
    assert rooms[1]["rates"][0]["max_persons"] == 2


def test_normalize_mapping_rooms_booking_form_bleibt_intakt() -> None:
    rooms = ChannelsMixin._normalize_mapping_rooms(  # noqa: SLF001
        {"data": {"rooms": [
            {"id": "R1", "title": "Doppel", "rates": [
                {"id": "RT1", "title": "Standard", "max_persons": 2},
            ]},
        ]}}
    )
    assert rooms[0]["id"] == "R1"
    assert rooms[0]["rates"][0]["id"] == "RT1"


class _FakeChannex:
    """Nur `get_channel`: liefert den Kanal-Zustand, den Channex live hatte."""

    def __init__(self, zustand: dict[str, bool]) -> None:
        self.zustand = zustand
        self.gefragt: list[str] = []

    def get_channel(self, channel_id: str) -> dict:
        self.gefragt.append(channel_id)
        tokens = (
            {"user_id": "529591717"} if self.zustand.get(channel_id) else None
        )
        return {"data": {"attributes": {
            "settings": {"tokens": tokens, "token_invalid": False}
            if tokens else {},
        }}}


class _Waehler(OAuthChannelsMixin):
    """Nur den Auswahl-Helfer testen, ohne DB/Service-Aufbau."""

    def __init__(self, channex: _FakeChannex) -> None:
        self._channex = channex


def test_autorisierter_kanal_gewinnt_gegen_leeren_zweitkanal() -> None:
    """Der REALE Fehler: für ein Objekt war ein zweiter, leerer Airbnb-Kanal
    entstanden, und dessen DB-Zeile zeigte darauf. Jeder weitere Versuch lief
    in den leeren Kanal, während die Autorisierung am ersten hing — die UI
    meldete endlos „warte auf die Bestätigung". Gewinnen muss der Kanal mit
    Tokens (Airbnb autorisiert das KONTO, also genau einen Kanal)."""
    mit_tokens = "9a46827b-7b6a-4be2-bbd6-611794f785fb"
    leer = "f729554c-7f78-4f1a-90f3-4e02bd4359ac"
    waehler = _Waehler(_FakeChannex({mit_tokens: True, leer: False}))
    assert waehler._autorisierter_kanal([leer, mit_tokens]) == mit_tokens  # noqa: SLF001


def test_kein_autorisierter_kanal_gibt_none() -> None:
    """Ohne Tokens gibt es keine Wahl — der Aufrufer nimmt dann seinen
    bisherigen Weg statt einen Kanal zu erfinden (Wurzel 4)."""
    waehler = _Waehler(_FakeChannex({"a": False, "b": False}))
    assert waehler._autorisierter_kanal(["a", "b"]) is None  # noqa: SLF001
