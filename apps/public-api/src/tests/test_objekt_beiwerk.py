"""Zusatzleistungen, Konditionen, Kanäle, Zugangsdaten und Portal-Rohdaten.

Geprüft wird das, was hier leicht falsch wird:

* **Kein Betrag ohne Währung** — die Währung einer Zusatzleistung kommt vom
  Objekt und wird nicht erfunden (Wurzel 4).
* **Keine Sprache wird als eine andere ausgegeben** — ein leerer Text heißt
  „nicht übersetzt" und fällt weg, statt als leerer Name zu erscheinen.
* **Ohne gepflegte Kondition kommt nichts** statt einer erfundenen Staffel.
* **Die Objekt-Beschränkung gilt auf jedem dieser Pfade** (Wurzel 9).
* **Portal-Rohdaten trennen `booked_at` und `received_at`** (Wurzel 5b).
"""
from __future__ import annotations

import pytest

from src.core import errors
from src.core.auth import ApiKontext
from src.v1 import objekt_beiwerk as beiwerk
from src.v1 import reservations_verwalten as buchungen
from src.v1.schemas import ZugangsdatenSetzen

from .fake_db import FakeDB

_CTX = ApiKontext(
    tenant_id="t1",
    client_pk="c1",
    client_id="mnd_live_id_abc",
    scopes=["properties:read", "properties:write", "reservations:read"],
    property_ids=[],
)
_CTX_FREMD = ApiKontext(
    tenant_id="t1",
    client_pk="c1",
    client_id="mnd_live_id_abc",
    scopes=["properties:read", "properties:write", "reservations:read"],
    property_ids=["p9"],
)


def _db() -> FakeDB:
    return FakeDB(
        {
            "properties": [
                {
                    "id": "p1",
                    "tenant_id": "t1",
                    "currency": "DKK",
                    "status": "active",
                    "listed_on_marketplace": True,
                    "listed_on_website": False,
                }
            ],
            "property_addons": [
                {
                    "id": "a1",
                    "property_id": "p1",
                    "name": {"de": "Wäschepaket", "en": ""},
                    "description": {"de": "Frisch aus der Wäscherei", "en": ""},
                    "price": 150,
                    "basis": "per_stay",
                    "mandatory": False,
                    "tax_rate": 25,
                    "active": True,
                    "sort_order": 1,
                },
                {
                    "id": "a2",
                    "property_id": "p1",
                    "name": {"de": "Endreinigung", "en": "Final cleaning"},
                    "description": {},
                    "price": 400,
                    "basis": "per_stay",
                    "mandatory": True,
                    "tax_rate": None,
                    "active": False,
                    "sort_order": 2,
                },
            ],
            "rate_plans": [
                {
                    "id": "rp1",
                    "tenant_id": "t1",
                    "property_id": "p1",
                    "booking_condition_id": "bc1",
                }
            ],
            "booking_conditions": [
                {
                    "id": "bc1",
                    "tenant_id": "t1",
                    "internal_name": "Standard 30/70",
                    "is_default": True,
                    "installments": 2,
                    "first_payment_percent": 30,
                    "first_payment_timing": "at_booking",
                    "balance_days_before_arrival": 30,
                    "deposit_required": False,
                    "deposit_method": None,
                    "cancellation_mode": "staffel",
                }
            ],
            "booking_condition_refund_rules": [
                {
                    "id": "r1",
                    "condition_id": "bc1",
                    "days_before_arrival": 30,
                    "refund_percent": 100,
                },
                {
                    "id": "r2",
                    "condition_id": "bc1",
                    "days_before_arrival": 7,
                    "refund_percent": 50,
                },
            ],
            "channex_property_map": [
                {
                    "tenant_id": "t1",
                    "property_id": "p1",
                    "channex_property_id": "chx-1",
                    "sync_enabled": True,
                    "last_sync_at": "2026-08-20T09:00:00+00:00",
                    "last_sync_status": "ok",
                    "last_sync_error": None,
                    "deleted_at": None,
                }
            ],
            "property_guest_portal": [
                {
                    "id": "pg1",
                    "property_id": "p1",
                    "self_checkin": True,
                    "door_code": "4711",
                    "wifi_ssid": "Kornblomst",
                    "wifi_password": "sommer2026",
                    "show_code_only_if_paid": True,
                    "hide_code_until_checkin": False,
                    "code_visible_from": None,
                }
            ],
            "reservations": [
                {
                    "id": "r1",
                    "tenant_id": "t1",
                    "property_id": "p1",
                    "channel": "airbnb",
                    "ota_name": "Airbnb",
                    "external_ref": "HMABC123",
                    "booked_at": "2026-03-23T14:22:00+00:00",
                    "created_at": "2026-08-06T10:48:00+00:00",
                    "payment_collect": "ota",
                    "ota_commission": 320.50,
                    "ota_withheld_taxes": 41,
                    "ota_notes": None,
                    "ota_details": {"listing_id": "12345"},
                    "source_channex_booking_id": "chx-b-1",
                },
                {
                    "id": "r2",
                    "tenant_id": "t1",
                    "property_id": "p1",
                    "channel": "direct",
                    "ota_name": None,
                    "external_ref": None,
                    "booked_at": None,
                    "created_at": "2026-08-10T08:00:00+00:00",
                    "payment_collect": None,
                    "ota_commission": None,
                    "ota_withheld_taxes": None,
                    "ota_notes": None,
                    "ota_details": None,
                    "source_channex_booking_id": None,
                },
            ],
        }
    )


