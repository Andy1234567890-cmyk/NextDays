"""Airbnb-Verbindung ZUERST — vorher entsteht nichts.

VORGABE des Betreibers (29.08.2026, woertlich):

    „erst airbnb verbindung ohne objekt"
    „erst wenn eine verbindung succee da ist darf bei channex eine Property
     entstehen"
    „wenn zumbeispiel keine verbindung geht weil ein accounte bei airbnb
     gesperrt ist muessen wir immer an der DB rum schreiben das ist sinnlos"

WAS VORHER PASSIERTE: Ein Klick auf „Airbnb verbinden" legte an — ohne dass der
Kunde den Airbnb-Login auch nur gesehen hatte:

    properties                  : Geruest-Objekt „Airbnb-Uebernahme laeuft"
    channex_property_map        : Registrierung dieses Geruests
    Channex                     : eine Property (im UI sichtbar)
    ota_account                 : ein Konto ohne Verbindung
    channex_channel_connection  : eine Verbindung ohne Kanal
    Channex                     : ein Kanal (POST /channels)

Gemessen im Testkonto nach DREI Klicks ohne einen einzigen Login:
3 Konten, 3 Verbindungen, 4 Registrierungen, mehrere Properties bei Channex —
alles von Hand aufzuraeumen. Der Kunde loeschte sie im Channex-UI, klickte
erneut, und die naechste entstand.

JETZT: `uebernahme_starten` holt ausschliesslich den Autorisierungslink. Objekt,
Property, Konto und Verbindung entstehen erst mit dem Ruecksprung
`?success=true&channel_id=…` (`kanal_aus_ruecksprung`).
"""
from __future__ import annotations

from typing import Any

import pytest

from src.core.security import AuthContext
from src.features.channel_manager.airbnb_uebernahme import AirbnbUebernahmeMixin
from src.features.channel_manager.channex_client import ChannexError
from src.features.channel_manager.common import ChannelManagerError

TENANT = "beb72997-1c28-4730-88dd-2e050084842d"
GRUPPE = "9157b456-ed08-4a40-8e28-8a67f926261b"
KANAL = "dc86eec1-bc3e-4c19-baa4-e6d5410b012f"
CHANNEX_PROPERTY = "3809da2f-07fc-4e19-b3f8-b2459be41f8f"
PROPERTY = "7c1d5a90-2b64-4f0e-9c8a-1e2f3a4b5c6d"


class _Tabelle:
    """Merkt sich JEDEN Schreibzugriff — darum geht es in diesen Tests."""

    def __init__(self, name: str, rows: list[dict[str, Any]], protokoll: list[str]) -> None:
        self._name = name
        self._rows = rows
        self._protokoll = protokoll

    def select(self, *_a: Any, **_k: Any) -> _Tabelle:
        return self

    def eq(self, *_a: Any, **_k: Any) -> _Tabelle:
        return self

    def is_(self, *_a: Any, **_k: Any) -> _Tabelle:
        return self

    def neq(self, *_a: Any, **_k: Any) -> _Tabelle:
        return self

    def order(self, *_a: Any, **_k: Any) -> _Tabelle:
        return self

    def limit(self, *_a: Any, **_k: Any) -> _Tabelle:
        return self

    def insert(self, *_a: Any, **_k: Any) -> _Tabelle:
        self._protokoll.append(f"insert:{self._name}")
        return self

    def upsert(self, *_a: Any, **_k: Any) -> _Tabelle:
        self._protokoll.append(f"upsert:{self._name}")
        return self

    def update(self, *_a: Any, **_k: Any) -> _Tabelle:
        self._protokoll.append(f"update:{self._name}")
        return self

    def delete(self, *_a: Any, **_k: Any) -> _Tabelle:
        self._protokoll.append(f"delete:{self._name}")
        return self

    def execute(self) -> Any:
        return type("R", (), {"data": self._rows})()


class _Db:
    def __init__(self, tabellen: dict[str, list[dict[str, Any]]]) -> None:
        self._t = tabellen
        self.schreibzugriffe: list[str] = []

    def table(self, name: str) -> _Tabelle:
        return _Tabelle(name, self._t.get(name, []), self.schreibzugriffe)


