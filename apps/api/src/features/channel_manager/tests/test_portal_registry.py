"""Die Portal-Registry und die Stellen, an denen sie einen Fehler verhindert.

Zweimal ist derselbe stille Fehler entstanden: Booking.com lief auf dem
Airbnb-Pfad, weil „woran erkennt dieses Portal ein Objekt" an mehreren Stellen
unabhängig beantwortet wurde. Diese Tests halten die Antwort fest — nicht die
Formulierung, sondern die Wirkung.
"""

from __future__ import annotations

from typing import Any

import pytest

from src.features.channel_manager.common import ChannelManagerError
from src.features.channel_manager.objekt_kanal import ObjektKanalMixin
from src.features.channel_manager.portal_registry import (
    AIRBNB,
    BOOKING,
    EXPEDIA,
    ist_airbnb,
    portal_profil,
)


def test_airbnb_erkennt_ueber_die_anzeige() -> None:
    """Airbnb: die Anzeige IST das Objekt, ihre Nummer steht am Objekt."""
    p = portal_profil(AIRBNB)
    assert p.kennung == "listing"
    assert p.settings_feld == "listing_id"
    assert p.kennung_tabelle == "properties"
    assert p.kennung_spalte == "airbnb_listing_id"
    assert p.oauth is True
    assert p.direktzugriff is True


def test_booking_erkennt_ueber_den_zimmertyp() -> None:
    """Booking.com verkauft Zimmertypen; die Kennung hängt an der VERBINDUNG.

    Der Unterschied ist nicht kosmetisch: dasselbe Objekt läuft bei zwei
    Portalen unter verschiedenen Kennungen, deshalb kann sie nicht am Objekt
    stehen.
    """
    p = portal_profil(BOOKING)
    assert p.kennung == "zimmertyp"
    assert p.settings_feld == "room_type_code"
    assert p.kennung_tabelle == "channex_channel_connection"
    assert p.kennung_spalte == "ota_room_type_code"
    # Kein OAuth, kein Direktzugriff — beides sind Airbnb-Sonderwege.
    assert p.oauth is False
    assert p.direktzugriff is False


def test_unbekanntes_portal_bekommt_nie_den_airbnb_weg() -> None:
    """Der Standard ist `zimmertyp`, nicht `listing`.

    Ein Portal, das wir nie angefasst haben, darf im Zweifel nicht auf Airbnbs
    Sonderweg laufen — dort wäre es sicher falsch. Genau diese Richtung des
    Fallbacks war der ursprüngliche Fehler.
    """
    for code in ("Agoda", "Hostelworld", "GoogleHotelARI", "VoellingUnbekannt"):
        p = portal_profil(code)
        assert p.kennung == "zimmertyp", code
        assert p.settings_feld == "room_type_code", code
        assert p.oauth is False, code
        assert p.direktzugriff is False, code


def test_kein_portal_ohne_code_faellt_auf_airbnb() -> None:
    assert portal_profil(None).kennung == "zimmertyp"
    assert portal_profil("").kennung == "zimmertyp"
    assert ist_airbnb(None) is False
    assert ist_airbnb("") is False
    assert ist_airbnb(BOOKING) is False
    assert ist_airbnb(EXPEDIA) is False
    assert ist_airbnb(AIRBNB) is True


class _FakeQuery:
    """Minimaler Supabase-Query-Doppelgänger: merkt sich Tabelle + Filter."""

    def __init__(self, protokoll: list[dict[str, Any]], tabelle: str,
                 daten: list[dict[str, Any]]) -> None:
        self._p = protokoll
        self._eintrag: dict[str, Any] = {"tabelle": tabelle, "filter": {}}
        self._daten = daten
        protokoll.append(self._eintrag)

    def select(self, spalten: str) -> _FakeQuery:
        self._eintrag["select"] = spalten
        return self

    def eq(self, spalte: str, wert: Any) -> _FakeQuery:
        self._eintrag["filter"][spalte] = wert
        return self

    def limit(self, _n: int) -> _FakeQuery:
        return self

    def execute(self) -> Any:
        return type("R", (), {"data": self._daten})()


class _FakeDb:
    def __init__(self, tabellen: dict[str, list[dict[str, Any]]]) -> None:
        self._tabellen = tabellen
        self.protokoll: list[dict[str, Any]] = []

    def table(self, name: str) -> _FakeQuery:
        return _FakeQuery(self.protokoll, name, self._tabellen.get(name, []))


def test_kennung_booking_kommt_aus_der_verbindung() -> None:
    """Bei Booking wird die Verbindungszeile gelesen, nicht das Objekt.

    Der Kern des zweiten stillen Fehlers: `_kanal_zuordnung_anlegen` las
    unbedingt `properties.airbnb_listing_id`. Hing das Objekt AUCH bei Airbnb,
    ging dessen Nummer an den Booking-Kanal.
    """
    db = _FakeDb({
        "properties": [{"airbnb_listing_id": "54087677"}],
        "channex_channel_connection": [{"ota_room_type_code": "1264579201"}],
    })
    kennung = ObjektKanalMixin._portal_objekt_kennung(
        db, "prop-1", portal_code=BOOKING, profil=portal_profil(BOOKING),
    )
    assert kennung == "1264579201"
    gelesen = db.protokoll[0]
    assert gelesen["tabelle"] == "channex_channel_connection"
    # Auf das Portal gescoped — sonst käme die Kennung eines fremden Portals.
    assert gelesen["filter"]["ota_portal_code"] == BOOKING
    assert gelesen["filter"]["property_id"] == "prop-1"


