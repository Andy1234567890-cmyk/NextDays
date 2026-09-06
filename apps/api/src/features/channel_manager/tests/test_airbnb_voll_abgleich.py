"""Voll-Abgleich am Airbnb-Kanal: erst ALLES aus Airbnb holen, dann schicken.

Anlass (06.09.2026): der Knopf war bei Airbnb derselbe Push wie bei Booking —
für ein frisch verbundenes Inserat kam sichtbar nichts. Airbnb ist das einzige
Portal, das Inhalte hergibt; der Voll-Abgleich holt sie dort für GENAU dieses
Objekt und reiht danach den Voll-Push ein.
"""
from __future__ import annotations

from typing import Any

from src.features.channel_manager.airbnb_voll_abgleich import AirbnbVollAbgleichMixin
from src.features.channel_manager.common import ChannelManagerError
from src.features.channel_manager.schemas import AirbnbObjektAbrufResponse

ABRUF = {
    "property_id": "p1", "listing_id": "1768637952856703501", "waehrung": "DKK",
    "zeitzone": "Europe/Copenhagen", "plan_angelegt": False, "zugeordnet": True,
    "preis_uebernommen": True, "base_price": 900.0, "min_stay": 2,
    "uebernommene_felder": ["title", "description", "amenities", "rooms"],
    "fotos_uebernommen": 12, "details_uebernommen": ["rooms"], "hinweis": None,
}


class _Dienst(AirbnbVollAbgleichMixin):
    def __init__(self, *, einreihen_scheitert: bool = False) -> None:
        self.eingereiht: list[tuple[str, str]] = []
        self.abgerufen: list[str] = []
        self._scheitert = einreihen_scheitert

    def _require_tenant(self, _ctx: Any) -> str:
        return "t1"

    def _require_db(self) -> object:
        return object()

    def airbnb_objekt_abrufen(self, _ctx: Any, property_id: str) -> dict[str, Any]:
        self.abgerufen.append(property_id)
        return dict(ABRUF)

    def _voll_push_einreihen(self, _db: Any, tenant_id: str, property_id: str) -> None:
        if self._scheitert:
            raise ChannelManagerError(
                "Full-Sync konnte nicht eingereiht werden.", status_code=502
            )
        self.eingereiht.append((tenant_id, property_id))


def test_holt_zuerst_und_reiht_dann_den_push_ein() -> None:
    dienst = _Dienst()
    raus = dienst.airbnb_voll_abgleich(object(), "p1")

    assert dienst.abgerufen == ["p1"]
    assert dienst.eingereiht == [("t1", "p1")]
    assert raus["push_eingereiht"] is True
    assert raus["fotos_uebernommen"] == 12
    # Das Feld überlebt die Serialisierung (FastAPI verwirft Unbekanntes still).
    assert AirbnbObjektAbrufResponse(**raus).model_dump()["push_eingereiht"] is True


def test_gescheitertes_einreihen_verliert_den_bericht_nicht() -> None:
    dienst = _Dienst(einreihen_scheitert=True)
    raus = dienst.airbnb_voll_abgleich(object(), "p1")

    assert raus["push_eingereiht"] is False
    assert raus["fotos_uebernommen"] == 12
    assert "eingereiht" in (raus["hinweis"] or "")


def test_objektseite_meldet_keinen_push() -> None:
    """Der reine Abruf der Objektseite trägt das Feld als `false` — kein
    behaupteter Push, der nicht lief (Wurzel 4)."""
    assert AirbnbObjektAbrufResponse(**ABRUF).model_dump()["push_eingereiht"] is False
