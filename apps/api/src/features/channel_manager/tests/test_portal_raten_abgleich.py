"""Der Bestands-Nachzug: Portal-Raten -> eigene Preisplaene, taeglich, automatisch.

`channels._plaene_fuer_uebrige_raten` laeuft nur beim VERBINDEN eines Kanals.
Fuer die 18 bereits verbundenen Booking-Kennungen griff es nie — belegt an
„FeWo *Stjerneskud*" (Booking fuehrt 47588686 „Standard Rate" und 63941996
„Wochenrate", lokal standen nur `Grundpreis` und `Grundpreis · BookingCom`).
`portal_raten_abgleich` zieht das nach; hier steht, was der Lauf tut und was
er ausdruecklich NICHT tut.

DER WICHTIGSTE TEST ist `test_zweiter_lauf_tut_nichts`: der Lauf kommt TAEGLICH
wieder. Ohne Idempotenz (Wurzel 2) entstuende jeden Tag ein weiterer
„Wochenrate"-Plan und jeden Tag ein Content-Sync — und der Content-Sync ist der
Weg, auf dem am Ende ein Channex-SCHREIBaufruf passiert.
"""
from __future__ import annotations

from typing import Any

from src.features.channel_manager.channels import ChannelsMixin
from src.features.channel_manager.channex_client import ChannexError
from src.features.channel_manager.portal_raten_abgleich import (
    PORTALE_MIT_RATEN,
    PortalRatenAbgleichMixin,
)

TENANT = "a25577cf-c941-45c4-8d23-008887e631aa"
OBJEKT = "6efd2281-1649-4883-9cf1-4e39f49fec66"  # FeWo *Stjerneskud*

# Genau die Live-Lage: zwei Raten unter einer Booking-Kennung.
STANDARD = {"id": 47588686, "title": "Standard Rate"}
WOCHE = {"id": 63941996, "title": "Wochenrate"}

GRUNDPREIS = {
    "id": "grund-1", "name": "Grundpreis",
    "base_price": 605, "currency": "DKK", "min_stay": 2,
}
VERBINDUNG = {
    "ota_portal_code": "BookingCom",
    "ota_hotel_id": "15122264",
    "channex_channel_id": "ch-1",
}


# --- Fake-DB ----------------------------------------------------------------
# `rate_plans` als echte Liste, damit ein insert im ZWEITEN Lauf als vorhandener
# Name sichtbar ist — genau das ist der Idempotenz-Beweis. Kein Nachbau der
# PostgREST-Filter: welche Zeilen eine Abfrage sieht, entscheidet die
# Testvorgabe.


class _Tabelle:
    def __init__(self, db: _Db, name: str) -> None:
        self._db = db
        self._name = name
        self._insert: dict[str, Any] | None = None
        self._update: dict[str, Any] | None = None
        self._spalten = ""
        self._eq: list[tuple[Any, Any]] = []

    def select(self, spalten: str = "") -> _Tabelle:
        self._spalten = spalten
        return self

    def insert(self, payload: dict[str, Any]) -> _Tabelle:
        self._insert = payload
        return self

    def update(self, payload: dict[str, Any]) -> _Tabelle:
        self._update = payload
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

    def execute(self) -> Any:
        if self._insert is not None:
            return self._db.insert_ausfuehren(self._name, self._insert)
        if self._update is not None:
            return self._db.update_ausfuehren(
                self._name, self._update, dict(self._eq)
            )
        return type("R", (), {
            "data": self._db.lesen(self._name, self._spalten, dict(self._eq)),
        })()


