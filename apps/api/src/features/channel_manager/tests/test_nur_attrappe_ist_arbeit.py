"""Eine Attrappe NEBEN einem Traeger ist keine Arbeit (Wurzel 2).

DER GEMESSENE FEHLZUSTAND (17.09.2026, Beta-Betrieb AirSmil, alle 20 Objekte):
Fuenf Objekte trugen am Booking-Kanal zwei Eintraege auf DERSELBEN Rate — einen
vollwertigen Traeger und daneben eine Attrappe ohne `occupancy`/`primary_occ`.
`_belegte_ratencodes` legte den Ratencode dann in BEIDE Mengen: `belegt` (wegen
des Traegers) und `attrappen` (wegen des Doppelgaengers). `zu_heilen` zaehlte
ihn, der Lauf reihte einen Content-Sync ein — und der Heiler
`objekt_kanal.freigegebene_plaene_zuordnen` uebersprang den Plan, weil er ihn
ueber den gesunden Eintrag in `schon_da` fand.

Zwei Definitionen von „versorgt", die sich nicht einigen: hier zaehlt der
EINTRAG, dort der PLAN. Ergebnis war ein Livelock — 31 folgenlose Content-Syncs
je Objekt in sieben Tagen, waehrend die uebrigen fuenfzehn Objekte bei null
lagen. Jeder dieser Syncs ist ein voller Content-Push gegen das Channex-Budget.

Die Eintraege unten sind die LIVE gelesenen von „FeWo *Stjerneskud*"
(Kanal 6194a921), samt dem Fremdkoerper `c0e40509` — der gehoert zum Bild,
weil er beweist, dass der Abzug nicht einfach „zweiter Eintrag = ignorieren"
ist: er wird aus einem anderen Grund uebersprungen (fremder Plan, nicht
primaer).

Der Bestands-Test `test_attrappe_loest_sync_auch_ohne_neuen_plan` haelt die
Gegenrichtung: eine Rate, die NUR eine Attrappe hat, MUSS weiter Arbeit sein.
"""
from __future__ import annotations

from typing import Any

from src.features.channel_manager.portal_raten_abgleich import PortalRatenAbgleichMixin

TENANT = "a25577cf-c941-45c4-8d23-008887e631aa"
OBJEKT = "6efd2281-1649-4883-9cf1-4e39f49fec66"
KANAL = "6194a921-b1c8-41b3-8971-f8bf0a645efc"
ZIMMER = 1264579201
WOCHE = "63941996"
STANDARD = "47588686"

TITEL_JE_CODE = {WOCHE: "Wochenrate", STANDARD: "Standard Rate"}


def _eintrag(
    mapping_id: str, plan: str, code: str, *,
    occupancy: int | None, primary: bool | None,
) -> dict[str, Any]:
    settings: dict[str, Any] = {"room_type_code": ZIMMER, "rate_plan_code": int(code)}
    if occupancy is not None:
        settings["occupancy"] = occupancy
        settings["pricing_type"] = "RLO"
    if primary is not None:
        settings["primary_occ"] = primary
    return {"id": mapping_id, "rate_plan_id": plan, "settings": settings}


# Der Live-Stand, Eintrag fuer Eintrag.
TRAEGER = _eintrag("e04e1c55", "b7df3e35", WOCHE, occupancy=4, primary=True)
GRUNDPREIS = _eintrag("f48200fc", "94cc38bb", STANDARD, occupancy=4, primary=True)
FREMDKOERPER = _eintrag("c0e40509", "bd74737b", WOCHE, occupancy=1, primary=False)
ATTRAPPE = _eintrag("7ba01b47", "b7df3e35", WOCHE, occupancy=None, primary=None)


class _Ergebnis:
    def __init__(self, data: list[dict[str, Any]]) -> None:
        self.data = data


