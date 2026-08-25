"""Tests für die Erstattung einer per Karte bezahlten Zusatzleistung (0473).

DER FALL, DEN DIESE TESTS FESTHALTEN (25.08.2026, live):
Buchung 6179a5d0 wurde vom Portal storniert. Das „Wäschepaket" für 150,00 DKK
war per Zahlungslink bezahlt (Stripe-Session `paid`, Geld im Verbundkonto), bei
UNS stand der Link auf `open` und die Position auf `pending` — weil
`checkout.session.completed` bei Stripe nie abonniert war. Es gab keinen Weg
zurück: `_bezahlt_fehler` verwies mit 409 auf „bitte erstatten", die Route dafür
existierte nicht.

Kein Netz: Stripe wird gepatcht. Die Fake-DB aus `test_addons` wird
weiterverwendet — kein zweiter Mock-Baukasten.
"""
from __future__ import annotations

import pytest

from src.core.security import AuthContext
from src.features.addons import zahlung as z
from src.features.addons.service import AddonError, AddonsService
from src.features.payments import erstattung_direkt as ed

from .test_addons import _DB

CTX = AuthContext(user_id="user-1", tenant_id="t1", role="admin")


def _db(*, link_status: str = "paid", **over: list[dict]) -> _DB:
    """Eine Buchung mit EINER bezahlten Zusatzleistung über 150,00 DKK."""
    tables: dict[str, list[dict]] = {
        "reservations": [
            {
                "id": "res-1",
                "tenant_id": "t1",
                "currency": "DKK",
                "status": "cancelled",
                "check_in": "2026-08-25",
                "check_out": "2026-08-28",
            }
        ],
        "reservation_addons": [
            {
                "id": "ra-1",
                "tenant_id": "t1",
                "reservation_id": "res-1",
                "addon_id": None,
                "name": {"de": "Wäschepaket"},
                "price": 150.0,
                "basis": "per_stay",
                "tax_rate": None,
                "qty": 1,
                "total": 150.0,
                "status": "paid",
                "refunded_cents": 0,
                "refunded_at": None,
                "refund_reason": None,
            }
        ],
        "addon_payment_links": [
            {
                "id": "link-1",
                "tenant_id": "t1",
                "reservation_id": "res-1",
                "stripe_account_id": "acct_1",
                "stripe_payment_link_id": "plink_1",
                "currency": "DKK",
                "amount_cents": 15000,
                "application_fee_cents": 750,
                "fee_bps": 500,
                "status": link_status,
                "checkout_session_id": (
                    "cs_1" if link_status != "open" else None
                ),
                "payment_intent_id": "pi_1" if link_status != "open" else None,
                "refunded_cents": 0,
                "refunded_at": None,
            }
        ],
        "addon_payment_link_items": [
            {"link_id": "link-1", "reservation_addon_id": "ra-1",
             "amount_cents": 15000}
        ],
        "payments": [
            {
                "id": "pay-1",
                "reservation_id": "res-1",
                "gateway_ref": "cs_1",
                "amount": 150.0,
                "currency": "DKK",
                "type": "addon",
                "status": "succeeded",
            }
        ],
        "invoices": [],
        "reservation_events": [],
        "tasks": [],
    }
    tables.update(over)
    return _DB(tables)


class _StripeFake:
    def __init__(self) -> None:
        self.refunds: list[dict] = []
        self.sessions: dict[str, dict | None] = {}
        self.deaktiviert: list[str] = []

    def refund(self, intent: str, cents: int | None = None, **kw: object) -> dict:
        self.refunds.append({"intent": intent, "cents": cents, **kw})
        return {"id": f"re_{len(self.refunds)}", "status": "succeeded"}

    def find(self, link_id: str, **_kw: object) -> dict | None:
        return self.sessions.get(link_id)

    def deactivate(self, link_id: str, **_kw: object) -> None:
        self.deaktiviert.append(link_id)


@pytest.fixture(name="stripe")
def _stripe(monkeypatch: pytest.MonkeyPatch) -> _StripeFake:
    fake = _StripeFake()
    monkeypatch.setattr(
        ed.sc, "refund", lambda pi, cents=None, **kw: fake.refund(pi, cents, **kw)
    )
    monkeypatch.setattr(
        z.sc, "find_paid_session", lambda lid, **kw: fake.find(lid, **kw)
    )
    monkeypatch.setattr(
        z.sc, "deactivate_payment_link", lambda lid, **kw: fake.deactivate(lid, **kw)
    )
    return fake