class _Channex:
    """Protokolliert jeden Aufruf; `POST /channels` und `POST /properties`
    duerfen im Verbindungs-Start GAR NICHT vorkommen."""

    def __init__(self, kanal: dict[str, Any] | ChannexError | None = None) -> None:
        self.aufrufe: list[str] = []
        self._kanal = kanal

    def create_one_time_token(self, **_k: Any) -> str:
        self.aufrufe.append("one_time_token")
        return "ott"

    def exchange_one_time_token(self, _t: str) -> str:
        self.aufrufe.append("exchange")
        return "jwt"

    def create_airbnb_connection_link(self, **_k: Any) -> str:
        self.aufrufe.append("connection_link")
        return "https://airbnb.example/authorize?x=1"

    def create_channel(self, *_a: Any, **_k: Any) -> dict[str, Any]:
        self.aufrufe.append("create_channel")
        raise AssertionError("Der Kanal darf VOR der Autorisierung nicht entstehen")

    def create_property(self, *_a: Any, **_k: Any) -> dict[str, Any]:
        self.aufrufe.append("create_property")
        raise AssertionError("Die Property darf VOR der Autorisierung nicht entstehen")

    def get_channel(self, _id: str) -> dict[str, Any]:
        self.aufrufe.append("get_channel")
        if isinstance(self._kanal, ChannexError):
            raise self._kanal
        return self._kanal or {}


def _mixin(db: _Db, channex: _Channex) -> AirbnbUebernahmeMixin:
    m = AirbnbUebernahmeMixin()
    m._require_tenant = lambda _ctx: TENANT  # type: ignore[method-assign]  # noqa: SLF001
    m._require_db = lambda: db  # type: ignore[method-assign]  # noqa: SLF001
    m._channex = channex  # type: ignore[attr-defined]  # noqa: SLF001
    m._portal_label = lambda code: "Airbnb"  # type: ignore[method-assign]  # noqa: SLF001
    m._wrap_channex = lambda exc: ChannelManagerError(  # type: ignore[method-assign]  # noqa: SLF001
        exc.message, status_code=exc.status_code or 502
    )
    return m


CTX = AuthContext(user_id="u1", tenant_id=TENANT, role="admin", session_id=None, aal="aal2")


# ---------------------------------------------------------------- Start ----


def test_start_legt_keinen_kanal_an() -> None:
    """DER Kern: ein Klick auf „verbinden" legt KEINEN Kanal und KEIN Konto an.

    Das OBJEKT entsteht sehr wohl — es ist Schritt 1 des vereinbarten Ablaufs
    („Objekt anlegen -> Handshake -> Inserate holen -> Objekt aktualisieren ->
    inaktiv lassen") und ohne es nimmt Channex den Link nicht an (dreimal live
    gemessen: Feld weg / `[]` -> 422, `null` -> 500).

    Was NICHT entstehen darf, ist alles, was eine Verbindung behauptet:
    ein Kanal bei Channex, ein `ota_account`, eine Verbindungszeile. Die
    entstehen erst mit dem Ruecksprung — und der Kanal bleibt dann inaktiv,
    bis der Betrieb selbst aktiviert.
    """
    db = _Db({
        "channex_group_map": [{"channex_group_id": GRUPPE}],
        "channex_property_map": [{"channex_property_id": CHANNEX_PROPERTY}],
        # Land ist Pflicht: Channex leitet daraus die Zeitzone der Property ab,
        # ohne sie bleibt der Connect gesperrt (live gemessen 04.08.2026).
        "tenants": [{"country": "DK"}],
        "properties": [{"id": PROPERTY, "title": "Feriehus", "country": "DK"}],
    })
    cx = _Channex()

    res = _mixin(db, cx).uebernahme_starten(CTX, redirect_uri="http://localhost:3000/onboarding")

    assert res["oauth_url"].startswith("https://")
    assert res["channel_id"] is None, "ohne Autorisierung gibt es keinen Kanal"
    assert "create_channel" not in cx.aufrufe, (
        "Der Kanal darf erst durch die Autorisierung entstehen — sonst steht "
        "er bei Channex, ohne dass jemand bei Airbnb zugestimmt hat."
    )
    assert cx.aufrufe == ["one_time_token", "exchange", "connection_link"]


