"""Provision aus `invoice.paid` — was gebucht wird, was nicht, und dass nie doppelt.

Der teuerste Fehler dieses Slices ist eine Provision auf Geld, das kein
Abo-Umsatz ist (OTA-Provisionsposten auf derselben Rechnung), oder dieselbe
Rechnung zweimal. Beides steht hier fest.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

import pytest

from src.features.affiliates import provision as prov

from .fakedb import FakeDb

AFF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
TEN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
REF = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
PAID_AT = int(datetime(2026, 9, 1, 10, 0, tzinfo=UTC).timestamp())

TIERS = [
    {
        "id": "einsteiger",
        "name": "Einsteiger",
        "min_customers": 0,
        "max_customers": 4,
        "rate": "0.1500",
        "lifetime_rate": "0",
        "team_allowed": False,
        "sort": 1,
    },
    {
        "id": "aufsteiger",
        "name": "Aufsteiger",
        "min_customers": 5,
        "max_customers": 9,
        "rate": "0.2000",
        "lifetime_rate": "0",
        "team_allowed": True,
        "sort": 2,
    },
    {
        "id": "experte",
        "name": "Experte",
        "min_customers": 10,
        "max_customers": 19,
        "rate": "0.2500",
        "lifetime_rate": "0",
        "team_allowed": True,
        "sort": 3,
    },
    {
        "id": "elite",
        "name": "Elite-Partner",
        "min_customers": 20,
        "max_customers": None,
        "rate": "0.3000",
        "lifetime_rate": "0.0250",
        "team_allowed": True,
        "sort": 4,
    },
]


def _db(
    *, referral_status: str = "pending", partner_status: str = "approved", tier: str = "einsteiger"
) -> FakeDb:
    return FakeDb(
        {
            "affiliate_tiers": TIERS,
            "affiliates": [
                {
                    "id": AFF,
                    "email": "p@partner.example",
                    "full_name": "Pia Partner",
                    "language": "de",
                    "status": partner_status,
                    "current_tier_id": tier,
                }
            ],
            "tenant_subscription": [
                {"tenant_id": TEN, "stripe_customer_id": "cus_1", "status": "active"}
            ],
            "affiliate_referrals": [
                {
                    "id": REF,
                    "affiliate_id": AFF,
                    "tenant_id": TEN,
                    "status": referral_status,
                    "first_paid_at": None,
                    "commission_until": None,
                    "created_at": "2026-08-01T00:00:00+00:00",
                }
            ],
        }
    )


def _line(amount: int, *, abo: bool = True, rabatt: int = 0, steuer_inkl: int = 0) -> dict:
    return {
        "amount": amount,
        "parent": {"type": "subscription_item_details" if abo else "invoice_item_details"},
        "discount_amounts": [{"amount": rabatt}] if rabatt else [],
        "taxes": [{"amount": steuer_inkl, "tax_behavior": "inclusive"}] if steuer_inkl else [],
    }


def _invoice(
    lines: list[dict],
    *,
    invoice_id: str = "in_1",
    period_start: int = PAID_AT,
    paid_at: int = PAID_AT,
) -> dict:
    return {
        "id": invoice_id,
        "customer": "cus_1",
        "currency": "dkk",
        "period_start": period_start,
        "status_transitions": {"paid_at": paid_at},
        "lines": {"data": lines, "has_more": False},
        "payments": {"data": [{"payment": {"charge": "ch_1", "payment_intent": "pi_1"}}]},
    }


# --- Basis ---------------------------------------------------------------------


def test_basis_nur_abo_positionen_netto() -> None:
    """OTA-Provisionsposten (invoice_item) zählen nicht; Rabatt und inklusive
    Steuer werden abgezogen."""
    lines = [
        _line(19900, rabatt=1900, steuer_inkl=3600),  # Grundtarif
        _line(2990),  # Modul
        _line(48000, abo=False),  # OTA-Provision des Vormonats
    ]
    assert prov.abo_basis_cents(lines) == 19900 - 1900 - 3600 + 2990


def test_basis_legacy_line_type() -> None:
    assert (
        prov.abo_basis_cents(
            [{"type": "subscription", "amount": 1000}, {"type": "invoiceitem", "amount": 999}]
        )
        == 1000
    )


def test_plus_monate_kappt_monatsende() -> None:
    start = datetime(2026, 1, 31, 12, 0, tzinfo=UTC)
    assert prov.plus_monate(start, 1) == datetime(2026, 2, 28, 12, 0, tzinfo=UTC)
    assert prov.plus_monate(start, 12) == datetime(2027, 1, 31, 12, 0, tzinfo=UTC)


# --- Buchung -------------------------------------------------------------------


def test_erste_rechnung_startet_laufzeit_und_bucht_mit_rangsatz() -> None:
    db = _db()
    ergebnis = prov.verbuche_rechnung(
        db, _invoice([_line(20000)]), event_id="evt_1", lines_loader=None
    )
    assert ergebnis == "gebucht"
    zeile = db.zeilen("affiliate_commissions")[0]
    assert zeile["kind"] == "earn"
    assert Decimal(zeile["base_amount"]) == Decimal("200.00")
    assert zeile["rate"] == "0.1500"
    assert Decimal(zeile["amount"]) == Decimal("30.00")
    assert zeile["currency"] == "DKK"
    assert zeile["status"] == "pending"
    assert zeile["stripe_charge_id"] == "ch_1"
    ref = db.zeilen("affiliate_referrals")[0]
    assert ref["first_paid_at"].startswith("2026-09-01")
    assert ref["commission_until"].startswith("2027-09-01")
    assert ref["status"] == "approved"


def test_dieselbe_rechnung_wird_nie_zweimal_gebucht() -> None:
    db = _db()
    prov.verbuche_rechnung(db, _invoice([_line(20000)]), event_id="evt_1", lines_loader=None)
    ergebnis = prov.verbuche_rechnung(
        db, _invoice([_line(20000)]), event_id="evt_1_retry", lines_loader=None
    )
    assert ergebnis == "duplikat"
    assert len(db.zeilen("affiliate_commissions")) == 1


def test_nach_zwoelf_monaten_keine_provision_mehr() -> None:
    db = _db(referral_status="approved")
    db.zeilen("affiliate_referrals")[0].update(
        {
            "first_paid_at": "2025-08-01T00:00:00+00:00",
            "commission_until": "2026-08-01T00:00:00+00:00",
        }
    )
    ergebnis = prov.verbuche_rechnung(
        db, _invoice([_line(20000)]), event_id="evt_2", lines_loader=None
    )
    assert ergebnis == "ausgelaufen"
    assert db.zeilen("affiliate_commissions") == []


def test_rechnung_ohne_abo_position_bucht_nichts() -> None:
    db = _db()
    ergebnis = prov.verbuche_rechnung(
        db, _invoice([_line(48000, abo=False)]), event_id="evt_3", lines_loader=None
    )
    assert ergebnis == "leer"
    assert db.zeilen("affiliate_commissions") == []


def test_gehaltene_zuordnung_bucht_held() -> None:
    db = _db(referral_status="held")
    ergebnis = prov.verbuche_rechnung(
        db, _invoice([_line(20000)]), event_id="evt_4", lines_loader=None
    )
    assert ergebnis == "gebucht_held"
    assert db.zeilen("affiliate_commissions")[0]["status"] == "held"


def test_betrieb_ohne_partner_ist_kein_fall() -> None:
    db = _db()
    db.rows["affiliate_referrals"] = []
    assert (
        prov.verbuche_rechnung(db, _invoice([_line(20000)]), event_id="evt_5", lines_loader=None)
        == "kein_partner"
    )


def test_rechnung_ohne_zeitpunkt_wird_abgelehnt() -> None:
    db = _db()
    inv = _invoice([_line(20000)])
    inv["status_transitions"] = {}
    inv.pop("created", None)
    with pytest.raises(ValueError, match="Zahlungszeitpunkt"):
        prov.verbuche_rechnung(db, inv, event_id="evt_6", lines_loader=None)


def test_has_more_laedt_alle_positionen_nach() -> None:
    db = _db()
    inv = _invoice([_line(100)])
    inv["lines"]["has_more"] = True
    geladen = [_line(100), _line(20000)]
    prov.verbuche_rechnung(db, inv, event_id="evt_7", lines_loader=lambda _id: geladen)
    assert Decimal(db.zeilen("affiliate_commissions")[0]["base_amount"]) == Decimal("201.00")


def test_rangsatz_kommt_aus_der_tabelle() -> None:
    db = _db(tier="elite")
    prov.verbuche_rechnung(db, _invoice([_line(10000)]), event_id="evt_8", lines_loader=None)
    zeile = db.zeilen("affiliate_commissions")[0]
    assert zeile["rate"] == "0.3000"
    assert Decimal(zeile["amount"]) == Decimal("30.00")


# --- Gegenbuchung ---------------------------------------------------------------


def _mit_ertrag() -> FakeDb:
    db = _db()
    prov.verbuche_rechnung(db, _invoice([_line(20000)]), event_id="evt_1", lines_loader=None)
    return db


def test_teilerstattung_bucht_anteil_gegen() -> None:
    db = _mit_ertrag()
    charge = {"id": "ch_1", "payment_intent": "pi_1", "amount": 20000, "amount_refunded": 5000}
    prov.storniere_fuer_charge(db, charge, event_id="evt_r1")
    zeilen = db.zeilen("affiliate_commissions")
    assert len(zeilen) == 2
    gegen = zeilen[1]
    assert gegen["kind"] == "reversal"
    assert Decimal(gegen["amount"]) == Decimal("-7.50")
    assert gegen["parent_id"] == zeilen[0]["id"]
    assert zeilen[0]["status"] == "pending"  # nur teilweise → Ertrag bleibt


def test_vollerstattung_schliesst_den_ertrag() -> None:
    db = _mit_ertrag()
    charge = {"id": "ch_1", "payment_intent": "pi_1", "amount": 20000, "amount_refunded": 20000}
    prov.storniere_fuer_charge(db, charge, event_id="evt_r2")
    zeilen = db.zeilen("affiliate_commissions")
    assert Decimal(zeilen[1]["amount"]) == Decimal("-30.00")
    assert zeilen[0]["status"] == "reversed"


def test_mehrere_erstattungen_nehmen_nie_mehr_als_den_ertrag() -> None:
    db = _mit_ertrag()
    prov.storniere_fuer_charge(
        db, {"id": "ch_1", "amount": 20000, "amount_refunded": 15000}, event_id="evt_r3"
    )
    prov.storniere_fuer_charge(
        db, {"id": "ch_1", "amount": 20000, "amount_refunded": 20000}, event_id="evt_r4"
    )
    summe = sum(Decimal(z["amount"]) for z in db.zeilen("affiliate_commissions"))
    assert summe == Decimal("0.00")


def test_dasselbe_erstattungsevent_bucht_nur_einmal() -> None:
    db = _mit_ertrag()
    charge = {"id": "ch_1", "amount": 20000, "amount_refunded": 5000}
    prov.storniere_fuer_charge(db, charge, event_id="evt_r5")
    prov.storniere_fuer_charge(db, charge, event_id="evt_r5")
    assert len(db.zeilen("affiliate_commissions")) == 2


def test_gutschrift_im_verhaeltnis_zur_rechnung() -> None:
    db = _mit_ertrag()
    prov.storniere_fuer_gutschrift(
        db,
        {"invoice": "in_1", "total": 10000},
        event_id="evt_c1",
        invoice_total_loader=lambda _id: 40000,
    )
    assert Decimal(db.zeilen("affiliate_commissions")[1]["amount"]) == Decimal("-7.50")


def test_chargeback_haelt_und_gibt_bei_sieg_frei() -> None:
    db = _mit_ertrag()
    prov.chargeback_eroeffnet(db, {"id": "dp_1", "charge": "ch_1"})
    assert db.zeilen("affiliate_commissions")[0]["status"] == "held"
    prov.chargeback_entschieden(
        db, {"id": "dp_1", "charge": "ch_1", "status": "won"}, event_id="evt_d1"
    )
    assert db.zeilen("affiliate_commissions")[0]["status"] == "pending"


def test_verlorener_chargeback_bucht_voll_gegen() -> None:
    db = _mit_ertrag()
    prov.chargeback_entschieden(
        db, {"id": "dp_1", "charge": "ch_1", "status": "lost"}, event_id="evt_d2"
    )
    zeilen = db.zeilen("affiliate_commissions")
    assert Decimal(zeilen[1]["amount"]) == Decimal("-30.00")
    assert zeilen[0]["status"] == "reversed"
