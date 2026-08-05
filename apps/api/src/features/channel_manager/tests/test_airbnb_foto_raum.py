"""Foto ↔ Airbnb-Raum: die zwei Payload-Formen und das Fail-closed-Rücklesen.

Die Formen sind live gemessen (05.08.2026, Listing 1675950565421151420) und
nicht austauschbar — genau daran ist es zuerst gescheitert:

  * zuordnen: {"room_id": …}     — mit listing_id zusammen lehnt Airbnb ab
  * lösen:    {"listing_id": …}  — {"room_id": null} quittiert Airbnb mit 200
                                    und ändert NICHTS (stiller Nicht-Vorgang)
"""
from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from src.core.security import AuthContext
from src.features.channel_manager.common import ChannelManagerError
from src.features.channel_manager.service import ChannelManagerService

LISTING = "1675950565421151420"
FOTO_DB = "2925f3db-2df2-4b8b-9d36-bdc08d2be86c"
FOTO_AIRBNB = f"{LISTING}_2644183304"
RAUM = "792924439"


class _Kette:
    """Minimaler Supabase-Ersatz: liefert je Tabelle feste Zeilen."""

    def __init__(self, daten: list[dict]) -> None:
        self.daten = daten

    def select(self, *_a: object, **_k: object) -> _Kette:
        return self

    def update(self, _patch: dict) -> _Kette:
        return self

    def upsert(self, _zeile: dict, **_k: object) -> _Kette:
        return self

    def eq(self, *_a: object) -> _Kette:
        return self

    def in_(self, *_a: object) -> _Kette:
        return self

    def limit(self, _n: int) -> _Kette:
        return self

    def execute(self) -> object:
        return SimpleNamespace(data=self.daten)


class _DB:
    def __init__(self, tabellen: dict[str, list[dict]]) -> None:
        self.tabellen = tabellen

    def table(self, name: str) -> _Kette:
        return _Kette(self.tabellen.get(name, []))


class _Channex:
    """Merkt sich den Payload — er ist das Prüfobjekt."""

    def __init__(self) -> None:
        self.aufrufe: list[tuple[str, str, dict]] = []
        self.is_configured = True

    def airbnb_api_proxy_write(
        self, _channel: str, endpoint: str, method: str, *,
        params: dict | None = None, payload: dict | None = None,
    ) -> dict[str, Any]:
        self.aufrufe.append((endpoint, method, payload or {}))
        return {"data": {}}

    def set_trace_sink(self, _sink: object) -> None:
        return None


def _dienst(raum_danach: str | None) -> tuple[ChannelManagerService, _Channex]:
    """Service mit gefaktem Airbnb-Stand; `raum_danach` ist das Rücklese-Ergebnis."""
    channex = _Channex()
    db = _DB(
        {
            "properties": [{"id": "p-1", "airbnb_listing_id": LISTING}],
            "property_photos": [{"id": FOTO_DB, "url": "https://cdn/a.jpg"}],
            "airbnb_foto_raum": [{"airbnb_photo_id": FOTO_AIRBNB}],
        }
    )
    dienst = ChannelManagerService(service_client=db, channex=channex)
    dienst._airbnb_kanal_des_betriebs = staticmethod(lambda *_a: "kanal-1")  # type: ignore[method-assign]
    dienst._airbnb_token = lambda *_a: ("token", "user")  # type: ignore[method-assign]
    dienst.airbnb_fotos_direkt = lambda *_a: [  # type: ignore[method-assign]
        {"airbnb_photo_id": FOTO_AIRBNB, "airbnb_room_id": raum_danach}
    ]
    # Airbnbs Räume: der Ziel-Raum MUSS dabei sein, sonst greift der
    # Vorher-Check (tote Raum-ID) — genau der Fall, den `_raum_neu_aufloesen`
    # abfängt und den ein eigener Test prüft.
    dienst._airbnb_raeume_lesen = lambda *_a: [  # type: ignore[method-assign]
        {"id": RAUM, "room_type": "living_room"}
    ]
    return dienst, channex


def _ctx() -> AuthContext:
    return AuthContext(user_id="u-1", tenant_id="t-1", role="admin")


def test_zuordnen_sendet_nur_room_id() -> None:
    """`listing_id` daneben lehnt Airbnb ab („not both") — es darf nicht rein."""
    dienst, channex = _dienst(RAUM)
    dienst.airbnb_foto_umhaengen(
        _ctx(), property_id="p-1", photo_id=FOTO_DB, room_id=RAUM
    )
    _endpoint, _method, payload = channex.aufrufe[0]
    assert payload == {"room_id": RAUM}


def test_loesen_sendet_listing_id_statt_leerem_raum() -> None:
    """DER Befund: `{"room_id": null}` ist ein stiller Nicht-Vorgang.

    Airbnb antwortet darauf 200 und lässt die Zuordnung stehen. Gelöst wird nur,
    indem das Foto ans Listing gehängt wird.
    """
    dienst, channex = _dienst(None)
    dienst.airbnb_foto_umhaengen(
        _ctx(), property_id="p-1", photo_id=FOTO_DB, room_id=None
    )
    _endpoint, _method, payload = channex.aufrufe[0]
    assert payload == {"listing_id": LISTING}
    assert "room_id" not in payload