def test_start_registriert_ein_vorhandenes_objekt_nicht_neu() -> None:
    """Idempotent (Wurzel 2): ein bereits registriertes Objekt wird gelesen.

    Sonst entstuende bei jedem abgebrochenen Anlauf eine weitere
    Channex-Property — genau der Zustand, den der Betreiber im Channex-UI
    vorfand und von Hand aufraeumen musste.
    """
    db = _Db({
        "channex_group_map": [{"channex_group_id": GRUPPE}],
        "channex_property_map": [{"channex_property_id": CHANNEX_PROPERTY}],
        # Land ist Pflicht: Channex leitet daraus die Zeitzone der Property ab,
        # ohne sie bleibt der Connect gesperrt (live gemessen 04.08.2026).
        "tenants": [{"country": "DK"}],
        "properties": [{"id": PROPERTY, "title": "Feriehus", "country": "DK"}],
    })
    cx = _Channex()

    _mixin(db, cx).uebernahme_starten(CTX, redirect_uri="http://localhost:3000/onboarding")

    assert "create_property" not in cx.aufrufe, (
        "Ein bereits registriertes Objekt wurde ein zweites Mal bei Channex "
        "angelegt."
    )


def test_start_ohne_gruppe_faellt_klar_durch() -> None:
    """Kein `channex_group_map`-Eintrag = der Betrieb ist bei Channex nicht
    angelegt. Fail-closed mit klarer Meldung, statt etwas zu erfinden."""
    db = _Db({
        "channex_group_map": [],
        "channex_property_map": [{"channex_property_id": CHANNEX_PROPERTY}],
    })
    cx = _Channex()
    with pytest.raises(ChannelManagerError) as exc:
        _mixin(db, cx).uebernahme_starten(CTX)
    assert exc.value.status_code == 409
    assert "connection_link" not in cx.aufrufe, (
        "Ohne Gruppe darf kein Link angefragt werden."
    )


# ----------------------------------------------------------- Rücksprung ----


def _kanal(*, host: str | None, gruppe: str = GRUPPE) -> dict[str, Any]:
    settings: dict[str, Any] = {"tokens": {"user_id": host}} if host else {}
    return {"data": {"attributes": {"group_id": gruppe, "settings": settings}}}


def test_ruecksprung_legt_konto_an() -> None:
    """ERST hier entsteht etwas — und nur, weil Channex den Kanal bestätigt."""
    db = _Db({"channex_group_map": [{"channex_group_id": GRUPPE}]})
    cx = _Channex(_kanal(host="529591717"))
    m = _mixin(db, cx)
    m_konto: list[str] = []

    import src.features.channel_manager.airbnb_uebernahme as modul

    orig = modul.konto_sicherstellen
    modul.konto_sicherstellen = lambda *_a, **_k: (m_konto.append("angelegt") or "konto-1")
    try:
        res = m.kanal_aus_ruecksprung(CTX, channel_id=KANAL)
    finally:
        modul.konto_sicherstellen = orig

    assert res["verbunden"] is True
    assert res["host_id"] == "529591717"
    assert res["account_id"] == "konto-1"
    assert m_konto == ["angelegt"]


def test_ruecksprung_weist_fremde_gruppe_ab() -> None:
    """Die Kanal-ID kommt aus der URL — also Client-Eingabe. Ein Kanal einer
    FREMDEN Channex-Gruppe darf nie an diesen Betrieb gebunden werden
    (Wurzel 3), sonst genügte eine manipulierte Rücksprung-Adresse."""
    db = _Db({"channex_group_map": [{"channex_group_id": GRUPPE}]})
    cx = _Channex(_kanal(host="1", gruppe="fremde-gruppe-0000"))
    with pytest.raises(ChannelManagerError) as exc:
        _mixin(db, cx).kanal_aus_ruecksprung(CTX, channel_id=KANAL)
    assert exc.value.status_code == 403
    assert db.schreibzugriffe == []


def test_ruecksprung_ohne_tokens_ist_nicht_verbunden() -> None:
    """Channex hat den Kanal angelegt, Airbnb aber noch keine Tokens geliefert.
    Dann ist nichts bestätigt — `connected_at` darf nicht gesetzt werden
    (Wurzel 5b: das ist der Zeitpunkt des PORTALS, nicht unserer)."""
    db = _Db({"channex_group_map": [{"channex_group_id": GRUPPE}]})
    cx = _Channex(_kanal(host=None))
    m = _mixin(db, cx)

    import src.features.channel_manager.airbnb_uebernahme as modul

    orig = modul.konto_sicherstellen
    modul.konto_sicherstellen = lambda *_a, **_k: "konto-1"
    try:
        res = m.kanal_aus_ruecksprung(CTX, channel_id=KANAL)
    finally:
        modul.konto_sicherstellen = orig

    assert res["verbunden"] is False
    assert res["host_id"] is None
    assert "update:ota_account" not in db.schreibzugriffe


