"""Die Inventur haengt am Turnover — Zaehlpunkte, Rhythmus, Meldebestand.

Was diese Datei festhaelt, ist der Zuschnitt: Recherche der Praxis (Guesty,
Breezeway, Sortly) zeigt einhellig, dass die Zaehlung dort passiert, wo ohnehin
jemand steht. Ein eigener Inventarbereich wird nicht gepflegt.

Die drei Fallen, gegen die hier geprueft wird:
  * Zu viele Punkte auf einer Liste — dann hakt niemand mehr ab, sondern
    klickt durch. Deshalb Rhythmus und Deckel.
  * „nicht gezaehlt" als „in Ordnung" zu lesen (Wurzel 4).
  * Bei jedem Turnover eine neue Nachfuell-Aufgabe (Wurzel 2).
"""
from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace
from typing import Any

from src.features.tasks.inventur import (
    MAX_ZAEHLPUNKTE,
    zaehle_menge,
    zaehlpunkte_fuer_abreise,
)

TID = "t1"
PID = "11111111-1111-4111-8111-111111111111"
IID = "22222222-2222-4222-8222-222222222222"
CID = "33333333-3333-4333-8333-333333333333"
HEUTE = date(2026, 9, 10)


class _Kette:
    def __init__(self, tabelle: str, daten: Any, protokoll: list[tuple]) -> None:
        self._tabelle = tabelle
        self._daten = daten
        self._protokoll = protokoll

    def insert(self, werte: Any) -> "_Kette":
        self._protokoll.append(("insert", self._tabelle, werte))
        self._daten = [{**werte, "id": "neu-1"}] if isinstance(werte, dict) else werte
        return self

    def update(self, werte: Any) -> "_Kette":
        self._protokoll.append(("update", self._tabelle, werte))
        return self

    def __getattr__(self, _name: str) -> "_Kette":
        return self

    def __call__(self, *_a: object, **_k: object) -> "_Kette":
        return self

    def execute(self) -> SimpleNamespace:
        return SimpleNamespace(data=self._daten)


class _DB:
    def __init__(self, tabellen: dict[str, Any], protokoll: list[tuple]) -> None:
        self._tabellen = tabellen
        self._protokoll = protokoll

    def table(self, name: str) -> _Kette:
        return _Kette(name, self._tabellen.get(name, []), self._protokoll)


def _zeile(**felder: Any) -> dict:
    return {
        "id": IID,
        "name": "Weinglas",
        "soll_menge": 6,
        "zaehl_rhythmus": "jede_abreise",
        "zuletzt_gezaehlt_am": None,
        "art": "bestand",
        "meldebestand": None,
        "room_id": None,
        "nachfuell_task_id": None,
        **felder,
    }


def _db(zeilen: list[dict], **rest: Any) -> tuple[_DB, list[tuple]]:
    prot: list[tuple] = []
    tab = {"inventory_items": zeilen, "checklist_items": [], "tasks": []}
    tab.update(rest)
    return _DB(tab, prot), prot


# --- Rhythmus: wer landet auf der Abreise-Liste? -----------------------------
def test_jede_abreise_ist_immer_dabei() -> None:
    db, _ = _db([_zeile()])
    punkte = zaehlpunkte_fuer_abreise(db, TID, PID, heute=HEUTE)
    assert len(punkte) == 1
    assert punkte[0]["inventory_item_id"] == IID


def test_soll_menge_steht_im_label() -> None:
    """„Weinglas (6)" ist zaehlbar, „Weinglas" nicht."""
    db, _ = _db([_zeile()])
    assert zaehlpunkte_fuer_abreise(db, TID, PID, heute=HEUTE)[0]["label"] == (
        "Weinglas (6)"
    )


def test_ohne_soll_steht_nur_der_name() -> None:
    db, _ = _db([_zeile(soll_menge=None)])
    assert zaehlpunkte_fuer_abreise(db, TID, PID, heute=HEUTE)[0]["label"] == (
        "Weinglas"
    )