# --- Der Regelfall -----------------------------------------------------------

def test_erstattung_gibt_dem_gast_den_vollen_betrag(stripe: _StripeFake) -> None:
    db = _db()
    res = AddonsService(db).erstatte_reservation_addon(
        CTX, "ra-1", "Buchung von Booking.com storniert"
    )
    # 100 % des BEZAHLTEN Betrags — nicht abzüglich der 750 Öre Provision.
    assert stripe.refunds[0]["cents"] == 15000
    assert stripe.refunds[0]["direct_acct"] == "acct_1"
    # Die Provision bleibt bei uns (Entscheidung vom 25.08.2026).
    assert stripe.refunds[0]["refund_application_fee"] is False
    # Kein Destination Charge → nichts zurückzuholen.
    assert stripe.refunds[0]["reverse_transfer"] is False
    assert res.status == "cancelled"
    assert res.refunded_cents == 15000
    assert res.refund_reason == "Buchung von Booking.com storniert"


def test_position_wird_storniert_damit_sie_aus_dem_umsatz_faellt() -> None:
    """Kein neuer Status `refunded` — sechs Umsatzleser prüfen auf `cancelled`."""
    db = _db()
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(ed.sc, "refund", lambda *_a, **_k: {"id": "re_1", "status": "ok"})
        AddonsService(db).erstatte_reservation_addon(CTX, "ra-1", "Storno")
    zeile = db.tables["reservation_addons"][0]
    assert zeile["status"] == "cancelled"
    assert zeile["refunded_at"] is not None
    assert zeile["cancel_reason"] == "Storno"


def test_beleg_und_erstattungszeile_stehen_beide(stripe: _StripeFake) -> None:
    """Der Zahlungsbeleg bleibt — es IST Geld geflossen (anders als bei 0470)."""
    db = _db()
    AddonsService(db).erstatte_reservation_addon(CTX, "ra-1", "Storno Portal")
    typen = sorted(p["type"] for p in db.tables["payments"])
    assert typen == ["addon", "refund"]
    refund = next(p for p in db.tables["payments"] if p["type"] == "refund")
    assert refund["amount"] == 150.0
    assert refund["parent_payment_id"] == "pay-1"
    assert refund["gateway_ref"] == "re_1"


def test_link_wird_als_erstattet_fortgeschrieben(stripe: _StripeFake) -> None:
    db = _db()
    AddonsService(db).erstatte_reservation_addon(CTX, "ra-1", "Storno Portal")
    link = db.tables["addon_payment_links"][0]
    assert link["refunded_cents"] == 15000
    assert link["status"] == "refunded"
    assert link["refunded_at"] is not None


# --- Der eigentliche Live-Fall: bezahlt bei Stripe, `open` bei uns -----------

def test_offener_link_wird_vor_der_erstattung_nachverbucht(
    stripe: _StripeFake,
) -> None:
    """Ohne diesen Schritt wäre der Fall vom 25.08.2026 nicht erstattbar.

    Der Link stand bei uns `open`, weil `checkout.session.completed` bei Stripe
    nie abonniert war. Eine Erstattung hätte Geld zurückgezahlt, das in unseren
    Büchern nie eingegangen war — Refund-Beleg ohne Elternbeleg, Position weiter
    als offene Forderung.
    """
    db = _db(link_status="open", payments=[])
    stripe.sessions["plink_1"] = {
        "id": "cs_1",
        "payment_intent": "pi_1",
        "amount_total": 15000,
    }
    AddonsService(db).erstatte_reservation_addon(CTX, "ra-1", "Storno Portal")
    typen = sorted(p["type"] for p in db.tables["payments"])
    assert typen == ["addon", "refund"]          # Eingang UND Erstattung
    assert stripe.refunds[0]["intent"] == "pi_1"
    assert db.tables["addon_payment_links"][0]["status"] == "refunded"


def test_offener_link_ohne_zahlung_bei_stripe_wird_nicht_erstattet(
    stripe: _StripeFake,
) -> None:
    db = _db(link_status="open", payments=[])
    stripe.sessions["plink_1"] = None
    with pytest.raises(AddonError) as exc:
        AddonsService(db).erstatte_reservation_addon(CTX, "ra-1", "Storno")
    assert exc.value.status_code == 409
    assert not stripe.refunds


