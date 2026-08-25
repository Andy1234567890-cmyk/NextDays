"""Eine fällige Restzahlung darf an einem fehlenden Schlüssel nicht sterben.

Kontext (25.08.2026): `nextdays-worker` fährt den stündlichen Einzugslauf, hatte
in Coolify aber keinen `STRIPE_SECRET_KEY` — anders als `nextdays-api`. Der
Client wurde damals erst UNTEN in der Argumentliste aufgelöst
(`client=self._stripe`), also nachdem die Zeile bereits auf `charging` stand.
Der `StripeNotConfiguredError` lief dadurch in das allgemeine
`except PaymentsError` und schrieb `failed`.

Das ist der teure Teil: die Zeile war nie bei Stripe, wurde aber abgeschrieben —
und der stündliche Tick greift sie nie wieder auf, weil er nur `scheduled`
liest. Ein behebbarer Betriebsmangel hätte so echte Forderungen dauerhaft
verloren (Wurzel 1: kein halber Gegenzustand; Wurzel 5: kein stiller Ausfall).
"""
from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from src.features.payments.service import (
    PaymentsConfigError,
    PaymentsError,
    PaymentsService,
)


class _Kette:  # pylint: disable=too-few-public-methods
    def __init__(self, db: _DB, tabelle: str) -> None:
        self._db = db
        self._tabelle = tabelle

    def select(self, *_a: Any, **_k: Any) -> _Kette:
        return self

    def update(self, zeile: dict) -> _Kette:
        self._db.updates.append((self._tabelle, dict(zeile)))
        return self

    def eq(self, *_a: Any) -> _Kette:
        return self

    def limit(self, _n: int) -> _Kette:
        return self

    def execute(self) -> Any:
        class _R:  # pylint: disable=too-few-public-methods
            data = self._db.tabellen.get(self._tabelle, [])

        return _R()


class _DB:  # pylint: disable=too-few-public-methods
    def __init__(self, tabellen: dict[str, list[dict]]) -> None:
        self.tabellen = tabellen
        self.updates: list[tuple[str, dict]] = []

    def table(self, name: str) -> _Kette:
        return _Kette(self, name)


def _dienst(monkeypatch: pytest.MonkeyPatch) -> tuple[PaymentsService, _DB]:
    """Ein Dienst, dessen Stripe-Zugang NICHT konfiguriert ist.

    Der leere Schlüssel wird erzwungen, statt sich auf die Umgebung des
    Testlaufs zu verlassen: liegt lokal ein echter Key in der `.env`, baute
    `get_stripe()` sonst einen Client (bzw. bräche an der Live-Key-Sperre) und
    der Test prüfte etwas anderes als seinen Namen.
    """
    from src.features.payments import stripe_client

    monkeypatch.setattr(
        stripe_client, "get_settings",
        lambda: SimpleNamespace(
            stripe_secret_key=SimpleNamespace(get_secret_value=lambda: "")
        ),
    )
    db = _DB({
        "payments": [{
            "id": "pay-1",
            "type": "balance",
            "scheduled_status": "scheduled",
            "stripe_payment_method_id": "pm_1",
            "stripe_customer_id": "cus_1",
            "reservation_id": "res-1",
            "amount": 100.0,
            "currency": "DKK",
        }],
    })
    svc = PaymentsService(service_client=db)  # type: ignore[arg-type]
    monkeypatch.setattr(
        PaymentsService, "_load_reservation",
        lambda _s, _db, _rid: {"tenant_id": "t-1", "id": "res-1"},
    )
    monkeypatch.setattr(
        PaymentsService, "_settings_flag", lambda *_a, **_k: True,
    )
    monkeypatch.setattr(
        PaymentsService, "_connected_account", lambda *_a, **_k: "acct_1",
    )
    return svc, db


def test_fehlender_schluessel_laesst_die_zeile_scheduled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Der Kern: kein `failed`. Die Forderung bleibt einziehbar."""
    svc, db = _dienst(monkeypatch)
    with pytest.raises(PaymentsConfigError):
        svc.charge_due_balance(payment_id="pay-1")
    geschrieben = [z for _t, z in db.updates if "scheduled_status" in z]
    assert all(z["scheduled_status"] != "failed" for z in geschrieben), geschrieben
    # Und auch kein halber Claim: die Zeile darf nicht auf 'charging' liegen
    # bleiben, sonst überspringt der nächste Lauf sie als „in Bearbeitung".
    if geschrieben:
        assert geschrieben[-1]["scheduled_status"] == "scheduled"


def test_konfigurationsfehler_bleibt_ein_paymentserror(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Unterklasse, nicht Geschwister: jeder bestehende `except PaymentsError`
    im Router fängt ihn weiterhin — nur die Hintergrundläufe unterscheiden."""
    svc, _db = _dienst(monkeypatch)
    with pytest.raises(PaymentsError):
        svc.charge_due_balance(payment_id="pay-1")
    assert issubclass(PaymentsConfigError, PaymentsError)
