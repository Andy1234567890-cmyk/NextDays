"""Tests für die Nachberechnung einer Website-Buchung (0469).

Kein Netz: der Stripe-Client wird gepatcht. Die Fake-DB aus ``test_payments``
wird wiederverwendet — dieselben Query-Ketten, kein zweiter Mock-Baukasten.
"""
from __future__ import annotations

import pytest

from src.core.security import AuthContext
from src.features.payments import nachberechnung as n
from src.features.payments.nachberechnung import (
    NachberechnungService,
    verbuche_checkout_session,
    ziehe_link_zurueck_bei_betragsaenderung,
)
from src.features.payments.schemas import NachberechnungCreate
from src.features.payments.service import PaymentsError, passe_restzahlung_an

from .test_payments import _DB

CTX = AuthContext(user_id="user-1", tenant_id="t1", role="admin")


def _db(*, channel: str = "website", **over: object) -> _DB:
    db = _DB()
    reservierung: dict = {
        "id": "res-1",
        "tenant_id": "t1",
        "property_id": "prop-1",
        "currency": "DKK",
        "channel": channel,
        "ota_name": None,
        "source_channex_booking_id": None,
        "status": "confirmed",
        "total_amount": 3752.50,
        "paid_amount": 192.75,
        "guest_email": "okurz@example.dk",
        "guest_language": "da",
        "check_in": "2026-10-23",
        "check_out": "2026-10-28",
    }
    reservierung.update(over)
    db.store["reservations"] = [reservierung]
    db.store["tenant_billing_profile"] = [
        {
            "tenant_id": "t1",
            "stripe_account_id": "acct_1",
            "stripe_charges_enabled": True,
        }
    ]
    db.store["tenants"] = [{"id": "t1", "platform_fee_bps": 800}]
    db.store["reservation_charge_links"] = []
    db.store["reservation_events"] = []
    db.store["payments"] = []
    return db


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
    monkeypatch.setattr(n.sc, "create_payment_link", lambda **kw: fake.create(**kw))
    monkeypatch.setattr(
        n.sc, "deactivate_payment_link", lambda lid, **kw: fake.deactivate(lid, **kw)
    )
    monkeypatch.setattr(
        n.sc, "find_paid_session", lambda lid, **kw: fake.find(lid, **kw)
    )
    return fake


def _req(betrag: float = 500.0, grund: str = "Verlängerung um 2 Nächte"):  # noqa: ANN202
    return NachberechnungCreate(amount=betrag, grund=grund)


# --- Kanal-Gate --------------------------------------------------------------

@pytest.mark.parametrize("kanal", ["booking", "airbnb", "vrbo", "ota_other"])
def test_ota_buchung_bekommt_keinen_link(kanal: str, stripe: _StripeFake) -> None:
    """Bei einem Portal kassiert das Portal — ein eigener Link wäre eine
    zweite Kasse für dieselbe Forderung."""
    svc = NachberechnungService(_db(channel=kanal))
    with pytest.raises(PaymentsError) as exc:
        svc.erstellen(CTX, "res-1", _req())
    assert exc.value.status_code == 409
    assert not stripe.erstellt


def test_direkt_und_marktplatz_bekommen_keinen_link(stripe: _StripeFake) -> None:
    """`direct` (Telefon/vor Ort) und `portal` (myBestDays) sind ausdrücklich
    ausgeschlossen: dort ist der Zahlweg anderswo vereinbart."""
    for kanal in ("direct", "portal"):
        with pytest.raises(PaymentsError) as exc:
            NachberechnungService(_db(channel=kanal)).erstellen(CTX, "res-1", _req())
        assert exc.value.status_code == 409
    assert not stripe.erstellt


