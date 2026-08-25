"""Tests für den Zahlungslink der Zusatzleistungen (0386).

Kein Netz: der Stripe-Client wird gepatcht. Die Fake-DB aus ``test_addons``
wird wiederverwendet — dieselben Query-Ketten, kein zweiter Mock-Baukasten.
"""
from __future__ import annotations

import pytest

from src.core.security import AuthContext
from src.features.addons import zahlung as z
from src.features.addons.zahlung import (
    AddonZahlungService,
    ZahlungslinkFehler,
    verbuche_checkout_session,
)

from .test_addons import _DB

CTX = AuthContext(user_id="user-1", tenant_id="t1", role="admin")


def _db(**over: list[dict]) -> _DB:
    tables: dict[str, list[dict]] = {
        "reservations": [{"id": "res-1", "tenant_id": "t1", "currency": "DKK"}],
        "tenants": [{"id": "t1", "addon_fee_bps": 500}],
        "tenant_billing_profile": [
            {
                "tenant_id": "t1",
                "stripe_account_id": "acct_1",
                "stripe_charges_enabled": True,
            }
        ],
        "reservation_addons": [
            {
                "id": "ra-1",
                "tenant_id": "t1",
                "reservation_id": "res-1",
                "name": {"de": "Frühstück"},
                "total": 120.0,
                "status": "pending",
            },
            {
                "id": "ra-2",
                "tenant_id": "t1",
                "reservation_id": "res-1",
                "name": {"de": "Transfer"},
                "total": 80.0,
                "status": "pending",
            },
        ],
        "addon_payment_links": [],
        "addon_payment_link_items": [],
        "payments": [],
    }
    tables.update(over)
    return _DB(tables)


class _StripeFake:
    """Zählt Aufrufe, damit Idempotenz beweisbar ist (nicht nur plausibel)."""

    def __init__(self) -> None:
        self.erstellt: list[dict] = []
        self.deaktiviert: list[str] = []
        self.sessions: dict[str, dict | None] = {}

    def create(self, **kw: object) -> dict:
        self.erstellt.append(dict(kw))
        nr = len(self.erstellt)
        return {
            "id": f"plink_{nr}",
            "url": f"https://buy.stripe.com/test_{nr}",
            "price_id": f"price_{nr}",
            "product_id": f"prod_{nr}",
            "active": True,
        }

    def deactivate(self, link_id: str, **_kw: object) -> None:
        self.deaktiviert.append(link_id)

    def find(self, link_id: str, **_kw: object) -> dict | None:
        return self.sessions.get(link_id)


@pytest.fixture(name="stripe")
def _stripe(monkeypatch: pytest.MonkeyPatch) -> _StripeFake:
    fake = _StripeFake()
    monkeypatch.setattr(
        z.sc, "create_payment_link", lambda **kw: fake.create(**kw)
    )
    monkeypatch.setattr(
        z.sc, "deactivate_payment_link", lambda lid, **kw: fake.deactivate(lid, **kw)
    )
    monkeypatch.setattr(z.sc, "find_paid_session", lambda lid, **kw: fake.find(lid, **kw))
    return fake


# --- Erstellen ---------------------------------------------------------------

def test_link_summiert_offene_positionen_und_behaelt_5_prozent(
    stripe: _StripeFake,
) -> None:
    svc = AddonZahlungService(_db())
    res = svc.erstellen(CTX, "res-1")
    assert res.amount_cents == 20000          # 120 + 80
    assert res.application_fee_cents == 1000  # 5 %
    assert res.fee_bps == 500
    assert res.currency == "DKK"
    assert res.positionen == 2
    assert stripe.erstellt[0]["application_fee_cents"] == 1000
    # Direct Charge: der Link entsteht im Konto des Betriebs.
    assert stripe.erstellt[0]["acct"] == "acct_1"


def test_provision_bemisst_sich_am_netto_nicht_am_brutto(stripe: _StripeFake) -> None:
    """Sonst zahlte ein dänischer Betrieb (25 %) mehr Provision als ein
    luxemburgischer (17 %) — für denselben Nettopreis und dieselbe Leistung."""
    db = _db(
        reservation_addons=[
            {
                "id": "ra-1",
                "tenant_id": "t1",
                "reservation_id": "res-1",
                "name": {"de": "Wäschepaket"},
                "total": 300.0,      # brutto, inkl. 25 % dänischer USt
                "tax_rate": 25.0,
                "status": "pending",
            }
        ]
    )
    res = AddonZahlungService(db).erstellen(CTX, "res-1")
    # Der Gast zahlt den vollen Bruttobetrag …
    assert res.amount_cents == 30000
    # … die Provision bemisst sich aber an 240,00 netto → 12,00 statt 15,00.
    assert res.application_fee_cents == 1200


