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
#
# VOLLSTAENDIG wie Channex es liefert (Form zurueckgelesen 23.08.2026 an Kanal
# 6194a921-b1c8-41b3-8971-f8bf0a645efc): `id` (die mapping_id), `occupancy`,
# `pricing_type`, `primary_occ`, `readonly`. Die frueheren Fixtures liessen das
# weg — und genau deshalb fanden sie den Fehler nicht, den dieser Lauf live
# produzierte: einen Eintrag ohne `primary_occ`, der keine Restriktionen sendet.
def _eintrag(mapping_id: str, plan: str, code: int, *,
             primary: bool = True, occ: int = 4) -> dict[str, Any]:
    return {
        "id": mapping_id,
        "rate_plan_id": plan,
        "settings": {
            "readonly": False, "occupancy": occ,
            "room_type_code": RAUM, "rate_plan_code": code,
            "pricing_type": "RLO", "primary_occ": primary,
        },
    }


BESTAND: list[dict[str, Any]] = [
    _eintrag("map-standard", "cx-grund", STANDARD_CODE),
    _eintrag("map-woche", "cx-grund", WOCHE_CODE),
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
    assert paar == {
        "room_type_code": RAUM, "rate_plan_code": WOCHE_CODE,
        # Ohne diese drei Felder ist der Eintrag am Kanal eine Attrappe: Channex
        # sendet nur am primaeren Eintrag Restriktionen, und `occupancy`/
        # `pricing_type` sind Pflicht im Create-Payload. Beide Werte kommen aus
        # dem BESTEHENDEN Eintrag desselben Paares, nicht aus einem Default.
        "primary_occ": True, "occupancy": 4, "pricing_type": "RLO",
        "readonly": False,
    }


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
    nur_standard = [_eintrag("map-standard", "cx-grund", STANDARD_CODE)]
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
        # KOPIE: der Fake veraendert den Bestand (anlegen/loesen) wie der echte
        # Kanal. Ohne Kopie waere das Modul-Fixture nach dem ersten Test kaputt.
        self._bestand = [dict(e) for e in bestand]
        self._ota_zimmer = ota_zimmer
        self.angelegt: list[tuple[str, str, dict[str, Any]]] = []
        self.geloest: list[tuple[str, str]] = []
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
        # Wie am echten Kanal: der neue Eintrag steht danach im Bestand. Erst
        # damit ist der zweite Lauf ein echter Idempotenz-Test.
        self._bestand.append({
            "id": f"map-neu-{len(self.angelegt)}",
            "rate_plan_id": rate_plan_id, "settings": dict(settings),
        })
        return {"data": {"attributes": {"settings": settings}}}

    def delete_channel_mapping(
        self, channel_id: str, mapping_id: str
    ) -> dict[str, Any]:
        """Der Gegenzustand (Wurzel 1): das Paar von seinem alten Traeger
        loesen. Der echte Kanal nimmt den Eintrag danach nicht mehr mit."""
        self.geloest.append((channel_id, mapping_id))
        self._bestand[:] = [
            e for e in self._bestand if str(e.get("id")) != mapping_id
        ]
        return {}


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
    assert settings["room_type_code"] == RAUM
    assert settings["rate_plan_code"] == WOCHE_CODE
    assert settings["primary_occ"] is True
    assert settings["occupancy"] == 4
    assert settings["pricing_type"] == "RLO"
    # Die Standard-Rate bleibt beim Grundpreis.
    assert settings["rate_plan_code"] != STANDARD_CODE
    # DER GEGENZUSTAND: der alte Traeger des Paares ist GELOEST. Ohne das hat
    # das Paar zwei primaere Eintraege, und live gewinnt der alte — genau der
    # Zustand, der am 23.08.2026 am Kanal 6194a921 gemessen wurde.
    assert cx.geloest == [("kanal-1", "map-woche")]
    # Und der Traeger der Standard-Rate bleibt unangetastet.
    assert all(m != "map-standard" for _, m in cx.geloest)


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
        _eintrag("map-woche-neu", "cx-woche", WOCHE_CODE),
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
        _eintrag("map-monat", "cx-grund", monat_code),
    ]
    dienst, cx = _dienst(_daten(plan_name="Monatsrate"), bestand, zimmer)
    dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")

    assert len(cx.angelegt) == 1
    assert cx.angelegt[0][2]["rate_plan_code"] == monat_code
    assert cx.geloest == [("kanal-1", "map-monat")]