class _Db:
    def __init__(
        self, *, grundpreis: dict[str, Any] | None = GRUNDPREIS,
        verbindungen: list[dict[str, Any]] | None = None,
    ) -> None:
        self.grundpreis = grundpreis
        self.verbindungen = (
            [VERBINDUNG] if verbindungen is None else verbindungen
        )
        self.rate_plans: list[dict[str, Any]] = (
            [grundpreis] if grundpreis else []
        )
        self.inserts: list[dict[str, Any]] = []
        self.updates: list[dict[str, Any]] = []
        self._naechste_id = 0
        # Die Live-Lage: der Grundpreis ist bei Channex als `cx-grundpreis`
        # registriert — genau die ID, auf die der Kanal-Doppelgaenger zeigt.
        self.rate_plan_map: list[dict[str, Any]] = (
            [{"local_rate_plan_id": grundpreis["id"],
              "channex_rate_plan_id": "cx-grundpreis"}]
            if grundpreis else []
        )

    def table(self, name: str) -> _Tabelle:
        return _Tabelle(self, name)

    def lesen(
        self, name: str, spalten: str, filter_: dict[Any, Any] | None = None
    ) -> list[dict[str, Any]]:
        if name == "channex_channel_connection":
            return list(self.verbindungen)
        if name == "channex_rate_plan_map":
            return list(self.rate_plan_map)
        if name != "rate_plans":  # pragma: no cover — nichts anderes wird gelesen
            raise AssertionError(f"unerwartete Tabelle: {name}")
        if "base_price" in spalten:
            return [self.grundpreis] if self.grundpreis else []
        if "portal_scope" in spalten:
            # Der Lese-Schritt von `portalfreigabe_nachziehen`: EINE Zeile per ID.
            plan_id = (filter_ or {}).get("id")
            return [
                {"id": r["id"], "send_to_portals": r.get("send_to_portals"),
                 "portal_scope": r.get("portal_scope")}
                for r in self.rate_plans if r["id"] == plan_id
            ]
        return [
            {"id": r["id"], "name": r.get("name"),
             "send_to_portals": r.get("send_to_portals")}
            for r in self.rate_plans if r.get("name")
        ]

    def update_ausfuehren(
        self, name: str, payload: dict[str, Any], filter_: dict[Any, Any]
    ) -> Any:
        assert name == "rate_plans", name
        plan_id = filter_.get("id")
        for r in self.rate_plans:
            if r["id"] == plan_id:
                r.update(payload)
                self.updates.append({"id": plan_id, **payload})
        return type("R", (), {"data": []})()

    def insert_ausfuehren(self, name: str, payload: dict[str, Any]) -> Any:
        assert name == "rate_plans", name
        self._naechste_id += 1
        neu = {**payload, "id": f"neu-{self._naechste_id}"}
        self.rate_plans.append(neu)
        self.inserts.append(payload)
        return type("R", (), {"data": [{"id": neu["id"]}]})()


class _Channex:
    """Genau die ZWEI lesenden Calls dieses Laufs — `get_channel_mapping_details`
    (was das Portal fuehrt) und `get_channel` (was schon zugeordnet ist).

    Kein Schreib-Call ist definiert. Ein `create_channel_mapping` oder
    `update_channel` waere hier ein AttributeError, was diesen Doppelgaenger zur
    Wache darueber macht, dass der Lauf selbst nichts an Channex schreibt — das
    tut erst der Content-Sync-Handler (Schritt e)."""

    def __init__(
        self, antwort: dict[str, Any] | ChannexError,
        *, gemappt: list[Any] | ChannexError | None = None,
    ) -> None:
        self.antwort = antwort
        # Standard = die Live-Lage: die STANDARD-Rate ist gemappt (sie traegt
        # den Grundpreis), die Wochenrate nicht.
        self.gemappt: list[Any] | ChannexError = (
            [STANDARD["id"]] if gemappt is None else gemappt
        )
        self.aufrufe: list[dict[str, Any]] = []
        self.kanal_aufrufe: list[str] = []
        self.zuordnungen: list[tuple[str, Any, bool]] = []
        # Ratencodes, deren Eintrag als ATTRAPPE gebaut wird (ohne `occupancy`
        # und `pricing_type`) — der live gemessene Fehlzustand.
        self.attrappe_codes: set[str] = set()

    def get_channel_mapping_details(
        self, *, channel: str, settings: dict[str, Any]
    ) -> dict[str, Any]:
        self.aufrufe.append({"channel": channel, "settings": settings})
        if isinstance(self.antwort, ChannexError):
            raise self.antwort
        return self.antwort

    def get_channel(self, channel_id: str) -> dict[str, Any]:
        self.kanal_aufrufe.append(channel_id)
        if isinstance(self.gemappt, ChannexError):
            raise self.gemappt
        # `zuordnungen` gesetzt = die Zuordnungen ausdruecklich vorgeben
        # (Plan-ID, Ratencode, primary_occ); sonst zeigen alle Codes aus
        # `gemappt` auf den Grundpreis — die Live-Lage.
        eintraege = self.zuordnungen or [
            ("cx-grundpreis", code, True) for code in self.gemappt
        ]
        # `occupancy` gehoert zu einem echten Eintrag: Channex fuehrt sie an
        # jeder Paar-Zuordnung, und ohne sie ist der Eintrag eine Attrappe, die
        # keine Restriktionen traegt. Wer sie im Doppelgaenger weglaesst, testet
        # ausschliesslich den Fehlzustand — `attrappe_codes` macht ihn deshalb
        # ausdruecklich waehlbar, statt ihn zum Normalfall zu machen.
        return {
            "data": {
                "attributes": {
                    "rate_plans": [
                        {
                            "rate_plan_id": plan,
                            "settings": {
                                "room_type_code": 1220760101,
                                "rate_plan_code": code,
                                "primary_occ": primary,
                                **(
                                    {}
                                    if str(code) in self.attrappe_codes
                                    else {"occupancy": 4,
                                          "pricing_type": "Standard"}
                                ),
                            },
                        }
                        for plan, code, primary in eintraege
                    ]
                }
            }
        }


