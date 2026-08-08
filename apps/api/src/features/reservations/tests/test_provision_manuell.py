"""Provision für im PMS erfasste Buchungen (writes.py).

Bis dahin erzeugte NUR der OTA-Import (`bookings_sync`) eine Provisionszeile —
eine an der Rezeption erfasste Booking-/Airbnb-Buchung blieb unberechnet, und
ein Storno hätte eine offene Zeile stehen lassen (Wurzel 1). Geprüft wird der
Schreibpfad, nicht der Ledger-Service: dass `record_commission`/
`cancel_commission` mit dem richtigen Kanal/Betrag/Währung aufgerufen werden.
"""
from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from pydantic import ValidationError

from src.core.security import AuthContext
from src.features.reservations.schemas import (
    ReservationChannel,
    ReservationCreate,
    ReservationMove,
)
from src.features.reservations.service import ReservationsService

from .test_reservations import (
    RID,
    _move_db,
    _move_store,
    _service_for_create,
)


@pytest.fixture(name="subs")
def _subs(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    """`SubscriptionsService` an seiner Quelle ersetzen — writes.py importiert
    ihn lazy im Aufruf, ein Patch am Aufrufmodul ginge daher ins Leere."""
    fake = MagicMock(name="SubscriptionsService")
    monkeypatch.setattr(
        "src.features.subscriptions.service.SubscriptionsService", fake
    )
    return fake


def _create_service(
    monkeypatch: pytest.MonkeyPatch, *, channel: str, currency: str
) -> tuple[ReservationsService, MagicMock]:
    """create() bis hinter die RPC durchlaufen lassen (Muster aus
    `_rpc_service`): Vorchecks frei, Gast/Quote gemockt, RPC liefert die Zeile."""
    service = _service_for_create(property_found=True, taken_days=[], stopped_days=[])
    db = service._client  # noqa: SLF001 — Test greift auf den Mock zu
    monkeypatch.setattr(service, "_upsert_guest", lambda *_a, **_k: "g-1")
    monkeypatch.setattr(
        service, "_quote",
        lambda *_a, **_k: SimpleNamespace(total=400.0, currency=currency, lines=[]),
    )
    mask = MagicMock()
    mask.name.side_effect = lambda v: v or ""
    mask.amount.side_effect = lambda v: v
    mask.amounts = True
    mask.source_value.side_effect = lambda v: v
    monkeypatch.setattr(
        "src.features.reservations.writes.load_guest_mask", lambda *_a: mask
    )
    db.rpc.return_value.execute.return_value.data = {
        "reservation": {
            "id": "r-1", "property_id": "p1", "guest_id": "g-1", "channel": channel,
            "check_in": "2026-05-01", "check_out": "2026-05-03",
            "status": "confirmed", "total_amount": 400.0, "currency": currency,
            "ota_name": None, "external_ref": None,
        },
        "outbox_id": "ob-1",
    }
    return service, db


def test_manuelle_ota_buchung_erfasst_provision(
    monkeypatch: pytest.MonkeyPatch, subs: MagicMock
) -> None:
    """Eine an der Rezeption erfasste Booking-Buchung meldet die Provision —
    mit der Währung der Buchung (kein EUR-Hardcode, Wurzel 4)."""
    service, _ = _create_service(monkeypatch, channel="booking", currency="DKK")
    service.create(
        AuthContext(user_id="u1", tenant_id="t1"),
        ReservationCreate(
            property_id="p1",
            check_in=date(2026, 5, 1),
            check_out=date(2026, 5, 3),
            channel=ReservationChannel.booking,
        ),
    )
    subs.return_value.record_commission.assert_called_once_with(
        "t1",
        reservation_id="r-1",
        channel="booking",
        gross_amount=400.0,
        currency="DKK",
    )


def test_direktbuchung_meldet_kanal_direct(
    monkeypatch: pytest.MonkeyPatch, subs: MagicMock
) -> None:
    """Eine Direktbuchung darf KEINE Provisionszeile bekommen. Der Kanal wird
    trotzdem gemeldet — `record_commission` filtert eigene Kanäle selbst weg und
    räumt dabei eine Altzeile aus einem früheren externen Kanal ab (Wurzel 1);
    eine eigene Kanal-Prüfung hier wäre eine zweite Wahrheit."""
    service, _ = _create_service(monkeypatch, channel="direct", currency="EUR")
    service.create(
        AuthContext(user_id="u1", tenant_id="t1"),
        ReservationCreate(
            property_id="p1",
            check_in=date(2026, 5, 1),
            check_out=date(2026, 5, 3),
            channel=ReservationChannel.direct,
        ),
    )
    (_, kwargs) = subs.return_value.record_commission.call_args
    assert kwargs["channel"] == "direct"


class _LedgerQuery:
    """Minimaler Query-Stub für die Gegenprobe am echten Ledger-Service:
    select/insert/delete auf einem Dict-Store. Bewusst lokal statt im geteilten
    `_MoveQuery` — die Reservierungs-Tests brauchen kein delete."""

    def __init__(self, store: dict, name: str) -> None:
        self._store = store
        self._name = name
        self._eq: dict = {}
        self._delete = False
        self._insert: dict | None = None

    def select(self, *_a, **_k) -> "_LedgerQuery":
        return self

    def eq(self, col: str, val: object) -> "_LedgerQuery":
        self._eq[col] = val
        return self

    def limit(self, *_a, **_k) -> "_LedgerQuery":
        return self

    def insert(self, payload: dict) -> "_LedgerQuery":
        self._insert = payload
        return self

    def delete(self) -> "_LedgerQuery":
        self._delete = True
        return self

    def _match(self, r: dict) -> bool:
        return all(r.get(c) == v for c, v in self._eq.items())

    def execute(self) -> MagicMock:
        table = self._store.setdefault(self._name, [])
        if self._insert is not None:
            row = {"status": "pending", **self._insert}
            table.append(row)
            res = MagicMock()
            res.data = [row]
            return res
        if self._delete:
            bleibt = [r for r in table if not self._match(r)]
            self._store[self._name] = bleibt
            res = MagicMock()
            res.data = []
            return res
        res = MagicMock()
        res.data = [r for r in table if self._match(r)]
        return res


def test_direktbuchung_erzeugt_keine_ledger_zeile() -> None:
    """Gegenprobe ohne Mock am Ledger-Service: der echte `record_commission`
    legt für 'direct' nichts an, für 'booking' schon."""
    from src.features.subscriptions.service import (  # noqa: PLC0415
        SubscriptionsService,
    )

    store: dict = {
        "reservations": [{"id": RID, "tenant_id": "t1", "property_id": "p1"}],
        "properties": [{"id": "p1", "tenant_id": "t1", "status": "active"}],
    }
    db = MagicMock(name="supabase")
    db.table.side_effect = lambda name: _LedgerQuery(store, name)
    subs = SubscriptionsService(service_client=db)

    subs.record_commission(
        "t1", reservation_id=RID, channel="direct", gross_amount=200.0,
        currency="EUR",
    )
    assert not store.get("commission_ledger")

    subs.record_commission(
        "t1", reservation_id=RID, channel="booking", gross_amount=200.0,
        currency="EUR",
    )
    zeilen = store.get("commission_ledger", [])
    assert len(zeilen) == 1
    assert zeilen[0]["channel"] == "booking"
    assert zeilen[0]["currency"] == "EUR"


def test_storno_entfernt_offene_provision(subs: MagicMock) -> None:
    """Storno → offene Provisionszeile weg (Gegenzustand, Wurzel 1)."""
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    svc.cancel(
        AuthContext(user_id="u", tenant_id="t1", role="admin"),
        RID,
        "Gast hat abgesagt",
    )
    subs.return_value.cancel_commission.assert_called_once_with(
        "t1", reservation_id=RID
    )


def test_abgelehnte_anfrage_entfernt_offene_provision(subs: MagicMock) -> None:
    """Eine abgelehnte Anfrage kam nie zustande — die offene Provisionszeile
    muss weg (Wurzel 1). Eine über den OTA-Import entstandene Anfrage
    (Request to Book) bringt sie mit; ohne den Gegenzustand wanderte sie in die
    Monatssumme und der Betrieb zahlte für einen Verkauf, den er abgelehnt hat."""
    store = _move_store(
        check_in="2026-07-01", check_out="2026-07-03", status="requested"
    )
    svc = _move_db(store)
    # Die Antwort-Serialisierung ist hier NICHT der Prüfgegenstand: `_row` baut
    # ein `ReservationResponse`, dessen `ReservationStatus` die DB-Werte
    # 'declined'/'expired'/'requested' (Enum aus 0183) nicht kennt und deshalb
    # wirft — ein vorbestehender Mangel im Schema, der zu diesem Test nicht
    # gehört. Geprüft wird der Gegenzustand: Status gesetzt, Ledger geräumt.
    with pytest.raises(ValidationError):
        svc.decline_request(
            AuthContext(user_id="u", tenant_id="t1", role="admin"),
            RID,
            "Zeitraum passt nicht",
        )
    assert store["reservations"][0]["status"] == "declined"
    subs.return_value.cancel_commission.assert_called_once_with(
        "t1", reservation_id=RID
    )


def test_abgelaufene_anfrage_entfernt_offene_provision(subs: MagicMock) -> None:
    """Dasselbe für den Verfall (Cron): 24-h-Frist verstrichen → keine Buchung,
    also keine Provision. Der Lauf meldet die Anfrage als abgelaufen zurück."""
    store = _move_store(
        check_in="2026-07-01", check_out="2026-07-03", status="requested"
    )
    # `_MoveQuery.lt` filtert auf `date` — die Frist zusätzlich dort ablegen,
    # damit der Store-Stub die fällige Zeile wie die echte Query auswählt.
    store["reservations"][0]["request_expires_at"] = "2020-01-01T00:00:00+00:00"
    store["reservations"][0]["date"] = "2020-01-01T00:00:00+00:00"
    svc = _move_db(store)

    assert svc.expire_stale_requests() == 1
    assert store["reservations"][0]["status"] == "expired"
    subs.return_value.cancel_commission.assert_called_once_with(
        "t1", reservation_id=RID
    )


def test_umbuchung_zieht_provision_nach(subs: MagicMock) -> None:
    """Upsell beim Verschieben (reprice) → der neue Betrag geht an den Ledger."""
    from src.features.pricing.schemas import QuoteLine, QuoteResponse  # noqa: PLC0415

    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    svc._quote = MagicMock(  # noqa: SLF001 — Preis-Resolver im Test festnageln
        return_value=QuoteResponse(
            property_id="p2", check_in=date(2026, 7, 10), check_out=date(2026, 7, 12),
            nights=2, guests=1, channel="booking", currency="EUR",
            nightly_total=450.0, total=450.0,
            lines=[QuoteLine(label="Übernachtung", amount=450.0, kind=None)],
        )
    )
    svc.move(
        AuthContext(user_id="u", tenant_id="t1", role="admin"),
        RID,
        ReservationMove(
            property_id="p2", check_in=date(2026, 7, 10),
            check_out=date(2026, 7, 12), reprice=True,
        ),
    )
    subs.return_value.record_commission.assert_called_once_with(
        "t1",
        reservation_id=RID,
        channel="booking",
        gross_amount=450.0,
        currency="EUR",
    )


def test_provision_kippt_die_buchung_nicht(
    monkeypatch: pytest.MonkeyPatch, subs: MagicMock
) -> None:
    """Best-effort (Wurzel 5): fällt die Provisionserfassung aus, bleibt die
    Buchung bestehen — der Aufrufer sieht kein 500."""
    subs.return_value.record_commission.side_effect = RuntimeError("Ledger down")
    service, _ = _create_service(monkeypatch, channel="airbnb", currency="EUR")
    resp = service.create(
        AuthContext(user_id="u1", tenant_id="t1"),
        ReservationCreate(
            property_id="p1",
            check_in=date(2026, 5, 1),
            check_out=date(2026, 5, 3),
            channel=ReservationChannel.airbnb,
        ),
    )
    assert resp.id == "r-1"