def test_ohne_steuersatz_ist_brutto_gleich_netto(stripe: _StripeFake) -> None:
    """Kein ausgewiesener Satz → nichts herausrechnen (kein geratener Default)."""
    db = _db(
        reservation_addons=[
            {
                "id": "ra-1",
                "tenant_id": "t1",
                "reservation_id": "res-1",
                "name": {"de": "Transfer"},
                "total": 100.0,
                "tax_rate": None,
                "status": "pending",
            }
        ]
    )
    res = AddonZahlungService(db).erstellen(CTX, "res-1")
    assert (res.amount_cents, res.application_fee_cents) == (10000, 500)


def test_zweiter_klick_gibt_denselben_link_zurueck(stripe: _StripeFake) -> None:
    svc = AddonZahlungService(_db())
    erst = svc.erstellen(CTX, "res-1")
    zweit = svc.erstellen(CTX, "res-1")
    assert erst.id == zweit.id
    assert len(stripe.erstellt) == 1  # kein zweiter Stripe-Link


def test_geaenderte_positionen_ziehen_alten_link_zurueck(stripe: _StripeFake) -> None:
    db = _db()
    svc = AddonZahlungService(db)
    svc.erstellen(CTX, "res-1")
    # Ein Extra kommt dazu → der alte Link lautet auf einen veralteten Betrag.
    db.tables["reservation_addons"].append(
        {
            "id": "ra-3",
            "tenant_id": "t1",
            "reservation_id": "res-1",
            "name": {"de": "Reinigung"},
            "total": 50.0,
            "status": "pending",
        }
    )
    neu = svc.erstellen(CTX, "res-1")
    assert neu.amount_cents == 25000
    assert stripe.deaktiviert == ["plink_1"]
    offen = [r for r in db.tables["addon_payment_links"] if r["status"] == "open"]
    assert len(offen) == 1


def test_ohne_offene_positionen_409(stripe: _StripeFake) -> None:
    db = _db(reservation_addons=[])
    with pytest.raises(ZahlungslinkFehler) as exc:
        AddonZahlungService(db).erstellen(CTX, "res-1")
    assert exc.value.status_code == 409
    assert not stripe.erstellt


def test_ohne_waehrung_422(stripe: _StripeFake) -> None:
    db = _db(reservations=[{"id": "res-1", "tenant_id": "t1", "currency": ""}])
    with pytest.raises(ZahlungslinkFehler) as exc:
        AddonZahlungService(db).erstellen(CTX, "res-1")
    assert exc.value.status_code == 422


def test_ohne_verbundenes_konto_409(stripe: _StripeFake) -> None:
    db = _db(tenant_billing_profile=[{"tenant_id": "t1", "stripe_account_id": None}])
    with pytest.raises(ZahlungslinkFehler) as exc:
        AddonZahlungService(db).erstellen(CTX, "res-1")
    assert exc.value.status_code == 409


def test_konto_ohne_charges_enabled_409(stripe: _StripeFake) -> None:
    db = _db(
        tenant_billing_profile=[
            {
                "tenant_id": "t1",
                "stripe_account_id": "acct_1",
                "stripe_charges_enabled": False,
            }
        ]
    )
    with pytest.raises(ZahlungslinkFehler) as exc:
        AddonZahlungService(db).erstellen(CTX, "res-1")
    assert exc.value.status_code == 409


def test_fremde_buchung_404(stripe: _StripeFake) -> None:
    db = _db(reservations=[{"id": "res-1", "tenant_id": "t2", "currency": "DKK"}])
    with pytest.raises(ZahlungslinkFehler) as exc:
        AddonZahlungService(db).erstellen(CTX, "res-1")
    assert exc.value.status_code == 404


# --- Verbuchen ---------------------------------------------------------------

def _session(**over: object) -> dict:
    base = {
        "id": "cs_1",
        "payment_link": "plink_1",
        "payment_status": "paid",
        "payment_intent": "pi_1",
        "amount_total": 20000,
        "metadata": {"nd_zweck": "addon"},
    }
    base.update(over)
    return base


