"""Master-Strategie (0525): Ränge nach Struktur, Aufstiegsbonus einmalig je Rang,
Untervermittler erst ab Aufsteiger, Superprovision ohne Laufzeitgrenze,
Markt-Turbo für Partner und Sponsor — und jede dieser Zeilen nur einmal."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from src.features.affiliates import attribution, stufen
from src.features.affiliates import provision as prov

from .fakedb import FakeDb
from .test_provision import TIERS

SPONSOR = "a0000000-0000-4000-8000-00000000000a"
MEMBER = "a0000000-0000-4000-8000-00000000000b"
TEN = "b0000000-0000-4000-8000-00000000000b"
REF = "c0000000-0000-4000-8000-00000000000c"
JETZT = datetime(2026, 10, 1, 3, 0, tzinfo=UTC)
PAID_AT = int(datetime(2026, 9, 1, 10, 0, tzinfo=UTC).timestamp())

BONI = [
    {"tier_id": "aufsteiger", "currency": "EUR", "amount": "50.00"},
    {"tier_id": "experte", "currency": "EUR", "amount": "50.00"},
    {"tier_id": "elite", "currency": "EUR", "amount": "50.00"},
]


def _refs(affiliate_id: str, anzahl: int, *, start: int = 0) -> tuple[list[dict], list[dict]]:
    refs, abos = [], []
    for n in range(start, start + anzahl):
        tid = f"{n:08d}-0000-4000-8000-000000000000"
        refs.append(
            {
                "id": f"r{n}",
                "affiliate_id": affiliate_id,
                "tenant_id": tid,
                "status": "approved",
                "first_paid_at": "2026-08-01T00:00:00+00:00",
                "created_at": "2026-08-01T00:00:00+00:00",
            }
        )
        abos.append({"tenant_id": tid, "status": "active"})
    return refs, abos


def _db(
    *,
    eigene: int,
    team: int = 0,
    sponsor_tier: str = "einsteiger",
    member_tier: str = "einsteiger",
) -> FakeDb:
    r1, a1 = _refs(SPONSOR, eigene)
    r2, a2 = _refs(MEMBER, team, start=100)
    return FakeDb(
        {
            "affiliate_tiers": TIERS,
            "affiliate_tier_bonuses": BONI,
            "affiliate_program_rates": [{"key": "booking_share", "rate": "0.005"}],
            "affiliates": [
                {
                    "id": SPONSOR,
                    "email": "s@x.example",
                    "full_name": "Sven",
                    "language": "de",
                    "status": "approved",
                    "current_tier_id": sponsor_tier,
                    "tier_below_since": None,
                    "sponsor_affiliate_id": None,
                },
                {
                    "id": MEMBER,
                    "email": "m@y.example",
                    "full_name": "Mia",
                    "language": "de",
                    "status": "approved",
                    "current_tier_id": member_tier,
                    "tier_below_since": None,
                    "sponsor_affiliate_id": SPONSOR,
                    "sponsor_flags": [],
                },
            ],
            "affiliate_referrals": r1 + r2,
            "tenant_subscription": a1 + a2,
            "affiliate_referral_codes": [
                {"id": "code-s", "affiliate_id": SPONSOR, "code": "SVEN-1", "active": True}
            ],
        }
    )


def _zeilen(db: FakeDb, kind: str, wer: str | None = None) -> list[dict]:
    return [
        r
        for r in db.zeilen("affiliate_commissions")
        if r["kind"] == kind and (wer is None or r["affiliate_id"] == wer)
    ]


# --- Rang nach Struktur + Bonus -----------------------------------------------------------


def test_team_kunden_heben_den_sponsor() -> None:
    """2 eigene + 3 Team-Kunden = 5 → Aufsteiger, obwohl eigene allein nicht reichen."""
    db = _db(eigene=2, team=3)
    bilanz = stufen.raenge_bewerten(db, jetzt=JETZT)
    sponsor = db.zeilen("affiliates")[0]
    assert sponsor["current_tier_id"] == "aufsteiger"
    assert bilanz["aufstieg"] == 1 and bilanz["bonus"] == 1


def test_aufstiegsbonus_einmal_je_rang() -> None:
    db = _db(eigene=5)
    stufen.raenge_bewerten(db, jetzt=JETZT)
    boni = _zeilen(db, "bonus", SPONSOR)
    assert len(boni) == 1
    assert boni[0]["tier_id"] == "aufsteiger"
    assert Decimal(boni[0]["amount"]) == Decimal("50.00") and boni[0]["currency"] == "EUR"
    assert boni[0]["referral_id"] is None and boni[0]["tenant_id"] is None
    assert boni[0]["status"] == "pending"
    # Rückstufung und Wiederaufstieg zahlen NICHT erneut.
    db.zeilen("affiliates")[0]["current_tier_id"] = "einsteiger"
    stufen.raenge_bewerten(db, jetzt=JETZT)
    assert len(_zeilen(db, "bonus", SPONSOR)) == 1


def test_sprung_ueber_zwei_raenge_zahlt_jeden_bonus() -> None:
    """0 → 12 Kunden in einem Monat: Aufsteiger UND Experte werden erreicht."""
    db = _db(eigene=12)
    bilanz = stufen.raenge_bewerten(db, jetzt=JETZT)
    assert db.zeilen("affiliates")[0]["current_tier_id"] == "experte"
    assert sorted(b["tier_id"] for b in _zeilen(db, "bonus", SPONSOR)) == ["aufsteiger", "experte"]
    assert bilanz["bonus"] == 2


def test_einsteiger_zahlt_keinen_bonus() -> None:
    db = _db(eigene=0)
    stufen.raenge_bewerten(db, jetzt=JETZT)
    assert _zeilen(db, "bonus") == []


# --- Untervermittler erst ab Aufsteiger --------------------------------------------------


def test_einsteiger_darf_kein_team_fuehren() -> None:
    db = _db(eigene=0)
    db.zeilen("affiliates")[1]["sponsor_affiliate_id"] = None
    res = attribution.sponsor_zuordnen(
        db, affiliate_id=MEMBER, bewerber_email="m@y.example", sponsor_code="sven-1"
    )
    assert res is None
    assert db.zeilen("affiliates")[1]["sponsor_affiliate_id"] is None


def test_aufsteiger_darf_team_fuehren() -> None:
    db = _db(eigene=0, sponsor_tier="aufsteiger")
    db.zeilen("affiliates")[1]["sponsor_affiliate_id"] = None
    res = attribution.sponsor_zuordnen(
        db, affiliate_id=MEMBER, bewerber_email="m@y.example", sponsor_code="sven-1"
    )
    assert res is not None and res["id"] == SPONSOR
    assert db.zeilen("affiliates")[1]["sponsor_affiliate_id"] == SPONSOR


# --- Superprovision ----------------------------------------------------------------------


def _invoice(amount: int = 10000, *, invoice_id: str = "in_1", customer: str = "cus_m") -> dict:
    return {
        "id": invoice_id,
        "customer": customer,
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


def _mit_kunde(db: FakeDb, *, commission_until: str | None = None) -> None:
    db.zeilen("tenant_subscription").append(
        {"tenant_id": TEN, "stripe_customer_id": "cus_m", "status": "active"}
    )
    db.zeilen("affiliate_referrals").append(
        {
            "id": REF,
            "affiliate_id": MEMBER,
            "tenant_id": TEN,
            "status": "approved",
            "first_paid_at": "2026-01-01T00:00:00+00:00" if commission_until else None,
            "commission_until": commission_until,
            "created_at": "2026-01-01T00:00:00+00:00",
        }
    )


def test_elite_sponsor_bekommt_differenz_und_superprovision() -> None:
    db = _db(eigene=0, sponsor_tier="elite")
    _mit_kunde(db)
    assert prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None) == "gebucht"
    # Team-Partner: 15 % Ertrag. Sponsor: 15 % Differenz + 2,5 % Superprovision.
    assert Decimal(_zeilen(db, "earn", MEMBER)[0]["amount"]) == Decimal("15.00")
    assert Decimal(_zeilen(db, "override", SPONSOR)[0]["amount"]) == Decimal("15.00")
    lt = _zeilen(db, "lifetime", SPONSOR)
    assert len(lt) == 1 and Decimal(lt[0]["amount"]) == Decimal("2.50")
    assert lt[0]["reason"] == f"team:{MEMBER}"
    # Der Team-Partner ist Einsteiger → keine eigene Superprovision.
    assert _zeilen(db, "lifetime", MEMBER) == []


def test_elite_partner_superprovision_auf_eigene_kunden_additiv() -> None:
    """Rang 4 in Monat 1–12: 30 % + 2,5 % auf eigene Kunden (Entscheidung 4)."""
    db = _db(eigene=0, member_tier="elite")
    _mit_kunde(db)
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
    assert Decimal(_zeilen(db, "earn", MEMBER)[0]["amount"]) == Decimal("30.00")
    assert Decimal(_zeilen(db, "lifetime", MEMBER)[0]["amount"]) == Decimal("2.50")
    assert _zeilen(db, "lifetime", MEMBER)[0]["reason"] == "lifetime:own"
    # Einsteiger-Sponsor: Differenz 15 % − 30 % < 0 → nichts, keine Superprovision.
    assert _zeilen(db, "override", SPONSOR) == []
    assert _zeilen(db, "lifetime", SPONSOR) == []


def test_superprovision_laeuft_nach_zwoelf_monaten_weiter() -> None:
    """Laufzeit vorbei → kein Ertrag, kein Override — aber die Superprovision
    entsteht weiter (ohne parent_id, Rechnung als Backstop)."""
    db = _db(eigene=0, sponsor_tier="elite")
    _mit_kunde(db, commission_until="2026-08-01T00:00:00+00:00")
    assert (
        prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
        == "ausgelaufen"
    )
    assert _zeilen(db, "earn") == [] and _zeilen(db, "override") == []
    lt = _zeilen(db, "lifetime", SPONSOR)
    assert len(lt) == 1 and lt[0]["parent_id"] is None
    assert lt[0]["stripe_invoice_id"] == "in_1"
    # Redelivery derselben Rechnung → keine zweite Zeile.
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_2", lines_loader=None)
    assert len(_zeilen(db, "lifetime", SPONSOR)) == 1


def test_ohne_elite_keine_superprovision() -> None:
    db = _db(eigene=0, sponsor_tier="experte")
    _mit_kunde(db)
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
    assert _zeilen(db, "lifetime") == []


def test_erstattung_nimmt_superprovision_mit() -> None:
    db = _db(eigene=0, sponsor_tier="elite")
    _mit_kunde(db)
    prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None)
    prov.storniere_fuer_charge(
        db, {"id": "ch_1", "amount": 10000, "amount_refunded": 10000}, event_id="evt_r"
    )
    lt = _zeilen(db, "lifetime", SPONSOR)[0]
    assert lt["status"] == "reversed"
    gegen = [r for r in _zeilen(db, "reversal") if r["parent_id"] == lt["id"]]
    assert len(gegen) == 1 and Decimal(gegen[0]["amount"]) == Decimal("-2.50")


def test_leere_rechnung_startet_die_laufzeit_nicht() -> None:
    """Eine Rechnung ohne Abo-Basis ist keine „erste zahlungspflichtige"."""
    db = _db(eigene=0)
    _mit_kunde(db)
    leer = _invoice()
    leer["lines"]["data"][0]["parent"] = {"type": "invoice_item_details"}
    assert prov.verbuche_rechnung(db, leer, event_id="evt_1", lines_loader=None) == "leer"
    ref = next(r for r in db.zeilen("affiliate_referrals") if r["id"] == REF)
    assert ref["first_paid_at"] is None and ref["commission_until"] is None


