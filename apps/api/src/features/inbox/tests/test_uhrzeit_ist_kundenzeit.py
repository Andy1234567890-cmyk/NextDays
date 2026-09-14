"""Die eingestellte Uhrzeit einer Regel ist die des Kunden — in der Ortszeit
des Objekts, nie UTC (14.09.2026: 06:00 eingestellt, 08:00 dänischer Zeit
geplant, weil der Ortszeit-Schalter aus war)."""

from __future__ import annotations

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

import pytest

from src.features.inbox.planung import PlanungMixin

_KOPENHAGEN = ZoneInfo("Europe/Copenhagen")


def _thread(anreise: str) -> dict:
    return {"arrival_date": anreise, "departure_date": anreise, "booked_at": None}


@pytest.mark.parametrize(
    ("uhrzeit", "anreise"),
    [
        ("06:00", "2026-10-26"),  # Winterzeit (UTC+1)
        ("23:00", "2026-07-15"),  # Sommerzeit (UTC+2)
        ("00:30", "2026-03-29"),  # Tag der Umstellung
        ("13:00", "2026-12-31"),
    ],
)
def test_uhrzeit_gilt_in_objekt_ortszeit(uhrzeit: str, anreise: str) -> None:
    send_at = PlanungMixin._compute_send_at(  # noqa: SLF001
        "arrival", 0, uhrzeit, _thread(anreise),
        timezone_name="Europe/Copenhagen", offset_unit="days", offset_value=0,
    )
    assert send_at is not None
    lokal = send_at.astimezone(_KOPENHAGEN)
    assert (lokal.strftime("%Y-%m-%d"), lokal.strftime("%H:%M")) == (anreise, uhrzeit)


def test_minutenversatz_braucht_keine_zeitzone() -> None:
    """„5 Minuten nach Buchung" rechnet vom echten Zeitpunkt, nicht von einer
    Wanduhr — hier gibt es nichts zu deuten."""
    th = {"arrival_date": "2026-10-10", "departure_date": "2026-10-12",
          "booked_at": "2026-10-01T21:55:00+00:00"}
    send_at = PlanungMixin._compute_send_at(  # noqa: SLF001
        "booking", 5, None, th, timezone_name=None, offset_unit="minutes", offset_value=5,
    )
    assert send_at == datetime(2026, 10, 1, 22, 0, tzinfo=UTC)
