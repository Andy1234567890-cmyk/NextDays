"""Tests für Check-in/Check-out (0091) inkl. Pflicht-Rechnung beim Check-out.

Chain-Mock wie in buchhaltung/tests/test_reservation_invoice.py: jede Query-
Kette endet in execute() → hinterlegte Daten; Attribut-Zugriffe werden je
Tabelle protokolliert (Beweis „kein Write vor Rechnung").
"""
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest

from src.core.security import AuthContext
from src.features.buchhaltung.service import BuchhaltungError
from src.features.reservations.schemas import CheckOutRequest
from src.features.reservations.service import ReservationError, ReservationsService

CTX = AuthContext(user_id="u1", tenant_id="t1")
RID = "11111111-1111-4111-8111-111111111111"
# Dynamische Daten: der Abreisetag-Guard vergleicht gegen HEUTE IN UTC
# (service.py: datetime.now(UTC).date()). Der Test MUSS dieselbe Zeitzone nutzen,
# sonst divergieren „heute" lokal vs. UTC um Mitternacht → flaky Check-out-Tests.
_TODAY = datetime.now(UTC).date()


class _Chain:
    def __init__(self, data: object, calls: list[str]) -> None:
        self._data = data
        self.calls = calls

    def __getattr__(self, name: str) -> "_Chain":
        self.calls.append(name)
        return self

    def __call__(self, *args: object, **kwargs: object) -> "_Chain":
        return self

    def execute(self) -> SimpleNamespace:
        return SimpleNamespace(data=self._data)


class _DB:
    def __init__(self, tables: dict[str, object]) -> None:
        self._tables = tables
        self.calls: dict[str, list[str]] = {}

    def table(self, name: str) -> _Chain:
        calls = self.calls.setdefault(name, [])
        return _Chain(self._tables.get(name, []), calls)


def _reservation(**overrides: object) -> dict:
    base = {
        "id": RID,
        "tenant_id": "t1",
        "property_id": "p1",
        "guest_id": "g1",
        "channel": "direct",
        "status": "confirmed",
        "check_in": (_TODAY - timedelta(days=2)).isoformat(),
        "check_out": _TODAY.isoformat(),
        "checked_in_at": None,
        "checked_out_at": None,
        "total_amount": 300.0,
        "currency": "EUR",
        "guests": {"name": "Max Muster"},
    }
    base.update(overrides)
    return base


def _service(reservation: dict | None, extra: dict[str, object] | None = None
             ) -> tuple[ReservationsService, _DB]:
    tables: dict[str, object] = {
        "reservations": [reservation] if reservation else [],
        "users": [],  # load_guest_mask → fail-closed Maske
        "invoices": [],
    }
    tables.update(extra or {})
    db = _DB(tables)
    return ReservationsService(service_client=db), db  # type: ignore[arg-type]


# --- Check-in ----------------------------------------------------------------

def test_check_in_requires_confirmed() -> None:
    service, _ = _service(_reservation(status="pending"))
    with pytest.raises(ReservationError) as exc:
        service.check_in(CTX, RID)
    assert exc.value.status_code == 409


def test_check_in_rejects_cancelled() -> None:
    service, _ = _service(_reservation(status="cancelled"))
    with pytest.raises(ReservationError) as exc:
        service.check_in(CTX, RID)
    assert exc.value.status_code == 409


def test_check_in_rejects_double() -> None:
    service, _ = _service(
        _reservation(checked_in_at="2026-07-01T14:00:00+00:00")
    )
    with pytest.raises(ReservationError) as exc:
        service.check_in(CTX, RID)
    assert exc.value.status_code == 409


def test_check_in_unknown_reservation_404() -> None:
    service, _ = _service(None)
    with pytest.raises(ReservationError) as exc:
        service.check_in(CTX, RID)
    assert exc.value.status_code == 404


def test_non_uuid_reservation_id_is_404_not_500() -> None:
    """Ein Nicht-UUID-Pfad (z. B. /reservierungen/einstellungen, das Next.js
    auf [id] mappt) darf keinen 500 werfen, sondern 404 — der Guard fängt ihn
    VOR der DB ab (CLAUDE.md Wurzel 5, fail-closed). Gilt für alle per-ID-Pfade."""
    service, _ = _service(_reservation())
    for action in (
        lambda: service.detail(CTX, "einstellungen"),
        lambda: service.check_in(CTX, "einstellungen"),
        lambda: service.cancel(CTX, "einstellungen", "Grund"),
    ):
        with pytest.raises(ReservationError) as exc:
            action()
        assert exc.value.status_code == 404


