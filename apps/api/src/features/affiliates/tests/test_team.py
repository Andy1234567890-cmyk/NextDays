"""Team-Provision (0520, Differenzmodell 0525, Strukturvertrieb 0533): Override =
Roll-up-Differenz über die ganze Sponsor-Kette, folgt der Ertragszeile; die
zahlenden Kunden der ganzen Struktur zählen für den Rang."""

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
        "id": "experte",
        "name": "Experte",
        "sort": 3,
        "min_customers": 10,
        "max_customers": 19,
        "rate": "0.25",
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
    assert prov.override_buchen(db, earn, partner=partner) == []
    assert len(_zeilen(db, "override")) == 1


ELITE2 = "a0000000-0000-4000-8000-00000000000c"
OBEN = "a0000000-0000-4000-8000-00000000000d"


def _db_kette(*raenge: str) -> FakeDb:
    """MEMBER (Einsteiger, wirbt den Kunden) unter einer Kette von Sponsoren;
    `raenge` von unten nach oben. IDs: SPONSOR, ELITE2, OBEN."""
    db = _db()
    ids = [SPONSOR, ELITE2, OBEN][: len(raenge)]
    db.zeilen("affiliates")[0]["current_tier_id"] = raenge[0]
    for i, (aid, rang) in enumerate(zip(ids[1:], raenge[1:], strict=True)):
        db.zeilen("affiliates").append(
            {
                "id": aid,
                "email": f"{i}@oben.example",
                "full_name": f"Oben {i}",
                "language": "de",
                "status": "approved",
                "current_tier_id": rang,
                "sponsor_affiliate_id": None,
                "sponsor_flags": [],
            }
        )
        # der Knoten darunter haengt an diesem
        unten = next(a for a in db.zeilen("affiliates") if a["id"] == ids[i])
        unten["sponsor_affiliate_id"] = aid
    return db


def test_override_laeuft_die_kette_hoch() -> None:
    """Strukturvertrieb: Einsteiger 15 → Aufsteiger 20 → Elite 30 auf 100 €:
    der Aufsteiger bekommt 5 (20−15), der Elite 10 (30−20). Summe 15 = 30−15."""
    db = _db_kette("aufsteiger", "elite")
    assert prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None) == "gebucht"
    ov = {z["affiliate_id"]: Decimal(z["amount"]) for z in _zeilen(db, "override")}
    assert ov == {SPONSOR: Decimal("5.00"), ELITE2: Decimal("10.00")}
    earn = _zeilen(db, "earn")[0]
    assert all(z["parent_id"] == earn["id"] for z in _zeilen(db, "override"))
    assert all(z["reason"] == f"team:{MEMBER}" for z in _zeilen(db, "override"))


def test_override_rollup_zum_hoechsten_verguetetem_satz() -> None:
    """Nicht aufsteigende Kette: Einsteiger 15 → Elite 30 → Aufsteiger 20 →
    Elite 30. Der erste Elite bekommt 15, der Aufsteiger NICHTS (20 < 30), der
    zweite Elite NICHTS (30 = 30). Differenz zum direkten Kind statt zum
    Hoechsten haette 15 + 0 + 10 = 25 zusaetzlich ausgezahlt — Deckel gerissen."""
    db = _db_kette("elite", "aufsteiger", "elite")
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
    ov = {z["affiliate_id"]: Decimal(z["amount"]) for z in _zeilen(db, "override")}
    assert ov == {SPONSOR: Decimal("15.00")}
    gesamt = Decimal(_zeilen(db, "earn")[0]["amount"]) + sum(ov.values())
    assert gesamt == Decimal("30.00")  # 100 € × hoechster Satz der Kette


def test_override_experte_ueber_einsteiger_und_aufsteiger() -> None:
    """Der Fall aus der Vergleichstabelle: ein Experte (25) verdient ueber einem
    Einsteiger 10, ueber einem Aufsteiger 5 — und steht der Aufsteiger zwischen
    beiden, bekommt der Aufsteiger 5 (20−15) und der Experte 5 (25−20)."""
    # Experte direkt ueber dem werbenden Einsteiger
    db = _db_kette("experte")
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
    assert _override_je_partner(db) == {SPONSOR: Decimal("10.00")}

    # Experte direkt ueber einem werbenden Aufsteiger
    db = _db_kette("experte")
    db.zeilen("affiliates")[1]["current_tier_id"] = "aufsteiger"  # MEMBER wirbt
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
    assert Decimal(_zeilen(db, "earn")[0]["amount"]) == Decimal("20.00")
    assert _override_je_partner(db) == {SPONSOR: Decimal("5.00")}

    # Einsteiger wirbt, darueber Aufsteiger, darueber Experte
    db = _db_kette("aufsteiger", "experte")
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
    assert _override_je_partner(db) == {SPONSOR: Decimal("5.00"), ELITE2: Decimal("5.00")}


def _override_je_partner(db: FakeDb) -> dict[str, Decimal]:
    return {z["affiliate_id"]: Decimal(z["amount"]) for z in _zeilen(db, "override")}