# --- Der gemessene VIER-Eintraege-Zustand und sein Zielzustand --------------
#
# So sah der Kanal von „FeWo *Stjerneskud*"
# (6194a921-b1c8-41b3-8971-f8bf0a645efc) am 23.08.2026 aus, NACHDEM dieser Lauf
# einmal „erfolgreich" durchgelaufen war — zurueckgelesen per
# `GET /channels/{id}`, nicht angenommen:
#
#   code=47588686 occ=4    primary=True   -> 94cc38bb (Grundpreis)
#   code=63941996 occ=1    primary=False  -> bd74737b (Grundpreis · BookingCom)
#   code=63941996 occ=None primary=None   -> b7df3e35 (unsere Wochenrate)
#   code=63941996 occ=4    primary=True   -> 94cc38bb (Grundpreis)
#
# Der dritte Eintrag ist die Attrappe: ohne `primary_occ` sendet Channex dort
# keine Restriktionen, der vierte bleibt Traeger, und das Booking-Extranet
# zeigte an der Wochenrate weiter Mindestaufenthalt 2 statt 7.
STJERNESKUD_RAUM = 1264579201
STJERNESKUD_STANDARD = 47588686
STJERNESKUD_WOCHE = 63941996
CX_GRUND = "94cc38bb-3c39-46cd-8ebf-fd54812f5245"
CX_KANALPLAN = "bd74737b-32c0-4cfc-b815-9ecfa90777df"
CX_WOCHE = "b7df3e35-4483-494f-85fc-476aa14d8d6e"

VIER_EINTRAEGE: list[dict[str, Any]] = [
    {"id": "f48200fc", "rate_plan_id": CX_GRUND,
     "settings": {"readonly": False, "occupancy": 4,
                  "rate_plan_code": STJERNESKUD_STANDARD,
                  "room_type_code": STJERNESKUD_RAUM,
                  "pricing_type": "RLO", "primary_occ": True}},
    {"id": "c0e40509", "rate_plan_id": CX_KANALPLAN,
     "settings": {"readonly": False, "occupancy": 1,
                  "rate_plan_code": STJERNESKUD_WOCHE,
                  "room_type_code": STJERNESKUD_RAUM,
                  "pricing_type": "RLO", "occ_changed": False,
                  "primary_occ": False}},
    {"id": "7ba01b47", "rate_plan_id": CX_WOCHE,
     "settings": {"rate_plan_code": STJERNESKUD_WOCHE,
                  "room_type_code": STJERNESKUD_RAUM}},
    {"id": "8ec8a717", "rate_plan_id": CX_GRUND,
     "settings": {"readonly": False, "occupancy": 4,
                  "rate_plan_code": STJERNESKUD_WOCHE,
                  "room_type_code": STJERNESKUD_RAUM,
                  "pricing_type": "RLO", "primary_occ": True}},
]

STJERNESKUD_ZIMMER: list[dict[str, Any]] = [{
    "id": STJERNESKUD_RAUM, "title": "Ferienhaus",
    "rates": [
        {"id": STJERNESKUD_STANDARD, "title": "Standard Rate"},
        {"id": STJERNESKUD_WOCHE, "title": "Wochenrate"},
    ],
}]


def _stjerneskud_daten() -> dict[str, list[dict[str, Any]]]:
    daten = _daten(plan_name="Wochenrate")
    daten["channex_rate_plan_map"] = [
        {"local_rate_plan_id": "lokal-woche",
         "channex_rate_plan_id": CX_WOCHE,
         "tenant_id": "t-1", "deleted_at": None},
    ]
    return daten


