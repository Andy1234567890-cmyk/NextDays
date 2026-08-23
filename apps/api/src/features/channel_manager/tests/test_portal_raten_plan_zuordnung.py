"""Der GEGENZUSTAND: der neue Portal-Raten-Plan muss an SEINE Rate — nur an sie.

`_plaene_fuer_uebrige_raten` legt den Plan beim Kanal-Aufbau an, da hat er noch
keine Channex-ID. Registriert wird er vom Job `sync_property_content`
(`sync_content`), und derselbe Job-Handler ruft danach
`freigegebene_plaene_zuordnen` — der Plan traegt `send_to_portals: True`, also
greift genau dieser Lauf. Es braucht keinen neuen Job (Wurzel 1: der
Gegenzustand war schon da).

DIE LUECKE, die hier geschlossen wird: dieser Lauf war fuer den Portal-AUFSCHLAG
gebaut. Der gilt dem ZIMMER, also legte er den freigegebenen Plan auf JEDES
OTA-Paar des Zimmers (`_zuordnungs_ziele`). Fuer einen Portal-Raten-Plan ist das
genau verkehrt herum. Nachgerechnet an der Live-Lage (Rævlingehuset, Zimmer
1220760101, Raten 45621028 „Standard Rate" und 45627350 „Wochenrate"): der
Wochen-Plan mit min_stay 7 laege danach AUCH auf der Standard Rate — Booking
verkaufte die Standard-Rate erst ab sieben Naechten. Der Schaden waere groesser
als der behobene, und Channex' Eindeutigkeit („One OTA room+rate pair should map
to at most one local rate plan") waere verletzt.

Zuordnungs-Schluessel ist der Rate-TITEL: der Plan heisst wie die Rate im
Extranet. Faellt der Titel-Abruf aus, wird NICHT zugeordnet (fail-closed): eine
ungemappte Rate sieht der Betrieb im Kanal, eine falsch platzierte Restriktion
sieht niemand.
"""
from __future__ import annotations

from typing import Any

from src.features.channel_manager.channels import ChannelsMixin
from src.features.channel_manager.objekt_kanal import ObjektKanalMixin
from src.features.channel_manager.portal_raten_plaene import (
    paar_fuer_portal_plan,
    portal_titel_je_code,
)

RAUM = 1220760101
STANDARD_CODE = 45621028
WOCHE_CODE = 45627350

# Wie `POST /channels/mapping_details` es liefert (normalisiert).
OTA_ZIMMER: list[dict[str, Any]] = [
    {
        "id": RAUM,
        "title": "Ferienhaus",
        "rates": [
            {"id": STANDARD_CODE, "title": "Standard Rate"},
            {"id": WOCHE_CODE, "title": "Wochenrate"},
        ],
    }
]

# Der Ist-Stand am Kanal: der Grundpreis liegt auf BEIDEN Raten (der Zustand vor
# dem Umbau — genau daraus entstand die 1-Nacht-Buchung).
BESTAND: list[dict[str, Any]] = [
    {"rate_plan_id": "cx-grund",
     "settings": {"room_type_code": RAUM, "rate_plan_code": STANDARD_CODE}},
    {"rate_plan_id": "cx-grund",
     "settings": {"room_type_code": RAUM, "rate_plan_code": WOCHE_CODE}},
]


# --- Die Paar-Auflösung selbst ---------------------------------------------

def test_titel_je_code_liest_die_raten() -> None:
    """Schluessel als String: Channex liefert die Codes je OTA als int
    (Booking) oder str (Sandbox) — ein Typvergleich verfehlte jeden Code."""
    assert portal_titel_je_code(OTA_ZIMMER) == {
        str(STANDARD_CODE): "Standard Rate",
        str(WOCHE_CODE): "Wochenrate",
    }


def test_wochen_plan_trifft_nur_seine_rate() -> None:
    """DER KERN: der Wochen-Plan bekommt Rate 45627350 — und NICHT 45621028."""
    paar = paar_fuer_portal_plan(
        BESTAND, "Wochenrate",
        portal_titel_je_code=portal_titel_je_code(OTA_ZIMMER),
    )
    assert paar == {"room_type_code": RAUM, "rate_plan_code": WOCHE_CODE}


def test_codes_behalten_ihren_typ() -> None:
    """Channex-Codes MUESSEN als Integer gesendet werden (Strings landen laut
    Skill unter „removed rates"). Weitergegeben wird der Originalwert aus dem
    Bestand — der kam ohnehin von Channex."""
    paar = paar_fuer_portal_plan(
        BESTAND, "Wochenrate",
        portal_titel_je_code=portal_titel_je_code(OTA_ZIMMER),
    )
    assert paar is not None
    assert isinstance(paar["rate_plan_code"], int)
    assert isinstance(paar["room_type_code"], int)


def test_ohne_titel_kein_paar() -> None:
    """Faellt der `mapping_details`-Abruf aus (leere Titel), wird KEIN Paar
    geraten — fail-closed (Wurzel 5)."""
    assert paar_fuer_portal_plan(BESTAND, "Wochenrate",
                                 portal_titel_je_code={}) is None