class _Tabelle:
    def __init__(self, zeilen: list[dict[str, Any]]) -> None:
        self._zeilen = zeilen

    def select(self, _spalten: str) -> _Tabelle:
        return self

    def eq(self, _spalte: str, _wert: object) -> _Tabelle:
        return self

    def in_(self, _spalte: str, _werte: object) -> _Tabelle:
        return self

    def is_(self, _spalte: str, _wert: object) -> _Tabelle:
        return self

    def execute(self) -> _Ergebnis:
        return _Ergebnis(self._zeilen)


class _DB:
    """Nur die zwei Tabellen, die `_plannamen_je_channex_id` liest."""

    def table(self, name: str) -> _Tabelle:
        if name == "rate_plans":
            return _Tabelle([
                {"id": "lokal-woche", "name": "Wochenrate"},
                {"id": "lokal-grund", "name": "Grundpreis"},
                {"id": "lokal-grund-bc", "name": "Grundpreis · BookingCom"},
            ])
        if name == "channex_rate_plan_map":
            return _Tabelle([
                {"local_rate_plan_id": "lokal-woche", "channex_rate_plan_id": "b7df3e35"},
                {"local_rate_plan_id": "lokal-grund", "channex_rate_plan_id": "94cc38bb"},
                {"local_rate_plan_id": "lokal-grund-bc", "channex_rate_plan_id": "bd74737b"},
            ])
        raise AssertionError(f"unerwartete Tabelle: {name}")


class _Channex:
    def __init__(self, eintraege: list[dict[str, Any]]) -> None:
        self._eintraege = eintraege

    def get_channel(self, _channel_id: str) -> dict[str, Any]:
        return {"data": {"attributes": {"rate_plans": self._eintraege}}}


class _Dienst(PortalRatenAbgleichMixin):
    def __init__(self, channex: _Channex) -> None:
        self._channex = channex


def _lesen(eintraege: list[dict[str, Any]]) -> tuple[set[str], set[str]]:
    ergebnis = _Dienst(_Channex(eintraege))._belegte_ratencodes(  # noqa: SLF001
        _DB(), TENANT, OBJEKT, {"channex_channel_id": KANAL}, TITEL_JE_CODE,
    )
    assert ergebnis is not None
    belegt, attrappen, _ = ergebnis
    return belegt, attrappen


def test_attrappe_neben_traeger_ist_keine_arbeit() -> None:
    """Der Live-Stand von Stjerneskud: nichts zu heilen."""
    belegt, attrappen = _lesen([TRAEGER, GRUNDPREIS, FREMDKOERPER, ATTRAPPE])

    assert belegt == {WOCHE, STANDARD}
    assert attrappen == set(), "Traeger vorhanden → der Doppelgaenger ist keine Arbeit"


def test_reihenfolge_entscheidet_nicht() -> None:
    """Der Traeger darf auch NACH der Attrappe stehen.

    Channex liefert das Array ungeordnet; bei „Feriehus Graevlinge" steht die
    Attrappe live VOR ihrem Traeger. Wuerde der Abzug in der Schleife statt bei
    der Rueckgabe passieren, haette dieses Objekt weiter gemeldet.
    """
    belegt, attrappen = _lesen([ATTRAPPE, FREMDKOERPER, TRAEGER, GRUNDPREIS])

    assert belegt == {WOCHE, STANDARD}
    assert attrappen == set()


def test_ohne_traeger_bleibt_die_attrappe_arbeit() -> None:
    """Die Gegenrichtung — sonst waere der Abzug ein Verschlucken (Wurzel 5).

    Ohne vollwertigen Eintrag sendet die Rate bei Channex nichts; genau dafuer
    gibt es den Zaehler. Derselbe Fall wie
    `test_attrappe_loest_sync_auch_ohne_neuen_plan`, hier eine Ebene tiefer.
    """
    belegt, attrappen = _lesen([GRUNDPREIS, ATTRAPPE])

    assert belegt == {STANDARD}
    assert attrappen == {WOCHE}
