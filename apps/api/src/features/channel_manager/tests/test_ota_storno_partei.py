"""Ein OTA-Fremdstorno vermerkt die Partei `portal` (0410).

WARUM DAS EIN EIGENER TEST IST: `reservations.cancelled_by_party` wird über
`ReservationsService.cancel()` als Pflichtparameter erzwungen — dieser Pfad hier
ruft `cancel()` bewusst NICHT auf. Eine OTA-Buchung ist lokal gar nicht
stornierbar (writes.py wirft 409); der Storno kommt ausschliesslich aus dem
Portal-Feed und wird per direktem UPDATE nachgezogen. Genau deshalb greift die
Pflicht-Prüfung des Services hier nicht, und genau deshalb kann diese Stelle die
Spalte stillschweigend leer lassen, ohne dass irgendein Test rot wird.

Ohne den Eintrag wäre jeder LAUFENDE OTA-Storno von einem Altbestands-Storno
(„nicht erfasst") nicht zu unterscheiden — und `portal`/`portal_storno` wären
Enum-Werte, die nie jemand schreibt.
"""
from __future__ import annotations

from typing import Any

from src.features.channel_manager.bookings_sync import BookingsSyncMixin

_TENANT = "22222222-2222-4222-8222-222222222222"
_PROPERTY = "33333333-3333-4333-8333-333333333333"
_RESERVATION = "44444444-4444-4444-8444-444444444444"


class _Query:
    """PostgREST-Stub: liefert je Tabelle feste Zeilen, merkt Updates/Inserts."""

    def __init__(self, tabelle: str, store: dict[str, Any]) -> None:
        self._tabelle = tabelle
        self._store = store

    def select(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def update(self, payload: dict[str, Any]) -> _Query:
        self._store["updates"].append((self._tabelle, payload))
        return self

    def insert(self, payload: dict[str, Any]) -> _Query:
        self._store["inserts"].append((self._tabelle, payload))
        return self

    def eq(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def limit(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def execute(self) -> Any:
        return type("R", (), {"data": self._store["rows"].get(self._tabelle, [])})()


class _Db:
    def __init__(self, rows: dict[str, list[dict[str, Any]]]) -> None:
        self.store: dict[str, Any] = {"rows": rows, "updates": [], "inserts": []}

    def table(self, name: str) -> _Query:
        return _Query(name, self.store)


class _Sync(BookingsSyncMixin):
    """Nur die Projektion — die Umgebung des Mixins wird nicht gebraucht."""


def _attrs(**over: Any) -> dict[str, Any]:
    basis = {
        "booking_id": "CHX-999",
        "status": "cancelled",
        "arrival_date": "2026-09-01",
        "departure_date": "2026-09-04",
        "ota_name": "Booking.com",
        "ota_reservation_code": "BK-4711",
        "amount": 1200.0,
        "currency": "DKK",
        "customer": {"name": "Test Gast", "mail": "gast@example.com"},
    }
    basis.update(over)
    return basis


def _storno_payload(store: dict[str, Any]) -> dict[str, Any]:
    return next(p for t, p in store["updates"] if t == "reservations")


def test_bekannte_buchung_wird_als_portal_storno_vermerkt(monkeypatch) -> None:
    """Der Regelfall: die Buchung kennen wir, das Portal meldet den Storno."""
    db = _Db(
        {
            "reservations": [
                {
                    "id": _RESERVATION,
                    "checked_out_at": None,
                    "check_in": "2026-09-01",
                    "check_out": "2026-09-04",
                    "property_id": _PROPERTY,
                    "payment_collect": "ota",
                    "unit_id": None,
                }
            ]
        }
    )
    sync = _Sync()
    # Die Gegenzustände (Nächte, Aufgaben) haben eigene Tests — hier interessiert
    # ausschliesslich, WAS in die Storno-Zeile geschrieben wird.
    monkeypatch.setattr(
        "src.features.channel_manager.bookings_sync.sync_nach_id",
        lambda *_a, **_k: None,
    )
    monkeypatch.setattr(_Sync, "_free_ota_nights", lambda *_a, **_k: None, raising=False)
    monkeypatch.setattr(
        _Sync, "_projection_precheck", lambda *_a, **_k: True, raising=False
    )

    sync._project_booking_to_reservation(  # noqa: SLF001
        db, _TENANT, _attrs(), guest_id="g-1", local_property_id=_PROPERTY
    )

    payload = _storno_payload(db.store)
    assert payload["status"] == "cancelled"
    assert payload["cancelled_by_party"] == "portal"
    assert payload["cancel_reason_code"] == "portal_storno"


def test_storno_partei_ist_nicht_leer_und_nicht_geraten(monkeypatch) -> None:
    """`null` wäre hier die falsche Angabe: wir WISSEN, woher der Storno kam.

    Gleichzeitig darf nichts Genaueres behauptet werden — der Channex-Feed
    nennt keinen Auslöser, deshalb steht dort `portal` (über das Portal
    eingegangen) und NICHT `gast` oder `betrieb` (Wurzel 4).
    """
    db = _Db(
        {
            "reservations": [
                {
                    "id": _RESERVATION,
                    "checked_out_at": None,
                    "check_in": "2026-09-01",
                    "check_out": "2026-09-04",
                    "property_id": _PROPERTY,
                    "payment_collect": None,
                    "unit_id": None,
                }
            ]
        }
    )
    sync = _Sync()
    monkeypatch.setattr(
        "src.features.channel_manager.bookings_sync.sync_nach_id",
        lambda *_a, **_k: None,
    )
    monkeypatch.setattr(_Sync, "_free_ota_nights", lambda *_a, **_k: None, raising=False)
    monkeypatch.setattr(
        _Sync, "_projection_precheck", lambda *_a, **_k: True, raising=False
    )

    sync._project_booking_to_reservation(  # noqa: SLF001
        db, _TENANT, _attrs(), guest_id="g-1", local_property_id=_PROPERTY
    )

    payload = _storno_payload(db.store)
    assert payload["cancelled_by_party"] not in (None, "", "gast", "betrieb")