def test_override_held_vererbt_sich_nach_oben() -> None:
    """Betrugs-Flag an der untersten Zuordnung haelt JEDE Stufe darueber an."""
    db = _db_kette("aufsteiger", "elite")
    next(a for a in db.zeilen("affiliates") if a["id"] == MEMBER)["sponsor_flags"] = ["same_iban"]
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
    assert {z["status"] for z in _zeilen(db, "override")} == {"held"}


def test_upline_zyklus_bricht_laut_ab() -> None:
    """A → B → A darf die DB nicht enthalten (Trigger 0533) — der Code darf sich
    darauf trotzdem nicht verlassen: kein Endlos-Lauf, jeder Knoten einmal."""
    db = _db()
    db.zeilen("affiliates")[0]["sponsor_affiliate_id"] = MEMBER  # Sponsor haengt am Member
    kette = prov._upline(db, db.zeilen("affiliates")[1])  # noqa: SLF001
    assert [k["id"] for k in kette] == [SPONSOR]


def test_superprovision_teilen_sich_alle_elite_der_kette() -> None:
    """Einsteiger → Elite → Elite: EIN Topf 2,50 (100 € × 2,5 %), je 1,25."""
    db = _db_kette("elite", "elite")
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
    lt = {z["affiliate_id"]: Decimal(z["amount"]) for z in _zeilen(db, "lifetime")}
    assert lt == {SPONSOR: Decimal("1.25"), ELITE2: Decimal("1.25")}


def test_superprovision_einziger_elite_bekommt_alles() -> None:
    db = _db_kette("elite", "aufsteiger")
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
    lt = _zeilen(db, "lifetime")
    assert [(z["affiliate_id"], Decimal(z["amount"])) for z in lt] == [(SPONSOR, Decimal("2.50"))]


def test_superprovision_werber_selbst_elite_teilt_mit_sponsor() -> None:
    """Ist der Werber selbst Elite, teilt er mit dem Elite darueber — eigener
    Anteil als `lifetime:own`, der des Sponsors als `team:<werber>`."""
    db = _db_kette("elite")
    db.zeilen("affiliates")[1]["current_tier_id"] = "elite"
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
    lt = {(z["affiliate_id"], z["reason"]): Decimal(z["amount"]) for z in _zeilen(db, "lifetime")}
    assert lt == {
        (MEMBER, "lifetime:own"): Decimal("1.25"),
        (SPONSOR, f"team:{MEMBER}"): Decimal("1.25"),
    }


def test_superprovision_rest_cent_geht_nach_unten() -> None:
    """Drei Elite auf 2,50: 0,84 / 0,83 / 0,83 — die Summe ist exakt der Topf,
    der Rest-Cent liegt beim untersten (werber-naechsten) Elite."""
    db = _db_kette("elite", "elite", "elite")
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
    lt = {z["affiliate_id"]: Decimal(z["amount"]) for z in _zeilen(db, "lifetime")}
    assert lt == {SPONSOR: Decimal("0.84"), ELITE2: Decimal("0.83"), OBEN: Decimal("0.83")}
    assert sum(lt.values()) == Decimal("2.50")


def test_anteile_summe_ist_immer_der_topf() -> None:
    for n in range(1, 8):
        teile = prov._anteile(Decimal("2.50"), n)  # noqa: SLF001
        assert len(teile) == n and sum(teile) == Decimal("2.50")
        assert max(teile) - min(teile) <= Decimal("0.01")
    assert prov._anteile(Decimal("0.00"), 3) == []  # noqa: SLF001


def test_struktur_zaehlt_alle_ebenen_fuer_den_rang() -> None:
    """Rang: eigene zahlende Kunden plus die der GANZEN Struktur darunter."""
    db = _db_kette("aufsteiger", "elite")
    ref = db.zeilen("affiliate_referrals")[0]
    ref["first_paid_at"] = "2026-08-30T12:00:00+00:00"
    db.zeilen("affiliate_referrals").append({**ref, "id": "ref-2", "tenant_id": "t-2"})
    db.zeilen("tenant_subscription").append({"tenant_id": "t-2", "status": "active"})
    struktur = stufen.struktur_kunden_je_partner(db)
    # MEMBER hat 2 Kunden; SPONSOR (eine Ebene drueber) und ELITE2 (zwei) zaehlen sie mit.
    assert struktur[MEMBER] == 2 and struktur[SPONSOR] == 2 and struktur[ELITE2] == 2


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


def test_sponsor_zuordnen_auch_unter_einem_team_mitglied() -> None:
    """Strukturvertrieb (0533): ein Sponsor, der selbst an jemandem haengt, darf
    Team fuehren — die Kette waechst in die Tiefe. Bis dahin lehnte genau das
    die zweite Ebene ab."""
    db = _db()
    db.zeilen("affiliates")[0]["sponsor_affiliate_id"] = "a0000000-0000-4000-8000-00000000000f"
    db.zeilen("affiliates")[1]["sponsor_affiliate_id"] = None
    sponsor = attribution.sponsor_zuordnen(
        db, affiliate_id=MEMBER, bewerber_email="m@member.example", sponsor_code="SVEN-1"
    )
    assert sponsor is not None and sponsor["id"] == SPONSOR
    assert db.zeilen("affiliates")[1]["sponsor_affiliate_id"] == SPONSOR


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