def _details(rates: list[dict[str, Any]]) -> dict[str, Any]:
    """Booking-Form von `mapping_details`: data.rooms[].rates[]."""
    return {
        "data": {
            "rooms": [
                {"id": 1220760101, "title": "Ferienhaus", "rates": rates}
            ]
        }
    }


class _Dienst(ChannelsMixin, PortalRatenAbgleichMixin):
    """Beide Mixins zusammen, wie im echten Dienst: `_grundpreis_zeile` und
    `_normalize_mapping_rooms` sind die ECHTEN aus `ChannelsMixin` — die
    Normalisierung der Booking-Antwort wird damit mitgeprueft und nicht
    nachgebaut. Ersetzt ist nur `_portal_label` (es liest Kanal-Meta, das hier
    nichts entscheidet)."""

    def __init__(self, db: _Db, channex: _Channex) -> None:
        self._db = db
        self._channex = channex

    def _require_db(self) -> _Db:
        return self._db

    def _portal_label(self, _portal_code: str) -> str:  # type: ignore[override]
        return "Booking.com"


def _lauf(
    db: _Db, channex: _Channex, monkeypatch: Any
) -> tuple[dict[str, Any], list[tuple[str, str]]]:
    """Einen Abgleich fahren und die eingereihten Content-Syncs mitschreiben.

    Der Job wird im Modul `src.jobs.queue` nachgeschlagen (lokaler Import im
    Mixin gegen den Zyklus), dort wird er ersetzt.
    """
    eingereiht: list[tuple[str, str]] = []
    import src.jobs.queue as queue_mod

    monkeypatch.setattr(
        queue_mod, "try_enqueue_content_sync",
        lambda _db, tid, pid, **_k: eingereiht.append((tid, pid)),
    )
    ergebnis = _Dienst(db, channex).portal_raten_abgleichen(TENANT, OBJEKT)
    return ergebnis, eingereiht


# --- Was der Lauf tut -------------------------------------------------------

def test_zwei_portal_raten_ergeben_genau_einen_neuen_plan(monkeypatch: Any) -> None:
    """Die Live-Lage von „FeWo *Stjerneskud*": genau EIN Plan entsteht.

    Booking fuehrt zwei Raten. Die Standard Rate ist im Kanal schon zugeordnet —
    sie traegt den Grundpreis, so paart es der Kanal-Aufbau
    (`zip(ota_rates, selected)`). UEBRIG ist nur die Wochenrate, und nur fuer
    sie fehlt ein Plan.

    Der GEGENPROBE-Wert dieses Tests liegt in dem, was NICHT passiert: kein
    zweiter Plan „Standard Rate". Ein solcher wuerde per `nur_paar` auf genau
    das Paar gelegt, das der Grundpreis haelt, und ihm seine einzige Rate
    nehmen (Channex: ein OTA-Paar traegt genau einen lokalen Plan).
    """
    db = _Db()
    channex = _Channex(_details([STANDARD, WOCHE]))
    ergebnis, eingereiht = _lauf(db, channex, monkeypatch)

    assert [i["name"] for i in db.inserts] == ["Wochenrate"]
    assert ergebnis["angelegt"] == 1
    assert ergebnis["portal_raten"] == 2
    assert ergebnis["sync_eingereiht"] is True
    # Der Content-Sync ist Schritt (d) — er registriert den Plan bei Channex
    # und ruft im selben Handler `freigegebene_plaene_zuordnen` (Schritt e).
    assert eingereiht == [(TENANT, OBJEKT)]


