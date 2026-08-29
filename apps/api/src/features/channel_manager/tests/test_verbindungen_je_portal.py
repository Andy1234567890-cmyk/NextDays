"""Die Kanaele-Seite eines Objekts zeigt JE PORTAL eine Zeile.

ANLASS (29.08.2026): Unter „PORTALE" standen DREIMAL „Airbnb" untereinander,
jedes mit eigenem Schalter, keiner davon wirksam.

URSACHE: `list_channel_connections` gab jede Zeile aus
`channex_channel_connection` aus. Zu EINEM Portal kann es mehrere geben — jeder
abgebrochene Verbindungsversuch hinterlaesst eine, ebenso ein zweiter
Portal-Zugang am selben Objekt (0304). Der Kunde hatte dreimal auf „Airbnb
verbinden" geklickt, ohne den Login je abzuschliessen.

Dieselbe Wurzel wie im Veroeffentlichen-Dialog
(`test_veroeffentlichen_kanal_je_portal.py`).
"""
from __future__ import annotations

from typing import Any

import pytest

from src.core.security import AuthContext
from src.features.channel_manager.channels import ChannelsMixin

TENANT = "beb72997-1c28-4730-88dd-2e050084842d"
PROPERTY = "3809da2f-07fc-4e19-b3f8-b2459be41f8f"


class _Abfrage:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def select(self, *_a: Any, **_k: Any) -> _Abfrage:
        return self

    def eq(self, *_a: Any, **_k: Any) -> _Abfrage:
        return self

    def is_(self, *_a: Any, **_k: Any) -> _Abfrage:
        return self

    def order(self, *_a: Any, **_k: Any) -> _Abfrage:
        return self

    def limit(self, *_a: Any, **_k: Any) -> _Abfrage:
        return self

    def execute(self) -> Any:
        return type("R", (), {"data": self._rows})()


class _Db:
    def __init__(self, verbindungen: list[dict[str, Any]]) -> None:
        self._verbindungen = verbindungen

    def table(self, name: str) -> _Abfrage:
        if name == "channex_channel_connection":
            return _Abfrage(self._verbindungen)
        return _Abfrage([{"sync_enabled": True}])


class _Dienst(ChannelsMixin):
    def __init__(self, db: _Db) -> None:
        self._db = db

    def _require_tenant(self, _ctx: Any) -> str:
        return TENANT

    def _require_db(self) -> Any:
        return self._db


CTX = AuthContext(user_id="u", tenant_id=TENANT, role="admin")


def _zeile(*, kanal: str | None, aktiv: bool, portal: str = "AirBNB") -> dict[str, Any]:
    return {
        "ota_portal_code": portal,
        "ota_hotel_id": None,
        "ota_room_type_code": None,
        "ota_room_title": None,
        "channex_channel_id": kanal,
        "is_active": aktiv,
        "last_error": None,
        "updated_at": None,
    }


def test_drei_tote_zeilen_ergeben_eine() -> None:
    """Der Live-Fall: drei Airbnb-Zeilen ohne Kanal."""
    dienst = _Dienst(_Db([
        _zeile(kanal=None, aktiv=False),
        _zeile(kanal=None, aktiv=False),
        _zeile(kanal=None, aktiv=False),
    ]))
    out = dienst.list_channel_connections(CTX, PROPERTY)
    assert len(out) == 1, f"Airbnb steht {len(out)}x unter PORTALE"


def test_aktive_zeile_schlaegt_tote() -> None:
    """Eine Leiche darf die funktionierende Verbindung nicht verdecken."""
    dienst = _Dienst(_Db([
        _zeile(kanal=None, aktiv=False),
        _zeile(kanal="k1", aktiv=True),
        _zeile(kanal=None, aktiv=False),
    ]))
    out = dienst.list_channel_connections(CTX, PROPERTY)
    assert len(out) == 1
    assert out[0]["is_active"] is True, (
        "Die tote Zeile hat gewonnen — die Seite meldet 'nicht verbunden', "
        "waehrend das Objekt verkauft."
    )
    assert out[0]["channel_id"] == "k1"


def test_verbunden_schlaegt_kanallos() -> None:
    """Verbunden-aber-inaktiv ist aussagekraeftiger als gar kein Kanal."""
    dienst = _Dienst(_Db([
        _zeile(kanal=None, aktiv=False),
        _zeile(kanal="k1", aktiv=False),
    ]))
    out = dienst.list_channel_connections(CTX, PROPERTY)
    assert len(out) == 1
    assert out[0]["channel_id"] == "k1"


def test_verschiedene_portale_bleiben_getrennt() -> None:
    """Zusammenfassen heisst nicht verschmelzen."""
    dienst = _Dienst(_Db([
        _zeile(kanal="k1", aktiv=True),
        _zeile(kanal="k2", aktiv=True, portal="BookingCom"),
    ]))
    out = dienst.list_channel_connections(CTX, PROPERTY)
    codes = [c["portal_code"] for c in out]
    assert sorted(codes) == ["AirBNB", "BookingCom"]


@pytest.mark.parametrize("anzahl", [1, 2, 5])
def test_immer_hoechstens_eine_zeile_je_portal(anzahl: int) -> None:
    dienst = _Dienst(_Db([_zeile(kanal=None, aktiv=False) for _ in range(anzahl)]))
    out = dienst.list_channel_connections(CTX, PROPERTY)
    assert len(out) == 1