def test_quartalszeile_erst_nach_90_tagen() -> None:
    """Sonst stuenden 200 Zeilen auf jeder Abreise und niemand haekt ab."""
    frisch = (
        datetime(2026, 9, 1, tzinfo=UTC)
    ).isoformat()
    db, _ = _db([_zeile(zaehl_rhythmus="quartal", zuletzt_gezaehlt_am=frisch)])
    assert zaehlpunkte_fuer_abreise(db, TID, PID, heute=HEUTE) == []

    alt = (datetime(2026, 9, 10, tzinfo=UTC) - timedelta(days=100)).isoformat()
    db2, _ = _db([_zeile(zaehl_rhythmus="quartal", zuletzt_gezaehlt_am=alt)])
    assert len(zaehlpunkte_fuer_abreise(db2, TID, PID, heute=HEUTE)) == 1


def test_nie_gezaehlt_ist_faellig_nicht_frisch() -> None:
    """Wurzel 4: nicht gezaehlt ist nicht dasselbe wie gezaehlt und in Ordnung."""
    db, _ = _db([_zeile(zaehl_rhythmus="jaehrlich", zuletzt_gezaehlt_am=None)])
    assert len(zaehlpunkte_fuer_abreise(db, TID, PID, heute=HEUTE)) == 1


def test_unlesbarer_zeitstempel_gilt_als_faellig() -> None:
    db, _ = _db([_zeile(zaehl_rhythmus="quartal", zuletzt_gezaehlt_am="kaputt")])
    assert len(zaehlpunkte_fuer_abreise(db, TID, PID, heute=HEUTE)) == 1


def test_nie_kommt_nie_auf_die_liste() -> None:
    db, _ = _db([_zeile(zaehl_rhythmus="nie")])
    assert zaehlpunkte_fuer_abreise(db, TID, PID, heute=HEUTE) == []


def test_deckel_greift_und_abreise_zeilen_gewinnen() -> None:
    """Wurzel 8. Und: wird gedeckelt, fallen die SELTENEREN Rhythmen heraus —
    nicht die, die bei jeder Abreise dran sind."""
    viele = [
        _zeile(id=f"j-{i}", name=f"Jahr {i}", zaehl_rhythmus="jaehrlich")
        for i in range(MAX_ZAEHLPUNKTE + 10)
    ]
    viele.append(_zeile(id="wichtig", name="Fernbedienung"))
    db, _ = _db(viele)
    punkte = zaehlpunkte_fuer_abreise(db, TID, PID, heute=HEUTE)
    assert len(punkte) == MAX_ZAEHLPUNKTE
    assert any(p["inventory_item_id"] == "wichtig" for p in punkte)


def test_ohne_objekt_keine_punkte() -> None:
    db, _ = _db([_zeile()])
    assert zaehlpunkte_fuer_abreise(db, TID, None, heute=HEUTE) == []


def test_zaehlpunkt_verlangt_kein_foto() -> None:
    """25 Pflichtfotos je Turnover waeren das Ende der Zaehlung. Das Foto
    verlangt der Schadensweg, wenn wirklich etwas fehlt."""
    db, _ = _db([_zeile()])
    assert zaehlpunkte_fuer_abreise(db, TID, PID, heute=HEUTE)[0]["requires_photo"] is (
        False
    )


# --- Zaehlen: Ist-Stand, Fehlbestand, Nachschub ------------------------------
def test_zaehlung_fuehrt_den_ist_stand_nach() -> None:
    db, prot = _db([_zeile()])
    ergebnis = zaehle_menge(
        db, TID, item_id=CID, inventory_item_id=IID, property_id=PID,
        menge=4, user_id="u1",
    )
    assert ergebnis["gezaehlt"] == 4
    assert ergebnis["fehlbestand"] == 2
    inv = [e for e in prot if e[0] == "update" and e[1] == "inventory_items"]
    assert inv and inv[0][2]["quantity"] == 4
    assert inv[0][2]["zuletzt_gezaehlt_am"], "sonst bleibt die Zeile ewig faellig"


def test_menge_steht_auch_am_checklistenpunkt() -> None:
    """Der Beleg: WER hat WANN WAS gezaehlt."""
    db, prot = _db([_zeile()])
    zaehle_menge(
        db, TID, item_id=CID, inventory_item_id=IID, property_id=PID,
        menge=5, user_id="u1",
    )
    punkt = [e for e in prot if e[0] == "update" and e[1] == "checklist_items"]
    assert punkt and punkt[0][2]["gezaehlte_menge"] == 5


