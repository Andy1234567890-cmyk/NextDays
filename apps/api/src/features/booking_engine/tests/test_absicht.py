"""Keine Buchung ohne bezahlte Zahlung (0409).

DER ANLASS: Über die eigene Plattform entstand eine Reservierung mit
`status='confirmed'` und `paid_amount=0.00` (live am 18.08.2026). Sie belegte
drei Nächte, sperrte sie bei den OTAs und stiess die Automails an — bezahlt hat
sie nie jemand. Der Gast hatte die Zahlung nach der Buchungsanlage abgebrochen.

Diese Tests halten die Umkehrung fest: Der Buchungsendpunkt schreibt NICHTS
mehr, und die Reservierung entsteht ausschliesslich aus einer bezahlten
Absicht. Alles hier prüft genau diese Grenze — die Stellen, an denen früher
eine unbezahlte Buchung entstehen konnte.
"""
from __future__ import annotations

from datetime import date, timedelta
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest

from src.features.booking_engine import absicht
from src.features.booking_engine.schemas import GuestContact, PublicBookingRequest
from src.features.booking_engine.service import BookingEngineError, BookingEngineService


def _db() -> MagicMock:
    """DB-Mock, in dem der Zeitraum frei ist."""
    db = MagicMock(name="supabase")

    def table(name: str) -> MagicMock:
        t = MagicMock(name=f"table:{name}")
        if name in ("availability", "stop_sell"):
            kette = (
                t.select.return_value.eq.return_value.gte.return_value.lt.return_value
            )
            kette.execute.return_value.data = []
        return t

    db.table.side_effect = table
    db.rpc.return_value.execute.return_value.data = {
        "reservation": {"id": "res-1"},
        "outbox_id": None,
    }
    return db


def _service(monkeypatch: pytest.MonkeyPatch, db: MagicMock) -> BookingEngineService:
    import src.features.pricing.resolver as resolver_mod

    svc = BookingEngineService(service_client=db)
    monkeypatch.setattr(
        svc,
        "_public_property",
        lambda *_a: {"tenant_id": "t-1", "status": "active", "max_guests": 6},
    )
    monkeypatch.setattr(svc, "_upsert_guest", lambda *_a: "g-1")
    monkeypatch.setattr(svc, "_push_channex", lambda *_a, **_k: None)
    monkeypatch.setattr(svc, "_nachlauf", lambda **_k: None)
    monkeypatch.setattr(
        resolver_mod.PricingResolver,
        "quote",
        lambda _self, _req: SimpleNamespace(
            total=260.0, currency="DKK", lines=[], priceless=False, unpriced_nights=0
        ),
    )
    return svc


def _anfrage() -> PublicBookingRequest:
    return PublicBookingRequest(
        property_id="p-1",
        check_in=date.today() + timedelta(days=30),
        check_out=date.today() + timedelta(days=32),
        guests=2,
        contact=GuestContact(
            first_name="Andy", last_name="Test", email="test@example.com"
        ),
    )


def _stripe_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(absicht, "anlegen", lambda *_a, **_k: "abs-1")
    monkeypatch.setattr(absicht, "zahlung_vermerken", lambda *_a, **_k: None)
    monkeypatch.setattr(
        "src.features.payments.service.PaymentsService.create_intent_for_absicht",
        lambda *_a, **_k: {
            "payment_ref": "pi_1",
            "client_secret": "cs_1",
            "publishable_key": "pk_test",
            "stripe_account": "acct_1",
        },
    )


# --- Der Kern: vor der Zahlung entsteht nichts ------------------------------
def test_buchen_legt_keine_reservierung_an(monkeypatch: pytest.MonkeyPatch) -> None:
    """DIE REGEL. Genau das ging live schief: `confirmed` + `paid_amount 0,00`.

    Der Endpunkt darf den Kalender nicht anfassen — weder `reservations` noch
    `availability` noch `ari_outbox`, die alle an derselben RPC hängen.
    """
    db = _db()
    svc = _service(monkeypatch, db)
    _stripe_ok(monkeypatch)

    antwort = svc.create_public_booking(_anfrage())

    assert antwort.zahlung_erforderlich is True
    assert antwort.status == "zahlung_offen"
    assert antwort.client_secret == "cs_1"
    assert not any(
        aufruf[0][0] == "create_reservation_atomic"
        for aufruf in db.rpc.call_args_list
    ), "Vor bezahlter Zahlung darf keine Reservierung entstehen."