def test_channex_import_sperrt_auch_bei_kanal_website(stripe: _StripeFake) -> None:
    """Fail-closed: das Etikett `website` zählt nicht, wenn die Buchung
    nachweislich über Channex kam."""
    db = _db(source_channex_booking_id="cbk-1", ota_name="Booking.com")
    with pytest.raises(PaymentsError) as exc:
        NachberechnungService(db).erstellen(CTX, "res-1", _req())
    assert exc.value.status_code == 409
    assert "Booking.com" in exc.value.message
    assert not stripe.erstellt


def test_stornierte_buchung_fordert_nichts(stripe: _StripeFake) -> None:
    db = _db(status="cancelled")
    with pytest.raises(PaymentsError) as exc:
        NachberechnungService(db).erstellen(CTX, "res-1", _req())
    assert exc.value.status_code == 409
    assert not stripe.erstellt


# --- Erstellen ---------------------------------------------------------------

def test_website_buchung_ist_provisionsfrei(stripe: _StripeFake) -> None:
    """0380: eine Buchung über die eigene Website läuft nicht über uns. Der
    5-%-Satz der Zusatzleistungen darf hier NICHT greifen."""
    res = NachberechnungService(_db()).erstellen(CTX, "res-1", _req(500.0))
    assert res.amount_cents == 50000
    assert res.application_fee_cents == 0
    assert res.fee_bps == 0
    assert res.currency == "DKK"
    assert res.grund == "Verlängerung um 2 Nächte"
    # Direct Charge: der Link entsteht im Konto des Betriebs.
    assert stripe.erstellt[0]["acct"] == "acct_1"
    assert stripe.erstellt[0]["application_fee_cents"] == 0
    # Der Grund ist der Produktname auf der Zahlseite — kein Gastname.
    assert stripe.erstellt[0]["product_name"] == "Verlängerung um 2 Nächte"


def test_betrag_ueber_offen_wird_abgelehnt(stripe: _StripeFake) -> None:
    """Mehr als offen ist keine Nachberechnung, sondern eine Überzahlung."""
    svc = NachberechnungService(_db())
    with pytest.raises(PaymentsError) as exc:
        svc.erstellen(CTX, "res-1", _req(3600.0))  # offen: 3559,75
    assert exc.value.status_code == 422
    assert not stripe.erstellt


def test_ohne_waehrung_kein_link(stripe: _StripeFake) -> None:
    with pytest.raises(PaymentsError) as exc:
        NachberechnungService(_db(currency="")).erstellen(CTX, "res-1", _req())
    assert exc.value.status_code == 422
    assert not stripe.erstellt


def test_ohne_offenen_betrag_kein_link(stripe: _StripeFake) -> None:
    db = _db(paid_amount=3752.50)
    with pytest.raises(PaymentsError) as exc:
        NachberechnungService(db).erstellen(CTX, "res-1", _req())
    assert exc.value.status_code == 409
    assert not stripe.erstellt


def test_konto_ohne_freischaltung_kein_link(stripe: _StripeFake) -> None:
    db = _db()
    db.store["tenant_billing_profile"][0]["stripe_charges_enabled"] = False
    with pytest.raises(PaymentsError) as exc:
        NachberechnungService(db).erstellen(CTX, "res-1", _req())
    assert exc.value.status_code == 409
    assert not stripe.erstellt


def test_zweiter_klick_erzeugt_keinen_zweiten_link(stripe: _StripeFake) -> None:
    svc = NachberechnungService(_db())
    erst = svc.erstellen(CTX, "res-1", _req())
    zweit = svc.erstellen(CTX, "res-1", _req())
    assert erst.id == zweit.id
    assert len(stripe.erstellt) == 1
    assert not stripe.deaktiviert


def test_anderer_betrag_schliesst_den_alten_link(stripe: _StripeFake) -> None:
    """Sonst blieben ZWEI bezahlbare URLs im Umlauf (Wurzel 1)."""
    svc = NachberechnungService(_db())
    alt = svc.erstellen(CTX, "res-1", _req(500.0))
    neu = svc.erstellen(CTX, "res-1", _req(600.0))
    assert alt.id != neu.id
    assert stripe.deaktiviert == ["plink_1"]
    assert len(stripe.erstellt) == 2


