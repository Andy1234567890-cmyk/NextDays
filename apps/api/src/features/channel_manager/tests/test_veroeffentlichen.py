"""Veröffentlichen je Kanal: Auswahl, Vorschau, Sichtbarkeit schalten.

DER ANLASS (06.08.2026): „Aktiv" wirkte nur bei uns — bei Airbnb standen alle
18 Objekte weiter auf „Unlisted". Der Schalter ist `published` im
Channex-Mapping je Listing.

DIE GEFAHR, die die meisten Tests hier abdecken: `PUT channels/{id}` ERSETZT
das `rate_plans`-Array. Der Kanal trägt ALLE Objekte des Kontos (live 18).
Ein Schreibaufruf, der nur das eine Mapping sendet, trennt die anderen 17 vom
Portal — aus einem Klick „veröffentlichen" würde ein stiller Totalausfall.
"""
from __future__ import annotations

from typing import Any

import pytest

from src.features.channel_manager.common import ChannelManagerError
from src.features.channel_manager.veroeffentlichen import (
    GRUND_INAKTIV,
    GRUND_KEIN_KANAL,
    MARKTPLATZ_CODE,
    VeroeffentlichenMixin,
    kanal_auswahl,
    portal_label,
)


class _DB:
    """Minimale Supabase-Attrappe für `channex_channel_connection`."""

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def table(self, _name: str) -> _DB:
        return self

    def select(self, *_a: object, **_k: object) -> _DB:
        return self

    def eq(self, *_a: object) -> _DB:
        return self

    def execute(self) -> Any:
        return type("R", (), {"data": self._rows})()


# Genau der Live-Stand vom 06.08.2026: Airbnb verbunden, die anderen zwei
# tragen zwar eine Zeile, aber KEINE channex_channel_id.
LIVE_ZEILEN = [
    {"ota_portal_code": "AirBNB", "channex_channel_id": "ch-1",
     "is_active": True, "last_error": None},
    {"ota_portal_code": "BookingCom", "channex_channel_id": None,
     "is_active": True, "last_error": None},
    {"ota_portal_code": "Vrbo", "channex_channel_id": None,
     "is_active": True, "last_error": None},
]


def test_nur_wirklich_verbundene_sind_waehlbar() -> None:
    """Eine Zeile ohne Kanal-ID ist eine Absicht, keine Verbindung.

    Live tragen 78 Zeilen nur 18 Kanal-IDs. Wären Booking.com/Vrbo wählbar,
    häkelte der Betrieb etwas an, das nirgends ankommt (Wurzel 4).
    """
    kanaele = kanal_auswahl(_DB(LIVE_ZEILEN), "t-1", "p-1", marktplatz=False)
    nach_code = {k["code"]: k for k in kanaele}
    assert nach_code["AirBNB"]["waehlbar"] is True
    assert nach_code["BookingCom"]["waehlbar"] is False
    assert nach_code["BookingCom"]["grund"] == GRUND_KEIN_KANAL
    assert nach_code["Vrbo"]["grund"] == GRUND_KEIN_KANAL


def test_nicht_verbundene_werden_gezeigt_nicht_verschwiegen() -> None:
    """Weglassen sähe aus, als gäbe es das Portal nicht."""
    codes = {k["code"] for k in
             kanal_auswahl(_DB(LIVE_ZEILEN), "t-1", "p-1", marktplatz=False)}
    assert {"AirBNB", "BookingCom", "Vrbo", MARKTPLATZ_CODE} <= codes


def test_marktplatz_braucht_keinen_kanal() -> None:
    """myBestDays ist kein OTA — eigene Achse, immer wählbar."""
    kanaele = kanal_auswahl(_DB([]), "t-1", "p-1", marktplatz=True)
    markt = [k for k in kanaele if k["code"] == MARKTPLATZ_CODE][0]
    assert markt["waehlbar"] is True
    assert markt["bereits_gelistet"] is True


