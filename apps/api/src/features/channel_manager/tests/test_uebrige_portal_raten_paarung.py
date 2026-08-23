"""Die PAARUNG: welche Portal-Rate auf welchen Preisplan zeigt.

`portal_raten_plaene` legt den Plan an (dort getestet). Hier wird die Stelle
geprueft, die ihn EINSETZT — `channels._plaene_fuer_uebrige_raten` — und die
Reihenfolge, von der die ganze Paarung haengt.

WARUM DIE REIHENFOLGE TRAEGT: `_build_rate_plans` paart
`zip(ota_rates, selected)`. Steht der Grundpreis nicht an Position 0 von
`selected`, bekaeme die STANDARD-Rate des Portals den Wochen-Plan (min_stay 7)
und die Wochenrate den Grundpreis — das Portal verkaufte die Standard-Rate erst
ab sieben Naechten. Deshalb halten die Tests unten fest, dass der neue Plan
HINTEN landet: seine `channex_rate_plan_map`-Zeile entsteht nach der des
Grundpreises, und `_rate_plan_maps_for_property` sortiert nach `created_at`.

Live-Grundlage (23.08.2026, Rævlingehuset, Booking-Zimmer 1220760101): zwei
gleichrangige Raten (Standard 45621028, Wochenrate 45627350) auf EINEM lokalen
Plan. Nur ein Eintrag je Plan trug `primary_occ`; ueber die Wochenrate kam eine
1-Nacht-Buchung, obwohl bei Channex auf allen Raten min_stay 3 lag.
"""
from __future__ import annotations

from typing import Any

from src.features.channel_manager.channels import ChannelsMixin
from src.features.channel_manager.portal_raten_plaene import MAX_PLAENE_JE_ZIMMER

STANDARD = {"id": 45621028, "title": "Standard Rate"}
WOCHE = {"id": 45627350, "title": "Wochenrate"}
GRUND_CX = "cx-grundpreis"


# --- Fake-DB ----------------------------------------------------------------
# Nur `rate_plans` — lesen (Grundpreis, vorhandene Namen) und insert. Die
# Channex-Aufloesung haengt am lokalen Plan und wird am Dienst ersetzt
# (`_Dienst._channex_id_fuer_lokalen_plan`), weil die Fake-Tabelle den lokalen
# Plan der Abfrage nicht kennt. Bewusst kein echter Filter-Nachbau: welche
# Zeile fuer welche Abfrage kommt, entscheidet die Testvorgabe — geprueft wird
# die Absicht, nicht die Nachbildung von PostgREST.


class _Tabelle:
    def __init__(self, db: _Db, name: str) -> None:
        self._db = db
        self._name = name
        self._insert: dict[str, Any] | None = None
        self._spalten = ""

    def select(self, spalten: str = "") -> _Tabelle:
        self._spalten = spalten
        return self

    def insert(self, payload: dict[str, Any]) -> _Tabelle:
        self._insert = payload
        return self

    def eq(self, *_a: Any, **_k: Any) -> _Tabelle:
        return self

    def is_(self, *_a: Any, **_k: Any) -> _Tabelle:
        return self

    def order(self, *_a: Any, **_k: Any) -> _Tabelle:
        return self

    def limit(self, *_a: Any, **_k: Any) -> _Tabelle:
        return self

    def execute(self) -> Any:
        if self._insert is not None:
            return self._db.insert_ausfuehren(self._name, self._insert)
        return type("R", (), {"data": self._db.lesen(self._name, self._spalten)})()


class _Db:
    """Fake-Supabase: `rate_plans` als echte Liste, damit ein insert im
    naechsten Lauf als vorhandener Name sichtbar ist (Idempotenz-Beweis)."""

    def __init__(
        self, *, grundpreis: dict[str, Any] | None,
        channex_ids: dict[str, str] | None = None,
    ) -> None:
        self.grundpreis = grundpreis
        self.channex_ids = channex_ids or {}
        self.rate_plans: list[dict[str, Any]] = [grundpreis] if grundpreis else []
        self.inserts: list[dict[str, Any]] = []
        self._naechste_id = 0

    def table(self, name: str) -> _Tabelle:
        return _Tabelle(self, name)

    def lesen(self, name: str, spalten: str) -> list[dict[str, Any]]:
        if name != "rate_plans":  # pragma: no cover — nichts anderes wird gelesen
            raise AssertionError(f"unerwartete Tabelle: {name}")
        if "base_price" in spalten:
            # `_grundpreis_zeile`: portal_scope IS NULL, aeltester, limit 1.
            return [self.grundpreis] if self.grundpreis else []
        # `vorhandene_plan_namen`: id + name aller Plaene.
        return [
            {"id": r["id"], "name": r.get("name")}
            for r in self.rate_plans if r.get("name")
        ]

    def insert_ausfuehren(self, name: str, payload: dict[str, Any]) -> Any:
        assert name == "rate_plans", name
        self._naechste_id += 1
        neu = {**payload, "id": f"lokal-{self._naechste_id}"}
        self.rate_plans.append(neu)
        self.inserts.append(payload)
        return type("R", (), {"data": [{"id": neu["id"]}]})()


