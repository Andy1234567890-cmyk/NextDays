"""Endpunkte: Objekt-Scope, Währungsregel, Verfügbarkeit, Buchung.

Die Endpunkte werden direkt als Funktionen gerufen statt über einen HTTP-Client.
Grund: der HTTP-Weg zöge Redis (Rate-Limit-Middleware) und damit eine
Infrastruktur in einen Test, der eine fachliche Regel prüfen soll. Was am
HTTP-Rand passiert — Statuscodes, problem+json, Header — ist in
`test_grenzen.py` abgedeckt.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from src.core import errors
from src.core.auth import ApiKontext
from src.v1 import availability as verf
from src.v1 import properties as objekte
from src.v1 import reservations as buchungen
from src.v1.schemas import BuchungAnlegen, Gast, SperrAnfrage

from .fake_db import FakeDB

_CTX = ApiKontext(
    tenant_id="t1",
    client_pk="c1",
    client_id="mnd_live_id_abc",
    scopes=["properties:read", "availability:write", "reservations:write"],
    property_ids=[],
)
_CTX_BESCHRAENKT = ApiKontext(
    tenant_id="t1",
    client_pk="c1",
    client_id="mnd_live_id_abc",
    scopes=["properties:read"],
    property_ids=["p1"],
)


def _basis_db() -> FakeDB:
    return FakeDB(
        {
            "properties": [
                {
                    "id": "p1",
                    "tenant_id": "t1",
                    "title": "Feriehus Kornblomst",
                    "status": "active",
                    "currency": "DKK",
                    "timezone": "Europe/Copenhagen",
                    "max_guests": 4,
                    "amenities": ["wifi"],
                    "photos": [],
                    "listed_on_marketplace": True,
                    "listed_on_website": False,
                    "created_at": "2026-01-01T00:00:00+00:00",
                    "updated_at": "2026-01-01T00:00:00+00:00",
                    "archived_at": None,
                },
                {
                    "id": "p2",
                    "tenant_id": "t1",
                    "title": "Zweites Objekt",
                    "status": "active",
                    "currency": "DKK",
                    "max_guests": 2,
                    "created_at": "2026-01-01T00:00:00+00:00",
                    "updated_at": "2026-01-01T00:00:00+00:00",
                    "archived_at": None,
                },
            ],
            "property_units": [
                {"id": "u1", "tenant_id": "t1", "property_id": "p1", "name": "A", "position": 0},
                {"id": "u2", "tenant_id": "t1", "property_id": "p1", "name": "B", "position": 1},
            ],
            "availability": [],
            "stop_sell": [],
            "rate_plans": [],
        }
    )


@pytest.fixture(autouse=True)
def _db(monkeypatch: pytest.MonkeyPatch) -> FakeDB:
    """Eine Nachbildung für alle Module, die `service_db` benutzen."""
    db = _basis_db()
    for modul in (objekte, verf, buchungen):
        monkeypatch.setattr(modul, "service_db", lambda: db)
    monkeypatch.setattr("src.core.db.service_db", lambda: db)
    monkeypatch.setattr("src.core.ari._job_einreihen", lambda *a, **k: None)
    return db


# ---------------------------------------------------------------------------
# Objekte
# ---------------------------------------------------------------------------
def test_objekt_liefert_einheiten_zahl() -> None:
    """`units_total` ist die Zahl der Einheiten — die Grundlage dafür, dass
    Verfügbarkeit eine Zahl und kein Ja/Nein ist."""
    o = objekte.detail("p1", _CTX)
    assert o.units_total == 2
    assert o.currency == "DKK"
    # Kanal-Sichtbarkeit ist PRO KANAL, es gibt kein globales „veröffentlicht".
    assert o.channels == {"marketplace": True, "website": False}


def test_beschraenkter_zugang_sieht_fremdes_objekt_nicht() -> None:
    """Der Detailpfad prüft dieselbe Beschränkung wie die Liste (Wurzel 9)."""
    with pytest.raises(errors.ApiFehler) as exc:
        objekte.detail("p2", _CTX_BESCHRAENKT)
    assert exc.value.status == 403
    assert exc.value.code == "objekt_nicht_erlaubt"


def test_objekt_ohne_waehrung_schlaegt_fehl(_db: FakeDB) -> None:
    """Kein erfundenes „EUR": eine fehlende Währung ist ein Datenfehler.

    Ein Ersatzwert würde in einem dänischen Betrieb Kronen als Euro ausgeben —
    Faktor 7,5.
    """
    _db.speicher["properties"][0]["currency"] = ""
    with pytest.raises(errors.ApiFehler) as exc:
        objekte.detail("p1", _CTX)
    assert exc.value.status == 422
    assert exc.value.code == "waehrung_fehlt"


def test_einheiten_ohne_zeile_sind_mindestens_eine(_db: FakeDB) -> None:
    """n >= 1 ist die Untergrenze des Modells, keine Erfindung."""
    _db.speicher["property_units"] = []
    assert objekte.detail("p1", _CTX).units_total == 1


# ---------------------------------------------------------------------------
# Verfügbarkeit
# ---------------------------------------------------------------------------
def test_freie_einheiten_sind_eine_zahl() -> None:
    antwort = verf.lesen(
        _CTX, property_id="p1", from_=date(2026, 9, 1), to=date(2026, 9, 3)
    )
    assert antwort["granularity"] == "spans"
    # Zwei Einheiten, nichts belegt → durchgehend 2.
    assert antwort["data"] == [
        {"from": "2026-09-01", "to": "2026-09-03", "units_available": 2}
    ]


def test_stop_sell_macht_null_frei(_db: FakeDB) -> None:
    """Ein Verkaufsstopp zählt 0, egal wie viele Einheiten der Kalender freihat.

    Genau hier lag der Live-Fehler vom 14.08.2026: der Stopp stand als
    Restriktion bei Channex, die Stückzahl meldete weiter 1, und Booking.com
    verkaufte.
    """
    _db.speicher["stop_sell"].append(
        {
            "id": "s1",
            "tenant_id": "t1",
            "property_id": "p1",
            "date": "2026-09-02",
            "rate_plan_id": None,
        }
    )
    antwort = verf.lesen(
        _CTX, property_id="p1", from_=date(2026, 9, 1), to=date(2026, 9, 3)
    )
    werte = {z["from"]: z["units_available"] for z in antwort["data"]}
    assert werte["2026-09-02"] == 0


def test_sperren_ueberschreibt_keine_buchung(_db: FakeDB) -> None:
    """Eine gebuchte Nacht wird übersprungen und gezählt, nicht überschrieben."""
    _db.speicher["availability"].append(
        {
            "id": "a1",
            "property_id": "p1",
            "unit_id": "u1",
            "date": "2026-09-02",
            "status": "booked",
        }
    )
    ergebnis = verf.setzen(
        SperrAnfrage(
            **{
                "property_id": "p1",
                "from": date(2026, 9, 1),
                "to": date(2026, 9, 3),
                "action": "block",
            }
        ),
        _CTX,
    )
    # 2 Einheiten × 3 Nächte = 6 Zeilen, eine davon gebucht → 5 gesetzt.
    assert ergebnis.nights_changed == 5
    assert ergebnis.nights_skipped == 1


def test_stop_sell_erlaubt_keine_einzelne_einheit() -> None:
    """Ein Verkaufsstopp gilt dem ganzen Objekt — sonst wäre er ein anderes
    Werkzeug mit demselben Namen."""
    with pytest.raises(errors.ApiFehler) as exc:
        verf.setzen(
            SperrAnfrage(
                **{
                    "property_id": "p1",
                    "from": date(2026, 9, 1),
                    "to": date(2026, 9, 2),
                    "action": "stop_sell",
                    "unit_id": "u1",
                }
            ),
            _CTX,
        )
    assert exc.value.status == 422


def test_fremde_einheit_wird_abgelehnt() -> None:
    """Eine geratene UUID darf nicht in einer Kalenderzeile landen (Wurzel 3)."""
    with pytest.raises(errors.ApiFehler) as exc:
        verf.setzen(
            SperrAnfrage(
                **{
                    "property_id": "p1",
                    "from": date(2026, 9, 1),
                    "to": date(2026, 9, 2),
                    "action": "block",
                    "unit_id": "fremde-einheit",
                }
            ),
            _CTX,
        )
    assert exc.value.status == 422


# ---------------------------------------------------------------------------
# Buchung
# ---------------------------------------------------------------------------
def _buchung(**abweichend: object) -> BuchungAnlegen:
    felder: dict = {
        "property_id": "p1",
        "check_in": date(2026, 9, 10),
        "check_out": date(2026, 9, 13),
        "total_amount": Decimal("4500"),
        "currency": "DKK",
        "adults": 2,
        "guest": Gast(first_name="Jens", last_name="Hansen", email="jens@example.dk"),
    }
    felder.update(abweichend)
    return BuchungAnlegen(**felder)


def test_falsche_waehrung_ist_422() -> None:
    """EUR gegen ein DKK-Objekt: kein stilles Umrechnen, kein stilles Übernehmen."""
    with pytest.raises(errors.ApiFehler) as exc:
        buchungen.anlegen(
            _buchung(currency="EUR"),
            _Antwort(),  # type: ignore[arg-type]
            _CTX,
            idempotency_key="schluessel-abcdef",
        )
    assert exc.value.status == 422
    assert exc.value.extra["property_currency"] == "DKK"


def test_fehlender_idempotency_key_ist_422() -> None:
    with pytest.raises(errors.ApiFehler) as exc:
        buchungen.anlegen(
            _buchung(), _Antwort(), _CTX, idempotency_key=None  # type: ignore[arg-type]
        )
    assert exc.value.status == 422


def test_zu_viele_gaeste_ist_422() -> None:
    """Säuglinge zählen nicht mit — so führen es Airbnb und Booking.com."""
    with pytest.raises(errors.ApiFehler) as exc:
        buchungen.anlegen(
            _buchung(adults=4, children=2, infants=3),
            _Antwort(),  # type: ignore[arg-type]
            _CTX,
            idempotency_key="schluessel-abcdef",
        )
    assert exc.value.status == 422
    assert exc.value.extra["max_guests"] == 4


def test_belegter_zeitraum_ist_409(_db: FakeDB) -> None:
    """Der Konflikt der Datenbankfunktion wird zu einem sprechenden 409 — nicht
    zu einem 500, der dem Client den Grund nimmt."""
    _db.rpc_fehler = RuntimeError("RS409 Zeitraum enthält bereits belegte Tage.")
    with pytest.raises(errors.ApiFehler) as exc:
        buchungen.anlegen(
            _buchung(), _Antwort(), _CTX, idempotency_key="schluessel-abcdef"  # type: ignore[arg-type]
        )
    assert exc.value.status == 409
    assert exc.value.code == "zeitraum_nicht_verfuegbar"


def test_buchung_geht_ueber_die_datenbankfunktion(_db: FakeDB) -> None:
    """Kein eigener Buchungspfad: gebucht wird über `create_reservation_atomic`,
    weil nur sie Kalender und Buchung in einer Transaktion setzt."""
    _db.rpc_antwort = {
        "reservation": {
            "id": "r1",
            "property_id": "p1",
            "unit_id": "u1",
            "guest_id": None,
            "status": "confirmed",
            "channel": "direct",
            "check_in": "2026-09-10",
            "check_out": "2026-09-13",
            "total_amount": "4500",
            "paid_amount": "0",
            "currency": "DKK",
            "adults": 2,
            "children": 0,
            "infants": 0,
            "pets": 0,
            "booked_at": None,
            "created_at": "2026-08-21T10:00:00+00:00",
            "updated_at": "2026-08-21T10:00:00+00:00",
        }
    }
    ergebnis = buchungen.anlegen(
        _buchung(), _Antwort(), _CTX, idempotency_key="schluessel-abcdef"  # type: ignore[arg-type]
    )
    assert ergebnis["id"] == "r1"
    assert ergebnis["nights"] == 3
    # Unsere Uhr ist NICHT der Buchungszeitpunkt des Gastes (Wurzel 5b).
    assert ergebnis["booked_at"] is None
    assert ergebnis["received_at"] == "2026-08-21T10:00:00Z"
    namen = [name for name, _ in _db.rpc_aufrufe]
    assert namen == ["create_reservation_atomic"]


def test_belegter_zeitraum_gibt_den_schluessel_frei(_db: FakeDB) -> None:
    """Nach einem 409 ist derselbe Idempotency-Key wieder nutzbar.

    Ohne die Freigabe bliebe der Anspruch ohne Antwort stehen, und jede
    Wiederholung bekäme dauerhaft 409 „läuft noch" — der Schlüssel wäre
    verbrannt, obwohl keine Buchung entstanden ist. Genau das soll der Client
    aber tun: denselben Schlüssel erneut senden, sobald die Nächte frei sind.
    """
    _db.rpc_fehler = RuntimeError("RS409 Zeitraum enthält bereits belegte Tage.")
    with pytest.raises(errors.ApiFehler):
        buchungen.anlegen(
            _buchung(), _Antwort(), _CTX, idempotency_key="schluessel-abcdef"  # type: ignore[arg-type]
        )
    assert _db.speicher.get("public_api_idempotency", []) == []


def test_serverfehler_behaelt_den_schluessel(_db: FakeDB) -> None:
    """Bei unklarem Ausgang bleibt der Schlüssel belegt (fail-closed).

    Hier KANN die Buchung entstanden sein — eine Wiederholung wäre eine zweite.
    Der Client bekommt 409 „läuft noch" und soll erst nachsehen.
    """
    # RPC antwortet ohne Reservierungszeile: der Endpunkt macht daraus 500
    # `buchung_unklar`, weil er nicht weiß, was passiert ist.
    _db.rpc_antwort = {}
    with pytest.raises(errors.ApiFehler) as exc:
        buchungen.anlegen(
            _buchung(), _Antwort(), _CTX, idempotency_key="schluessel-abcdef"  # type: ignore[arg-type]
        )
    assert exc.value.status == 500
    assert len(_db.speicher.get("public_api_idempotency", [])) == 1


class _Antwort:
    """Minimaler Ersatz für `fastapi.Response` (der Endpunkt setzt Header)."""

    def __init__(self) -> None:
        self.status_code = 200
        self.headers: dict[str, str] = {}