def test_zweite_rate_am_grundpreis_ist_arbeit_nicht_ruhe(monkeypatch: Any) -> None:
    """„GEMAPPT" IST NICHT „VERSORGT" — der Befund, der den ersten Entwurf kippte.

    Genau der Kanal von „FeWo *Stjerneskud*", gelesen am 23.08.2026: BEIDE
    Booking-Raten zeigen auf den Grundpreis, BEIDE mit `primary_occ: true`.

        47588686 (Standard Rate) -> cx-grundpreis   primary
        63941996 (Wochenrate)    -> cx-grundpreis   primary

    Ein Lauf, der jede zugeordnete Rate auslaesst, haette hier „nichts zu tun"
    gemeldet — im Trockenlauf ueber alle 18 Kennungen ergab das ueberall 0. Der
    Zustand ist aber genau der Fehler: zwei Raten auf einem Plan, ein
    Mindestaufenthalt fuer beide, keine eigene Zeile unter „Preise".

    Behalten darf der Grundpreis EINE Rate je Zimmer, die zweite ist Arbeit.
    """
    db = _Db()
    channex = _Channex(
        _details([STANDARD, WOCHE]),
        gemappt=[STANDARD["id"], WOCHE["id"]],  # beide am Grundpreis, primary
    )
    ergebnis, eingereiht = _lauf(db, channex, monkeypatch)

    assert [i["name"] for i in db.inserts] == ["Wochenrate"]
    assert ergebnis["angelegt"] == 1
    assert eingereiht == [(TENANT, OBJEKT)]


def test_primaere_zuordnung_entscheidet_nicht_die_reihenfolge(
    monkeypatch: Any,
) -> None:
    """WELCHE Rate der Grundpreis behaelt, sagt `primary_occ` — nicht die
    Position im Array.

    Live gemessen an „Bedstefars lille skovhus" und „Feriehus Rævehulen"
    (23.08.2026): Channex liefert die WOCHENRATE VORN und die Standard Rate
    dahinter, und nur die hintere traegt `primary_occ: true`.

        63942079 primary=False   <- steht vorn, ist aber die Arbeit
        55268553 primary=True    <- behaelt der Grundpreis

    Ein Lauf, der „die erste behaelt der Plan" annahm, legte hier einen Plan
    „Standard Rate" an und liess die Wochenrate liegen — genau verkehrt. Der
    Test haelt die Reihenfolge deshalb ABSICHTLICH umgedreht.
    """
    db = _Db()
    channex = _Channex(_details([STANDARD, WOCHE]))
    channex.zuordnungen = [
        ("cx-grundpreis", WOCHE["id"], False),      # vorn, nicht primaer
        ("cx-grundpreis", STANDARD["id"], True),    # hinten, primaer
    ]
    ergebnis, _ = _lauf(db, channex, monkeypatch)

    assert [i["name"] for i in db.inserts] == ["Wochenrate"]
    assert ergebnis["angelegt"] == 1


def test_eigener_plan_je_rate_ist_ruhe(monkeypatch: Any) -> None:
    """Der Zielzustand: zeigt jede Rate auf einen Plan, der IHREN Namen traegt
    UND dessen Eintrag die Restriktionen traegt, ist nichts zu tun. Das ist die
    erste Idempotenz-Sperre nach einem vollstaendig durchgelaufenen Abgleich.

    `primary_occ: True` ist Teil des Zielzustands, nicht Beigabe: ohne die Marke
    sendet Channex an dem Eintrag keine Restriktionen. Genau diese Attrappe lag
    live vor (23.08.2026, Grævlinge und Stjerneskud: `occ=None, primary=None`),
    und weil sie als „versorgt" galt, stiess der Abgleich keinen Content-Sync an
    und der Fehlzustand fror ein — die Mindestaufenthalt-Zelle der Wochenrate
    blieb im Booking-Extranet leer. Siehe `test_attrappe_ist_keine_ruhe`."""
    db = _Db()
    db.rate_plans.append({"id": "woche-1", "name": "Wochenrate"})
    db.rate_plan_map.append({
        "local_rate_plan_id": "woche-1", "channex_rate_plan_id": "cx-woche",
    })
    channex = _Channex(_details([STANDARD, WOCHE]))
    # Standard am Grundpreis (behalten), Wochenrate an ihrem eigenen Plan —
    # beide als Restriktions-Traeger ihres Paares.
    channex.zuordnungen = [
        ("cx-grundpreis", STANDARD["id"], True),
        ("cx-woche", WOCHE["id"], True),
    ]
    ergebnis, eingereiht = _lauf(db, channex, monkeypatch)

    assert db.inserts == []
    assert ergebnis["angelegt"] == 0
    assert eingereiht == []


