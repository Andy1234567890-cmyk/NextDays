"""Rangbewertung (Aufstieg sofort, Abstieg erst nach zwei Stichtagen) und
Auszahlungslauf (je Währung, Mindestbetrag aus Daten, fail-closed ohne VIES)."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from src.features.affiliates import auszahlung, stufen

from .fakedb import FakeDb
from .test_provision import AFF, TIERS

JETZT = datetime(2026, 10, 1, 3, 0, tzinfo=UTC)


def _ref(n: int, *, abo: str = "active") -> tuple[dict, dict]:
    tid = f"{n:08d}-0000-4000-8000-000000000000"
    return (
        {
            "id": f"r{n}",
            "affiliate_id": AFF,
            "tenant_id": tid,
            "status": "approved",
            "first_paid_at": "2026-08-01T00:00:00+00:00",
            "created_at": "2026-08-01T00:00:00+00:00",
        },
        {"tenant_id": tid, "status": abo},
    )


def _db(
    anzahl: int, *, tier: str = "einsteiger", below_since: str | None = None, gekuendigt: int = 0
) -> FakeDb:
    refs, abos = [], []
    for n in range(anzahl):
        r, a = _ref(n, abo="canceled" if n < gekuendigt else "active")
        refs.append(r)
        abos.append(a)
    return FakeDb(
        {
            "affiliate_tiers": TIERS,
            "affiliates": [
                {
                    "id": AFF,
                    "email": "p@x.example",
                    "full_name": "Pia",
                    "language": "de",
                    "status": "approved",
                    "current_tier_id": tier,
                    "tier_below_since": below_since,
                }
            ],
            "affiliate_referrals": refs,
            "tenant_subscription": abos,
        }
    )


def test_rang_fuer_bereiche() -> None:
    assert stufen.rang_fuer(0, TIERS)["id"] == "einsteiger"
    assert stufen.rang_fuer(4, TIERS)["id"] == "einsteiger"
    assert stufen.rang_fuer(5, TIERS)["id"] == "aufsteiger"
    assert stufen.rang_fuer(9, TIERS)["id"] == "aufsteiger"
    assert stufen.rang_fuer(10, TIERS)["id"] == "experte"
    assert stufen.rang_fuer(19, TIERS)["id"] == "experte"
    assert stufen.rang_fuer(20, TIERS)["id"] == "elite"
    assert stufen.rang_fuer(500, TIERS)["id"] == "elite"


def test_aufstieg_sofort() -> None:
    db = _db(6)
    bilanz = stufen.raenge_bewerten(db, jetzt=JETZT)
    assert bilanz["aufstieg"] == 1
    assert db.zeilen("affiliates")[0]["current_tier_id"] == "aufsteiger"
    verlauf = db.zeilen("affiliate_tier_history")
    assert verlauf[-1]["tier_id"] == "aufsteiger" and verlauf[-1]["paying_customers"] == 6


def test_gekuendigte_zaehlen_nicht() -> None:
    db = _db(5, gekuendigt=1)
    stufen.raenge_bewerten(db, jetzt=JETZT)
    assert db.zeilen("affiliates")[0]["current_tier_id"] == "einsteiger"


def test_abstieg_erst_nach_zweitem_stichtag() -> None:
    db = _db(3, tier="aufsteiger")
    stufen.raenge_bewerten(db, jetzt=JETZT)
    p = db.zeilen("affiliates")[0]
    assert p["current_tier_id"] == "aufsteiger" and p["tier_below_since"] is not None
    bilanz = stufen.raenge_bewerten(db, jetzt=JETZT)
    assert bilanz["abstieg"] == 1
    p = db.zeilen("affiliates")[0]
    assert p["current_tier_id"] == "einsteiger" and p["tier_below_since"] is None


def test_erholung_loescht_die_vormerkung() -> None:
    db = _db(8, tier="aufsteiger", below_since="2026-09-01T00:00:00+00:00")
    stufen.raenge_bewerten(db, jetzt=JETZT)
    assert db.zeilen("affiliates")[0]["tier_below_since"] is None


# --- Auszahlung -----------------------------------------------------------------


def _zeile(
    betrag: str, waehrung: str = "EUR", *, kind: str = "earn", status: str = "approved"
) -> dict:
    return {
        "affiliate_id": AFF,
        "currency": waehrung,
        "amount": betrag,
        "kind": kind,
        "status": status,
        "payout_id": None,
        "created_at": "2026-09-15T00:00:00+00:00",
        "referral_id": "r0",
        "tenant_id": "t0",
        "rate": "0.15",
        "tier_id": "einsteiger",
        "base_amount": "0",
    }


def _adb(
    zeilen: list[dict],
    *,
    legal_form: str = "private",
    vies: str | None = None,
    method: str | None = "stripe",
    konto: str | None = "acct_test1",
    auszahlbar: bool = True,
) -> FakeDb:
    return FakeDb(
        {
            "affiliates": [
                {
                    "id": AFF,
                    "email": "p@x.example",
                    "full_name": "Pia",
                    "language": "de",
                    "status": "approved",
                    "country": "DK",
                    "vat_id": "DK12345678" if legal_form == "company" else None,
                    "legal_form": legal_form,
                    "vat_id_verified_at": vies,
                    "payout_method": method,
                    "payout_details": {"iban": "DK5000400440116243", "account_holder": "Pia"},
                    "stripe_account_id": konto,
                    "stripe_payouts_enabled": auszahlbar,
                }
            ],
            "affiliate_payout_minimums": [
                {"currency": "EUR", "minimum": "50.00"},
                {"currency": "DKK", "minimum": "375.00"},
            ],
            "affiliate_commissions": zeilen,
        }
    )


def test_lauf_buendelt_je_waehrung_und_zieht_gegenzeilen_ab() -> None:
    db = _adb(
        [
            _zeile("40.00"),
            _zeile("30.00"),
            _zeile("-10.00", kind="reversal"),
            _zeile("400.00", "DKK"),
        ]
    )
    bilanz = auszahlung.lauf_vorbereiten(db, jetzt=JETZT)
    assert bilanz["angelegt"] == 2
    zahlungen = {z["currency"]: z for z in db.zeilen("affiliate_payouts")}
    assert Decimal(zahlungen["EUR"]["amount"]) == Decimal("60.00")
    assert Decimal(zahlungen["DKK"]["amount"]) == Decimal("400.00")
    assert zahlungen["EUR"]["statement_no"].startswith("PA-2026-")
    assert all(c["payout_id"] for c in db.zeilen("affiliate_commissions"))
    assert len(db.zeilen("affiliate_payout_items")) == 4


def test_unter_mindestbetrag_wird_vorgetragen() -> None:
    db = _adb([_zeile("49.99")])
    bilanz = auszahlung.lauf_vorbereiten(db, jetzt=JETZT)
    assert bilanz["unter_minimum"] == 1 and db.zeilen("affiliate_payouts") == []


def test_unternehmen_ohne_vies_bestaetigung_wird_nicht_ausgezahlt() -> None:
    db = _adb([_zeile("500.00")], legal_form="company", vies=None)
    bilanz = auszahlung.lauf_vorbereiten(db, jetzt=JETZT)
    assert bilanz["gesperrt"] == 1 and db.zeilen("affiliate_payouts") == []


def test_ohne_verbundkonto_nichts() -> None:
    """Ab 0522 ist das Verbundkonto der einzige Weg — ohne Konto keine Zeile."""
    db = _adb([_zeile("500.00")], konto=None)
    assert auszahlung.lauf_vorbereiten(db, jetzt=JETZT)["gesperrt"] == 1


def test_verbundkonto_nicht_freigeschaltet_nichts() -> None:
    """Konto da, aber Stripe hat es (noch) nicht freigegeben: kein Geld.
    Der offene KYC-Stand ist ein Sperrgrund, kein Grund zum Überweisen."""
    db = _adb([_zeile("500.00")], auszahlbar=False)
    assert auszahlung.lauf_vorbereiten(db, jetzt=JETZT)["gesperrt"] == 1


def test_unbekannte_waehrung_wird_gemeldet_nicht_geraten() -> None:
    db = _adb([_zeile("500.00", "CHF")])
    assert auszahlung.lauf_vorbereiten(db, jetzt=JETZT)["gesperrt"] == 1


def test_bestaetigen_und_fehlschlag_sind_gegenzustaende() -> None:
    db = _adb([_zeile("80.00"), _zeile("70.00")])
    auszahlung.lauf_vorbereiten(db, jetzt=JETZT)
    zahlung = db.zeilen("affiliate_payouts")[0]
    auszahlung.fehlgeschlagen(db, zahlung["id"], grund="IBAN falsch", admin_id="admin")
    assert db.zeilen("affiliate_payouts")[0]["status"] == "failed"
    assert all(c["payout_id"] is None for c in db.zeilen("affiliate_commissions"))
    assert db.zeilen("affiliate_payout_items") == []
    # Zweiter Lauf bündelt erneut, dann bestätigen.
    auszahlung.lauf_vorbereiten(db, jetzt=JETZT)
    neu = [z for z in db.zeilen("affiliate_payouts") if z["status"] == "pending"][0]
    auszahlung.bestaetigen(db, neu["id"], external_ref="WISE-123", admin_id="admin")
    assert all(c["status"] == "paid" for c in db.zeilen("affiliate_commissions"))
    assert db.zeilen("affiliate_payouts")[-1]["external_ref"] == "WISE-123"


def test_gutschrift() -> None:
    """Die Gutschrift (Self-Billing) bleibt vom Wegwechsel unberührt — sie ist
    das Steuerdokument, nicht der Zahlungsweg.

    export_csv wird hier NICHT mehr geprüft: der Lauf schreibt seit 0522
    `method='stripe'`, und die CSV filtert auf wise/sepa/paypal — sie liefert für
    neue Auszahlungen bewusst nur noch die Kopfzeile.
    """
    db = _adb([_zeile("80.00")])
    auszahlung.lauf_vorbereiten(db, jetzt=JETZT)
    zahlung = db.zeilen("affiliate_payouts")[0]
    assert zahlung["method"] == "stripe"

    class _S:
        company_legal_name = "myNextDays"
        company_legal_form = "ApS"
        company_street = "Vej 1"
        company_city = "København"
        company_country = "DK"
        company_registration_number = "12345678"
        company_vat_id = "DK12345678"

    text = auszahlung.gutschrift_rendern(db, zahlung["id"], settings=_S())
    assert "selvfakturering" in text and "80.00 EUR" in text
    assert "Privatperson" in text and "Reverse Charge" not in text