def test_zurueckziehen_ist_idempotent(stripe: _StripeFake) -> None:
    db = _db()
    svc = NachberechnungService(db)
    svc.erstellen(CTX, "res-1", _req())
    svc.zurueckziehen(CTX, "res-1")
    svc.zurueckziehen(CTX, "res-1")  # nichts Offenes mehr da
    assert stripe.deaktiviert == ["plink_1"]
    assert db.store["reservation_charge_links"][0]["status"] == "cancelled"


# --- Lesen ------------------------------------------------------------------

def test_lesen_meldet_offenen_betrag_und_moeglichkeit(stripe: _StripeFake) -> None:
    stand = NachberechnungService(_db()).lesen(CTX, "res-1")
    assert stand.moeglich is True
    assert stand.hinweis is None
    assert stand.offen_amount == 3559.75
    assert stand.currency == "DKK"
    assert stand.link is None
    # Ohne `previous_total` am Ereignis wird nichts vorgeschlagen (Wurzel 4).
    assert stand.vorschlag_amount is None


def test_vorschlag_kommt_aus_dem_repriced_ereignis(stripe: _StripeFake) -> None:
    db = _db()
    db.store["reservation_events"] = [
        {
            "tenant_id": "t1",
            "reservation_id": "res-1",
            "kind": "repriced",
            "detail": {"previous_total": 2252.50, "total_amount": 3752.50},
        }
    ]
    stand = NachberechnungService(db).lesen(CTX, "res-1")
    assert stand.vorschlag_amount == 1500.0


def test_lesen_bei_ota_buchung_nennt_den_grund(stripe: _StripeFake) -> None:
    stand = NachberechnungService(_db(channel="booking")).lesen(CTX, "res-1")
    assert stand.moeglich is False
    assert stand.hinweis


def test_lesen_verbucht_eine_bei_stripe_bezahlte_zahlung(
    stripe: _StripeFake,
) -> None:
    """Netz unter dem Webhook: bleibt der Connect-Webhook aus, darf die
    Zahlung nicht dauerhaft als offen stehen."""
    db = _db()
    svc = NachberechnungService(db)
    svc.erstellen(CTX, "res-1", _req(500.0))
    stripe.sessions["plink_1"] = {
        "id": "cs_1",
        "payment_intent": "pi_1",
        "amount_total": 50000,
    }
    stand = svc.lesen(CTX, "res-1")
    assert stand.link is None  # nicht mehr offen
    assert db.store["reservation_charge_links"][0]["status"] == "paid"
    assert db.store["reservations"][0]["paid_amount"] == 692.75


# --- Webhook ----------------------------------------------------------------

def _session(**over: object) -> dict:
    session = {
        "id": "cs_1",
        "payment_link": "plink_1",
        "payment_status": "paid",
        "payment_intent": "pi_1",
        "amount_total": 50000,
        "metadata": {
            "nd_zweck": "nachberechnung",
            "tenant_id": "t1",
            "reservation_id": "res-1",
        },
    }
    session.update(over)
    return session


def test_webhook_verbucht_beleg_und_erhoeht_bezahlt(stripe: _StripeFake) -> None:
    db = _db()
    NachberechnungService(db).erstellen(CTX, "res-1", _req(500.0))
    assert verbuche_checkout_session(db, _session(), account="acct_1") is True
    link = db.store["reservation_charge_links"][0]
    assert link["status"] == "paid"
    assert link["checkout_session_id"] == "cs_1"
    beleg = db.store["payments"][0]
    # Eigener Typ: eine Nachberechnung ist weder Anzahlung noch Restzahlung —
    # als 'full' verbucht wäre die Buchung fälschlich komplett bezahlt.
    assert beleg["type"] == "surcharge"
    assert beleg["amount"] == 500.0
    # Referenz ist die Session, nicht der PaymentIntent (sonst greift der
    # payment_intent.succeeded-Pfad und plant eine Auszahlung).
    assert beleg["gateway_ref"] == "cs_1"
    assert db.store["reservations"][0]["paid_amount"] == 692.75
    assert db.store["reservation_events"][0]["kind"] == "surcharge_paid"