def test_attrappe_ist_keine_ruhe(monkeypatch: Any) -> None:
    """Ein namensgleicher Plan mit ATTRAPPEN-Eintrag ist KEIN Zielzustand.

    Live gemessen (23.08.2026) an „Feriehus Grævlinge" und „FeWo *Stjerneskud*":
    der Plan „Wochenrate" existierte, war bei Channex registriert und am Kanal
    zugeordnet — aber mit `occupancy: None` und `primary_occ: None`. Ein solcher
    Eintrag sendet keine Restriktionen: im Booking-Extranet blieb die
    Mindestaufenthalt-Zelle der Wochenrate leer, waehrend die 7 bei Channex auf
    der Rate korrekt anlag.

    Der Abgleich las die Attrappe als „versorgt", meldete `angelegt = 0` und
    stiess keinen Content-Sync an. Damit wurde
    `objekt_kanal._eintrag_ist_vollwertig` — das die Attrappe erkennt und das
    Paar heilt — NIE erreicht, und der Fehlzustand fror ein. Genau diese Sperre
    prueft dieser Test: der Sync MUSS eingereiht werden, sonst heilt der
    taegliche Lauf den Bestand nie.
    """
    db = _Db()
    db.rate_plans.append({"id": "woche-1", "name": "Wochenrate"})
    db.rate_plan_map.append({
        "local_rate_plan_id": "woche-1", "channex_rate_plan_id": "cx-woche",
    })
    channex = _Channex(_details([STANDARD, WOCHE]))
    channex.zuordnungen = [
        ("cx-grundpreis", STANDARD["id"], True),
        ("cx-woche", WOCHE["id"], False),
    ]
    # Der Eintrag der Wochenrate ist die Attrappe — wie live.
    channex.attrappe_codes = {str(WOCHE["id"])}

    ergebnis, eingereiht = _lauf(db, channex, monkeypatch)

    # Kein zweiter Plan: der Name steht schon da, angelegt wird nichts.
    assert db.inserts == []
    assert ergebnis["angelegt"] == 0
    # ABER der Sync muss laufen, damit die Zuordnung geheilt wird.
    assert eingereiht, "Attrappe muss einen Content-Sync ausloesen"


def test_kanal_unlesbar_legt_nichts_an(monkeypatch: Any) -> None:
    """Ist der Kanal nicht lesbar, ist UNBEKANNT, welche Rate ihren eigenen Plan
    schon traegt — und ohne dieses Wissen wuerde der Lauf dem Grundpreis seine
    Rate wegnehmen. Fail-closed (Wurzel 5), kein Freibrief."""
    db = _Db()
    channex = _Channex(
        _details([STANDARD, WOCHE]),
        gemappt=ChannexError("404 Not Found", status_code=404),
    )
    ergebnis, eingereiht = _lauf(db, channex, monkeypatch)

    assert db.inserts == []
    assert ergebnis["angelegt"] == 0
    assert eingereiht == []


def test_kanal_ohne_zuordnung_macht_alle_raten_offen(monkeypatch: Any) -> None:
    """Leere Zuordnung ist NICHT dasselbe wie unlesbar: traegt der Kanal
    tatsaechlich keine Rate, ist jede Rate offen und bekommt ihren Plan."""
    db = _Db()
    channex = _Channex(_details([STANDARD, WOCHE]), gemappt=[])
    ergebnis, _ = _lauf(db, channex, monkeypatch)

    assert [i["name"] for i in db.inserts] == ["Standard Rate", "Wochenrate"]
    assert ergebnis["angelegt"] == 2


