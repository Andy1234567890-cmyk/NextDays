"""„Pausieren"/„Aktivieren" auf der Kanalseite schalten EIN Objekt an EINEM Portal.

Anlass (06.09.2026): `set_connection_active` rief `deactivate_channel` auf den
Channex-Kanal. Bei Airbnb ist der Kanal das KONTO — an `9a46827b…` hängen 18
Anzeigen. „Pausieren" an „Feriehus Merete" hätte alle 18 gestoppt; live
verhinderte das nur Channex' 422 „remove mappings before". Seitdem läuft der
Weg über die Hebel aus `objekt_verkauf`: Airbnb → NUR diese Anzeige
(`execute/unpublish` + Rücklesen), Booking & Co. → der Kanal, nach Zählung.
"""
from __future__ import annotations

from typing import Any

import pytest

from src.features.channel_manager.common import ChannelManagerError
from src.features.channel_manager.objekt_verkauf import ObjektVerkaufMixin

TENANT = "t1"
PROPERTY = "p1"
KANAL = "kanal-airbnb"
MAPPING = "mapping-77"
LISTING = "1768745828195736148"


class _Ctx:
    tenant_id = TENANT
    user_id = "u1"


class _Tabelle:
    """Merkt sich, was geschrieben wird; liefert je Tabelle vorbereitete Zeilen."""

    def __init__(self, db: _Db, name: str) -> None:
        self._db = db
        self._name = name
        self._filter: dict[str, Any] = {}
        self._schreibt: dict[str, Any] | None = None
        self._loescht = False

    def select(self, *_a: Any) -> _Tabelle:
        return self

    def eq(self, feld: str, wert: Any) -> _Tabelle:
        self._filter[feld] = wert
        return self

    def is_(self, *_a: Any) -> _Tabelle:
        return self

    def order(self, *_a: Any) -> _Tabelle:
        return self

    def limit(self, *_a: Any) -> _Tabelle:
        return self

    def update(self, werte: dict[str, Any]) -> _Tabelle:
        self._schreibt = werte
        return self

    def insert(self, werte: dict[str, Any]) -> _Tabelle:
        self._db.inserts.append((self._name, werte))
        return self

    def delete(self) -> _Tabelle:
        self._loescht = True
        return self

    def execute(self) -> Any:
        if self._schreibt is not None:
            self._db.updates.append((self._name, dict(self._filter), self._schreibt))
            return type("R", (), {"data": [self._schreibt]})()
        if self._loescht:
            self._db.deletes.append((self._name, dict(self._filter)))
            return type("R", (), {"data": []})()
        return type("R", (), {"data": self._db.zeilen.get(self._name, [])})()


class _Db:
    def __init__(self, zeilen: dict[str, list[dict[str, Any]]]) -> None:
        self.zeilen = zeilen
        self.updates: list[tuple[str, dict[str, Any], dict[str, Any]]] = []
        self.inserts: list[tuple[str, dict[str, Any]]] = []
        self.deletes: list[tuple[str, dict[str, Any]]] = []

    def table(self, name: str) -> _Tabelle:
        return _Tabelle(self, name)


class _Channex:
    """Zeichnet auf, was an Channex geht — und liefert den Kanal so, wie er
    nach dem Schalten aussehen soll."""

    def __init__(self, published: bool) -> None:
        self.published = published
        self.deaktiviert: list[str] = []
        self.aktiviert: list[str] = []
        self.geschaltet: list[tuple[str, str, bool]] = []

    def get_channel(self, _channel_id: str) -> dict[str, Any]:
        return {"data": {"attributes": {
            "is_active": True,
            "properties": ["cx-p1", "cx-p2", "cx-p3"],
            "rate_plans": [
                {"id": MAPPING, "rate_plan_id": "rp-own",
                 "settings": {"listing_id": LISTING, "published": self.published}},
                {"id": "mapping-fremd", "rate_plan_id": "rp-fremd",
                 "settings": {"listing_id": "999", "published": True}},
            ],
        }}}

    def deactivate_channel(self, channel_id: str) -> None:
        self.deaktiviert.append(channel_id)

    def activate_channel(self, channel_id: str) -> None:
        self.aktiviert.append(channel_id)

    def set_listing_published(
        self, channel_id: str, listing_id: str, *, published: bool
    ) -> None:
        self.geschaltet.append((channel_id, listing_id, published))
        self.published = published