def test_vier_eintraege_werden_auf_einen_traeger_je_paar_zurueckgefuehrt() -> None:
    """DER HEIL-TEST: aus dem gemessenen Vier-Eintraege-Zustand der Zielzustand.

    Paar 47588686 -> Grundpreis (primary, unberuehrt).
    Paar 63941996 -> Wochenrate (primary) — der alte Grundpreis-Traeger 8ec8a717
                     ist GELOEST, sonst hat das Paar zwei primaere Eintraege und
                     Channex laesst den alten gewinnen.
    Der occ=1/primary=False-Eintrag (c0e40509) bleibt UNBERUEHRT: er ist eine
    Belegungs-Variante des Kanal-Plans, kein Restriktions-Traeger.
    """
    dienst, cx = _dienst(
        _stjerneskud_daten(), VIER_EINTRAEGE, STJERNESKUD_ZIMMER
    )
    dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")

    assert cx.geloest == [("kanal-1", "8ec8a717")], (
        "Nur der alte primaere Traeger des Paares 63941996 darf weg — nicht der "
        "des Paares 47588686 und nicht die Belegungs-Variante."
    )
    assert len(cx.angelegt) == 1
    _kanal, rp, settings = cx.angelegt[0]
    assert rp == CX_WOCHE
    assert settings["rate_plan_code"] == STJERNESKUD_WOCHE
    assert settings["primary_occ"] is True
    # occupancy/pricing_type aus dem Bestandseintrag desselben Paares — 4/RLO,
    # nicht 2/Standard (der Default des Kanal-AUFBAUS) und nicht 1 (die
    # Belegungs-Variante).
    assert settings["occupancy"] == 4
    assert settings["pricing_type"] == "RLO"


def test_paar_hat_danach_genau_einen_primaeren_eintrag() -> None:
    """Channex traegt je OTA-Paar hoechstens EINEN lokalen Plan. Nach dem Lauf
    muss das Paar 63941996 genau einen primaeren Eintrag haben — und der muss
    unser Wochen-Plan sein."""
    dienst, cx = _dienst(
        _stjerneskud_daten(), VIER_EINTRAEGE, STJERNESKUD_ZIMMER
    )
    dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")

    danach = cx.get_channel("kanal-1")["data"]["attributes"]["rate_plans"]
    primaer = [
        e for e in danach
        if str((e.get("settings") or {}).get("rate_plan_code"))
        == str(STJERNESKUD_WOCHE)
        and (e.get("settings") or {}).get("primary_occ") is True
    ]
    assert len(primaer) == 1, primaer
    assert primaer[0]["rate_plan_id"] == CX_WOCHE
    # Die Belegungs-Variante steht weiter da.
    assert any(e["id"] == "c0e40509" for e in danach)


def test_zweiter_lauf_aendert_nichts() -> None:
    """Idempotenz (Wurzel 2): der Lauf haengt an JEDEM Content-Sync und kommt
    taeglich wieder. Beim zweiten Mal ist der Plan schon am Kanal — es darf
    weder ein Eintrag angelegt noch einer geloescht werden. Ohne die
    `rate_plan_id`-Pruefung in `alter_traeger_mapping_id` loeschte der zweite
    Lauf die Zuordnung, die der erste gerade hergestellt hat."""
    dienst, cx = _dienst(
        _stjerneskud_daten(), VIER_EINTRAEGE, STJERNESKUD_ZIMMER
    )
    dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")
    angelegt_1, geloest_1 = len(cx.angelegt), len(cx.geloest)

    ergebnis = dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")

    assert ergebnis["zugeordnet"] == 0
    assert len(cx.angelegt) == angelegt_1
    assert len(cx.geloest) == geloest_1


def test_attrappen_eintrag_ist_keine_quelle_fuer_die_belegung() -> None:
    """Der kaputte dritte Eintrag (nur die beiden Codes) darf nicht als Traeger
    gelten — sonst schreibt der Lauf den Fehler fort und legt den naechsten
    Eintrag wieder ohne `occupancy` an."""
    nur_attrappe = [
        VIER_EINTRAEGE[0],  # anderes Paar
        VIER_EINTRAEGE[2],  # die Attrappe des Paares 63941996
    ]
    dienst, cx = _dienst(
        _stjerneskud_daten(), nur_attrappe, STJERNESKUD_ZIMMER
    )
    dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")

    assert cx.angelegt == [], (
        "Ohne belegte occupancy wird NICHT zugeordnet — eine geratene Belegung "
        "waere ein anderer Preis fuer dieselbe Rate (fail-closed, Wurzel 4/5)."
    )
    assert cx.geloest == []