class _Dienst(ChannelsMixin):
    """Nur die zwei Fremdteile ersetzt, die nicht zur Paarung gehoeren: das
    Portal-Label und der Job (er laeuft im Worker, nicht im Test)."""

    def __init__(self, db: _Db) -> None:
        self._db = db
        self.jobs: list[str] = []

    def _portal_label(self, _portal_code: str) -> str:  # type: ignore[override]
        return "Booking.com"

    def _channex_id_fuer_lokalen_plan(  # type: ignore[override]
        self, _db: Any, _tenant_id: str, local_rate_plan_id: str
    ) -> str | None:
        return self._db.channex_ids.get(local_rate_plan_id)


def _paare(
    dienst: _Dienst, db: _Db, uebrige: list[dict[str, Any]],
    monkeypatch: Any,
) -> list[tuple[dict[str, Any], str]]:
    """`_plaene_fuer_uebrige_raten` aufrufen, den Content-Sync-Job abfangen.

    Der Job wird im Modul `src.jobs.queue` nachgeschlagen (lokaler Import gegen
    einen Zyklus) — dort wird er ersetzt, damit der Test keinen Job einreiht.
    """
    from src.jobs import queue

    monkeypatch.setattr(
        queue, "try_enqueue_content_sync",
        lambda _db, _t, prop, **_k: dienst.jobs.append(prop),
    )
    return dienst._plaene_fuer_uebrige_raten(
        db, "t-1",
        local_property_id="prop-1", portal_code="BookingCom",
        uebrige=uebrige, grundpreis_channex_id=GRUND_CX,
    )


GRUNDPREIS = {
    "id": "rp-grund", "name": "Grundpreis",
    "base_price": 880, "currency": "DKK", "min_stay": 3,
}


# --- C1: die Wochenrate bekommt einen EIGENEN Plan --------------------------

def test_wochenrate_bekommt_eigenen_plan(monkeypatch: Any) -> None:
    """Zwei Portal-Raten, ein lokaler Plan: die uebrige Rate bekommt ihren
    eigenen — nicht ein zweites Mal den Grundpreis.

    Das ist der ganze Zweck: Booking fuehrt Restriktionen auf RATE-Ebene, und
    nur ein Eintrag je Plan traegt `primary_occ`.
    """
    db = _Db(grundpreis=GRUNDPREIS)
    dienst = _Dienst(db)
    paare = _paare(dienst, db, [WOCHE], monkeypatch)

    assert len(db.inserts) == 1
    neu = db.inserts[0]
    assert neu["name"] == "Wochenrate"
    assert neu["property_id"] == "prop-1"
    # Preis geerbt, Mindestaufenthalt EIGEN (7 statt der 3 des Grundpreises).
    assert neu["base_price"] == 880
    assert neu["currency"] == "DKK"
    assert neu["min_stay"] == 7
    assert neu["send_to_portals"] is True
    # Der neue Plan hat noch keine Channex-ID → dieser Aufbau paart auf den
    # Grundpreis (eine unzugeordnete Rate verhindert die Kanal-Aktivierung).
    assert paare == [(WOCHE, GRUND_CX)]
    # ... und der Gegenzustand ist eingereiht: ohne Registrierung bei Channex
    # bekaeme der Plan nie eine ID und damit nie seine eigene Zuordnung.
    assert dienst.jobs == ["prop-1"]


def test_registrierter_plan_wird_auch_gepaart(monkeypatch: Any) -> None:
    """Sobald der Plan bei Channex registriert ist, zeigt die Rate auf IHN.

    Das ist der Zustand nach dem Content-Sync — erst hier trennt sich die
    Wochenrate wirklich vom Grundpreis.
    """
    db = _Db(
        grundpreis=GRUNDPREIS,
        # Der Plan existiert lokal schon (voriger Lauf) UND bei Channex.
        channex_ids={"rp-woche": "cx-woche"},
    )
    db.rate_plans.append({"id": "rp-woche", "name": "Wochenrate"})
    dienst = _Dienst(db)
    paare = _paare(dienst, db, [WOCHE], monkeypatch)

    assert db.inserts == []
    assert paare == [(WOCHE, "cx-woche")]
    # Nichts neu angelegt → kein Job.
    assert dienst.jobs == []