def test_antwort_traegt_den_serverpreis(monkeypatch: pytest.MonkeyPatch) -> None:
    """Der Gast sieht, was er zahlt — aus dem Quote, nicht aus seinem Request.

    Der Client schickt zwar `total_amount`, es wird aber ignoriert; sonst
    liesse sich eine 0-Buchung anlegen (Wurzel 3).
    """
    svc = _service(monkeypatch, _db())
    _stripe_ok(monkeypatch)
    antwort = svc.create_public_booking(_anfrage())
    assert antwort.total_amount == 260.0
    assert antwort.currency == "DKK"


def test_ohne_waehrung_keine_zahlung(monkeypatch: pytest.MonkeyPatch) -> None:
    """Fehlende Währung ist ein Datenfehler → 422, kein EUR-Ersatz (Wurzel 4)."""
    import src.features.pricing.resolver as resolver_mod

    svc = _service(monkeypatch, _db())
    monkeypatch.setattr(
        resolver_mod.PricingResolver,
        "quote",
        lambda _self, _req: SimpleNamespace(
            total=260.0, currency=None, lines=[], priceless=False, unpriced_nights=0
        ),
    )
    with pytest.raises(BookingEngineError) as exc:
        svc.create_public_booking(_anfrage())
    assert exc.value.status_code == 422


# --- Das Einlösen ----------------------------------------------------------
def _absicht_zeile(**abweichung: Any) -> dict[str, Any]:
    zeile = {
        "status": absicht.OFFEN,
        "tenant_id": "t-1",
        "property_id": "p-1",
        "check_in": (date.today() + timedelta(days=30)).isoformat(),
        "check_out": (date.today() + timedelta(days=32)).isoformat(),
        "total_amount": 260.0,
        "currency": "DKK",
        "reservation_id": None,
        "daten": {
            "guests": 2,
            "pets": 1,
            "guest_id": "g-1",
            "contact": {"first_name": "Andy", "email": "test@example.com"},
            "quote_items": [{"label": "Übernachtung", "amount": 260.0}],
        },
    }
    zeile.update(abweichung)
    return zeile