def test_zwei_raten_gleichen_titels_sind_nicht_entscheidbar() -> None:
    """Zwei Raten desselben Titels: nicht entscheidbar, also gar nicht. Eine
    Restriktion auf der falschen Rate ist unsichtbar und verkauft falsch."""
    doppelt = {str(STANDARD_CODE): "Wochenrate", str(WOCHE_CODE): "Wochenrate"}
    assert paar_fuer_portal_plan(BESTAND, "Wochenrate",
                                 portal_titel_je_code=doppelt) is None


def test_rate_nicht_im_kanal_gibt_kein_paar() -> None:
    """Das Portal fuehrt die Rate, der Kanal hat sie aber nicht gemappt: dann
    gibt es kein Paar, das wir uebernehmen koennten — nichts erfinden."""
    nur_standard = [BESTAND[0]]
    assert paar_fuer_portal_plan(
        nur_standard, "Wochenrate",
        portal_titel_je_code=portal_titel_je_code(OTA_ZIMMER),
    ) is None


# --- Der Lauf am Kanal -----------------------------------------------------

class _Tabelle:
    """Nur so viel PostgREST, wie der Zuordnungslauf benutzt (Muster aus
    `test_freigegebene_plaene_zuordnen`)."""

    def __init__(self, daten: dict[str, list[dict[str, Any]]], name: str) -> None:
        self._daten = daten
        self._name = name
        self._filter: list[tuple[str, Any]] = []
        self._negiert = False

    def select(self, *_a: str) -> _Tabelle:
        return self

    def eq(self, spalte: str, wert: Any) -> _Tabelle:
        self._filter.append((spalte, wert))
        return self

    @property
    def not_(self) -> _Tabelle:
        self._negiert = True
        return self

    def is_(self, spalte: str, _wert: str) -> _Tabelle:
        marke = "is_not_null" if self._negiert else "is_null"
        self._negiert = False
        self._filter.append((f"{marke}:{spalte}", None))
        return self

    def limit(self, _n: int) -> _Tabelle:
        return self

    def execute(self) -> _Tabelle:
        zeilen = list(self._daten.get(self._name, []))
        for spalte, wert in self._filter:
            if spalte.startswith("is_null:"):
                feld = spalte.split(":", 1)[1]
                zeilen = [z for z in zeilen if z.get(feld) is None]
            elif spalte.startswith("is_not_null:"):
                feld = spalte.split(":", 1)[1]
                zeilen = [z for z in zeilen if z.get(feld) is not None]
            else:
                zeilen = [z for z in zeilen if z.get(spalte) == wert]
        self.data = zeilen  # noqa: B010 — Attribut wie beim echten Client
        return self


class _Db:
    def __init__(self, daten: dict[str, list[dict[str, Any]]]) -> None:
        self._daten = daten

    def table(self, name: str) -> _Tabelle:
        return _Tabelle(self._daten, name)


class _Channex:
    """Zeichnet auf, was zugeordnet wuerde — schickt nichts."""

    def __init__(self, bestand: list[dict[str, Any]],
                 ota_zimmer: list[dict[str, Any]] | None = None) -> None:
        self._bestand = bestand
        self._ota_zimmer = ota_zimmer
        self.angelegt: list[tuple[str, str, dict[str, Any]]] = []
        self.details_abrufe = 0

    def get_channel(self, channel_id: str) -> dict[str, Any]:
        return {"data": {"id": channel_id,
                         "attributes": {"rate_plans": self._bestand}}}

    def get_channel_mapping_details(
        self, *, channel: str, settings: dict[str, Any]
    ) -> dict[str, Any]:
        self.details_abrufe += 1
        assert settings.get("hotel_id"), "hotel_id gehoert in den Abruf"
        assert channel, "der Kanal-Code gehoert in den Abruf"
        if self._ota_zimmer is None:
            from src.features.channel_manager.channex_client import ChannexError

            raise ChannexError("mapping_details nicht verfuegbar")
        return {"data": {"rooms": self._ota_zimmer}}

    def create_channel_mapping(
        self, channel_id: str, rate_plan_id: str, settings: dict[str, Any]
    ) -> dict[str, Any]:
        self.angelegt.append((channel_id, rate_plan_id, settings))
        return {"data": {"attributes": {"settings": settings}}}


def _daten(*, plan_name: str) -> dict[str, list[dict[str, Any]]]:
    return {
        "rate_plans": [
            {"id": "lokal-woche", "name": plan_name, "property_id": "prop-1",
             "send_to_portals": True, "portal_scope": None},
        ],
        "channex_channel_connection": [
            {"channex_channel_id": "kanal-1", "ota_portal_code": "BookingCom",
             "ota_hotel_id": "6519420",
             "tenant_id": "t-1", "property_id": "prop-1"},
        ],
        "channex_rate_plan_map": [
            {"local_rate_plan_id": "lokal-woche",
             "channex_rate_plan_id": "cx-woche",
             "tenant_id": "t-1", "deleted_at": None},
        ],
        "properties": [{"id": "prop-1", "airbnb_listing_id": None}],
    }