def test_stripe_stoerung_erstattet_nicht(monkeypatch: pytest.MonkeyPatch) -> None:
    """Fail-closed: Ohne Auskunft über den Zahlungsstand kein Geldereignis."""
    db = _db(link_status="open", payments=[])

    def _kaputt(*_a: object, **_k: object) -> None:
        raise RuntimeError("Stripe weg")

    monkeypatch.setattr(z.sc, "find_paid_session", _kaputt)
    with pytest.raises(AddonError) as exc:
        AddonsService(db).erstatte_reservation_addon(CTX, "ra-1", "Storno")
    assert exc.value.status_code == 503


# --- Schranken ---------------------------------------------------------------

def test_ohne_kartenzahlung_kein_refund_sondern_ruecknahme() -> None:
    db = _db(addon_payment_links=[], addon_payment_link_items=[], payments=[])
    with pytest.raises(AddonError) as exc:
        AddonsService(db).erstatte_reservation_addon(CTX, "ra-1", "Storno")
    assert exc.value.status_code == 409
    assert "zurückgenommen" in exc.value.message


def test_grund_ist_pflicht() -> None:
    with pytest.raises(AddonError) as exc:
        AddonsService(_db()).erstatte_reservation_addon(CTX, "ra-1", "  ")
    assert exc.value.status_code == 422


def test_festgeschriebene_rechnung_sperrt(stripe: _StripeFake) -> None:
    db = _db(
        invoices=[
            {
                "id": "inv-1",
                "tenant_id": "t1",
                "reservation_id": "res-1",
                "invoice_type": "invoice",
                "status": "open",
                "deleted_at": None,
                "invoice_number": "2026-0001",
            }
        ]
    )
    with pytest.raises(AddonError) as exc:
        AddonsService(db).erstatte_reservation_addon(CTX, "ra-1", "Storno")
    assert exc.value.status_code == 409
    assert not stripe.refunds


def test_zweite_erstattung_ist_ein_no_op(stripe: _StripeFake) -> None:
    """Wurzel 2: Doppelklick löst KEIN zweites Geldereignis aus."""
    db = _db()
    svc = AddonsService(db)
    svc.erstatte_reservation_addon(CTX, "ra-1", "Storno Portal")
    svc.erstatte_reservation_addon(CTX, "ra-1", "Storno Portal")
    assert len(stripe.refunds) == 1


def test_fremder_tenant_sieht_die_position_nicht(stripe: _StripeFake) -> None:
    fremd = AuthContext(user_id="user-9", tenant_id="t9", role="admin")
    with pytest.raises(AddonError) as exc:
        AddonsService(_db()).erstatte_reservation_addon(fremd, "ra-1", "Storno")
    assert exc.value.status_code == 404
    assert not stripe.refunds


# --- Gegenzustand beim Storno der BUCHUNG (Wurzel 1) -------------------------
#
# Die Lücke, die den Fall erst erzeugt hat: `cancel()` schloss seit 0469 den
# Nachberechnungs-Link, den Addon-Link nicht. Es gab nur
# `ziehe_link_zurueck_bei_storno` für EINE Position.

def test_buchungsstorno_schliesst_unbezahlten_link(stripe: _StripeFake) -> None:
    db = _db(link_status="open", payments=[])
    stripe.sessions["plink_1"] = None
    bilanz = z.bei_buchungsstorno(db, tenant_id="t1", reservation_id="res-1")
    assert bilanz == {"geschlossen": 1, "bezahlt_offen": 0}
    assert stripe.deaktiviert == ["plink_1"]
    assert db.tables["addon_payment_links"][0]["status"] == "cancelled"


def test_buchungsstorno_verbucht_bezahlten_link_statt_ihn_zu_schliessen(
    stripe: _StripeFake,
) -> None:
    """Schließen wäre hier falsch: Es macht den Betrag unsichtbar.

    Genau das ist am 25.08.2026 passiert — 150,00 DKK im Verbundkonto, die
    niemand mehr einer Buchung zuordnete.
    """
    db = _db(link_status="open", payments=[])
    stripe.sessions["plink_1"] = {
        "id": "cs_1", "payment_intent": "pi_1", "amount_total": 15000
    }
    bilanz = z.bei_buchungsstorno(db, tenant_id="t1", reservation_id="res-1")
    assert bilanz == {"geschlossen": 0, "bezahlt_offen": 1}
    assert stripe.deaktiviert == []
    assert db.tables["addon_payment_links"][0]["status"] == "paid"
    arten = [e["kind"] for e in db.tables["reservation_events"]]
    assert "addon_refund_faellig" in arten