# --- Markt-Turbo -------------------------------------------------------------------------


def _anteil(db: FakeDb, *, charge: str = "ch_b1", cents: int = 80000, event: str = "evt_b") -> str:
    return prov.buchungsanteil_buchen(
        db,
        tenant_id=TEN,
        charge_id=charge,
        payment_intent="pi_b1",
        amount_cents=cents,
        currency="dkk",
        paid_at=datetime(2026, 9, 5, 12, 0, tzinfo=UTC),
        event_id=event,
    )


def test_buchungsanteil_fuer_partner_und_sponsor() -> None:
    # Beide Elite: der Anteil entsteht seit dem 03.09.2026 nur fuer Raenge mit
    # `lifetime_rate` — und die Pruefung greift je Empfaenger, nicht einmal
    # fuer den Vorgang.
    db = _db(eigene=0, sponsor_tier="elite", member_tier="elite")
    _mit_kunde(db)
    assert _anteil(db) == "gebucht"
    # EIN Topf, geteilt (03.09.2026): beide Elite → 800,00 DKK × 0,5 % = 4,00
    # DKK, je 2,00 fuer Werber und Elite-Sponsor, in Buchungswaehrung.
    mine = _zeilen(db, "booking_share", MEMBER)
    sp = _zeilen(db, "booking_share", SPONSOR)
    assert len(mine) == 1 and len(sp) == 1
    for z in (mine[0], sp[0]):
        assert Decimal(z["amount"]) == Decimal("2.00") and z["currency"] == "DKK"
        assert Decimal(z["base_amount"]) == Decimal("800.00")
        assert z["status"] == "pending" and z["stripe_charge_id"] == "ch_b1"
    assert mine[0]["reason"] == "booking:own" and sp[0]["reason"] == f"team:{MEMBER}"


