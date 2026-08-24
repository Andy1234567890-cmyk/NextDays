"""Die Auswahl-Liste des Dialogs „Preisplan anlegen" — LESEND.

WARUM ES DIESEN ENDPUNKT GIBT: die Zuordnung eines Preisplans zu einer
Portal-Rate laeuft ausschliesslich ueber Namensgleichheit
(`portal_raten_plaene.paar_fuer_portal_plan`). Ein getippter „Wochenpreis" neben
Bookings „Wochenrate" ergibt einen Plan, der nie beim Portal ankommt — eine
Attrappe ohne Fehlermeldung. Der Endpunkt liefert die Titel, damit der Nutzer
sie WAEHLT statt sie abzuschreiben.

DER WICHTIGSTE TEST ist `test_abruf_leer_ist_nicht_nichts_frei`: eine leere
Liste und ein fehlgeschlagener Abruf sehen identisch aus. Ohne `abruf_ok`
behauptete die Oberflaeche bei jeder Channex-Stoerung „keine Raten frei" — und
der Nutzer tippte wieder von Hand, also genau der Fehler zurueck, den der Dialog
beheben soll (Wurzel 5).

DER TEST-DOPPELGAENGER BILDET DEN ECHTEN ZUSTAND AB, nicht den kaputten: jeder
Kanal-Eintrag traegt `occupancy` UND `primary_occ`, so wie eine funktionierende
Booking-Zuordnung live aussieht. Ein Eintrag ohne diese Felder ist eine ATTRAPPE
(`_eintrag_traegt_restriktionen`) und ein eigener, gemessener Fehlzustand — er
ist hier ausdruecklich waehlbar (`attrappe_codes`), nicht der Normalfall. Genau
daran sind in diesem Slice schon Tests gruen gewesen, ohne etwas zu pruefen.
"""
from __future__ import annotations

from typing import Any

import pytest

from src.core.security import AuthContext
from src.features.channel_manager.channels import ChannelsMixin
from src.features.channel_manager.channex_client import ChannexError
from src.features.channel_manager.common import ChannelManagerError
from src.features.channel_manager.portal_raten_abgleich import (
    PortalRatenAbgleichMixin,
)
from src.features.channel_manager.portal_raten_auswahl import (
    MAX_RATEN_JE_PORTAL,
    PortalRatenAuswahlMixin,
)

TENANT = "a25577cf-c941-45c4-8d23-008887e631aa"
FREMD = "11111111-2222-3333-4444-555555555555"
OBJEKT = "6efd2281-1649-4883-9cf1-4e39f49fec66"  # FeWo *Stjerneskud*
ZIMMER = 1220760101

# Die Live-Lage: zwei Raten unter einer Booking-Kennung. Die Standard Rate
# traegt den Grundpreis (primaer), die Wochenrate hat keinen eigenen Plan.
STANDARD = {"id": 47588686, "title": "Standard Rate"}
WOCHE = {"id": 63941996, "title": "Wochenrate"}

VERBINDUNG = {
    "ota_portal_code": "BookingCom",
    "ota_hotel_id": "15122264",
    "channex_channel_id": "ch-1",
}
AIRBNB_VERBINDUNG = {
    "ota_portal_code": "AirBNB",
    "ota_hotel_id": "2087",
    "channex_channel_id": "ch-air",
}


# --- Doppelgaenger ----------------------------------------------------------
class _Tabelle:
    def __init__(self, db: _Db, name: str) -> None:
        self._db = db
        self._name = name
        self._spalten = ""
        self._eq: list[tuple[Any, Any]] = []

    def select(self, spalten: str = "") -> _Tabelle:
        self._spalten = spalten
        return self

    def eq(self, spalte: Any = None, wert: Any = None) -> _Tabelle:
        self._eq.append((spalte, wert))
        return self

    def is_(self, *_a: Any, **_k: Any) -> _Tabelle:
        return self

    def in_(self, *_a: Any, **_k: Any) -> _Tabelle:
        return self

    @property
    def not_(self) -> _Tabelle:
        return self

    def order(self, *_a: Any, **_k: Any) -> _Tabelle:
        return self

    def limit(self, *_a: Any, **_k: Any) -> _Tabelle:
        return self

    def insert(self, *_a: Any, **_k: Any) -> _Tabelle:  # pragma: no cover
        raise AssertionError("der Endpunkt ist LESEND — kein insert")

    def update(self, *_a: Any, **_k: Any) -> _Tabelle:  # pragma: no cover
        raise AssertionError("der Endpunkt ist LESEND — kein update")

    def delete(self, *_a: Any, **_k: Any) -> _Tabelle:  # pragma: no cover
        raise AssertionError("der Endpunkt ist LESEND — kein delete")

    def execute(self) -> Any:
        return type("R", (), {
            "data": self._db.lesen(self._name, self._spalten, dict(self._eq)),
        })()


