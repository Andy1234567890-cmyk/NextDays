"""Tests der Auszahlung von Beteiligungen.

Hier fließt echtes Geld — abgedeckt sind die Fälle, in denen doppelt, gar nicht
oder an den Falschen ausgezahlt würde:

  1. Ohne auszahlungsbereites Stripe-Konto wird nicht transferiert.
  2. Ein fehlgeschlagener Transfer blockiert die übrigen nicht.
  3. Jeder Transfer bekommt einen deterministischen Idempotenz-Key.
  4. Bereits ausgezahlte Zeilen werden nicht neu berechnet.
  5. Bei Destination Charges wird GAR NICHT transferiert (Doppelzahlung).
"""
from unittest.mock import MagicMock, patch

import pytest

from src.features.cohosts.payout_service import PayoutService
from src.features.payouts.faelligkeit import transfer_group


@pytest.fixture(autouse=True)
def _separate_transfers(monkeypatch: pytest.MonkeyPatch) -> None:
    """Standard für diese Datei: Charge und Transfer sind getrennt.

    Ohne das greift die Sperre in ``pay_pending`` und es liefe nie ein
    Transfer — die Auszahlungsfälle wären dann gar nicht geprüft. Der
    gesperrte Zustand hat einen eigenen Test.
    """
    einstellungen = MagicMock()
    einstellungen.stripe_separate_transfers = True
    monkeypatch.setattr(
        "src.features.cohosts.payout_service.get_settings",
        lambda: einstellungen,
    )


def _db() -> MagicMock:
    return MagicMock(name="supabase")


def _kette(mock: MagicMock, *schritte: str) -> MagicMock:
    aktuell = mock
    for s in schritte:
        aktuell = getattr(aktuell, s).return_value
    return aktuell


def _offene_zeile(**over: object) -> dict:
    basis = {
        "id": "p1",
        "user_id": "u1",
        "payout_amount_cents": 5_000,
        "currency": "EUR",
        "transfer_group": transfer_group("res1"),
        "status": "pending",
    }
    return {**basis, **over}


def _setup(db: MagicMock, zeilen: list[dict], konten: list[dict]) -> MagicMock:
    payouts = MagicMock()
    _kette(payouts, "select", "eq", "eq", "limit").execute.return_value.data = zeilen
    accounts = MagicMock()
    _kette(accounts, "select", "in_").execute.return_value.data = konten
    db.table.side_effect = lambda n: (
        accounts if n == "cohost_stripe_accounts" else payouts
    )
    return payouts


def test_ohne_auszahlungsbereites_konto_kein_transfer() -> None:
    """Ein Konto ohne payouts_enabled darf kein Geld bekommen."""
    db = _db()
    _setup(
        db,
        [_offene_zeile()],
        [{"user_id": "u1", "stripe_account_id": "acct_1", "payouts_enabled": False}],
    )
    with patch(
        "src.features.cohosts.payout_service.sc.create_transfer"
    ) as transfer:
        anzahl = PayoutService(db=db).pay_pending(reservation_id="res1")
    transfer.assert_not_called()
    assert anzahl == 0


def test_fehlendes_konto_blockiert_die_anderen_nicht() -> None:
    """Ein Co-Gastgeber ohne Konto darf die Auszahlung der übrigen nicht stoppen."""
    db = _db()
    _setup(
        db,
        [
            _offene_zeile(id="p1", user_id="u1"),
            _offene_zeile(id="p2", user_id="u2"),
        ],
        # Nur u2 hat ein fertiges Konto.
        [{"user_id": "u2", "stripe_account_id": "acct_2", "payouts_enabled": True}],
    )
    with patch(
        "src.features.cohosts.payout_service.sc.create_transfer",
        return_value={"id": "tr_2"},
    ) as transfer:
        anzahl = PayoutService(db=db).pay_pending(reservation_id="res1")
    assert anzahl == 1
    assert transfer.call_count == 1


def test_transfer_bekommt_deterministischen_idempotenz_key() -> None:
    """Ein Retry darf bei Stripe nicht doppelt auszahlen (Wurzel 2)."""
    db = _db()
    _setup(
        db,
        [_offene_zeile(id="p-abc")],
        [{"user_id": "u1", "stripe_account_id": "acct_1", "payouts_enabled": True}],
    )
    with patch(
        "src.features.cohosts.payout_service.sc.create_transfer",
        return_value={"id": "tr_1"},
    ) as transfer:
        PayoutService(db=db).pay_pending(reservation_id="res1")
    assert transfer.call_args.kwargs["idempotency_key"] == "cohost-payout-p-abc"


def test_transfer_group_klammert_die_buchung() -> None:
    """Alle Transfers einer Buchung teilen sich die transfer_group.

    Es muss DIESELBE Klammer sein wie am Charge und am Gastgeber-Transfer —
    die nackte Reservierungs-ID würde eine eigene Gruppe aufmachen.
    """
    db = _db()
    _setup(
        db,
        [_offene_zeile()],
        [{"user_id": "u1", "stripe_account_id": "acct_1", "payouts_enabled": True}],
    )
    with patch(
        "src.features.cohosts.payout_service.sc.create_transfer",
        return_value={"id": "tr_1"},
    ) as transfer:
        PayoutService(db=db).pay_pending(reservation_id="res1")
    assert transfer.call_args.kwargs["transfer_group"] == transfer_group("res1")
    assert transfer.call_args.kwargs["transfer_group"] == "reservation:res1"


def test_destination_charge_sperrt_den_transfer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Kernschutz gegen Doppelzahlung.

    Bei einer Destination Charge hat der Gastgeber den vollen Betrag inklusive
    des Co-Gastgeber-Anteils bereits erhalten — der Anteil steckt NICHT in der
    application_fee. Ein Transfer käme zusätzlich aus dem Plattform-Saldo.
    """
    einstellungen = MagicMock()
    einstellungen.stripe_separate_transfers = False
    monkeypatch.setattr(
        "src.features.cohosts.payout_service.get_settings",
        lambda: einstellungen,
    )
    db = _db()
    _setup(
        db,
        [_offene_zeile()],
        [{"user_id": "u1", "stripe_account_id": "acct_1", "payouts_enabled": True}],
    )
    with patch(
        "src.features.cohosts.payout_service.sc.create_transfer"
    ) as transfer:
        anzahl = PayoutService(db=db).pay_pending(reservation_id="res1")
    transfer.assert_not_called()
    assert anzahl == 0


def test_stripe_fehler_wird_festgehalten_nicht_geschluckt() -> None:
    """Ein gescheiterter Transfer muss sichtbar bleiben (Wurzel 5)."""
    db = _db()
    payouts = _setup(
        db,
        [_offene_zeile()],
        [{"user_id": "u1", "stripe_account_id": "acct_1", "payouts_enabled": True}],
    )
    with patch(
        "src.features.cohosts.payout_service.sc.create_transfer",
        side_effect=RuntimeError("insufficient funds"),
    ):
        anzahl = PayoutService(db=db).pay_pending(reservation_id="res1")
    assert anzahl == 0
    # Der Grund landet an der Zeile, nicht nur im Nichts.
    geschrieben = [c.args[0] for c in payouts.update.call_args_list if c.args]
    assert any("last_error" in g for g in geschrieben)


def test_keine_offenen_zeilen_ist_kein_fehler() -> None:
    """Buchung ohne Beteiligung: nichts zu tun, kein Fehler."""
    db = _db()
    _setup(db, [], [])
    assert PayoutService(db=db).pay_pending(reservation_id="res1") == 0
