"""Der Gast-Storno trägt `gast` als Partei (0410).

WARUM DIESER TEST DER WICHTIGSTE DER ETAPPE IST: Bis 0410 schrieb dieser Pfad
`cancelled_by = NULL` — bewusst, weil ein Portal-Gast keine `public.users`-Zeile
ist und der Fremdschlüssel sonst bräche. Damit war „der Gast hat storniert" von
„Auslöser unbekannt" nicht mehr zu unterscheiden. Genau diese Unterscheidung
entscheidet ab Etappe 3, ob die 8 %-Marktplatz-Provision bei uns bleibt: bei
einem Gast-Storno bleibt sie (Airbnb behält seine Servicegebühr ebenso), bei
einem Storno des Betriebs wird sie zurückgebucht.

Ein Fehler hier ist unsichtbar: die Buchung ist in beiden Fällen storniert, nur
das Geld liegt hinterher woanders.
"""
from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock

import pytest

from src.features.guest_bookings.service import (
    GuestBookingsError,
    GuestBookingsService,
)

_RID = "22222222-2222-4222-8222-222222222222"


def _service(
    monkeypatch: pytest.MonkeyPatch, row: dict
) -> tuple[GuestBookingsService, MagicMock]:
    """Service mit gemockter Buchung und gemocktem Reservierungs-Service.

    Der Storno selbst wird NICHT nachgebaut: er läuft absichtlich über die EINE
    zentrale Stelle (`ReservationsService.cancel`, Wurzel 1). Geprüft wird
    daher, WAS dieser Pfad dorthin übergibt.
    """
    svc = GuestBookingsService(service_client=MagicMock(name="supabase"))
    monkeypatch.setattr(
        GuestBookingsService, "_load_own", lambda _s, _r, _e: row
    )
    reservations = MagicMock(name="ReservationsService")
    reservations.return_value.cancel.return_value = MagicMock(
        id=_RID, status="cancelled"
    )
    # Am NUTZUNGSORT patchen: `guest_bookings.service` importiert den
    # Reservierungs-Service top-level, ein Patch am Ursprungsmodul käme zu spät.
    monkeypatch.setattr(
        "src.features.guest_bookings.service.ReservationsService", reservations
    )
    return svc, reservations


def _row(**abweichung: object) -> dict:
    zeile = {
        "id": _RID,
        "tenant_id": "t-1",
        "status": "confirmed",
        "check_in": "2026-09-01",
        "check_out": "2026-09-04",
        "checked_in_at": None,
        "checked_out_at": None,
        "guest_email": "gast@example.com",
    }
    zeile.update(abweichung)
    return zeile


def test_gast_storno_setzt_partei_gast(monkeypatch: pytest.MonkeyPatch) -> None:
    svc, reservations = _service(monkeypatch, _row())
    out = svc.cancel_booking(
        _RID, "gast@example.com", "Reise abgesagt", today=date(2026, 8, 1)
    )
    assert out.status == "cancelled"
    kwargs = reservations.return_value.cancel.call_args.kwargs
    assert kwargs["partei"].value == "gast"
    assert kwargs["reason_code"].value == "gast_wunsch"
    # Und weiterhin KEIN Auslöser-User: ein Gast ist keine users-Zeile, der FK
    # bräche. Die Partei ersetzt diese Angabe, sie kommt nicht zu ihr hinzu.
    assert kwargs["by_user_id"] is None


def test_bereits_storniert_bleibt_409(monkeypatch: pytest.MonkeyPatch) -> None:
    """Wurzel 2 — der Riegel VOR dem Seiteneffekt bleibt bestehen."""
    svc, reservations = _service(monkeypatch, _row(status="cancelled"))
    with pytest.raises(GuestBookingsError) as exc:
        svc.cancel_booking(
            _RID, "gast@example.com", "nochmal", today=date(2026, 8, 1)
        )
    assert exc.value.status_code == 409
    reservations.return_value.cancel.assert_not_called()