# --- C2: Idempotenz (Wurzel 2) ---------------------------------------------

def test_zweiter_lauf_legt_keinen_zweiten_plan_an(monkeypatch: Any) -> None:
    """Wurzel 2: der Kanal-Aufbau laeuft mehrfach (Reconnect, additiver PUT,
    Doppelklick). Ohne Namensabgleich stuende nach drei Laeufen dreimal
    „Wochenrate" unter „Preise"."""
    db = _Db(grundpreis=GRUNDPREIS)
    dienst = _Dienst(db)

    _paare(dienst, db, [WOCHE], monkeypatch)
    assert len(db.inserts) == 1
    _paare(dienst, db, [WOCHE], monkeypatch)
    _paare(dienst, db, [WOCHE], monkeypatch)

    assert len(db.inserts) == 1, db.inserts
    assert [r.get("name") for r in db.rate_plans].count("Wochenrate") == 1


def test_idempotent_auch_bei_abweichender_schreibweise(monkeypatch: Any) -> None:
    """Der Abgleich laeuft ueber den kleingeschriebenen Namen: Booking liefert
    denselben Titel nicht garantiert gleich gross."""
    db = _Db(grundpreis=GRUNDPREIS)
    db.rate_plans.append({"id": "rp-woche", "name": "WOCHENRATE"})
    dienst = _Dienst(db)
    _paare(dienst, db, [{"id": 1, "title": "  wochenrate  "}], monkeypatch)
    assert db.inserts == []


# --- C3: ohne Grundpreis kein erfundener Plan (Wurzel 4) -------------------

def test_ohne_grundpreis_kein_plan_und_rueckfall(monkeypatch: Any) -> None:
    """Kein Grundpreis = keine Erbmasse. Dann wird KEIN Plan angelegt (ein
    erfundener Preis waere Wurzel 4) und die Rate faellt auf die
    Grundpreis-Channex-ID zurueck — unzugeordnet darf sie nicht bleiben, sonst
    aktiviert Channex den Kanal nicht ("Map all rates even the derived ones").
    """
    db = _Db(grundpreis=None)
    dienst = _Dienst(db)
    paare = _paare(dienst, db, [WOCHE], monkeypatch)

    assert db.inserts == []
    assert paare == [(WOCHE, GRUND_CX)]
    # Nichts angelegt → nichts zu registrieren.
    assert dienst.jobs == []


# --- C4: Obergrenze (Wurzel 8) --------------------------------------------

def test_ueber_der_obergrenze_wird_gekappt(monkeypatch: Any) -> None:
    """Wurzel 8: jeder unbegrenzte Bereich bekommt eine harte Obergrenze. Ein
    Abruf, der Dutzende Raten liefert, ist ein Fehler und darf nicht Dutzende
    Plaene anlegen. Gekappt wird LAUT — stilles Abschneiden waere dieselbe
    Unsichtbarkeit, die der ganze Umbau behebt.

    Die Warnung wird am `log`-Objekt des Moduls abgefangen, nicht ueber
    capsys/caplog: structlog schreibt weder in den stdlib-Logger noch
    verlaesslich nach stdout, sobald pytest die Ausgabe umleitet.
    """
    zu_viele = [
        {"id": 1000 + i, "title": f"Rate {i}"}
        for i in range(MAX_PLAENE_JE_ZIMMER + 3)
    ]
    db = _Db(grundpreis=GRUNDPREIS)
    dienst = _Dienst(db)

    warnungen: list[tuple[str, dict[str, Any]]] = []
    from src.features.channel_manager import channels as channels_modul

    monkeypatch.setattr(
        channels_modul.log, "warning",
        lambda ereignis, **felder: warnungen.append((ereignis, felder)),
    )
    paare = _paare(dienst, db, zu_viele, monkeypatch)

    assert len(paare) == MAX_PLAENE_JE_ZIMMER
    assert len(db.inserts) == MAX_PLAENE_JE_ZIMMER
    gekappt = [f for e, f in warnungen if e == "portal_raten_ueber_obergrenze"]
    assert len(gekappt) == 1, warnungen
    # Die WAHRE Anzahl steht in der Warnung, nicht die gekappte — sonst
    # verschwiegen die Logs, wie viel weggefallen ist.
    assert gekappt[0]["anzahl"] == MAX_PLAENE_JE_ZIMMER + 3
    assert gekappt[0]["grenze"] == MAX_PLAENE_JE_ZIMMER