def test_vorhandener_plan_wird_nicht_doppelt_angelegt(monkeypatch: Any) -> None:
    """Heisst ein Plan schon wie die Rate, entsteht kein zweiter.

    Der Plan traegt hier seine Portal-Freigabe (`send_to_portals`) — dann ist
    wirklich NICHTS zu tun, auch kein Content-Sync.
    """
    db = _Db()
    db.rate_plans.append({"id": "woche-1", "name": "Wochenrate",
                          "send_to_portals": True})
    channex = _Channex(_details([WOCHE]))
    ergebnis, eingereiht = _lauf(db, channex, monkeypatch)

    assert db.inserts == []
    assert db.updates == []
    assert ergebnis["angelegt"] == 0
    assert ergebnis["nachgezogen"] == 0
    assert ergebnis["sync_eingereiht"] is False
    assert eingereiht == []


def test_verlorene_portalfreigabe_wird_nachgezogen(monkeypatch: Any) -> None:
    """DER GEGENZUSTAND ZUR IDEMPOTENZ-SPERRE (Wurzel 1).

    Live gemessen (23.08.2026): der Plan „Wochenrate" von „FeWo *Stjerneskud*"
    (05f602c2-…) wurde 17:28:02 mit `send_to_portals: True` angelegt und stand
    17:28:51 auf `false` — waehrend die vier Schwester-Plaene desselben Laufs
    ihr `true` behielten. In beiden API-Containern steht in diesem Fenster KEIN
    schreibender Request (nur Channex-Webhooks), `mcp_access_log` ist leer; der
    Schreiber war ein Prozess mit dem Service-Key ausserhalb der deployten
    Dienste.

    Die Ursache liegt damit nicht im Code — die FOLGE lag es: der Plan war
    danach dauerhaft unzuordenbar, weil `freigegebene_plaene_zuordnen` nur
    Plaene mit `send_to_portals = true` liest und der taegliche Abgleich einen
    vorhandenen Plan nur am NAMEN wiedererkannte, nie an seinem Flag. Ohne
    dieses Nachziehen bliebe die Rate fuer immer ohne Kanal-Zuordnung.
    """
    db = _Db()
    db.rate_plans.append({"id": "woche-1", "name": "Wochenrate",
                          "send_to_portals": False})
    channex = _Channex(_details([WOCHE]))
    ergebnis, eingereiht = _lauf(db, channex, monkeypatch)

    assert db.inserts == [], "kein zweiter Plan — nur das Flag"
    assert db.updates == [{"id": "woche-1", "send_to_portals": True}]
    assert ergebnis["nachgezogen"] == 1
    # Der Content-Sync MUSS kommen: erst sein Handler ruft
    # `freigegebene_plaene_zuordnen`, die das Flag liest (Schritt (d)->(e)).
    assert ergebnis["sync_eingereiht"] is True
    assert eingereiht == [(TENANT, OBJEKT)]


def test_nachziehen_ist_idempotent(monkeypatch: Any) -> None:
    """Zweiter Lauf nach dem Nachziehen: kein weiteres Update, kein Sync.

    Sonst kostete jeder taegliche Lauf je Objekt einen vollen
    Channex-Content-Push fuer nichts (Wurzel 2).
    """
    db = _Db()
    db.rate_plans.append({"id": "woche-1", "name": "Wochenrate",
                          "send_to_portals": False})
    channex = _Channex(_details([WOCHE]))
    _lauf(db, channex, monkeypatch)
    ergebnis, eingereiht = _lauf(db, channex, monkeypatch)

    assert db.updates == [{"id": "woche-1", "send_to_portals": True}]
    assert ergebnis["nachgezogen"] == 0
    assert ergebnis["sync_eingereiht"] is False
    assert eingereiht == []


def test_kanalplan_wird_nicht_freigegeben(monkeypatch: Any) -> None:
    """Ein `portal_scope`-Plan bleibt bei `send_to_portals: False`.

    Er geht ausschliesslich ueber seine Portal-Achse an SEIN Portal (0272);
    ihn zusaetzlich freizugeben hiesse, ihn ueber die Zusatz-Freigabe an jedes
    Portal zu mappen. Das Flag ist dort ABSICHT, kein verlorener Zustand.
    """
    db = _Db()
    db.rate_plans.append({"id": "kanal-1", "name": "Wochenrate",
                          "send_to_portals": False,
                          "portal_scope": "BookingCom"})
    channex = _Channex(_details([WOCHE]))
    ergebnis, eingereiht = _lauf(db, channex, monkeypatch)

    assert db.updates == []
    assert ergebnis["nachgezogen"] == 0
    assert eingereiht == []