class _Db:
    """`insert`/`update`/`delete` fehlen bewusst NICHT — sie werfen. Damit ist
    dieser Doppelgaenger die Wache darueber, dass der Endpunkt nur liest."""

    def __init__(
        self, *,
        verbindungen: list[dict[str, Any]] | None = None,
        plaene: list[dict[str, Any]] | None = None,
        objekt_tenant: str = TENANT,
    ) -> None:
        self.verbindungen = (
            [VERBINDUNG] if verbindungen is None else verbindungen
        )
        # Der Grundpreis ist bei Channex als `cx-grundpreis` registriert.
        self.plaene = (
            [{"id": "grund-1", "name": "Grundpreis"}]
            if plaene is None else plaene
        )
        self.objekt_tenant = objekt_tenant
        self.gelesen: list[str] = []

    def table(self, name: str) -> _Tabelle:
        return _Tabelle(self, name)

    def lesen(
        self, name: str, spalten: str, filter_: dict[Any, Any] | None = None
    ) -> list[dict[str, Any]]:
        self.gelesen.append(name)
        filter_ = filter_ or {}
        if name == "properties":
            # Der ECHTE Scope-Weg: `load_scoped` filtert per (id, tenant_id).
            # Ein fremder Tenant bekommt hier NICHTS zurueck — und damit einen
            # 404, nicht die Daten.
            if (
                filter_.get("id") != OBJEKT
                or filter_.get("tenant_id") != self.objekt_tenant
            ):
                return []
            return [{"id": OBJEKT}]
        if name == "channex_channel_connection":
            if filter_.get("tenant_id") != self.objekt_tenant:
                return []
            return list(self.verbindungen)
        if name == "rate_plans":
            return list(self.plaene)
        if name == "channex_rate_plan_map":
            return [
                {"local_rate_plan_id": p["id"],
                 "channex_rate_plan_id": f"cx-{p['id']}"}
                for p in self.plaene
            ]
        raise AssertionError(f"unerwartete Tabelle: {name}")


class _Channex:
    """Die ZWEI lesenden Calls. `create_channel_mapping`, `update_channel` und
    `delete_channel_mapping` sind NICHT definiert — jeder Schreibversuch waere
    hier ein AttributeError, und genau das ist die Behauptung."""

    def __init__(
        self,
        antwort: dict[str, Any] | ChannexError,
        *,
        zuordnungen: list[tuple[str, Any, bool]] | None = None,
        kanal: ChannexError | dict[str, Any] | None = None,
        attrappe_codes: set[str] | None = None,
    ) -> None:
        self.antwort = antwort
        # Live-Lage: die Standard Rate traegt den Grundpreis als PRIMAERE
        # Zuordnung, die Wochenrate haengt (ohne eigenen Plan) daneben.
        self.zuordnungen = (
            [("cx-grund-1", STANDARD["id"], True)]
            if zuordnungen is None else zuordnungen
        )
        self.kanal = kanal
        self.attrappe_codes = attrappe_codes or set()
        self.details_aufrufe: list[dict[str, Any]] = []
        self.kanal_aufrufe: list[str] = []

    def get_channel_mapping_details(
        self, *, channel: str, settings: dict[str, Any]
    ) -> dict[str, Any]:
        self.details_aufrufe.append({"channel": channel, "settings": settings})
        if isinstance(self.antwort, ChannexError):
            raise self.antwort
        return self.antwort

    def get_channel(self, channel_id: str) -> dict[str, Any]:
        self.kanal_aufrufe.append(channel_id)
        if isinstance(self.kanal, ChannexError):
            raise self.kanal
        if self.kanal is not None:
            return self.kanal
        return {
            "data": {
                "attributes": {
                    "rate_plans": [
                        {
                            "id": f"map-{code}-{plan}",
                            "rate_plan_id": plan,
                            "settings": {
                                "room_type_code": ZIMMER,
                                "rate_plan_code": code,
                                "primary_occ": primary,
                                # `occupancy`/`pricing_type` gehoeren zu einem
                                # ECHTEN Eintrag. Ohne sie ist er eine Attrappe
                                # — ein eigener Fehlzustand, deshalb waehlbar
                                # und nicht der Normalfall.
                                **(
                                    {}
                                    if str(code) in self.attrappe_codes
                                    else {"occupancy": 4,
                                          "pricing_type": "Standard"}
                                ),
                            },
                        }
                        for plan, code, primary in self.zuordnungen
                    ]
                }
            }
        }


