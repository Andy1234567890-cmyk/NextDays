"""Team-Provision (0520, Differenzmodell 0525): Override = Satz des Sponsors minus
Satz des Team-Partners, folgt der Ertragszeile, kennt nur eine Ebene; Team-Kunden
zählen für den Rang des Sponsors (Struktur)."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from pydantic import ValidationError

from src.features.affiliates import attribution, stufen
from src.features.affiliates import provision as prov
from src.features.affiliates.schemas import PartnerBewerbung

from .fakedb import FakeDb

SPONSOR = "a0000000-0000-4000-8000-00000000000a"
MEMBER = "a0000000-0000-4000-8000-00000000000b"
TEN = "b0000000-0000-4000-8000-00000000000b"
REF = "c0000000-0000-4000-8000-00000000000c"
PAID_AT = int(datetime(2026, 8, 30, 12, 0, tzinfo=UTC).timestamp())

TIERS = [
    {
        "id": "einsteiger",
        "name": "Einsteiger",
        "sort": 1,
        "min_customers": 0,
        "max_customers": 4,
        "rate": "0.15",
        "lifetime_rate": "0",
        "team_allowed": False,
    },
    {
        "id": "aufsteiger",
        "name": "Aufsteiger",
        "sort": 2,
        "min_customers": 5,
        "max_customers": 9,
        "rate": "0.20",
        "lifetime_rate": "0",
        "team_allowed": True,
    },
    {
        "id": "elite",
        "name": "Elite-Partner",
        "sort": 4,
        "min_customers": 20,
        "max_customers": None,
        "rate": "0.30",
        "lifetime_rate": "0.025",
        "team_allowed": True,
    },
]


def _db(
    *,
    sponsor_status: str = "approved",
    member_status: str = "approved",
    sponsor_tier: str = "aufsteiger",
    flags: list[str] | None = None,
) -> FakeDb:
    return FakeDb(
        {
            "affiliate_tiers": TIERS,
            "affiliates": [
                {
                    "id": SPONSOR,
                    "email": "s@sponsor.example",
                    "full_name": "Sven Sponsor",
                    "language": "de",
                    "status": sponsor_status,
                    "current_tier_id": sponsor_tier,
                    "sponsor_affiliate_id": None,
                },
                {
                    "id": MEMBER,
                    "email": "m@member.example",
                    "full_name": "Mia Member",
                    "language": "de",
                    "status": member_status,
                    "current_tier_id": "einsteiger",
                    "sponsor_affiliate_id": SPONSOR,
                    "sponsor_flags": flags or [],
                },
            ],
            "tenant_subscription": [
                {"tenant_id": TEN, "stripe_customer_id": "cus_1", "status": "active"}
            ],
            "affiliate_referrals": [
                {
                    "id": REF,
                    "affiliate_id": MEMBER,
                    "tenant_id": TEN,
                    "status": "approved",
                    "first_paid_at": None,
                    "commission_until": None,
                    "created_at": "2026-08-01T00:00:00+00:00",
                }
            ],
            "affiliate_referral_codes": [
                {"id": "code-s", "affiliate_id": SPONSOR, "code": "SVEN-1", "active": True}
            ],
        }
    )


def _invoice(amount: int = 10000, invoice_id: str = "in_1") -> dict:
    return {
        "id": invoice_id,
        "customer": "cus_1",
        "currency": "eur",
        "period_start": PAID_AT,
        "status_transitions": {"paid_at": PAID_AT},
        "lines": {
            "data": [
                {
                    "amount": amount,
                    "parent": {"type": "subscription_item_details"},
                    "discount_amounts": [],
                    "taxes": [],
                }
            ],
            "has_more": False,
        },
        "payments": {"data": [{"payment": {"charge": "ch_1", "payment_intent": "pi_1"}}]},
    }


def _zeilen(db: FakeDb, kind: str) -> list[dict]:
    return [r for r in db.zeilen("affiliate_commissions") if r["kind"] == kind]


def test_override_ist_differenz_der_saetze() -> None:
    db = _db()
    assert prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None) == "gebucht"
    earn = _zeilen(db, "earn")[0]
    ov = _zeilen(db, "override")
    assert len(ov) == 1
    assert ov[0]["affiliate_id"] == SPONSOR
    assert ov[0]["parent_id"] == earn["id"]
    # 100 € × (20 % Aufsteiger − 15 % Einsteiger) = 5 %
    assert Decimal(ov[0]["amount"]) == Decimal("5.00")
    assert Decimal(ov[0]["rate"]) == Decimal("0.05")
    assert ov[0]["tier_id"] == "aufsteiger"
    assert ov[0]["status"] == "pending"
    assert ov[0]["matures_at"] == earn["matures_at"]


def test_override_satz_folgt_dem_rang_des_sponsors() -> None:
    db = _db(sponsor_tier="elite")
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
    # 30 % − 15 % = 15 % von 100 €
    assert Decimal(_zeilen(db, "override")[0]["amount"]) == Decimal("15.00")


def test_kein_override_bei_gleichem_rang() -> None:
    """Sponsor und Team-Partner im gleichen Rang → Differenz 0 → keine Zeile.
    Der Deckel (Partner + Sponsor ≤ 30 %) ist damit von selbst eingehalten."""
    db = _db(sponsor_tier="einsteiger")
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
    assert _zeilen(db, "override") == []


def test_kein_override_ohne_sponsor() -> None:
    db = _db()
    db.zeilen("affiliates")[1]["sponsor_affiliate_id"] = None
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
    assert _zeilen(db, "override") == []


@pytest.mark.parametrize(
    "sponsor_status,member_status",
    [("pending_review", "approved"), ("suspended", "approved"), ("approved", "suspended")],
)
def test_override_held_ohne_beidseitige_freigabe(sponsor_status: str, member_status: str) -> None:
    db = _db(sponsor_status=sponsor_status, member_status=member_status)
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
    assert _zeilen(db, "override")[0]["status"] == "held"


def test_override_held_bei_team_flags() -> None:
    db = _db(flags=["same_iban"])
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
    assert _zeilen(db, "override")[0]["status"] == "held"


def test_override_ist_idempotent_je_ertragszeile() -> None:
    db = _db()
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
    earn = _zeilen(db, "earn")[0]
    partner = db.zeilen("affiliates")[1]
    assert prov.override_buchen(db, earn, partner=partner) is None
    assert len(_zeilen(db, "override")) == 1


def test_erstattung_nimmt_override_anteilig_zurueck() -> None:
    db = _db()
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
    prov.storniere_fuer_charge(
        db, {"id": "ch_1", "amount": 10000, "amount_refunded": 5000}, event_id="evt_r"
    )
    ov = _zeilen(db, "override")[0]
    gegen = [r for r in _zeilen(db, "reversal") if r["parent_id"] == ov["id"]]
    assert len(gegen) == 1
    # Hälfte der 5,00 € Differenzprovision.
    assert Decimal(gegen[0]["amount"]) == Decimal("-2.50")
    assert gegen[0]["affiliate_id"] == SPONSOR


def test_vollerstattung_schliesst_override() -> None:
    db = _db()
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
    prov.storniere_fuer_charge(
        db, {"id": "ch_1", "amount": 10000, "amount_refunded": 10000}, event_id="evt_r"
    )
    assert _zeilen(db, "override")[0]["status"] == "reversed"


def test_chargeback_haelt_und_gibt_override_frei() -> None:
    db = _db()
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
    prov.chargeback_eroeffnet(db, {"id": "ch_1"})
    assert _zeilen(db, "override")[0]["status"] == "held"
    prov.chargeback_entschieden(db, {"charge": "ch_1", "status": "won"}, event_id="evt_w")
    ov = _zeilen(db, "override")[0]
    assert ov["status"] == "pending"
    assert ov["reason"] == f"team:{MEMBER}"


def test_verlorener_chargeback_bucht_override_voll_gegen() -> None:
    db = _db()
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
    prov.chargeback_entschieden(db, {"charge": "ch_1", "status": "lost"}, event_id="evt_l")
    ov = _zeilen(db, "override")[0]
    assert ov["status"] == "reversed"
    assert any(r["parent_id"] == ov["id"] for r in _zeilen(db, "reversal"))


# --- Sponsor-Zuordnung -------------------------------------------------------------


def test_sponsor_zuordnen_setzt_sponsor() -> None:
    db = _db()
    db.zeilen("affiliates")[1]["sponsor_affiliate_id"] = None
    res = attribution.sponsor_zuordnen(
        db, affiliate_id=MEMBER, bewerber_email="m@member.example", sponsor_code="sven-1"
    )
    assert res is not None and res["id"] == SPONSOR
    assert db.zeilen("affiliates")[1]["sponsor_affiliate_id"] == SPONSOR
    assert db.zeilen("affiliates")[1]["sponsor_flags"] == []


def test_sponsor_zuordnen_gleiche_domain_flaggt() -> None:
    db = _db()
    db.zeilen("affiliates")[1]["sponsor_affiliate_id"] = None
    attribution.sponsor_zuordnen(
        db, affiliate_id=MEMBER, bewerber_email="mia@sponsor.example", sponsor_code="SVEN-1"
    )
    assert db.zeilen("affiliates")[1]["sponsor_flags"] == ["same_email_domain"]


def test_sponsor_zuordnen_keine_zweite_ebene() -> None:
    db = _db()
    # Der Sponsor hängt selbst an jemandem → sein Code trägt kein Team.
    db.zeilen("affiliates")[0]["sponsor_affiliate_id"] = "a0000000-0000-4000-8000-00000000000f"
    db.zeilen("affiliates")[1]["sponsor_affiliate_id"] = None
    assert (
        attribution.sponsor_zuordnen(
            db, affiliate_id=MEMBER, bewerber_email="m@member.example", sponsor_code="SVEN-1"
        )
        is None
    )
    assert db.zeilen("affiliates")[1]["sponsor_affiliate_id"] is None


def test_sponsor_zuordnen_nur_freigegebener_sponsor() -> None:
    db = _db(sponsor_status="pending_review")
    db.zeilen("affiliates")[1]["sponsor_affiliate_id"] = None
    assert (
        attribution.sponsor_zuordnen(
            db, affiliate_id=MEMBER, bewerber_email="m@member.example", sponsor_code="SVEN-1"
        )
        is None
    )


def test_sponsor_zuordnen_nicht_selbst() -> None:
    db = _db()
    assert (
        attribution.sponsor_zuordnen(
            db, affiliate_id=SPONSOR, bewerber_email="s@sponsor.example", sponsor_code="SVEN-1"
        )
        is None
    )


def test_iban_flag_zwischen_sponsor_und_mitglied() -> None:
    db = _db()
    db.zeilen("affiliates")[0]["payout_details"] = {"iban": "DK50 0040 0440 1162 43"}
    attribution.iban_flag_pruefen(db, affiliate_id=MEMBER, iban="DK5000400440116243")
    assert "same_iban" in db.zeilen("affiliates")[1]["sponsor_flags"]


# --- Rang: Team-Kunden zählen nicht ------------------------------------------------


def test_rang_zaehlt_die_struktur() -> None:
    """Eigene Kunden zählen nur beim Partner; die Struktur des Sponsors zählt
    die Kunden seiner Team-Partner 1:1 mit (Zettel 3 B)."""
    db = _db()
    # Der Sponsor hat KEINE eigenen Referrals; sein Team-Mitglied hat einen zahlenden Kunden.
    db.zeilen("affiliate_referrals")[0]["first_paid_at"] = "2026-08-30T12:00:00+00:00"
    je_partner = stufen.zahlende_kunden_je_partner(db)
    assert je_partner.get(SPONSOR, 0) == 0
    assert je_partner.get(MEMBER, 0) == 1
    struktur = stufen.struktur_kunden_je_partner(db)
    assert struktur.get(SPONSOR, 0) == 1
    assert struktur.get(MEMBER, 0) == 1


def test_bewerbung_traegt_sponsor_code() -> None:
    b = PartnerBewerbung(
        email="neu@example.org",
        password="geheim-1234",
        full_name="Neu",
        legal_form="private",
        country="DE",
        channels=[{"platform": "instagram", "url": "https://instagram.com/neu"}],
        sponsor_code="sven-1",
        terms_accepted=True,
        terms_version="2026-09",
    )
    assert b.sponsor_code == "sven-1"
    with pytest.raises(ValidationError):
        PartnerBewerbung(
            email="neu@example.org",
            password="geheim-1234",
            full_name="Neu",
            legal_form="private",
            country="DE",
            channels=[{"platform": "instagram", "url": "https://instagram.com/neu"}],
            sponsor_code="x" * 41,
            terms_accepted=True,
            terms_version="2026-09",
        )