def test_ohne_soll_kein_fehlbestand() -> None:
    """Wurzel 4: ohne gepflegtes Soll fehlt nichts — nicht „alles fehlt"."""
    db, _ = _db([_zeile(soll_menge=None)])
    ergebnis = zaehle_menge(
        db, TID, item_id=CID, inventory_item_id=IID, property_id=PID,
        menge=0, user_id="u1",
    )
    assert ergebnis["fehlbestand"] == 0


def test_meldebestand_unterschritten_legt_aufgabe_an() -> None:
    db, prot = _db([_zeile(name="Handtuch", soll_menge=12, meldebestand=4)])
    ergebnis = zaehle_menge(
        db, TID, item_id=CID, inventory_item_id=IID, property_id=PID,
        menge=3, user_id="u1",
    )
    assert ergebnis["nachfuellen"] is True
    aufgabe = [e for e in prot if e[0] == "insert" and e[1] == "tasks"]
    assert aufgabe, "eine Nachfuell-Aufgabe muss entstehen"
    # Die Zahlen im Titel: sonst muss die Person erst nachsehen, wie viele
    # fehlen.
    assert "3 von 12" in aufgabe[0][2]["title"]
    assert aufgabe[0][2]["property_id"] == PID


def test_ueber_dem_meldebestand_passiert_nichts() -> None:
    db, prot = _db([_zeile(soll_menge=12, meldebestand=4)])
    ergebnis = zaehle_menge(
        db, TID, item_id=CID, inventory_item_id=IID, property_id=PID,
        menge=9, user_id="u1",
    )
    assert ergebnis["nachfuellen"] is False
    assert not [e for e in prot if e[0] == "insert" and e[1] == "tasks"]


def test_ohne_meldebestand_keine_aufgabe() -> None:
    """NULL heisst „nicht gepflegt", nicht „melde immer"."""
    db, prot = _db([_zeile(soll_menge=12, meldebestand=None)])
    zaehle_menge(
        db, TID, item_id=CID, inventory_item_id=IID, property_id=PID,
        menge=0, user_id="u1",
    )
    assert not [e for e in prot if e[0] == "insert" and e[1] == "tasks"]


def test_offene_nachfuell_aufgabe_wird_nicht_verdoppelt() -> None:
    """Wurzel 2: nach drei Abreisen stuenden sonst drei gleiche Aufgaben da."""
    db, prot = _db(
        [_zeile(soll_menge=12, meldebestand=4, nachfuell_task_id="task-1")],
        tasks=[{"id": "task-1", "status": "open"}],
    )
    ergebnis = zaehle_menge(
        db, TID, item_id=CID, inventory_item_id=IID, property_id=PID,
        menge=2, user_id="u1",
    )
    assert ergebnis["nachfuellen"] is False
    assert not [e for e in prot if e[0] == "insert" and e[1] == "tasks"]


def test_erledigte_nachfuell_aufgabe_erlaubt_eine_neue() -> None:
    """Der umgekehrte Fehler, und der stille: sonst gaebe es nach dem ersten
    Nachfuellen nie wieder eine Meldung."""
    db, prot = _db(
        [_zeile(soll_menge=12, meldebestand=4, nachfuell_task_id="task-1")],
        tasks=[{"id": "task-1", "status": "done"}],
    )
    ergebnis = zaehle_menge(
        db, TID, item_id=CID, inventory_item_id=IID, property_id=PID,
        menge=2, user_id="u1",
    )
    assert ergebnis["nachfuellen"] is True
    assert [e for e in prot if e[0] == "insert" and e[1] == "tasks"]


def test_entfernter_gegenstand_kippt_die_zaehlung_nicht() -> None:
    """Die Zahl am Punkt bleibt der Beleg, dass gezaehlt wurde."""
    db, prot = _db([])
    ergebnis = zaehle_menge(
        db, TID, item_id=CID, inventory_item_id=IID, property_id=PID,
        menge=3, user_id="u1",
    )
    assert ergebnis["gezaehlt"] == 3
    assert ergebnis["nachfuellen"] is False
    assert [e for e in prot if e[0] == "update" and e[1] == "checklist_items"]


def test_negative_menge_wird_zu_null() -> None:
    db, prot = _db([_zeile()])
    ergebnis = zaehle_menge(
        db, TID, item_id=CID, inventory_item_id=IID, property_id=PID,
        menge=-5, user_id="u1",
    )
    assert ergebnis["gezaehlt"] == 0