def _details(rates: list[dict[str, Any]]) -> dict[str, Any]:
    """Booking-Form von `mapping_details`: data.rooms[].rates[]."""
    return {
        "data": {
            "rooms": [{"id": ZIMMER, "title": "Ferienhaus", "rates": rates}]
        }
    }


def _airbnb_details(listings: list[dict[str, Any]]) -> dict[str, Any]:
    """Airbnb-Form: eine flache Listing-Liste, KEINE Raten-Ebene."""
    return {"data": {"listing_id_dictionary": {"values": listings}}}


class _Dienst(
    ChannelsMixin, PortalRatenAbgleichMixin, PortalRatenAuswahlMixin
):
    """Dieselbe Mixin-Reihenfolge wie im echten Dienst. `_kanaele_mit_raten`,
    `_portal_raten` und `_belegte_ratencodes` sind die ECHTEN aus dem Abgleich,
    `_normalize_mapping_rooms` das echte aus `ChannelsMixin` — genau darum geht
    es: eine Lese-Regel, nicht zwei."""

    def __init__(self, db: _Db, channex: _Channex) -> None:
        self._db = db
        self._channex = channex

    def _require_db(self) -> _Db:
        return self._db

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:  # pragma: no cover — im Test immer gesetzt
            raise ChannelManagerError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id


def _ctx(tenant_id: str = TENANT) -> AuthContext:
    return AuthContext(user_id="u-1", tenant_id=tenant_id, role="admin")


def _lauf(db: _Db, channex: _Channex, *, tenant: str = TENANT) -> dict[str, Any]:
    return _Dienst(db, channex).portal_raten_auswahl(_ctx(tenant), OBJEKT)


# --- Der Normalfall --------------------------------------------------------
def test_freie_rate_kommt_mit_vorschlag_sieben() -> None:
    """Die Wochenrate hat keinen eigenen Plan → frei, min_stay-Vorschlag 7.

    7 ist keine Erfindung: eine Wochenrate ist bei Booking ein eigener
    Ratenkategorie-Typ fuer „stays of seven nights or more"; der
    Mindestaufenthalt IST ihre Mechanik (`min_stay_aus_titel`)."""
    antwort = _lauf(_Db(), _Channex(_details([STANDARD, WOCHE])))

    assert antwort["property_id"] == OBJEKT
    assert len(antwort["portals"]) == 1
    portal = antwort["portals"][0]
    assert portal["portal"] == "BookingCom"
    assert portal["abruf_ok"] is True
    assert portal["kanal_lesbar"] is True
    assert portal["truncated"] is False

    woche = [r for r in portal["rates"] if r["title"] == "Wochenrate"]
    assert len(woche) == 1
    assert woche[0] == {
        "rate_plan_code": "63941996",
        "title": "Wochenrate",
        "room_type_code": str(ZIMMER),
        "portal": "BookingCom",
        "belegt": False,
        "min_stay": 7,
    }


def test_belegte_rate_kommt_mit_belegt_true() -> None:
    """Die Standard Rate traegt den Grundpreis primaer → `belegt: true`.

    Sie wird NICHT weggefiltert: der Nutzer soll sehen, dass sie versorgt ist
    (ausgegraut), statt einen zweiten Plan mit demselben Namen anzulegen. Zwei
    Plaene gleichen Namens machen die Zuordnung mehrdeutig, und
    `paar_fuer_portal_plan` ordnet dann fail-closed GAR NICHTS mehr zu."""
    antwort = _lauf(_Db(), _Channex(_details([STANDARD, WOCHE])))
    rates = {r["title"]: r for r in antwort["portals"][0]["rates"]}

    assert set(rates) == {"Standard Rate", "Wochenrate"}
    assert rates["Standard Rate"]["belegt"] is True
    assert rates["Wochenrate"]["belegt"] is False
    # Kein Wochen-/Monatswort im Titel → KEIN geratener Mindestaufenthalt.
    assert rates["Standard Rate"]["min_stay"] is None