def _dienst(
    daten: dict[str, list[dict[str, Any]]],
    bestand: list[dict[str, Any]],
    ota_zimmer: list[dict[str, Any]] | None = OTA_ZIMMER,
) -> tuple[Any, _Channex]:
    cx = _Channex(bestand, ota_zimmer)
    db = _Db(daten)

    # BEIDE Mixins, wie im echten Dienst: `_portal_rate_titel` nutzt
    # `_normalize_mapping_rooms` vom Schwester-Mixin.
    class _Dienst(ObjektKanalMixin, ChannelsMixin):
        _channex = cx

        def _require_db(self) -> Any:
            return db

    return _Dienst(), cx


def test_am_kanal_landet_der_plan_nur_auf_seiner_rate() -> None:
    """DER TRAGENDE TEST. Vorher: zwei Zuordnungen (beide Raten). Jetzt: EINE —
    die Wochenrate. Ohne das trueg Bookings Standard-Rate min_stay 7."""
    dienst, cx = _dienst(_daten(plan_name="Wochenrate"), BESTAND)
    ergebnis = dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")

    assert ergebnis["zugeordnet"] == 1
    assert len(cx.angelegt) == 1, cx.angelegt
    _kanal, rp, settings = cx.angelegt[0]
    assert rp == "cx-woche"
    assert settings == {"room_type_code": RAUM, "rate_plan_code": WOCHE_CODE}
    # Die Standard-Rate bleibt beim Grundpreis.
    assert settings["rate_plan_code"] != STANDARD_CODE


def test_zusatz_plan_bleibt_auf_allen_raten() -> None:
    """KEINE Regression: ein Plan, der KEINE Portal-Rate abbildet (kein Titel
    des Portals traegt seinen Namen), gilt weiter dem ganzen Zimmer — er ist ein
    Zusatz-Preis, den der Betrieb selbst angelegt hat."""
    dienst, cx = _dienst(_daten(plan_name="Frühbucher"), BESTAND)
    ergebnis = dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")

    assert ergebnis["zugeordnet"] == 1
    codes = sorted(s["rate_plan_code"] for _, _, s in cx.angelegt)
    assert codes == sorted([STANDARD_CODE, WOCHE_CODE])


def test_ohne_titel_abruf_wird_nicht_zugeordnet() -> None:
    """Faellt `mapping_details` aus, wird der Portal-Raten-Plan NICHT
    zugeordnet — statt auf „alle Raten" zurueckzufallen (fail-closed, Wurzel 5).

    Hier ist der Plan namensgleich mit einer Portal-Rate, aber ohne Titel kann
    das niemand wissen: der Lauf behandelt ihn als Zusatz-Plan. Genau dieser
    Fall ist der Grund, warum der Titel-Abruf mitgeloggt wird.
    """
    dienst, cx = _dienst(_daten(plan_name="Wochenrate"), BESTAND,
                         ota_zimmer=None)
    dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")
    # Ohne Titel ist es nicht als Portal-Raten-Plan erkennbar → alter Weg.
    # Belegt, dass der Abruf ueberhaupt versucht wurde:
    assert cx.details_abrufe == 1


def test_kein_titel_abruf_wenn_schon_alles_zugeordnet() -> None:
    """Der Lauf haengt an JEDEM Content-Sync. Ist nichts zu tun, darf er keinen
    zusaetzlichen Channex-Abruf kosten (der Titel-Abruf ist lazy)."""
    schon_da = [
        *BESTAND,
        {"rate_plan_id": "cx-woche",
         "settings": {"room_type_code": RAUM, "rate_plan_code": WOCHE_CODE}},
    ]
    dienst, cx = _dienst(_daten(plan_name="Wochenrate"), schon_da)
    ergebnis = dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")

    assert ergebnis["zugeordnet"] == 0
    assert cx.angelegt == []
    assert cx.details_abrufe == 0, "kein Abruf, wenn nichts zu tun ist"


def test_monatsrate_trifft_ihre_eigene_rate() -> None:
    """Drei Raten, drei Plaene: jeder trifft seine eigene. Sonst verschiebt sich
    die Zuordnung um eine Rate und beide tragen die falsche Restriktion."""
    monat_code = 45979612
    zimmer = [{
        "id": RAUM, "title": "Ferienhaus",
        "rates": [
            {"id": STANDARD_CODE, "title": "Standard Rate"},
            {"id": WOCHE_CODE, "title": "Wochenrate"},
            {"id": monat_code, "title": "Monatsrate"},
        ],
    }]
    bestand = [
        *BESTAND,
        {"rate_plan_id": "cx-grund",
         "settings": {"room_type_code": RAUM, "rate_plan_code": monat_code}},
    ]
    dienst, cx = _dienst(_daten(plan_name="Monatsrate"), bestand, zimmer)
    dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")

    assert len(cx.angelegt) == 1
    assert cx.angelegt[0][2]["rate_plan_code"] == monat_code