def test_bezahlte_absicht_erzeugt_bestaetigte_buchung(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Erst hier — und dann mit allen Daten, die der Gast eingegeben hat."""
    db = _db()
    svc = _service(monkeypatch, db)
    monkeypatch.setattr(absicht, "laden", lambda *_a: _absicht_zeile())
    monkeypatch.setattr(absicht, "als_eingeloest", lambda *_a: True)

    assert svc.absicht_einloesen("abs-1") == "res-1"

    payload = next(
        aufruf[0][1]["p_reservation"]
        for aufruf in db.rpc.call_args_list
        if aufruf[0][0] == "create_reservation_atomic"
    )
    assert payload["status"] == "confirmed"
    assert payload["channel"] == "portal"
    assert payload["ota_name"] == "myBestDays"
    assert payload["num_guests"] == 2
    assert payload["pets"] == 1
    assert payload["total_amount"] == 260.0
    assert payload["currency"] == "DKK"
    assert payload["guest_email"] == "test@example.com"


def test_zweite_zustellung_bucht_nicht_erneut(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Wurzel 2: Stripe stellt Webhooks mehrfach zu.

    Eine bereits eingelöste Absicht führt sofort zurück — sonst entstünden aus
    einer Zahlung zwei Buchungen, und die zweite belegte Nächte, für die
    niemand gezahlt hat.
    """
    db = _db()
    svc = _service(monkeypatch, db)
    monkeypatch.setattr(
        absicht,
        "laden",
        lambda *_a: _absicht_zeile(status=absicht.EINGELOEST, reservation_id="res-1"),
    )

    assert svc.absicht_einloesen("abs-1") == "res-1"
    assert not any(
        aufruf[0][0] == "create_reservation_atomic"
        for aufruf in db.rpc.call_args_list
    ), "Eine eingelöste Absicht darf keine zweite Buchung erzeugen."


def test_verlorenes_rennen_storniert_als_system(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """0410 — der Rollback ist ein SYSTEM-Storno, kein Storno des Betriebs.

    Verliert diese Zustellung das Rennen (eine parallele hat die Absicht schon
    eingelöst), nimmt der Code die eben angelegte Buchung zurück. Ausgelöst hat
    das unsere eigene Automatik — niemand hat einen Vertrag gebrochen. Stünde
    hier `betrieb`, schlüge das Regelwerk ab Etappe 4 „Provision zurück" vor
    und der Betrieb sähe einen Storno in seiner Statistik, den er nie gemacht
    hat.
    """
    db = _db()
    svc = _service(monkeypatch, db)
    monkeypatch.setattr(absicht, "laden", lambda *_a: _absicht_zeile())
    # Das Rennen ist verloren: der Claim greift nicht mehr.
    monkeypatch.setattr(absicht, "als_eingeloest", lambda *_a: False)
    reservations = MagicMock(name="ReservationsService")
    monkeypatch.setattr(
        "src.features.reservations.service.ReservationsService", reservations
    )

    assert svc.absicht_einloesen("abs-1") is None

    reservations.return_value.cancel.assert_called_once()
    kwargs = reservations.return_value.cancel.call_args.kwargs
    assert kwargs["partei"].value == "system"
    assert kwargs["reason_code"].value == "system_rollback"


def test_unbekannte_absicht_bucht_nicht(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _db()
    svc = _service(monkeypatch, db)
    monkeypatch.setattr(absicht, "laden", lambda *_a: None)
    assert svc.absicht_einloesen("abs-weg") is None
    assert not db.rpc.call_args_list


# --- Die Zustände der Absicht ----------------------------------------------
def test_absicht_ohne_betrag_wird_abgewiesen() -> None:
    """Ohne Betrag gäbe es keine Zahlung — und damit keine Buchung (Wurzel 4)."""
    with pytest.raises(absicht.AbsichtFehler):
        absicht.anlegen(
            MagicMock(),
            tenant_id="t-1",
            property_id="p-1",
            daten={},
            check_in=date.today(),
            check_out=date.today() + timedelta(days=1),
            total_amount=0,
            currency="DKK",
        )


def test_absicht_ohne_waehrung_wird_abgewiesen() -> None:
    with pytest.raises(absicht.AbsichtFehler):
        absicht.anlegen(
            MagicMock(),
            tenant_id="t-1",
            property_id="p-1",
            daten={},
            check_in=date.today(),
            check_out=date.today() + timedelta(days=1),
            total_amount=100.0,
            currency="",
        )


def test_claim_greift_nur_auf_offene_absicht() -> None:
    """Der Status-Guard IM UPDATE ist die Idempotenz-Schranke (Wurzel 2).

    Ohne `.eq("status", OFFEN)` würden zwei gleichzeitige Webhook-Zustellungen
    beide durchkommen.
    """
    db = MagicMock()
    kette = db.table.return_value.update.return_value.eq.return_value.eq.return_value
    kette.execute.return_value.data = [{"id": "abs-1"}]

    assert absicht.als_eingeloest(db, "abs-1", "res-1") is True
    # Die zweite Bedingung ist der Status-Filter — er MUSS gesetzt sein.
    zweite_eq = db.table.return_value.update.return_value.eq.return_value.eq
    assert zweite_eq.call_args[0] == ("status", absicht.OFFEN)


def test_claim_meldet_verlorenes_rennen() -> None:
    """Leeres Ergebnis = ein anderer Webhook war schneller."""
    db = MagicMock()
    kette = db.table.return_value.update.return_value.eq.return_value.eq.return_value
    kette.execute.return_value.data = []
    assert absicht.als_eingeloest(db, "abs-1", "res-1") is False