def test_marktplatz_ist_pflicht_und_steht_oben() -> None:
    """myBestDays ist NICHT abwählbar und steht an erster Stelle.

    Unsere eigene Strecke: ein Objekt, das dort nicht liegt, verkaufen wir gar
    nicht selbst, sondern nur über fremde Portale gegen deren Provision.
    """
    kanaele = kanal_auswahl(_DB(LIVE_ZEILEN), "t-1", "p-1", marktplatz=False)
    assert kanaele[0]["code"] == MARKTPLATZ_CODE
    assert kanaele[0]["pflicht"] is True


def test_fremde_portale_bleiben_abwaehlbar() -> None:
    """Wem der Betrieb Provision zahlt, entscheidet er selbst."""
    kanaele = kanal_auswahl(_DB(LIVE_ZEILEN), "t-1", "p-1", marktplatz=False)
    for k in kanaele:
        if k["code"] != MARKTPLATZ_CODE:
            assert k["pflicht"] is False, f"{k['code']} darf kein Pflichtkanal sein"


def test_marktplatz_ist_nie_nicht_verbunden() -> None:
    """Er braucht keinen Channex-Kanal — auch ohne jede Verbindung wählbar."""
    kanaele = kanal_auswahl(_DB([]), "t-1", "p-1", marktplatz=False)
    markt = [k for k in kanaele if k["code"] == MARKTPLATZ_CODE][0]
    assert markt["waehlbar"] is True
    assert markt["grund"] is None


def test_inaktive_verbindung_ist_nicht_waehlbar() -> None:
    """Kanal-ID vorhanden, aber abgeschaltet — anderer Grund als „nie verbunden"."""
    kanaele = kanal_auswahl(
        _DB([{"ota_portal_code": "AirBNB", "channex_channel_id": "ch-1",
              "is_active": False, "last_error": "Token abgelaufen"}]),
        "t-1", "p-1", marktplatz=False,
    )
    airbnb = [k for k in kanaele if k["code"] == "AirBNB"][0]
    assert airbnb["waehlbar"] is False
    assert airbnb["grund"] == GRUND_INAKTIV
    assert airbnb["letzter_fehler"] == "Token abgelaufen"


def test_waehlbare_stehen_oben() -> None:
    """Was geht, zuerst — der Betrieb soll nicht an Gesperrtem vorbeiscrollen."""
    kanaele = kanal_auswahl(_DB(LIVE_ZEILEN), "t-1", "p-1", marktplatz=False)
    ohne_markt = [k for k in kanaele if k["code"] != MARKTPLATZ_CODE]
    assert ohne_markt[0]["code"] == "AirBNB"


def test_portalnamen_sind_eigennamen() -> None:
    """„AirBNB" ist ein interner Code, „Airbnb" der Name der Marke."""
    assert portal_label("AirBNB") == "Airbnb"
    assert portal_label("BookingCom") == "Booking.com"
    # Unbekannter Code bleibt stehen, statt zu verschwinden.
    assert portal_label("NeuesPortal") == "NeuesPortal"


# --------------------------------------------------------------------------
# Sichtbarkeit schalten — hier liegt das Risiko.
# --------------------------------------------------------------------------

def _kanal(mappings: list[tuple[str, bool]]) -> dict[str, Any]:
    """Kanal-Antwort mit (listing_id, published) je Mapping."""
    return {"data": {"attributes": {"rate_plans": [
        {"rate_plan_id": f"rp-{lid}",
         "settings": {"listing_id": lid, "published": pub,
                      "sync_category": "sync_all"}}
        for lid, pub in mappings
    ]}}}


class _Channex:
    def __init__(self, mappings: list[tuple[str, bool]]) -> None:
        self._mappings = list(mappings)
        self.gesendet: list[dict[str, Any]] = []

    def get_channel(self, _cid: str) -> dict[str, Any]:
        return _kanal(self._mappings)

    def update_channel(self, _cid: str, attrs: dict[str, Any]) -> dict[str, Any]:
        self.gesendet.append(attrs)
        # Den gesendeten Stand übernehmen — so liest die Gegenprobe echt zurück.
        self._mappings = [
            (str(p["settings"]["listing_id"]), bool(p["settings"]["published"]))
            for p in attrs["rate_plans"]
        ]
        return {}