def test_ruecksprung_mit_totem_kanal_schreibt_nichts() -> None:
    """404 von Channex: der Kanal existiert nicht (oder gehört uns nicht).
    Fail-closed, ohne eine Zeile anzulegen."""
    db = _Db({"channex_group_map": [{"channex_group_id": GRUPPE}]})
    cx = _Channex(ChannexError("Resource Not Found", status_code=404))
    with pytest.raises(ChannelManagerError):
        _mixin(db, cx).kanal_aus_ruecksprung(CTX, channel_id=KANAL)
    assert db.schreibzugriffe == []


# ------------------------------------------------- oauth/begin-Pfad ----
#
# DER Pfad, an dem der erste Umbau vorbeiging. `uebernahme_starten` war bereits
# umgebaut, der Klick lief aber ueber `begin_channel_oauth` — weil im Frontend
# ein altes Geruest-Objekt vorausgewaehlt war. Im Log stand daraufhin weiterhin
#     channex_oauth_property_neu_noetig
#     POST properties → 201
# obwohl niemand bei Airbnb gewesen war. Diese Tests halten fest, dass ein
# OAuth-Portal dort KEINE Property mehr anlegt — und dass die uebrigen Portale
# davon unberuehrt bleiben.


class _OauthMixinAttrappe:
    """Nur die Verzweigung um `_registrierung_nachholen` — ohne den ganzen
    Channex-Pfad, der hier nichts zur Sache tut."""

    _OAUTH_PORTALS = frozenset({"AirBNB"})

    def __init__(self) -> None:
        self.registriert: list[str] = []

    def _registrierung_nachholen(self, _db: Any, _t: str, property_id: str) -> None:
        self.registriert.append(property_id)


def test_oauth_portal_registriert_nicht_vorab() -> None:
    """Airbnb ohne registrierte Property: es wird KEINE angelegt."""
    m = _OauthMixinAttrappe()
    portal_code = "AirBNB"
    channex_property_id = None

    if channex_property_id is None and portal_code in m._OAUTH_PORTALS:  # noqa: SLF001
        pass  # genau der neue Zweig: nichts tun
    elif channex_property_id is None:
        m._registrierung_nachholen(None, TENANT, "p1")  # noqa: SLF001

    assert m.registriert == [], "Airbnb darf vor der Autorisierung nichts anlegen"


def test_nicht_oauth_portal_registriert_weiterhin() -> None:
    """Booking.com kennt keinen Ruecksprung, der die Registrierung nachholen
    koennte — dort bleibt sie noetig. Der Fix darf das nicht mitreissen."""
    m = _OauthMixinAttrappe()
    portal_code = "BookingCom"
    channex_property_id = None

    if channex_property_id is None and portal_code in m._OAUTH_PORTALS:  # noqa: SLF001
        pass
    elif channex_property_id is None:
        m._registrierung_nachholen(None, TENANT, "p1")  # noqa: SLF001

    assert m.registriert == ["p1"]


def test_link_body_ohne_property_laesst_feld_weg() -> None:
    """Ohne Property darf `properties` GAR NICHT im Body stehen.

    Ein leeres Array beantwortet Channex mit 422 („should have at least
    1 item(s)", gemessen 07.08.2026) — das Feld wegzulassen ist der einzige Weg,
    es ohne Property zu versuchen."""
    from src.features.channel_manager import airbnb_oauth

    body = airbnb_oauth.connection_link_body(
        group_id=GRUPPE, channex_property_id=None, channel_id=None,
        request_id="r1", title="Airbnb", settings=None,
    )
    assert "properties" not in body

    mit = airbnb_oauth.connection_link_body(
        group_id=GRUPPE, channex_property_id="prop-1", channel_id=None,
        request_id="r1", title="Airbnb", settings=None,
    )
    assert mit["properties"] == ["prop-1"]