class _Dienst(ObjektVerkaufMixin):
    def __init__(self, db: _Db, channex: _Channex) -> None:
        self._db = db
        self._channex = channex
        self.trace: list[str] = []

    def _require_tenant(self, _ctx: Any) -> str:
        return TENANT

    def _require_db(self) -> _Db:
        return self._db

    def _trace_step(self, **kw: Any) -> None:
        self.trace.append(kw["step"])

    def _portal_label(self, code: str | None) -> str:
        return {"AirBNB": "Airbnb", "BookingCom": "Booking.com"}.get(code or "", "?")

    def _channex_rate_plan_ids(self, *_a: Any) -> set[str]:
        return {"rp-own"}

    def full_sync_property(self, *_a: Any, **_kw: Any) -> None:
        return None


def _verbindung(portal: str = "AirBNB", channex_property_id: str = "cx-p1") -> dict:
    return {
        "id": "conn-1", "ota_portal_code": portal, "channex_channel_id": KANAL,
        "channex_property_id": channex_property_id, "is_active": True,
        "ota_hotel_id": None,
    }


def test_airbnb_pausieren_zieht_nur_die_anzeige_zurueck() -> None:
    db = _Db({"channex_channel_connection": [_verbindung()], "property_sales_pause": []})
    cx = _Channex(published=True)
    dienst = _Dienst(db, cx)

    raus = dienst.portal_verkauf_schalten(
        _Ctx(), property_id=PROPERTY, portal_code="AirBNB", aktiv=False
    )

    # Der Kanal (= das Konto mit allen Anzeigen) bleibt unangetastet.
    assert cx.deaktiviert == []
    # Geschaltet wird GENAU diese Anzeige.
    assert cx.geschaltet == [(KANAL, LISTING, False)]
    assert raus["is_active"] is False and raus["portal"] == "Airbnb"
    # Vorzustand gesichert — „Verkauf fortsetzen" am Objekt findet ihn.
    assert db.inserts and db.inserts[0][0] == "property_sales_pause"
    assert db.inserts[0][1]["war_aktiv"] is True
    assert db.inserts[0][1]["channex_mapping_id"] == MAPPING
    # Die Verbindungszeile trägt den gelesenen Stand.
    assert any(
        t == "channex_channel_connection" and w == {"is_active": False}
        for t, _f, w in db.updates
    )


def test_airbnb_aktivieren_nutzt_die_gesicherte_pause() -> None:
    pause = {
        "id": "pause-1", "property_id": PROPERTY, "portal_code": "AirBNB",
        "hebel": "mapping_published", "channex_channel_id": KANAL,
        "channex_mapping_id": MAPPING, "war_aktiv": True,
    }
    db = _Db({
        "channex_channel_connection": [_verbindung()],
        "property_sales_pause": [pause],
    })
    cx = _Channex(published=False)
    dienst = _Dienst(db, cx)

    raus = dienst.portal_verkauf_schalten(
        _Ctx(), property_id=PROPERTY, portal_code="AirBNB", aktiv=True
    )

    assert cx.aktiviert == []
    assert cx.geschaltet == [(KANAL, LISTING, True)]
    assert raus["is_active"] is True
    # Die Pause ist geschlossen, nicht gelöscht.
    assert any(
        t == "property_sales_pause" and "beendet_at" in w for t, _f, w in db.updates
    )