class _Dienst(VeroeffentlichenMixin):
    def __init__(self, channex: _Channex) -> None:
        self._channex = channex


def test_nur_das_eine_listing_wird_umgestellt() -> None:
    """DIE Kernprüfung: 18 Objekte hängen an einem Kanal.

    Nach dem Schalten muss GENAU eines anders sein — und alle anderen müssen
    noch da sein. Ein PUT mit nur einem Mapping würde 17 Objekte vom Portal
    trennen.
    """
    cx = _Channex([("l-1", False), ("l-2", False), ("l-3", True)])
    dienst = _Dienst(cx)
    assert dienst.airbnb_sichtbarkeit_setzen("ch-1", "l-2", sichtbar=True) is True
    gesendet = cx.gesendet[0]["rate_plans"]
    assert len(gesendet) == 3, "Es müssen ALLE Mappings zurückgeschrieben werden"
    stand = {p["settings"]["listing_id"]: p["settings"]["published"]
             for p in gesendet}
    assert stand == {"l-1": False, "l-2": True, "l-3": True}


def test_fremde_einstellungen_bleiben_erhalten() -> None:
    """Am Mapping hängen Preis- und Verfügbarkeitsregeln — die dürfen nicht weg."""
    cx = _Channex([("l-1", False)])
    _Dienst(cx).airbnb_sichtbarkeit_setzen("ch-1", "l-1", sichtbar=True)
    settings = cx.gesendet[0]["rate_plans"][0]["settings"]
    assert settings["sync_category"] == "sync_all"
    assert cx.gesendet[0]["rate_plans"][0]["rate_plan_id"] == "rp-l-1"


def test_unbekanntes_listing_bricht_ab() -> None:
    """Lieber 422 als einen PUT, der nichts trifft aber alles überschreibt."""
    cx = _Channex([("l-1", False)])
    with pytest.raises(ChannelManagerError) as exc:
        _Dienst(cx).airbnb_sichtbarkeit_setzen("ch-1", "l-999", sichtbar=True)
    assert exc.value.status_code == 422
    assert not cx.gesendet, "Bei unbekanntem Listing darf NICHTS gesendet werden"


def test_mehrdeutige_zuordnung_bricht_ab() -> None:
    """Zwei Mappings auf dieselbe Anzeige: unklar, welches gilt (Wurzel 5)."""
    cx = _Channex([("l-1", False), ("l-1", True)])
    with pytest.raises(ChannelManagerError) as exc:
        _Dienst(cx).airbnb_sichtbarkeit_setzen("ch-1", "l-1", sichtbar=True)
    assert exc.value.status_code == 409
    assert not cx.gesendet


def test_abschalten_geht_genauso() -> None:
    """Der Gegenzustand muss denselben Weg gehen (Wurzel 1)."""
    cx = _Channex([("l-1", True), ("l-2", True)])
    assert _Dienst(cx).airbnb_sichtbarkeit_setzen(
        "ch-1", "l-1", sichtbar=False
    ) is True
    stand = {p["settings"]["listing_id"]: p["settings"]["published"]
             for p in cx.gesendet[0]["rate_plans"]}
    assert stand == {"l-1": False, "l-2": True}


def test_nicht_uebernommener_wert_wird_erkannt() -> None:
    """Ein 200 beweist nichts — zurückgelesen wird immer.

    Hier nimmt der Kanal die Änderung nicht an; das Ergebnis muss False sein,
    statt „veröffentlicht" zu melden, während das Objekt unlisted bleibt.
    """
    class _Stur(_Channex):
        def update_channel(self, _cid: str, attrs: dict[str, Any]) -> dict[str, Any]:
            self.gesendet.append(attrs)
            return {}  # Stand bleibt, wie er war.

    cx = _Stur([("l-1", False)])
    assert _Dienst(cx).airbnb_sichtbarkeit_setzen(
        "ch-1", "l-1", sichtbar=True
    ) is False