def test_webhook_redelivery_zahlt_nicht_doppelt(stripe: _StripeFake) -> None:
    db = _db()
    NachberechnungService(db).erstellen(CTX, "res-1", _req(500.0))
    verbuche_checkout_session(db, _session(), account="acct_1")
    verbuche_checkout_session(db, _session(), account="acct_1")
    assert len(db.store["payments"]) == 1
    assert db.store["reservations"][0]["paid_amount"] == 692.75


def test_webhook_ignoriert_fremde_zwecke(stripe: _StripeFake) -> None:
    db = _db()
    NachberechnungService(db).erstellen(CTX, "res-1", _req(500.0))
    fremd = _session(metadata={"nd_zweck": "addon"})
    assert verbuche_checkout_session(db, fremd, account="acct_1") is False
    assert not db.store["payments"]


def test_webhook_lehnt_fremdes_konto_ab(stripe: _StripeFake) -> None:
    db = _db()
    NachberechnungService(db).erstellen(CTX, "res-1", _req(500.0))
    assert verbuche_checkout_session(db, _session(), account="acct_fremd") is False
    assert db.store["reservation_charge_links"][0]["status"] == "open"
    assert not db.store["payments"]


def test_webhook_verbucht_abweichenden_betrag_nicht(stripe: _StripeFake) -> None:
    """Lieber sichtbar offen als still falsch (Wurzel 5)."""
    db = _db()
    NachberechnungService(db).erstellen(CTX, "res-1", _req(500.0))
    verbuche_checkout_session(db, _session(amount_total=49900), account="acct_1")
    assert db.store["reservation_charge_links"][0]["status"] == "open"
    assert not db.store["payments"]


def test_webhook_unbezahlte_session_verbucht_nichts(stripe: _StripeFake) -> None:
    db = _db()
    NachberechnungService(db).erstellen(CTX, "res-1", _req(500.0))
    assert (
        verbuche_checkout_session(
            db, _session(payment_status="unpaid"), account="acct_1"
        )
        is True
    )
    assert db.store["reservation_charge_links"][0]["status"] == "open"


# --- Gegenzustand: Buchung ändert sich --------------------------------------

def test_betragsaenderung_schliesst_offenen_link(stripe: _StripeFake) -> None:
    db = _db()
    NachberechnungService(db).erstellen(CTX, "res-1", _req(500.0))
    assert (
        ziehe_link_zurueck_bei_betragsaenderung(
            db, tenant_id="t1", reservation_id="res-1"
        )
        is True
    )
    assert stripe.deaktiviert == ["plink_1"]
    assert db.store["reservation_charge_links"][0]["status"] == "cancelled"


def test_ohne_offenen_link_ist_der_gegenzustand_ein_no_op(
    stripe: _StripeFake,
) -> None:
    db = _db()
    assert (
        ziehe_link_zurueck_bei_betragsaenderung(
            db, tenant_id="t1", reservation_id="res-1"
        )
        is False
    )
    assert not stripe.deaktiviert


def test_link_veraltet_wenn_der_buchungsbetrag_sich_aendert(
    stripe: _StripeFake,
) -> None:
    db = _db()
    svc = NachberechnungService(db)
    svc.erstellen(CTX, "res-1", _req(500.0))
    db.store["reservations"][0]["total_amount"] = 4000.0
    stand = svc.lesen(CTX, "res-1")
    assert stand.link is not None
    assert stand.link.betrag_veraltet is True


# --- Geplante Restzahlung (Wurzel 1) ----------------------------------------