def test_airbnb_aktivieren_ohne_pause_schaltet_direkt() -> None:
    """Vor dem 06.09.2026 pausiert (Kanal-Weg) oder am Portal selbst
    zurückgezogen: keine Pause gespeichert — der Betrieb will es trotzdem an."""
    db = _Db({"channex_channel_connection": [_verbindung()], "property_sales_pause": []})
    cx = _Channex(published=False)
    dienst = _Dienst(db, cx)

    raus = dienst.portal_verkauf_schalten(
        _Ctx(), property_id=PROPERTY, portal_code="AirBNB", aktiv=True
    )
    assert cx.geschaltet == [(KANAL, LISTING, True)]
    assert raus["is_active"] is True


def test_portal_zieht_nicht_mit_ist_ein_fehler_kein_stiller_erfolg() -> None:
    """Channex quittiert `execute/*` immer mit 200 — es zählt die Rücklesung.
    Bleibt `published` stehen, darf die Zeile NICHT „Pausiert" zeigen."""
    class _Stur(_Channex):
        def set_listing_published(self, *a: Any, **kw: Any) -> None:  # noqa: ARG002
            self.geschaltet.append(("stur", "", False))  # ändert `published` NICHT

    db = _Db({"channex_channel_connection": [_verbindung()], "property_sales_pause": []})
    dienst = _Dienst(db, _Stur(published=True))

    with pytest.raises(ChannelManagerError) as fehler:
        dienst.portal_verkauf_schalten(
            _Ctx(), property_id=PROPERTY, portal_code="AirBNB", aktiv=False
        )
    assert "nicht übernommen" in fehler.value.message
    # Die verwaiste Pause ist weg (Wurzel 1) und die Zeile blieb unberührt.
    assert db.deletes and db.deletes[0][0] == "property_sales_pause"
    assert not any(t == "channex_channel_connection" for t, _f, _w in db.updates)


def test_geteilter_kanal_wird_nicht_abgeschaltet() -> None:
    """Booking & Co. laufen über den Kanal — aber nur, wenn er NUR dieses Objekt
    trägt. Drei Objekte am Kanal: Fehler an den Betrieb, nichts geändert."""
    db = _Db({
        "channex_channel_connection": [_verbindung("BookingCom")],
        "property_sales_pause": [],
    })
    cx = _Channex(published=True)
    dienst = _Dienst(db, cx)

    with pytest.raises(ChannelManagerError) as fehler:
        dienst.portal_verkauf_schalten(
            _Ctx(), property_id=PROPERTY, portal_code="BookingCom", aktiv=False
        )
    assert "3 Objekte" in fehler.value.message
    assert cx.deaktiviert == []


def test_getrennte_verbindung_laesst_sich_nicht_aktivieren() -> None:
    zeile = {**_verbindung(), "channex_channel_id": None}
    db = _Db({"channex_channel_connection": [zeile], "property_sales_pause": []})
    dienst = _Dienst(db, _Channex(published=False))

    with pytest.raises(ChannelManagerError) as fehler:
        dienst.portal_verkauf_schalten(
            _Ctx(), property_id=PROPERTY, portal_code="AirBNB", aktiv=True
        )
    assert fehler.value.status_code == 409
    assert "neu verbinden" in fehler.value.message


def test_ohne_zuordnung_gibt_es_nichts_zu_schalten() -> None:
    class _OhneEigene(_Dienst):
        def _channex_rate_plan_ids(self, *_a: Any) -> set[str]:
            return set()

    db = _Db({"channex_channel_connection": [_verbindung()], "property_sales_pause": []})
    dienst = _OhneEigene(db, _Channex(published=True))

    with pytest.raises(ChannelManagerError) as fehler:
        dienst.portal_verkauf_schalten(
            _Ctx(), property_id=PROPERTY, portal_code="AirBNB", aktiv=False
        )
    assert fehler.value.status_code == 409
    assert "keiner Anzeige" in fehler.value.message
    # Keine Zeile auf „Pausiert" gedreht.
    assert not any(t == "channex_channel_connection" for t, _f, _w in db.updates)