def test_zweiter_lauf_tut_nichts(monkeypatch: Any) -> None:
    """WURZEL 2, der Kern: der Lauf kommt TAEGLICH wieder.

    Beim zweiten Lauf darf es weder einen weiteren Insert geben noch einen
    weiteren Content-Sync — der Content-Sync ist der Weg, auf dem spaeter ein
    Channex-SCHREIBaufruf passiert. Ein Lauf, der taeglich schreibt, waere
    taeglich ein Kanal-PUT ohne Anlass.
    """
    db = _Db()
    channex = _Channex(_details([STANDARD, WOCHE]))

    erste, eingereiht_1 = _lauf(db, channex, monkeypatch)
    assert erste["angelegt"] == 1
    assert len(eingereiht_1) == 1
    inserts_nach_lauf_1 = len(db.inserts)

    # Der Kanal traegt die Wochenrate hier ABSICHTLICH noch nicht (der
    # Content-Sync des ersten Laufs ist im Doppelgaenger nicht gelaufen) —
    # damit prueft dieser Test die zweite Sperre allein: den NAMEN. Genau das
    # ist der reale Fall, wenn der Abgleich zweimal laeuft, bevor der
    # Content-Sync durch ist.
    zweite, eingereiht_2 = _lauf(db, channex, monkeypatch)
    assert zweite["angelegt"] == 0
    assert zweite["sync_eingereiht"] is False
    assert len(db.inserts) == inserts_nach_lauf_1  # kein weiterer Insert
    assert eingereiht_2 == []                      # kein weiterer Sync

    # Und mit gemappter Wochenrate (Content-Sync durch) greift Sperre 1 —
    # dieselbe Ruhe, anderer Grund.
    channex.gemappt = [STANDARD["id"], WOCHE["id"]]
    dritte, eingereiht_3 = _lauf(db, channex, monkeypatch)
    assert dritte["angelegt"] == 0
    assert len(db.inserts) == inserts_nach_lauf_1
    assert eingereiht_3 == []


def test_wochenrate_traegt_sieben_naechte(monkeypatch: Any) -> None:
    """Eine Wochenrate ist bei Booking ein eigener Ratenkategorie-Typ, sichtbar
    ab sieben Naechten — der Mindestaufenthalt IST ihre Mechanik. Ohne das waere
    sie ein zweiter Standardpreis mit den 2 Naechten des Grundpreises."""
    db = _Db()
    _lauf(db, _Channex(_details([STANDARD, WOCHE])), monkeypatch)

    (neu,) = db.inserts
    assert neu["name"] == "Wochenrate"
    assert neu["min_stay"] == 7
    # Preis und Waehrung erbt er, der Mindestaufenthalt nicht.
    assert neu["base_price"] == 605
    assert neu["currency"] == "DKK"
    # Ohne dieses Flag bekaeme die Rate weiterhin keine Restriktionen.
    assert neu["send_to_portals"] is True


# --- Was der Lauf NICHT tut -------------------------------------------------

def test_ohne_grundpreis_passiert_nichts(monkeypatch: Any) -> None:
    """Kein Grundpreis = keine Erbmasse fuer Preis/Waehrung. Ein erfundener
    Startpreis waere eine Behauptung ueber den Verkauf (Wurzel 4)."""
    db = _Db(grundpreis=None)
    ergebnis, eingereiht = _lauf(db, _Channex(_details([WOCHE])), monkeypatch)

    assert db.inserts == []
    assert ergebnis["angelegt"] == 0
    assert eingereiht == []


def test_abruf_ohne_raten_legt_nichts_an(monkeypatch: Any) -> None:
    """FAIL-CLOSED (Wurzel 5): ein `mapping_details` ohne Raten ist ein
    fehlgeschlagener Abruf, kein Portal ohne Raten. Nichts anlegen — und
    ausdruecklich auch nichts abraeumen."""
    db = _Db()
    ergebnis, eingereiht = _lauf(db, _Channex(_details([])), monkeypatch)

    assert db.inserts == []
    assert ergebnis["angelegt"] == 0
    assert ergebnis["portal_raten"] == 0
    assert eingereiht == []
    # Die vorhandenen Plaene stehen unangetastet da.
    assert [r["id"] for r in db.rate_plans] == ["grund-1"]