def test_webhook_setzt_positionen_bezahlt_und_schreibt_beleg(
    stripe: _StripeFake,
) -> None:
    db = _db()
    AddonZahlungService(db).erstellen(CTX, "res-1")
    assert verbuche_checkout_session(db, _session(), account="acct_1") is True

    assert all(
        r["status"] == "paid"
        for r in db.tables["reservation_addons"]
        if r["reservation_id"] == "res-1"
    )
    link = db.tables["addon_payment_links"][0]
    assert link["status"] == "paid"
    assert link["payment_intent_id"] == "pi_1"
    beleg = db.tables["payments"][0]
    # Referenz ist die Checkout-Session, NICHT der PaymentIntent: sonst würde der
    # payment_intent.succeeded-Pfad die Buchung als voll bezahlt markieren und
    # eine Plattform-Auszahlung planen.
    assert beleg["gateway_ref"] == "cs_1"
    assert beleg["type"] == "addon"
    assert beleg["amount"] == 200.0
    assert beleg["currency"] == "DKK"


def test_webhook_redelivery_schreibt_keinen_zweiten_beleg(
    stripe: _StripeFake,
) -> None:
    db = _db()
    AddonZahlungService(db).erstellen(CTX, "res-1")
    verbuche_checkout_session(db, _session(), account="acct_1")
    verbuche_checkout_session(db, _session(), account="acct_1")
    assert len(db.tables["payments"]) == 1


def test_webhook_ignoriert_fremde_checkout_session(stripe: _StripeFake) -> None:
    db = _db()
    AddonZahlungService(db).erstellen(CTX, "res-1")
    fremd = _session(metadata={"nd_zweck": "abo"})
    assert verbuche_checkout_session(db, fremd, account="acct_1") is False
    assert not db.tables["payments"]


def test_webhook_lehnt_fremdes_verbundenes_konto_ab(stripe: _StripeFake) -> None:
    db = _db()
    AddonZahlungService(db).erstellen(CTX, "res-1")
    assert verbuche_checkout_session(db, _session(), account="acct_fremd") is False
    assert db.tables["addon_payment_links"][0]["status"] == "open"


def test_webhook_verbucht_nicht_bei_abweichendem_betrag(stripe: _StripeFake) -> None:
    db = _db()
    AddonZahlungService(db).erstellen(CTX, "res-1")
    verbuche_checkout_session(db, _session(amount_total=100), account="acct_1")
    assert db.tables["addon_payment_links"][0]["status"] == "open"
    assert not db.tables["payments"]


def test_webhook_unbezahlte_session_aendert_nichts(stripe: _StripeFake) -> None:
    db = _db()
    AddonZahlungService(db).erstellen(CTX, "res-1")
    verbuche_checkout_session(db, _session(payment_status="unpaid"), account="acct_1")
    assert db.tables["addon_payment_links"][0]["status"] == "open"


# --- Lesen mit Stripe-Abgleich ----------------------------------------------

def test_lesen_zieht_bezahlten_link_nach(stripe: _StripeFake) -> None:
    """Netz unter dem Webhook: fehlt das Event, holt der Lesepfad den Stand."""
    db = _db()
    svc = AddonZahlungService(db)
    svc.erstellen(CTX, "res-1")
    stripe.sessions["plink_1"] = {
        "id": "cs_9",
        "payment_intent": "pi_9",
        "amount_total": 20000,
        "currency": "dkk",
    }
    res = svc.lesen(CTX, "res-1")
    assert res is not None
    assert res.status == "paid"
    assert all(r["status"] == "paid" for r in db.tables["reservation_addons"])


def test_lesen_ohne_link_gibt_none(stripe: _StripeFake) -> None:
    assert AddonZahlungService(_db()).lesen(CTX, "res-1") is None


def test_zurueckziehen_deaktiviert_bei_stripe(stripe: _StripeFake) -> None:
    db = _db()
    svc = AddonZahlungService(db)
    svc.erstellen(CTX, "res-1")
    svc.zurueckziehen(CTX, "res-1")
    assert stripe.deaktiviert == ["plink_1"]
    assert db.tables["addon_payment_links"][0]["status"] == "cancelled"
    # Zweiter Aufruf ist ein No-op, kein Fehler.
    svc.zurueckziehen(CTX, "res-1")
    assert stripe.deaktiviert == ["plink_1"]