def test_eigener_namensgleicher_plan_ist_belegt() -> None:
    """Sobald die Wochenrate auf ihren NAMENSGLEICHEN Plan zeigt, ist sie
    belegt — das ist der Zustand, den der Dialog herstellen soll."""
    db = _Db(plaene=[
        {"id": "grund-1", "name": "Grundpreis"},
        {"id": "woche-1", "name": "Wochenrate"},
    ])
    channex = _Channex(
        _details([STANDARD, WOCHE]),
        zuordnungen=[
            ("cx-grund-1", STANDARD["id"], True),
            ("cx-woche-1", WOCHE["id"], True),
        ],
    )
    rates = {
        r["title"]: r for r in _lauf(db, channex)["portals"][0]["rates"]
    }
    assert rates["Wochenrate"]["belegt"] is True


def test_attrappe_gilt_als_belegt() -> None:
    """Ein namensgleicher Plan mit ATTRAPPEN-Eintrag (ohne `occupancy`) zaehlt
    als belegt: der Plan EXISTIERT. Ihn ein zweites Mal anzulegen heilt nichts,
    sondern macht den Namen mehrdeutig — geheilt wird die Attrappe vom
    taeglichen Abgleich (`zu_heilen`), nicht von einem zweiten Plan."""
    db = _Db(plaene=[
        {"id": "grund-1", "name": "Grundpreis"},
        {"id": "woche-1", "name": "Wochenrate"},
    ])
    channex = _Channex(
        _details([STANDARD, WOCHE]),
        zuordnungen=[
            ("cx-grund-1", STANDARD["id"], True),
            ("cx-woche-1", WOCHE["id"], True),
        ],
        attrappe_codes={str(WOCHE["id"])},
    )
    rates = {
        r["title"]: r for r in _lauf(db, channex)["portals"][0]["rates"]
    }
    assert rates["Wochenrate"]["belegt"] is True


def test_monatsrate_schlaegt_dreissig_vor() -> None:
    monat = {"id": 99001, "title": "Monatlich"}
    antwort = _lauf(_Db(), _Channex(_details([STANDARD, monat])))
    rates = {r["title"]: r for r in antwort["portals"][0]["rates"]}
    assert rates["Monatlich"]["min_stay"] == 30


def test_titel_kommt_exakt_durch() -> None:
    """Der Titel ist der ZUORDNUNGS-SCHLUESSEL, kein Anzeigetext. Nur
    Rand-Leerzeichen fallen weg; wer ihn normalisiert, erzeugt genau den Plan,
    der nicht mehr namensgleich ist und beim Portal nie ankommt."""
    roh = {"id": 5150, "title": "  Non-Refundable RATE (DK)  "}
    antwort = _lauf(_Db(), _Channex(_details([roh])))
    titel = [r["title"] for r in antwort["portals"][0]["rates"]]
    assert titel == ["Non-Refundable RATE (DK)"]


# --- Fail-closed (Wurzel 5) -------------------------------------------------
def test_abruf_leer_ist_nicht_nichts_frei() -> None:
    """DER KERN. `mapping_details` ohne Raten ist ein FEHLGESCHLAGENER Abruf,
    kein Portal ohne Raten. `abruf_ok: false` — die Oberflaeche darf daraus
    nicht „keine Raten frei" machen."""
    antwort = _lauf(_Db(), _Channex(_details([])))

    portal = antwort["portals"][0]
    assert portal["abruf_ok"] is False
    assert portal["rates"] == []


def test_channex_fehler_ist_abruf_nicht_ok() -> None:
    channex = _Channex(ChannexError("503", channex_status=503))
    portal = _lauf(_Db(), channex)["portals"][0]

    assert portal["abruf_ok"] is False
    assert portal["rates"] == []
    # Der Kanal wird gar nicht mehr geholt — kein zweiter Call fuer eine
    # Antwort, die wir nicht deuten koennen.
    assert channex.kanal_aufrufe == []


def test_kanal_unlesbar_macht_belegung_unbekannt() -> None:
    """Raten bekannt, Belegung UNBEKANNT → `belegt: null`, nicht `false`.

    Den Nutzer einen Plan fuer eine bereits versorgte Rate anlegen zu lassen,
    waere derselbe Doppel-Plan-Schaden wie ein abgetippter Titel."""
    channex = _Channex(
        _details([STANDARD, WOCHE]),
        kanal=ChannexError("500", channex_status=500),
    )
    portal = _lauf(_Db(), channex)["portals"][0]

    assert portal["abruf_ok"] is True
    assert portal["kanal_lesbar"] is False
    assert [r["belegt"] for r in portal["rates"]] == [None, None]
    # Die Titel und Vorschlaege stehen trotzdem — sie kommen aus dem Abruf,
    # der gelungen ist.
    assert {r["title"] for r in portal["rates"]} == {
        "Standard Rate", "Wochenrate",
    }