def test_channex_fehler_legt_nichts_an(monkeypatch: Any) -> None:
    """Ein abgelehnter Abruf ist derselbe Fall: kein Wissen ueber die Raten, also
    keine Aenderung. Der Fehler wird geloggt, nicht in „keine Raten" umgedeutet."""
    db = _Db()
    fehler = ChannexError("503 Service Unavailable", status_code=503)
    ergebnis, eingereiht = _lauf(db, _Channex(fehler), monkeypatch)

    assert db.inserts == []
    assert ergebnis["angelegt"] == 0
    assert eingereiht == []


def test_rate_ohne_titel_wird_uebersprungen(monkeypatch: Any) -> None:
    """Der Titel ist der EINZIGE Schluessel, der den Plan spaeter seiner Rate
    zuordnet (`paar_fuer_portal_plan`). Ein Plan ohne diesen Schluessel bekaeme
    nie sein Mapping — er waere eine Attrappe unter „Preise"."""
    db = _Db()
    ohne = {"id": 99887766, "title": ""}
    ergebnis, _ = _lauf(db, _Channex(_details([ohne, WOCHE])), monkeypatch)

    assert [i["name"] for i in db.inserts] == ["Wochenrate"]
    assert ergebnis["angelegt"] == 1


def test_airbnb_wird_gar_nicht_abgerufen(monkeypatch: Any) -> None:
    """Airbnb fuehrt GENAU EINE Rate je Anzeige — es gaebe nie etwas anzulegen,
    und der Abruf kostete 19 Channex-Calls je Lauf (live gezaehlt). Der Kanal
    wird deshalb nicht einmal angefasst."""
    db = _Db(verbindungen=[{
        "ota_portal_code": "AirBNB", "ota_hotel_id": "529591717",
        "channex_channel_id": "ch-airbnb",
    }])
    channex = _Channex(_details([WOCHE]))
    ergebnis, eingereiht = _lauf(db, channex, monkeypatch)

    assert channex.aufrufe == []   # kein Channex-Call
    assert db.inserts == []
    assert ergebnis["kanaele"] == 0
    assert eingereiht == []
    assert "AirBNB" not in PORTALE_MIT_RATEN


def test_verbindung_ohne_kennung_wird_ausgelassen(monkeypatch: Any) -> None:
    """Ohne `ota_hotel_id` gibt es keinen Abruf-Schluessel — und keinen
    erfundenen (Wurzel 4)."""
    db = _Db(verbindungen=[{
        "ota_portal_code": "BookingCom", "ota_hotel_id": None,
        "channex_channel_id": "ch-1",
    }])
    channex = _Channex(_details([WOCHE]))
    ergebnis, _ = _lauf(db, channex, monkeypatch)

    assert channex.aufrufe == []
    assert ergebnis["kanaele"] == 0


def test_abruf_ist_lesend_und_traegt_die_kennung(monkeypatch: Any) -> None:
    """`POST /channels/mapping_details` ist eine reine Leseabfrage und der
    einzige Weg an die Rate-TITEL (das Kanal-Mapping traegt nur Codes)."""
    db = _Db()
    channex = _Channex(_details([WOCHE]))
    _lauf(db, channex, monkeypatch)

    assert channex.aufrufe == [{
        "channel": "BookingCom",
        "settings": {"hotel_id": "15122264"},
    }]


def test_obergrenze_deckelt_einen_ausreisser(monkeypatch: Any) -> None:
    """Wurzel 8: ein Abruf mit Dutzenden Raten darf nicht Dutzende Plaene
    anlegen."""
    from src.features.channel_manager.portal_raten_plaene import (
        MAX_PLAENE_JE_ZIMMER,
    )

    viele = [{"id": 1000 + i, "title": f"Rate {i}"} for i in range(20)]
    db = _Db()
    ergebnis, _ = _lauf(db, _Channex(_details(viele)), monkeypatch)

    assert ergebnis["angelegt"] == MAX_PLAENE_JE_ZIMMER
    assert len(db.inserts) == MAX_PLAENE_JE_ZIMMER