def test_kennung_airbnb_kommt_vom_objekt() -> None:
    db = _FakeDb({
        "properties": [{"airbnb_listing_id": "54087677"}],
        "channex_channel_connection": [{"ota_room_type_code": "1264579201"}],
    })
    kennung = ObjektKanalMixin._portal_objekt_kennung(
        db, "prop-1", portal_code=AIRBNB, profil=portal_profil(AIRBNB),
    )
    assert kennung == "54087677"
    assert db.protokoll[0]["tabelle"] == "properties"


def test_fehlende_kennung_ist_none_kein_ersatzwert() -> None:
    """Fehlt die Kennung, ist die Antwort None — nicht die eines anderen
    Portals und kein Platzhalter (Wurzel 4)."""
    db = _FakeDb({"channex_channel_connection": []})
    assert ObjektKanalMixin._portal_objekt_kennung(
        db, "prop-1", portal_code=BOOKING, profil=portal_profil(BOOKING),
    ) is None


class _NurKennung(ObjektKanalMixin):
    """Nur so viel Service, wie `_kanal_zuordnung_anlegen` wirklich braucht."""

    def __init__(self, db: _FakeDb, channex: Any) -> None:
        self._db = db
        self._channex = channex

    @staticmethod
    def _portal_label(portal_code: str) -> str:
        return {AIRBNB: "Airbnb", BOOKING: "Booking.com"}.get(
            portal_code, portal_code
        )


class _ChannexSpion:
    def __init__(self) -> None:
        self.aufrufe: list[tuple[str, str, dict[str, Any]]] = []

    def create_channel_mapping(
        self, channel_id: str, rate_plan_id: str, settings: dict[str, Any]
    ) -> None:
        self.aufrufe.append((channel_id, rate_plan_id, settings))


def test_zuordnung_booking_sendet_room_type_code() -> None:
    """Der eigentliche Regressionstest: die Zuordnung an einen Booking-Kanal
    trägt `room_type_code`, NIE `listing_id` — auch dann nicht, wenn das Objekt
    zusätzlich eine Airbnb-Nummer hat (der Normalfall bei Multi-Portal)."""
    db = _FakeDb({
        "rate_plans": [{"property_id": "prop-1"}],
        "properties": [{"airbnb_listing_id": "54087677"}],
        "channex_channel_connection": [{"ota_room_type_code": "1264579201"}],
    })
    spion = _ChannexSpion()
    _NurKennung(db, spion)._kanal_zuordnung_anlegen(
        db, "kanal-booking", "cx-rate-1", "lokal-1", portal_code=BOOKING,
    )
    assert spion.aufrufe == [
        ("kanal-booking", "cx-rate-1", {"room_type_code": "1264579201"})
    ]
    gesendet = spion.aufrufe[0][2]
    assert "listing_id" not in gesendet
    assert "54087677" not in str(gesendet)


def test_zuordnung_airbnb_sendet_listing_id() -> None:
    db = _FakeDb({
        "rate_plans": [{"property_id": "prop-1"}],
        "properties": [{"airbnb_listing_id": "54087677"}],
        "channex_channel_connection": [{"ota_room_type_code": "1264579201"}],
    })
    spion = _ChannexSpion()
    _NurKennung(db, spion)._kanal_zuordnung_anlegen(
        db, "kanal-airbnb", "cx-rate-1", "lokal-1", portal_code=AIRBNB,
    )
    assert spion.aufrufe == [
        ("kanal-airbnb", "cx-rate-1", {"listing_id": "54087677"})
    ]


def test_fehlermeldung_nennt_das_richtige_portal() -> None:
    """Ein Booking-Betrieb darf keine Airbnb-Anweisung bekommen.

    Vorher lautete die 422 wörtlich „Dieses Objekt ist bei Airbnb noch nicht
    zugeordnet … bei Airbnb ab" — auch dann, wenn der Betrieb gerade bei
    Booking.com einen Aufschlag setzen wollte.
    """
    db = _FakeDb({
        "rate_plans": [{"property_id": "prop-1"}],
        "channex_channel_connection": [],
    })
    spion = _ChannexSpion()
    with pytest.raises(ChannelManagerError) as fehler:
        _NurKennung(db, spion)._kanal_zuordnung_anlegen(
            db, "kanal-booking", "cx-rate-1", "lokal-1", portal_code=BOOKING,
        )
    assert "Booking.com" in fehler.value.message
    assert "Airbnb" not in fehler.value.message
    assert fehler.value.status_code == 422
    # Nichts gesendet, wenn die Kennung fehlt.
    assert spion.aufrufe == []