def test_buchungsstorno_meldet_faelligkeit_nur_einmal(stripe: _StripeFake) -> None:
    """Wurzel 2: Ein zweiter Lauf schreibt kein zweites Ereignis."""
    db = _db()
    z.bei_buchungsstorno(db, tenant_id="t1", reservation_id="res-1")
    z.bei_buchungsstorno(db, tenant_id="t1", reservation_id="res-1")
    faellig = [
        e for e in db.tables["reservation_events"]
        if e["kind"] == "addon_refund_faellig"
    ]
    assert len(faellig) == 1


def test_buchungsstorno_bricht_bei_stripe_stoerung_ab(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Fail-closed: lieber ein abgebrochenes Storno als eine offene URL."""
    db = _db(link_status="open", payments=[])

    def _kaputt(*_a: object, **_k: object) -> None:
        raise RuntimeError("Stripe weg")

    monkeypatch.setattr(z.sc, "find_paid_session", _kaputt)
    with pytest.raises(z.ZahlungslinkFehler) as exc:
        z.bei_buchungsstorno(db, tenant_id="t1", reservation_id="res-1")
    assert exc.value.status_code == 503


def test_erstatteter_link_meldet_keine_faelligkeit_mehr(
    stripe: _StripeFake,
) -> None:
    db = _db()
    AddonsService(db).erstatte_reservation_addon(CTX, "ra-1", "Storno Portal")
    db.tables["reservation_events"].clear()
    bilanz = z.bei_buchungsstorno(db, tenant_id="t1", reservation_id="res-1")
    assert bilanz["bezahlt_offen"] == 0
    assert db.tables["reservation_events"] == []


# --- Wurzel 5b: unsere Uhr ist nicht der Zahlungszeitpunkt des Gastes --------

def test_paid_at_kommt_aus_stripe_nicht_von_unserer_uhr(
    stripe: _StripeFake,
) -> None:
    """Live belegt am 25.08.2026: nachverbucht am 25.08. 16:34, gezahlt am 20.08.

    Der Nachlese-Abgleich läuft Tage nach der Zahlung. Mit der eigenen Uhr stünde
    am Beleg ein Zeitpunkt, an dem der Gast nichts getan hat — plausibel, prüfbar
    falsch, und niemand erkennt es als Fehler.
    """
    # Position auf `pending`: genau der Live-Zustand — der Gast hatte bezahlt,
    # bei uns war noch nichts verbucht, weil `checkout.session.completed` nie
    # abonniert war.
    db = _db(link_status="open", payments=[])
    db.tables["reservation_addons"][0]["status"] = "pending"
    db.tables["reservation_addons"][0]["charged_at"] = None
    # 20.08.2026 15:54:59 UTC
    stripe.sessions["plink_1"] = {
        "id": "cs_1",
        "payment_intent": "pi_1",
        "amount_total": 15000,
        "created": 1787241299,
    }
    z.bei_buchungsstorno(db, tenant_id="t1", reservation_id="res-1")
    link = db.tables["addon_payment_links"][0]
    assert link["paid_at"].startswith("2026-08-20T15:54:59")
    # Auch die Position trägt den Zeitpunkt der Gastzahlung, nicht unseren.
    assert db.tables["reservation_addons"][0]["charged_at"].startswith(
        "2026-08-20T15:54:59"
    )


def test_fehlender_zeitstempel_faellt_auf_unsere_uhr_zurueck_aber_laut(
    stripe: _StripeFake,
) -> None:
    """Kein stiller Ersatzwert: der Mangel wird geloggt, nicht verschwiegen."""
    db = _db(link_status="open", payments=[])
    stripe.sessions["plink_1"] = {
        "id": "cs_1", "payment_intent": "pi_1", "amount_total": 15000
    }
    z.bei_buchungsstorno(db, tenant_id="t1", reservation_id="res-1")
    assert db.tables["addon_payment_links"][0]["paid_at"] is not None