def test_reprice_zieht_die_geplante_restzahlung_nach() -> None:
    """Ohne das zöge der Worker-Tick später den ALTEN Betrag ein."""
    db = _db()
    db.store["payments"] = [
        {
            "id": "pay-1",
            "reservation_id": "res-1",
            "type": "balance",
            "amount": 1000.0,
            "scheduled_status": "scheduled",
        }
    ]
    passe_restzahlung_an(
        db, reservation_id="res-1", total_amount=3752.50, paid_amount=192.75
    )
    assert db.store["payments"][0]["amount"] == 3559.75
    assert db.store["payments"][0]["scheduled_status"] == "scheduled"


def test_vollstaendig_bezahlt_laesst_die_restzahlung_entfallen() -> None:
    db = _db()
    db.store["payments"] = [
        {
            "id": "pay-1",
            "reservation_id": "res-1",
            "type": "balance",
            "amount": 1000.0,
            "scheduled_status": "scheduled",
        }
    ]
    passe_restzahlung_an(
        db, reservation_id="res-1", total_amount=1000.0, paid_amount=1000.0
    )
    assert db.store["payments"][0]["scheduled_status"] == "cancelled"


def test_laufender_charge_wird_nicht_angefasst() -> None:
    """`charging` läuft gerade bei Stripe — ein Update wäre eine zweite
    Wahrheit mitten im Zahlungsvorgang."""
    db = _db()
    db.store["payments"] = [
        {
            "id": "pay-1",
            "reservation_id": "res-1",
            "type": "balance",
            "amount": 1000.0,
            "scheduled_status": "charging",
        }
    ]
    passe_restzahlung_an(
        db, reservation_id="res-1", total_amount=3752.50, paid_amount=0.0
    )
    assert db.store["payments"][0]["amount"] == 1000.0


def test_ohne_geplante_restzahlung_wird_keine_angelegt() -> None:
    """Ohne gespeicherte Karte könnte der Worker sie nie belasten — eine
    dauerhaft geplante Zahlung ohne Zahlweg wäre eine Attrappe."""
    db = _db()
    passe_restzahlung_an(
        db, reservation_id="res-1", total_amount=3752.50, paid_amount=192.75
    )
    assert not db.store["payments"]


# --- Mailversand ------------------------------------------------------------

class _MailFake:
    def __init__(self) -> None:
        self.gesendet: list[object] = []

    def send(self, msg: object) -> None:
        self.gesendet.append(msg)


def test_mail_geht_in_der_sprache_des_gastes_raus(stripe: _StripeFake) -> None:
    db = _db()
    mail = _MailFake()
    svc = NachberechnungService(db, mail=mail)  # type: ignore[arg-type]
    svc.erstellen(CTX, "res-1", _req(500.0))
    svc.senden(CTX, "res-1")
    assert len(mail.gesendet) == 1
    nachricht = mail.gesendet[0]
    assert nachricht.to == "okurz@example.dk"  # type: ignore[attr-defined]
    # Dänisch (guest_language='da'), nicht Deutsch als stiller Rückfall.
    assert "booking" in nachricht.subject.lower()  # type: ignore[attr-defined]
    assert "https://buy.stripe.com/test_1" in nachricht.text  # type: ignore[attr-defined]


def test_mail_ohne_offenen_link_ist_ein_konflikt(stripe: _StripeFake) -> None:
    svc = NachberechnungService(_db(), mail=_MailFake())  # type: ignore[arg-type]
    with pytest.raises(PaymentsError) as exc:
        svc.senden(CTX, "res-1")
    assert exc.value.status_code == 409


def test_mail_ohne_gastadresse_scheitert_sichtbar(stripe: _StripeFake) -> None:
    """Kein stiller Ausfall: der Betrieb muss den Link von Hand weitergeben."""
    db = _db(guest_email=None)
    mail = _MailFake()
    svc = NachberechnungService(db, mail=mail)  # type: ignore[arg-type]
    svc.erstellen(CTX, "res-1", _req(500.0))
    with pytest.raises(PaymentsError) as exc:
        svc.senden(CTX, "res-1")
    assert exc.value.status_code == 422
    assert not mail.gesendet