def test_kanal_ohne_data_ist_unlesbar() -> None:
    """Eine Antwort ohne `data` ist kein leerer Kanal, sondern eine Antwort,
    die wir nicht deuten koennen."""
    channex = _Channex(_details([STANDARD, WOCHE]), kanal={})
    portal = _lauf(_Db(), channex)["portals"][0]

    assert portal["kanal_lesbar"] is False
    assert all(r["belegt"] is None for r in portal["rates"])


def test_obergrenze_kappt_sichtbar() -> None:
    """Wurzel 8: die Antwort des Portals ist fremdgesteuert. Gekappt wird
    SICHTBAR (`truncated`) — sonst fehlte dem Nutzer eine Rate, ohne dass es
    jemand merkt."""
    viele = [
        {"id": 700000 + i, "title": f"Rate {i}"}
        for i in range(MAX_RATEN_JE_PORTAL + 4)
    ]
    portal = _lauf(_Db(), _Channex(_details(viele)))["portals"][0]

    assert portal["truncated"] is True
    assert len(portal["rates"]) == MAX_RATEN_JE_PORTAL


def test_normalfall_ist_nicht_truncated() -> None:
    portal = _lauf(_Db(), _Channex(_details([STANDARD, WOCHE])))["portals"][0]
    assert portal["truncated"] is False


# --- Airbnb ----------------------------------------------------------------
def test_airbnb_erscheint_gar_nicht_und_kostet_keinen_call() -> None:
    """Airbnb hat keine Raten-Ebene: `_normalize_mapping_rooms` liefert je
    Listing GENAU EINE „Rate" mit der Listing-ID als Code, und die ist immer
    schon der Grundpreis. Ein Eintrag hier waere das Angebot, fuer die
    Listing-ID einen Plan „Feriehus Kornblomst" anzulegen — sinnlos. Die
    Allowlist `PORTALE_MIT_RATEN` filtert sie weg, ohne zu crashen."""
    db = _Db(verbindungen=[AIRBNB_VERBINDUNG])
    channex = _Channex(
        _airbnb_details([{"id": 2087, "title": "Feriehus Kornblomst"}])
    )
    antwort = _lauf(db, channex)

    assert antwort["portals"] == []
    # Kein Channex-Call fuer ein Portal, das hier nichts zu sagen hat.
    assert channex.details_aufrufe == []
    assert channex.kanal_aufrufe == []


def test_airbnb_neben_booking_stoert_booking_nicht() -> None:
    """Ein Objekt kann mit MEHREREN Portalen verbunden sein. Die
    Airbnb-Verbindung darf die Booking-Liste nicht kippen und keinen Muell
    erzeugen."""
    db = _Db(verbindungen=[AIRBNB_VERBINDUNG, VERBINDUNG])
    channex = _Channex(_details([STANDARD, WOCHE]))
    antwort = _lauf(db, channex)

    assert [p["portal"] for p in antwort["portals"]] == ["BookingCom"]
    assert len(antwort["portals"][0]["rates"]) == 2
    assert channex.details_aufrufe == [
        {"channel": "BookingCom", "settings": {"hotel_id": "15122264"}}
    ]


# --- Mehrere Portale -------------------------------------------------------
def test_zwei_raten_portale_werden_getrennt_geliefert() -> None:
    """Je Portal ein eigener Block, und jede Rate traegt ihr `portal` — ein
    Ratencode ist nur INNERHALB eines Portals eindeutig."""
    sandbox = {**VERBINDUNG, "ota_portal_code": "SandBox",
               "ota_hotel_id": "sb-1", "channex_channel_id": "ch-2"}
    db = _Db(verbindungen=[VERBINDUNG, sandbox])
    antwort = _lauf(db, _Channex(_details([STANDARD, WOCHE])))

    assert [p["portal"] for p in antwort["portals"]] == [
        "BookingCom", "SandBox",
    ]
    for portal in antwort["portals"]:
        assert {r["portal"] for r in portal["rates"]} == {portal["portal"]}