def test_ohne_bestandseintrag_wird_nicht_zugeordnet() -> None:
    """Fehlt der Bestandseintrag des Paares ganz, gibt es keine occupancy zum
    Uebernehmen — dann wird gar nicht zugeordnet, statt mit einer geratenen
    Belegung (fail-closed, Wurzel 5)."""
    nur_standard = [VIER_EINTRAEGE[0]]
    dienst, cx = _dienst(
        _stjerneskud_daten(), nur_standard, STJERNESKUD_ZIMMER
    )
    dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")

    assert cx.angelegt == []
    assert cx.geloest == []


def test_airbnb_eintrag_gilt_als_vollwertig() -> None:
    """KEINE Regression bei Airbnb: dort gibt es `occupancy`/`pricing_type`
    nicht (Schluessel ist die `listing_id`, live gegengeprueft am Kanal
    21ec5429). Ein Listing-Eintrag an `occupancy` zu messen hiesse, JEDE
    Airbnb-Zuordnung als Attrappe zu lesen und bei jedem Lauf erneut anzulegen —
    Channex antwortet dann 422 „already exists"."""
    vollwertig = ObjektKanalMixin._eintrag_ist_vollwertig  # noqa: SLF001
    assert vollwertig({"settings": {"listing_id": "54087677",
                                    "published": True}}) is True
    # Ein PAAR-Eintrag ohne Belegung ist die Attrappe.
    assert vollwertig({"settings": {"room_type_code": RAUM,
                                    "rate_plan_code": WOCHE_CODE}}) is False
    assert vollwertig({"settings": {"room_type_code": RAUM,
                                    "rate_plan_code": WOCHE_CODE,
                                    "occupancy": 4,
                                    "pricing_type": "RLO"}}) is True


# --- Zweiter Live-Zustand: „Feriehus Grævlinge" -----------------------------
#
# Frisch gemessen (Channex-Property 28392615-ea5e-4f6d-ac00-b53aa481b284,
# Booking-Kanal 79a87664-fe24-4df8-996f-29305528250e). Er ist NICHT derselbe
# wie bei Stjerneskud, und der Unterschied entscheidet:
#
#   code=64053536 occ=None primary=None   -> f2648d48 (unsere Wochenrate)
#   code=64053536 occ=8    primary=False  -> 00641ac4 (Grundpreis)
#   code=64053431 occ=8    primary=True   -> 00641ac4 (Grundpreis, Standard)
#
# Das Paar 64053536 hat KEINEN Eintrag mit `primary_occ: True` — deshalb ist die
# Mindestaufenthalt-Zelle der Wochenrate im Booking-Extranet LEER, waehrend die
# Standard Rate (64053431, primary) ihre 2 korrekt zeigt. Bei Stjerneskud gab es
# einen alten primaeren Traeger, hier gibt es keinen: der Schaden ist derselbe,
# der Weg dahin nicht. Deshalb hat `restriktions_traeger` zwei Stufen.
GRAEV_RAUM = 1279216201
GRAEV_STANDARD = 64053431
GRAEV_WOCHE = 64053536
GRAEV_GRUND = "00641ac4-0000-0000-0000-000000000000"
GRAEV_WOCHE_CX = "f2648d48-0000-0000-0000-000000000000"