# -- Zusatzleistungen --------------------------------------------------------
def test_zusatzleistungen_nur_aktive_mit_objektwaehrung(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = _db()
    monkeypatch.setattr(beiwerk, "service_db", lambda: db)

    liste = beiwerk.zusatzleistungen("p1", _CTX)

    assert [z.id for z in liste] == ["a1"]
    assert liste[0].currency == "DKK"
    # Leere Sprachen fallen weg — sonst zeigt ein Client einen leeren Namen.
    assert liste[0].name == {"de": "Wäschepaket"}
    assert float(liste[0].tax_rate) == 25


def test_zusatzleistungen_mit_inaktiven(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db()
    monkeypatch.setattr(beiwerk, "service_db", lambda: db)

    liste = beiwerk.zusatzleistungen("p1", _CTX, include_inactive=True)
    assert {z.id for z in liste} == {"a1", "a2"}
    # Eine Leistung ohne jede Übersetzung liefert ein leeres Objekt, kein None.
    zwei = next(z for z in liste if z.id == "a2")
    assert zwei.description is None
    assert zwei.name == {"de": "Endreinigung", "en": "Final cleaning"}


def test_zusatzleistungen_ohne_objektwaehrung_schlagen_fehl(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = _db()
    db.speicher["properties"][0]["currency"] = None
    monkeypatch.setattr(beiwerk, "service_db", lambda: db)

    with pytest.raises(errors.ApiFehler) as fehler:
        beiwerk.zusatzleistungen("p1", _CTX)
    assert fehler.value.status == 422


def test_beiwerk_prueft_objektbeschraenkung(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db()
    monkeypatch.setattr(beiwerk, "service_db", lambda: db)

    with pytest.raises(errors.ApiFehler) as fehler:
        beiwerk.zusatzleistungen("p1", _CTX_FREMD)
    assert fehler.value.status == 403


# -- Konditionen -------------------------------------------------------------
def test_konditionen_ueber_rate_plan(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db()
    monkeypatch.setattr(beiwerk, "service_db", lambda: db)

    k = beiwerk.konditionen("p1", _CTX, rate_plan_id="rp1")

    assert k.name == "Standard 30/70"
    assert k.installments == 2
    # Absteigend: die großzügigste Stufe zuerst.
    assert [r.days_before for r in k.refund_rules] == [30, 7]


def test_konditionen_ohne_gepflegte_kondition_ist_leer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Keine erfundene Staffel — `null` heißt: keine Zusage."""
    db = _db()
    db.speicher["booking_conditions"] = []
    monkeypatch.setattr(beiwerk, "service_db", lambda: db)

    k = beiwerk.konditionen("p1", _CTX)
    assert k.name is None
    assert k.refund_rules == []
    assert k.deposit_required is False


def test_konditionen_fremder_rate_plan_ist_404(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db()
    db.speicher["rate_plans"][0]["property_id"] = "p2"
    monkeypatch.setattr(beiwerk, "service_db", lambda: db)

    with pytest.raises(errors.ApiFehler) as fehler:
        beiwerk.konditionen("p1", _CTX, rate_plan_id="rp1")
    assert fehler.value.status == 404


# -- Kanäle ------------------------------------------------------------------
def test_kanaele_drei_getrennte_schalter(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db()
    monkeypatch.setattr(beiwerk, "service_db", lambda: db)

    kanaele = {k.channel: k for k in beiwerk.kanaele("p1", _CTX)}

    assert kanaele["portale"].enabled is True
    assert kanaele["portale"].external_id == "chx-1"
    assert kanaele["marktplatz"].enabled is True
    # Kein globales „veröffentlicht": die eigene Website ist hier aus.
    assert kanaele["website"].enabled is False


def test_kanaele_ohne_portalanbindung(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db()
    db.speicher["channex_property_map"] = []
    monkeypatch.setattr(beiwerk, "service_db", lambda: db)

    kanaele = {k.channel for k in beiwerk.kanaele("p1", _CTX)}
    assert kanaele == {"marktplatz", "website"}


# -- Zugangsdaten ------------------------------------------------------------
def test_zugang_lesen_und_setzen(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db()
    monkeypatch.setattr(beiwerk, "service_db", lambda: db)

    vorher = beiwerk.zugang_lesen("p1", _CTX)
    assert vorher.door_code == "4711"

    nachher = beiwerk.zugang_setzen(
        "p1", ZugangsdatenSetzen(door_code="0815"), _CTX
    )
    assert nachher.door_code == "0815"
    # Nicht mitgeschickt → unverändert.
    assert nachher.wifi_ssid == "Kornblomst"


def test_zugang_ohne_vorhandene_zeile_legt_an(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db()
    db.speicher["property_guest_portal"] = []
    monkeypatch.setattr(beiwerk, "service_db", lambda: db)

    # Kein Fehler beim Lesen: ein Objekt ohne Selbst-Check-in hat keine Zeile.
    assert beiwerk.zugang_lesen("p1", _CTX).door_code is None

    beiwerk.zugang_setzen("p1", ZugangsdatenSetzen(door_code="1234"), _CTX)
    assert len(db.speicher["property_guest_portal"]) == 1


def test_zugang_setzen_ohne_felder_ist_422(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db()
    monkeypatch.setattr(beiwerk, "service_db", lambda: db)

    with pytest.raises(errors.ApiFehler) as fehler:
        beiwerk.zugang_setzen("p1", ZugangsdatenSetzen(), _CTX)
    assert fehler.value.status == 422


# -- Portal-Rohdaten ---------------------------------------------------------
def test_portal_rohdaten_trennt_die_zeitpunkte(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`booked_at` ist die Uhr des Gastes, `received_at` unsere (Wurzel 5b)."""
    db = _db()
    monkeypatch.setattr(buchungen, "service_db", lambda: db)

    roh = buchungen.portal_rohdaten("r1", _CTX)

    assert roh.booked_at is not None
    assert roh.received_at is not None
    assert roh.booked_at != roh.received_at
    assert roh.ota_name == "Airbnb"
    assert float(roh.commission) == 320.50
    assert roh.details == {"listing_id": "12345"}


def test_portal_rohdaten_bei_direktbuchung_ist_404(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = _db()
    monkeypatch.setattr(buchungen, "service_db", lambda: db)

    with pytest.raises(errors.ApiFehler) as fehler:
        buchungen.portal_rohdaten("r2", _CTX)
    assert fehler.value.status == 404