def test_ohne_verbindung_leere_liste() -> None:
    """Kein verbundenes Raten-Portal → leere Liste, kein erfundener Eintrag."""
    antwort = _lauf(_Db(verbindungen=[]), _Channex(_details([STANDARD])))
    assert antwort == {"property_id": OBJEKT, "portals": []}


def test_verbindung_ohne_kennung_wird_ausgelassen() -> None:
    """Ohne `ota_hotel_id` gibt es keinen Abruf — `mapping_details` braucht sie
    (`_kanaele_mit_raten` filtert sie deshalb schon weg)."""
    db = _Db(verbindungen=[{**VERBINDUNG, "ota_hotel_id": None}])
    channex = _Channex(_details([STANDARD]))
    assert _lauf(db, channex)["portals"] == []
    assert channex.details_aufrufe == []


# --- Scope (Wurzel 3) ------------------------------------------------------
def test_fremder_tenant_bekommt_404_und_keine_daten() -> None:
    """`load_scoped` filtert per (id, tenant_id) — ein fremder Tenant bekommt
    404, nicht die Raten. Und der Channex-Abruf findet gar nicht statt: der
    Scope steht VOR dem Lesen."""
    channex = _Channex(_details([STANDARD, WOCHE]))
    with pytest.raises(ChannelManagerError) as exc:
        _lauf(_Db(), channex, tenant=FREMD)

    assert exc.value.status_code == 404
    assert channex.details_aufrufe == []
    assert channex.kanal_aufrufe == []


def test_objekt_unbekannt_ist_404() -> None:
    db = _Db(objekt_tenant="anderer-tenant")
    with pytest.raises(ChannelManagerError) as exc:
        _lauf(db, _Channex(_details([STANDARD])))
    assert exc.value.status_code == 404


def test_kanaele_werden_auf_den_tenant_gescopt() -> None:
    """Nicht nur das Objekt: auch die Kanal-Zeilen kommen gescopt
    (`_kanaele_mit_raten` filtert per tenant_id UND property_id). Der
    Service-Key umgeht RLS — der Scope MUSS im Code stehen."""
    db = _Db()
    _lauf(db, _Channex(_details([STANDARD, WOCHE])))
    # properties zuerst, dann die Verbindungen — der Scope vor dem Inhalt.
    assert db.gelesen[0] == "properties"
    assert "channex_channel_connection" in db.gelesen


def test_ohne_tenant_kein_zugriff() -> None:
    ctx = AuthContext(user_id="u-1", tenant_id=None, role="admin")
    with pytest.raises(ChannelManagerError) as exc:
        _Dienst(_Db(), _Channex(_details([STANDARD]))).portal_raten_auswahl(
            ctx, OBJEKT
        )
    assert exc.value.status_code == 400


# --- Rein lesend ----------------------------------------------------------
def test_genau_zwei_lesende_calls_je_portal() -> None:
    """`mapping_details` (was das Portal fuehrt) und `GET /channels/{id}` (was
    schon zugeordnet ist) — nicht mehr. Jeder Schreibweg fehlt am
    Doppelgaenger und waere ein AttributeError."""
    channex = _Channex(_details([STANDARD, WOCHE]))
    _lauf(_Db(), channex)

    assert channex.details_aufrufe == [
        {"channel": "BookingCom", "settings": {"hotel_id": "15122264"}}
    ]
    assert channex.kanal_aufrufe == ["ch-1"]
    for verboten in (
        "create_channel_mapping", "update_channel", "delete_channel_mapping",
        "put_channel", "post_channel",
    ):
        assert not hasattr(channex, verboten)


def test_rate_ohne_titel_kommt_mit_leerem_titel_ohne_vorschlag() -> None:
    """Eine Rate ohne Titel ist nicht zuordenbar (der Titel IST der Schluessel).
    Sie wird geliefert, damit die Oberflaeche sie als nicht waehlbar zeigen
    kann — mit leerem Titel und OHNE geratenen Mindestaufenthalt, nie mit einem
    erfundenen Namen (Wurzel 4)."""
    ohne = {"id": 4242, "title": None}
    portal = _lauf(_Db(), _Channex(_details([ohne])))["portals"][0]

    assert portal["abruf_ok"] is True
    assert portal["rates"] == [{
        "rate_plan_code": "4242",
        "title": "",
        "room_type_code": str(ZIMMER),
        "portal": "BookingCom",
        "belegt": False,
        "min_stay": None,
    }]