def test_nicht_uebernommene_aenderung_ist_ein_fehler() -> None:
    """Wurzel 5: ein 200 ohne Wirkung darf nicht als Erfolg durchgehen."""
    dienst, _channex = _dienst(RAUM)  # Airbnb meldet weiter den ALTEN Raum
    with pytest.raises(ChannelManagerError) as exc:
        dienst.airbnb_foto_umhaengen(
            _ctx(), property_id="p-1", photo_id=FOTO_DB, room_id=None
        )
    assert exc.value.status_code == 502


def test_tote_raum_id_wird_ueber_die_art_neu_aufgeloest() -> None:
    """DIE RAUM-ID IST FLÜCHTIG — Löschen+Neuanlegen gibt eine NEUE.

    Live passiert: der Balkon wurde im Extranet gelöscht, unser Sync legte ihn
    neu an, Airbnb vergab 817255403 statt 817240083. Die offene Fotos-Seite
    hielt die alte ID und bekam „Room 817240083 not found for listing …".
    Aufgelöst wird über die ART, die in unserer Cache-Zeile steht.
    """
    channex = _Channex()
    db = _DB(
        {
            "properties": [{"id": "p-1", "airbnb_listing_id": LISTING}],
            "property_photos": [{"id": FOTO_DB, "url": "https://cdn/a.jpg"}],
            "airbnb_foto_raum": [
                {
                    "airbnb_photo_id": FOTO_AIRBNB,
                    "airbnb_room_id": "817240083",   # die TOTE ID
                    "airbnb_room_art": "balcony",
                }
            ],
        }
    )
    dienst = ChannelManagerService(service_client=db, channex=channex)
    dienst._airbnb_kanal_des_betriebs = staticmethod(lambda *_a: "kanal-1")  # type: ignore[method-assign]
    dienst._airbnb_token = lambda *_a: ("token", "user")  # type: ignore[method-assign]
    # Airbnb kennt heute NUR die neue ID.
    dienst._airbnb_raeume_lesen = lambda *_a: [  # type: ignore[method-assign]
        {"id": "817255403", "room_type": "balcony"}
    ]
    dienst.airbnb_fotos_direkt = lambda *_a: [  # type: ignore[method-assign]
        {"airbnb_photo_id": FOTO_AIRBNB, "airbnb_room_id": "817255403"}
    ]
    ergebnis = dienst.airbnb_foto_umhaengen(
        _ctx(), property_id="p-1", photo_id=FOTO_DB, room_id="817240083"
    )
    # Gesendet wurde die HEUTIGE ID, nicht die tote aus der Oberfläche.
    _endpoint, _method, payload = channex.aufrufe[0]
    assert payload == {"room_id": "817255403"}
    assert ergebnis["airbnb_room_id"] == "817255403"


def test_mehrdeutige_art_bricht_ab_statt_zu_raten() -> None:
    """Zwei Schlafzimmer, tote ID → nicht raten (Wurzel 4).

    Sonst landete das Foto im falschen Schlafzimmer, und niemand sähe es.
    """
    channex = _Channex()
    db = _DB(
        {
            "properties": [{"id": "p-1", "airbnb_listing_id": LISTING}],
            "property_photos": [{"id": FOTO_DB, "url": "https://cdn/a.jpg"}],
            "airbnb_foto_raum": [
                {
                    "airbnb_photo_id": FOTO_AIRBNB,
                    "airbnb_room_id": "alt-1",
                    "airbnb_room_art": "bedroom",
                }
            ],
        }
    )
    dienst = ChannelManagerService(service_client=db, channex=channex)
    dienst._airbnb_kanal_des_betriebs = staticmethod(lambda *_a: "kanal-1")  # type: ignore[method-assign]
    dienst._airbnb_token = lambda *_a: ("token", "user")  # type: ignore[method-assign]
    dienst._airbnb_raeume_lesen = lambda *_a: [  # type: ignore[method-assign]
        {"id": "neu-1", "room_type": "bedroom"},
        {"id": "neu-2", "room_type": "bedroom"},
    ]
    dienst.airbnb_fotos_direkt = lambda *_a: [  # type: ignore[method-assign]
        {"airbnb_photo_id": FOTO_AIRBNB, "airbnb_room_id": None}
    ]
    with pytest.raises(ChannelManagerError) as exc:
        dienst.airbnb_foto_umhaengen(
            _ctx(), property_id="p-1", photo_id=FOTO_DB, room_id="alt-1"
        )
    assert exc.value.status_code == 409
    assert not channex.aufrufe  # NICHT geraten, gar nicht erst gesendet


def test_unlesbarer_stand_gilt_nicht_als_geloest() -> None:
    """Ohne Rücklesen keine Bestätigung — sonst sieht Nichtwissen wie Erfolg aus.

    Beim Lösen ist das Ziel `None`; wäre „nicht lesbar" ebenfalls `None`, würde
    ein fehlgeschlagener Aufruf als gelungen gemeldet.
    """
    dienst, _channex = _dienst(None)
    dienst.airbnb_fotos_direkt = lambda *_a: []  # type: ignore[method-assign]
    with pytest.raises(ChannelManagerError) as exc:
        dienst.airbnb_foto_umhaengen(
            _ctx(), property_id="p-1", photo_id=FOTO_DB, room_id=None
        )
    assert exc.value.status_code == 502