GRAEVLINGE: list[dict[str, Any]] = [
    {"id": "map-attrappe", "rate_plan_id": GRAEV_WOCHE_CX,
     "settings": {"rate_plan_code": GRAEV_WOCHE, "room_type_code": GRAEV_RAUM}},
    {"id": "map-woche-nonprimary", "rate_plan_id": GRAEV_GRUND,
     "settings": {"readonly": False, "occupancy": 8,
                  "rate_plan_code": GRAEV_WOCHE, "room_type_code": GRAEV_RAUM,
                  "pricing_type": "Standard", "primary_occ": False}},
    {"id": "map-standard", "rate_plan_id": GRAEV_GRUND,
     "settings": {"readonly": False, "occupancy": 8,
                  "rate_plan_code": GRAEV_STANDARD,
                  "room_type_code": GRAEV_RAUM,
                  "pricing_type": "Standard", "primary_occ": True}},
]

GRAEV_ZIMMER: list[dict[str, Any]] = [{
    "id": GRAEV_RAUM, "title": "Ferienhaus",
    "rates": [
        {"id": GRAEV_STANDARD, "title": "Standard Rate"},
        {"id": GRAEV_WOCHE, "title": "Wochenrate"},
    ],
}]


def _graev_daten() -> dict[str, list[dict[str, Any]]]:
    daten = _daten(plan_name="Wochenrate")
    daten["channex_rate_plan_map"] = [
        {"local_rate_plan_id": "lokal-woche",
         "channex_rate_plan_id": GRAEV_WOCHE_CX,
         "tenant_id": "t-1", "deleted_at": None},
    ]
    return daten


def test_graevlinge_wochenrate_wird_primaerer_traeger() -> None:
    """Das Paar OHNE primaeren Traeger: die Wochenrate wird selbst einer.

    Die Belegung (8) kommt aus dem nicht-primaeren Bestandseintrag desselben
    Paares — das ist die einzige Stelle, an der die Belegung dieses Paares
    belegt steht. Sein Eintrag wird geloest, sonst haette das Paar unseren
    neuen primaeren PLUS den alten nicht-primaeren am Grundpreis, und Channex
    traegt je Paar nur EINEN lokalen Plan.
    """
    dienst, cx = _dienst(_graev_daten(), GRAEVLINGE, GRAEV_ZIMMER)
    dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")

    assert len(cx.angelegt) == 1, cx.angelegt
    _kanal, rp, settings = cx.angelegt[0]
    assert rp == GRAEV_WOCHE_CX
    assert settings["rate_plan_code"] == GRAEV_WOCHE
    assert settings["primary_occ"] is True, (
        "Ohne primary_occ bleibt die Mindestaufenthalt-Zelle der Wochenrate im "
        "Booking-Extranet leer — genau der gemessene Schaden."
    )
    assert settings["occupancy"] == 8, "Belegung aus dem Bestand, nicht geraten"
    assert settings["pricing_type"] == "Standard"
    # Die Standard Rate behaelt ihren Traeger.
    assert cx.geloest == [("kanal-1", "map-woche-nonprimary")]

    danach = cx.get_channel("kanal-1")["data"]["attributes"]["rate_plans"]
    for code in (GRAEV_STANDARD, GRAEV_WOCHE):
        primaer = [
            e for e in danach
            if str((e.get("settings") or {}).get("rate_plan_code")) == str(code)
            and (e.get("settings") or {}).get("primary_occ") is True
        ]
        assert len(primaer) == 1, (code, primaer)
    assert next(
        e["rate_plan_id"] for e in danach
        if str((e.get("settings") or {}).get("rate_plan_code"))
        == str(GRAEV_WOCHE)
        and (e.get("settings") or {}).get("primary_occ") is True
    ) == GRAEV_WOCHE_CX
    assert next(
        e["rate_plan_id"] for e in danach
        if str((e.get("settings") or {}).get("rate_plan_code"))
        == str(GRAEV_STANDARD)
    ) == GRAEV_GRUND


def test_graevlinge_zweiter_lauf_aendert_nichts() -> None:
    """Idempotenz auch fuer diesen Zustand (Wurzel 2)."""
    dienst, cx = _dienst(_graev_daten(), GRAEVLINGE, GRAEV_ZIMMER)
    dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")
    a1, g1 = len(cx.angelegt), len(cx.geloest)

    dienst.freigegebene_plaene_zuordnen("t-1", "prop-1")

    assert (len(cx.angelegt), len(cx.geloest)) == (a1, g1)