def test_buchungsanteil_nur_einmal_je_charge() -> None:
    db = _db(eigene=0, sponsor_tier="elite", member_tier="elite")
    _mit_kunde(db)
    assert _anteil(db) == "gebucht"
    assert _anteil(db, event="evt_b2") == "duplikat"
    assert len(_zeilen(db, "booking_share")) == 2


def test_buchungsanteil_nur_fuer_elite() -> None:
    """Unter Elite entsteht keine Zeile — und die Pruefung wirkt je Empfaenger.

    Der zweite Teil ist der eigentliche Punkt: Partner und Sponsor koennen
    verschiedene Raenge halten. Ein Elite-Sponsor ueber einem Einsteiger
    bekommt seinen Anteil, der Einsteiger nicht. Eine Pruefung am Aufrufer
    statt je Empfaenger wuerde hier beide gemeinsam abschneiden und faellt
    ohne diesen Test nicht auf.
    """
    db = _db(eigene=0)
    _mit_kunde(db)
    assert _anteil(db) == "kein_rang"
    assert _zeilen(db, "booking_share") == []

    db = _db(eigene=0, sponsor_tier="elite", member_tier="einsteiger")
    _mit_kunde(db)
    assert _anteil(db) == "gebucht"
    assert _zeilen(db, "booking_share", MEMBER) == []
    assert len(_zeilen(db, "booking_share", SPONSOR)) == 1
    # Redelivery im gemischten Fall: der Starter meldet erneut „kein Rang",
    # der Sponsor laeuft in den UNIQUE-Backstop. Das ist eine Redelivery und
    # muss als solche gemeldet werden — nicht als Rangbefund (Review 03.09.2026).
    assert _anteil(db, event="evt_b2") == "duplikat"
    assert len(_zeilen(db, "booking_share")) == 1