def test_check_in_sets_timestamp() -> None:
    service, db = _service(_reservation())
    result = service.check_in(CTX, RID)
    assert "update" in db.calls["reservations"]
    assert result.id == RID


# --- Check-out ---------------------------------------------------------------

def test_check_out_requires_check_in() -> None:
    service, db = _service(_reservation())
    with pytest.raises(ReservationError) as exc:
        service.check_out(CTX, RID)
    assert exc.value.status_code == 409
    assert "update" not in db.calls["reservations"]


def test_check_out_rejects_double() -> None:
    service, _ = _service(
        _reservation(
            checked_in_at="2026-07-01T14:00:00+00:00",
            checked_out_at="2026-07-04T10:00:00+00:00",
        )
    )
    with pytest.raises(ReservationError) as exc:
        service.check_out(CTX, RID)
    assert exc.value.status_code == 409


def test_check_out_aborts_without_touching_reservation_when_invoice_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Builder-Fehler (z. B. Steuersatz fehlt) ⇒ 4xx-Klartext und KEIN
    reservations-Update — kein halber Zustand."""
    service, db = _service(
        _reservation(checked_in_at="2026-07-01T14:00:00+00:00")
    )

    def _boom(*args: object, **kwargs: object) -> dict:
        raise BuchhaltungError("Übernachtungs-Steuersatz fehlt …", status_code=422)

    monkeypatch.setattr(
        "src.features.buchhaltung.reservation_invoice.create_from_reservation",
        _boom,
    )
    with pytest.raises(ReservationError) as exc:
        service.check_out(CTX, RID)
    assert exc.value.status_code == 422
    assert "Steuersatz" in exc.value.message
    assert "update" not in db.calls["reservations"]


def test_check_out_creates_invoice_then_completes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service, db = _service(
        _reservation(checked_in_at="2026-07-01T14:00:00+00:00")
    )
    monkeypatch.setattr(
        "src.features.buchhaltung.reservation_invoice.create_from_reservation",
        lambda *a, **k: {"id": "i1", "invoice_number": "RE-0001",
                         "already_existed": False},
    )
    result = service.check_out(CTX, RID)
    assert result.invoice_id == "i1"
    assert result.invoice_number == "RE-0001"
    assert result.invoice_already_existed is False
    assert "update" in db.calls["reservations"]


def test_check_out_blocked_before_departure_day() -> None:
    """Check-out erst AM Abreisetag — vorher 409, kein Write (frühere Abreise
    läuft über „Aufenthalt verkürzen")."""
    service, db = _service(
        _reservation(
            checked_in_at="2026-07-01T14:00:00+00:00",
            check_out=(_TODAY + timedelta(days=2)).isoformat(),
        )
    )
    with pytest.raises(ReservationError) as exc:
        service.check_out(CTX, RID)
    assert exc.value.status_code == 409
    assert "Abreisetag" in exc.value.message
    assert "update" not in db.calls["reservations"]


def test_check_out_passes_payment_to_builder(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Zahlart-Abfrage (Rezeption) erreicht den Rechnungs-Builder."""
    captured: dict = {}

    def fake(
        db: object,
        tenant_id: str,
        rid: str,
        *,
        payment_method: str = "invoice",
        card_brand: str | None = None,
    ) -> dict:
        captured.update(method=payment_method, brand=card_brand)
        return {"id": "i1", "invoice_number": "RE-0001", "already_existed": False}

    monkeypatch.setattr(
        "src.features.buchhaltung.reservation_invoice.create_from_reservation",
        fake,
    )
    service, _ = _service(
        _reservation(checked_in_at="2026-07-01T14:00:00+00:00")
    )
    result = service.check_out(
        CTX, RID, CheckOutRequest(payment_method="card", card_brand="Visa")
    )
    assert captured == {"method": "card", "brand": "Visa"}
    assert result.invoice_id == "i1"


def test_check_out_retry_reuses_existing_invoice(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Retry nach Teil-Fehler: der Builder findet die bestehende Rechnung
    (idempotent) und der Check-out wird abgeschlossen."""
    service, _ = _service(
        _reservation(checked_in_at="2026-07-01T14:00:00+00:00")
    )
    monkeypatch.setattr(
        "src.features.buchhaltung.reservation_invoice.create_from_reservation",
        lambda *a, **k: {"id": "i1", "invoice_number": "RE-0001",
                         "already_existed": True},
    )
    result = service.check_out(CTX, RID)
    assert result.invoice_already_existed is True