# --- Scope (Wurzel 3) -------------------------------------------------------

def test_fremder_tenant_findet_die_buchung_nicht(stripe: _StripeFake) -> None:
    fremd = AuthContext(user_id="user-2", tenant_id="t2", role="admin")
    with pytest.raises(PaymentsError) as exc:
        NachberechnungService(_db()).erstellen(fremd, "res-1", _req())
    assert exc.value.status_code == 404
    assert not stripe.erstellt


# --- Bezahlt ohne Karte (0470) ----------------------------------------------

def test_offenen_link_als_bezahlt_markieren(stripe: _StripeFake) -> None:
    """Der Gast hat bar gezahlt: Link zuerst bei Stripe schließen, dann buchen."""
    db = _db()
    svc = NachberechnungService(db)
    svc.erstellen(CTX, "res-1", _req(500.0))
    res = svc.als_bezahlt_markieren(CTX, "res-1")
    assert res.status == "paid"
    assert res.bezahlt_manuell is True
    # Reihenfolge: ohne die Deaktivierung bliebe eine bezahlbare URL im Umlauf.
    assert stripe.deaktiviert == ["plink_1"]
    assert db.store["payments"][0]["type"] == "surcharge"
    assert db.store["payments"][0]["gateway_ref"].startswith("manuell:")
    assert db.store["reservations"][0]["paid_amount"] == 692.75
    assert db.store["reservation_events"][0]["kind"] == "surcharge_paid_manually"


def test_als_bezahlt_ohne_offenen_link_ist_konflikt(stripe: _StripeFake) -> None:
    with pytest.raises(PaymentsError) as exc:
        NachberechnungService(_db()).als_bezahlt_markieren(CTX, "res-1")
    assert exc.value.status_code == 409


def test_bezahlt_erfassen_ohne_link(stripe: _StripeFake) -> None:
    """Zahlung an der Rezeption: kein Stripe-Aufruf, keine URL."""
    db = _db()
    res = NachberechnungService(db).bezahlt_erfassen(CTX, "res-1", _req(300.0))
    assert res.status == "paid"
    assert res.bezahlt_manuell is True
    assert res.url is None
    assert not stripe.erstellt
    assert db.store["reservations"][0]["paid_amount"] == 492.75
    assert db.store["payments"][0]["amount"] == 300.0


def test_bezahlt_erfassen_prueft_kanal_und_betrag(stripe: _StripeFake) -> None:
    with pytest.raises(PaymentsError) as exc:
        NachberechnungService(_db(channel="booking")).bezahlt_erfassen(
            CTX, "res-1", _req(300.0)
        )
    assert exc.value.status_code == 409
    with pytest.raises(PaymentsError) as exc:
        NachberechnungService(_db()).bezahlt_erfassen(CTX, "res-1", _req(4000.0))
    assert exc.value.status_code == 422


def test_bezahlte_erscheinen_im_lesepfad(stripe: _StripeFake) -> None:
    db = _db()
    svc = NachberechnungService(db)
    svc.bezahlt_erfassen(CTX, "res-1", _req(300.0, "Verlängerung"))
    stand = svc.lesen(CTX, "res-1")
    assert len(stand.bezahlt) == 1
    assert stand.bezahlt[0].amount_cents == 30000
    assert stand.bezahlt[0].grund == "Verlängerung"
    assert stand.bezahlt[0].bezahlt_manuell is True


def test_ruecknahme_senkt_bezahlt_und_loescht_beleg(stripe: _StripeFake) -> None:
    db = _db()
    svc = NachberechnungService(db)
    erfasst = svc.bezahlt_erfassen(CTX, "res-1", _req(300.0))
    svc.bezahlt_zuruecknehmen(CTX, "res-1", erfasst.id, "falsch erfasst")
    zeile = db.store["reservation_charge_links"][0]
    assert zeile["status"] == "cancelled"
    assert zeile["unpaid_reason"] == "falsch erfasst"
    # Der Zahl-Zeitpunkt gehörte zu einer Zahlung, die es nicht gab.
    assert zeile["paid_at"] is None
    assert not db.store["payments"]
    assert db.store["reservations"][0]["paid_amount"] == 192.75
    assert db.store["reservation_events"][-1]["kind"] == "surcharge_unpaid"


