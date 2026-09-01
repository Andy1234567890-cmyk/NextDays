"""Die Währung, in der fakturiert wird — und die Verteilung des Betrags.

Der Anlass (01.09.2026): ein DKK-Invoice-Item auf einem EUR-Kunden landete auf
keiner Rechnung, blieb stumm liegen und wurde nie berechnet. Diese Tests halten
die drei Schutzmechanismen fest, die daraus folgten.
"""
from __future__ import annotations

from decimal import Decimal

import pytest

from src.features.subscriptions import abrechnungswaehrung as aw


class _FakeCustomers:
    def __init__(self, waehrung: str | None) -> None:
        self._waehrung = waehrung
        self.gefragt: list[str] = []

    def retrieve(self, customer_id: str) -> dict[str, str | None]:
        self.gefragt.append(customer_id)
        return {"id": customer_id, "currency": self._waehrung}


class _FakeStripe:
    def __init__(self, waehrung: str | None) -> None:
        self.v1 = type("V1", (), {"customers": _FakeCustomers(waehrung)})()


def _fehler(exc: object) -> Exception:  # pragma: no cover — hier nie benutzt
    return AssertionError(f"unerwarteter Stripe-Fehler: {exc}")


# --- Währung ---------------------------------------------------------------

def test_gleiche_waehrung_bleibt_unveraendert() -> None:
    betrag, waehrung, kurs = aw.fakturierbar(
        None, _FakeStripe("DKK"), _fehler,
        customer_id="cus_1", betrag=1868.80,
        quell_waehrung="DKK", period="2026-08",
    )
    assert (betrag, waehrung, kurs) == (1868.80, "DKK", Decimal("1"))


def test_kunde_ohne_waehrung_legt_sie_mit_dieser_rechnung_fest() -> None:
    """Kein `currency` am Kunden → die Buchungswährung gilt, keine Umrechnung."""
    betrag, waehrung, kurs = aw.fakturierbar(
        None, _FakeStripe(None), _fehler,
        customer_id="cus_neu", betrag=100.0,
        quell_waehrung="SEK", period="2026-08",
    )
    assert (betrag, waehrung, kurs) == (100.0, "SEK", Decimal("1"))


def test_abweichende_kundenwaehrung_wird_umgerechnet(monkeypatch) -> None:
    """DKK-Provision auf EUR-Kunde → EUR-Betrag, sonst hinge das Item."""
    class _Fx:
        def __init__(self, _db: object) -> None: ...
        def get_rate(self, _tag: object, _von: str, _nach: str) -> Decimal:
            return Decimal("0.13378")  # 1 DKK ≈ 0,13378 EUR

    monkeypatch.setattr(
        "src.features.owner_statements.fx.FxService", _Fx, raising=True
    )
    betrag, waehrung, kurs = aw.fakturierbar(
        None, _FakeStripe("EUR"), _fehler,
        customer_id="cus_1", betrag=1868.80,
        quell_waehrung="DKK", period="2026-08",
    )
    assert waehrung == "EUR"
    assert kurs == Decimal("0.13378")
    assert betrag == pytest.approx(250.0, abs=0.05)


def test_ohne_kurs_klar_fehlschlagen(monkeypatch) -> None:
    """Kein Kurs → 503, NIE ein geratener Betrag (Wurzel 4)."""
    from src.features.owner_statements.fx import FxError
    from src.features.subscriptions.errors import SubscriptionsError

    class _Fx:
        def __init__(self, _db: object) -> None: ...
        def get_rate(self, _tag: object, _von: str, _nach: str) -> Decimal:
            raise FxError("Frankfurter nicht erreichbar")

    monkeypatch.setattr(
        "src.features.owner_statements.fx.FxService", _Fx, raising=True
    )
    with pytest.raises(SubscriptionsError) as exc:
        aw.fakturierbar(
            None, _FakeStripe("EUR"), _fehler,
            customer_id="cus_1", betrag=100.0,
            quell_waehrung="DKK", period="2026-08",
        )
    assert exc.value.status_code == 503


# --- Stichtag --------------------------------------------------------------

def test_stichtag_ist_der_monatserste_der_periode() -> None:
    """Fest aus der Periode — ein Wiederholungslauf muss denselben Kurs sehen."""
    from datetime import date
    assert aw.stichtag("2026-08") == date(2026, 8, 1)
    assert aw.stichtag("2026-12") == date(2026, 12, 1)


# --- Idempotenz ------------------------------------------------------------

def test_idempotenz_schluessel_enthaelt_den_betrag() -> None:
    """Anderer Betrag → anderer Schlüssel, sonst antwortet Stripe mit 400."""
    a = aw.idempotenz_schluessel("comm", "t1", "2026-08", 250.00)
    b = aw.idempotenz_schluessel("comm", "t1", "2026-08", 257.35)
    assert a != b
    assert a.endswith(":25000")


def test_idempotenz_schluessel_bei_gleichem_betrag_stabil() -> None:
    """Gleicher Betrag → gleicher Schlüssel: kein zweites Invoice-Item."""
    a = aw.idempotenz_schluessel("comm", "t1", "2026-08", 250.00)
    b = aw.idempotenz_schluessel("comm", "t1", "2026-08", 250.004)
    assert a == b


# --- Verteilung ------------------------------------------------------------

def test_verteilung_trifft_den_fakturierten_betrag_exakt() -> None:
    """Summe der Anteile == fakturierter Betrag, trotz Rundung je Zeile."""
    zeilen = [{"id": f"z{i}", "commission_amount": 27.17} for i in range(95)]
    anteile = aw.verteile_betrag(zeilen, 250.00, "commission_amount")
    assert round(sum(anteile.values()), 2) == 250.00
    assert len(anteile) == 95


def test_verteilung_bei_gedeckeltem_betrag() -> None:
    """Der Deckel kürzt: jede Zeile trägt anteilig weniger als sie erzeugte."""
    zeilen = [
        {"id": "a", "commission_amount": 2000.0},
        {"id": "b", "commission_amount": 580.76},
    ]
    anteile = aw.verteile_betrag(zeilen, 250.00, "commission_amount")
    assert round(sum(anteile.values()), 2) == 250.00
    assert anteile["a"] > anteile["b"]


def test_verteilung_ohne_betrag_gibt_nullen() -> None:
    zeilen = [{"id": "a", "fee_amount": 0.0}]
    assert aw.verteile_betrag(zeilen, 0.0, "fee_amount") == {"a": 0.0}