def test_buchungsanteil_ohne_partner_oder_charge() -> None:
    db = _db(eigene=0)
    assert _anteil(db) == "kein_partner"
    _mit_kunde(db)
    assert (
        prov.buchungsanteil_buchen(
            db,
            tenant_id=TEN,
            charge_id=None,
            payment_intent="pi",
            amount_cents=1000,
            currency="eur",
            paid_at=JETZT,
            event_id=None,
        )
        == "leer"
    )
    assert _zeilen(db, "booking_share") == []


def test_gast_erstattung_nimmt_buchungsanteil_anteilig_zurueck() -> None:
    db = _db(eigene=0, sponsor_tier="elite", member_tier="elite")
    _mit_kunde(db)
    _anteil(db)
    prov.storniere_fuer_charge(
        db, {"id": "ch_b1", "amount": 80000, "amount_refunded": 40000}, event_id="evt_r"
    )
    gegen = _zeilen(db, "reversal")
    assert len(gegen) == 2
    # halbe Erstattung auf je 2,00 → je −1,00
    assert all(Decimal(g["amount"]) == Decimal("-1.00") for g in gegen)
    assert {g["affiliate_id"] for g in gegen} == {MEMBER, SPONSOR}


def test_chargeback_haelt_buchungsanteil_und_verlust_bucht_gegen() -> None:
    db = _db(eigene=0)
    _mit_kunde(db)
    _anteil(db)
    prov.chargeback_eroeffnet(db, {"id": "ch_b1"})
    assert all(z["status"] == "held" for z in _zeilen(db, "booking_share"))
    prov.chargeback_entschieden(db, {"charge": "ch_b1", "status": "lost"}, event_id="evt_l")
    assert all(z["status"] == "reversed" for z in _zeilen(db, "booking_share"))


def test_satz_fehlt_dann_kein_anteil() -> None:
    db = _db(eigene=0)
    _mit_kunde(db)
    db.zeilen("affiliate_program_rates").clear()
    assert _anteil(db) == "leer"
    assert _zeilen(db, "booking_share") == []