def test_ruecknahme_verlangt_grund(stripe: _StripeFake) -> None:
    db = _db()
    svc = NachberechnungService(db)
    erfasst = svc.bezahlt_erfassen(CTX, "res-1", _req(300.0))
    with pytest.raises(PaymentsError) as exc:
        svc.bezahlt_zuruecknehmen(CTX, "res-1", erfasst.id, "  ")
    assert exc.value.status_code == 422
    assert db.store["reservation_charge_links"][0]["status"] == "paid"


def test_stripe_zahlung_laesst_sich_nicht_zuruecknehmen(
    stripe: _StripeFake,
) -> None:
    """Eine eingegangene Kartenzahlung ist eine Tatsache — sie wird erstattet."""
    db = _db()
    svc = NachberechnungService(db)
    erstellt = svc.erstellen(CTX, "res-1", _req(500.0))
    verbuche_checkout_session(db, _session(), account="acct_1")
    with pytest.raises(PaymentsError) as exc:
        svc.bezahlt_zuruecknehmen(CTX, "res-1", erstellt.id, "doch nicht bezahlt")
    assert exc.value.status_code == 409
    assert db.store["reservation_charge_links"][0]["status"] == "paid"
    assert db.store["payments"]


def test_festgeschriebene_rechnung_blockiert_die_ruecknahme(
    stripe: _StripeFake,
) -> None:
    """GoBD: eine gezogene Rechnungsnummer wird nicht nachträglich verändert."""
    db = _db()
    svc = NachberechnungService(db)
    erfasst = svc.bezahlt_erfassen(CTX, "res-1", _req(300.0))
    db.store["invoices"] = [
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
    with pytest.raises(PaymentsError) as exc:
        svc.bezahlt_zuruecknehmen(CTX, "res-1", erfasst.id, "falsch erfasst")
    assert exc.value.status_code == 409
    assert db.store["reservation_charge_links"][0]["status"] == "paid"


def test_rechnungsentwurf_blockiert_die_ruecknahme_nicht(
    stripe: _StripeFake,
) -> None:
    db = _db()
    svc = NachberechnungService(db)
    erfasst = svc.bezahlt_erfassen(CTX, "res-1", _req(300.0))
    db.store["invoices"] = [
        {
            "id": "inv-1",
            "tenant_id": "t1",
            "reservation_id": "res-1",
            "invoice_type": "invoice",
            "status": "draft",
            "deleted_at": None,
            "invoice_number": None,
        }
    ]
    svc.bezahlt_zuruecknehmen(CTX, "res-1", erfasst.id, "falsch erfasst")
    assert db.store["reservation_charge_links"][0]["status"] == "cancelled"


def test_ruecknahme_zieht_die_geplante_restzahlung_nach(
    stripe: _StripeFake,
) -> None:
    """Sonst zöge der Worker-Tick nach der Rücknahme zu wenig ein (Wurzel 1)."""
    db = _db()
    db.store["payments"] = [
        {
            "id": "pay-1",
            "reservation_id": "res-1",
            "type": "balance",
            "amount": 3559.75,
            "scheduled_status": "scheduled",
        }
    ]
    svc = NachberechnungService(db)
    erfasst = svc.bezahlt_erfassen(CTX, "res-1", _req(300.0))
    assert db.store["payments"][0]["amount"] == 3259.75
    svc.bezahlt_zuruecknehmen(CTX, "res-1", erfasst.id, "falsch erfasst")
    assert db.store["payments"][0]["amount"] == 3559.75