def test_genau_an_der_grenze_wird_nicht_gekappt(monkeypatch: Any) -> None:
    """Die Grenze selbst ist erlaubt — sonst faellt bei genau sechs Raten die
    letzte grundlos weg."""
    genau = [
        {"id": 2000 + i, "title": f"Rate {i}"}
        for i in range(MAX_PLAENE_JE_ZIMMER)
    ]
    db = _Db(grundpreis=GRUNDPREIS)
    paare = _paare(_Dienst(db), db, genau, monkeypatch)
    assert len(paare) == MAX_PLAENE_JE_ZIMMER


# --- B: die Reihenfolge von `selected` ------------------------------------
# Der neue Plan traegt `send_to_portals: True` und landet damit in
# `_selected_rate_plan_ids`. Die REIHENFOLGE entscheidet, welche Portal-Rate
# ihn bekommt: `_build_rate_plans` paart per `zip(ota_rates, selected)`.


class _ReihenfolgeDienst(ChannelsMixin):
    """`_selected_rate_plan_ids` mit ersetzten Datenzugriffen: geprueft wird die
    Sortier-/Auswahl-Logik, nicht PostgREST.

    `_rate_plan_maps_for_property` liefert die Map-IDs nach `created_at` —
    aelteste zuerst. Der Grundpreis existiert vor jedem Portal-Plan, seine Map
    ist also die aeltere; genau das gibt `maps` hier vor.
    """

    def __init__(self, maps: list[str], freigegeben: set[str]) -> None:
        self._maps = maps
        self._freigegeben = freigegeben

    def _rate_plan_maps_for_property(  # type: ignore[override]
        self, _db: Any, _t: str, _p: str
    ) -> list[str]:
        return self._maps

    def _channex_rate_plan_id_for_map(  # type: ignore[override]
        self, _db: Any, _t: str, map_id: str | None
    ) -> str | None:
        return f"cx-{map_id}" if map_id else None

    def _portal_scoped_channex_ids(  # type: ignore[override]
        self, _db: Any, _t: str, _p: str
    ) -> dict[str, str | None]:
        return {}  # keine Kanal-Plaene in diesem Test

    def _portal_enabled_rate_plan_ids(  # type: ignore[override]
        self, _db: Any, _t: str, _p: str
    ) -> set[str]:
        return self._freigegeben


def test_grundpreis_bleibt_an_position_null() -> None:
    """DER TRAGENDE TEST. `_build_rate_plans` paart
    `zip(ota_rates, selected)`; `ota_rates[0]` ist die Standard-Rate des
    Portals. Rutschte der Wochen-Plan auf Position 0, bekaeme die
    STANDARD-Rate min_stay 7 — Booking verkaufte sie erst ab sieben Naechten,
    und die Wochenrate liefe zum Grundpreis ohne Wochen-Restriktion.

    Getragen wird die Reihenfolge von `created_at` in
    `channex_rate_plan_map`: der Grundpreis existiert vor jedem Portal-Plan.
    """
    dienst = _ReihenfolgeDienst(
        maps=["map-grund", "map-woche"],
        freigegeben={"cx-map-woche"},
    )
    ids = dienst._selected_rate_plan_ids(None, "t-1", "prop-1", "BookingCom")
    assert ids == ["cx-map-grund", "cx-map-woche"]


def test_neuer_plan_landet_wirklich_in_selected() -> None:
    """`send_to_portals: True` ist kein Zierrat: OHNE das Flag stuende der neue
    Plan nicht in `selected`, und die naechste Paarung fiele wieder auf den
    Grundpreis zurueck — der Plan bliebe dauerhaft ohne Portal-Rate."""
    ohne_flag = _ReihenfolgeDienst(
        maps=["map-grund", "map-woche"], freigegeben=set(),
    )
    assert ohne_flag._selected_rate_plan_ids(
        None, "t-1", "prop-1", "BookingCom"
    ) == ["cx-map-grund"]

    mit_flag = _ReihenfolgeDienst(
        maps=["map-grund", "map-woche"], freigegeben={"cx-map-woche"},
    )
    assert mit_flag._selected_rate_plan_ids(
        None, "t-1", "prop-1", "BookingCom"
    ) == ["cx-map-grund", "cx-map-woche"]


def test_mehrere_portal_plaene_behalten_die_map_reihenfolge() -> None:
    """Bei drei Raten (Standard · Wochen · Monat) muss jede ihren eigenen Plan
    treffen — die Reihenfolge der Maps ist die Paarungsreihenfolge."""
    dienst = _ReihenfolgeDienst(
        maps=["map-grund", "map-woche", "map-monat"],
        freigegeben={"cx-map-woche", "cx-map-monat"},
    )
    assert dienst._selected_rate_plan_ids(
        None, "t-1", "prop-1", "BookingCom"
    ) == ["cx-map-grund", "cx-map-woche", "cx-map-monat"]
