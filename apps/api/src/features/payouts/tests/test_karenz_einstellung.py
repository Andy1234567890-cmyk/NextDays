"""Die Karenz je Betrieb: aus `payout_settings` in die Fälligkeit (0411).

`faelligkeit.py` rechnet die Frist; hier wird geprüft, dass der Service den
richtigen WERT dorthin bringt. Das ist die Stelle, an der eine Sonderkondition
wirksam wird — und die Stelle, an der ein vergessener Spalten-Lesevorgang die
Frist stillschweigend auf den Standard zurücksetzt, ohne dass etwas fehlschlägt.
"""
from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

import pytest

from src.core.security import AuthContext
from src.features.payouts.faelligkeit import KARENZ_TAGE
from src.features.payouts.service import PayoutsError, PayoutsService

_TENANT = "22222222-2222-4222-8222-222222222222"
_RESERVATION = "33333333-3333-4333-8333-333333333333"


class _Query:
    """Minimaler Supabase-Stub: liest je Tabelle feste Zeilen, merkt Upserts."""

    def __init__(self, tabelle: str, store: dict[str, Any]) -> None:
        self._tabelle = tabelle
        self._store = store

    def select(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def eq(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def limit(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def upsert(self, payload: dict[str, Any], **_k: Any) -> _Query:
        self._store.setdefault("upserts", []).append((self._tabelle, payload))
        return self

    def execute(self) -> Any:
        rows = self._store.get("rows", {}).get(self._tabelle, [])
        return type("R", (), {"data": rows})()


class _Db:
    def __init__(self, rows: dict[str, list[dict[str, Any]]]) -> None:
        self.store: dict[str, Any] = {"rows": rows, "upserts": []}

    def table(self, name: str) -> _Query:
        return _Query(name, self.store)


def _service(settings_zeile: dict[str, Any] | None) -> tuple[PayoutsService, _Db]:
    rows: dict[str, list[dict[str, Any]]] = {
        "payout_settings": [settings_zeile] if settings_zeile else []
    }
    db = _Db(rows)
    return PayoutsService(db), db  # type: ignore[arg-type]


def _ctx() -> AuthContext:
    return AuthContext(user_id="u-1", tenant_id=_TENANT, role="admin")


# --- Wert je Betrieb ---------------------------------------------------------

def test_ohne_einstellungszeile_gilt_die_standardkondition() -> None:
    """Keine Zeile heisst „nichts abweichend vereinbart" — und die
    Standardkondition ist eine echte Vereinbarung, kein Ratewert (Wurzel 4)."""
    svc, _ = _service(None)
    assert svc._karenz_tage(_TENANT) == KARENZ_TAGE  # noqa: SLF001


def test_sonderkondition_aus_der_zeile_gewinnt() -> None:
    """Genau dafür steht der Wert in der DB: eine abweichende Frist ohne
    Code-Änderung."""
    svc, _ = _service({"interval": "weekly", "karenz_tage": 7})
    assert svc._karenz_tage(_TENANT) == 7  # noqa: SLF001


def test_leere_spalte_faellt_auf_den_standard_zurueck() -> None:
    """`null` in der Spalte (Zeile aus der Zeit vor 0411) ist keine Frist von
    0 Tagen — sonst zahlte ein Altbestands-Betrieb ohne jede Prüffrist aus."""
    svc, _ = _service({"interval": "weekly", "karenz_tage": None})
    assert svc._karenz_tage(_TENANT) == KARENZ_TAGE  # noqa: SLF001


def test_unmoeglicher_wert_in_der_db_faellt_durch() -> None:
    """Der CHECK an der Spalte deckt den Normalweg ab; hier wird der Wert
    TROTZDEM geprüft. Fail-closed, weil eine Auszahlung daran hängt und ein
    Wert, der die Prüfung nicht besteht, kein Grund für einen Ersatzwert ist."""
    svc, _ = _service({"interval": "weekly", "karenz_tage": 400})
    with pytest.raises(Exception) as exc:  # FaelligkeitFehler
        svc._karenz_tage(_TENANT)  # noqa: SLF001
    assert getattr(exc.value, "status_code", None) == 422


# --- Auslieferung an den Betrieb --------------------------------------------

def test_settings_liefert_die_karenz_mit() -> None:
    """Der Betrieb muss sehen, WANN sein Geld kommt: der Rhythmus allein
    („donnerstags") wäre ohne die Frist eine falsche Auskunft."""
    svc, _ = _service(
        {
            "interval": "weekly",
            "paused": False,
            "paused_reason": None,
            "karenz_tage": 5,
        }
    )
    assert svc.settings(_ctx()).karenz_tage == 5


def test_settings_ohne_zeile_nennt_die_standardkondition() -> None:
    svc, _ = _service(None)
    assert svc.settings(_ctx()).karenz_tage == KARENZ_TAGE


def test_betrieb_kann_die_karenz_nicht_selbst_setzen() -> None:
    """WURZEL 3 — der Scope liegt im Schema, nicht im Frontend.

    Die Karenz ist unser Risikopuffer wie `paused`. Nähme
    `PayoutSettingsUpdate` sie an, könnte ein Betrieb sie per `curl` auf 0
    setzen und hätte keine Prüffrist mehr — unabhängig davon, was die
    Oberfläche anbietet.
    """
    from src.features.payouts.schemas import PayoutSettingsUpdate

    req = PayoutSettingsUpdate(interval="weekly", karenz_tage=0)  # type: ignore[call-arg]
    assert not hasattr(req, "karenz_tage")


# --- Bis in die geplante Zeile ----------------------------------------------

def test_geplante_faelligkeit_enthaelt_die_karenz() -> None:
    """Der ganze Weg: Spalte → Service → `due_at` der Auszahlungszeile.

    Abreise 15.07. (kein Checkout eingetragen) + 1 Tag Nachtragefrist
    + 3 Tage Karenz = Basis 19.07.; täglicher Rhythmus zahlt einen Tag später.
    """
    svc, db = _service({"interval": "daily", "karenz_tage": 3})
    svc.plane_auszahlung(
        reservation_id=_RESERVATION,
        tenant_id=_TENANT,
        brutto_cents=100_000,
        plattform_cents=8_000,
        spende_cents=0,
        cohost_cents=0,
        currency="dkk",
        checked_out_at=None,
        check_out=date(2026, 7, 15),
    )
    payload = next(p for t, p in db.store["upserts"] if t == "payouts")
    assert payload["due_at"] == datetime(2026, 7, 20, tzinfo=UTC).isoformat()


def test_unmoegliche_karenz_verhindert_die_planung() -> None:
    """Wurzel 5: lieber keine Auszahlungszeile als eine mit falscher Frist —
    eine falsche `due_at` fällt niemandem auf, sie zahlt einfach zu früh."""
    svc, db = _service({"interval": "daily", "karenz_tage": -2})
    with pytest.raises(PayoutsError):
        svc.plane_auszahlung(
            reservation_id=_RESERVATION,
            tenant_id=_TENANT,
            brutto_cents=100_000,
            plattform_cents=8_000,
            spende_cents=0,
            cohost_cents=0,
            currency="dkk",
            checked_out_at=None,
            check_out=date(2026, 7, 15),
        )
    assert not db.store["upserts"]
