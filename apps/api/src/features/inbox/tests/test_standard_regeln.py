"""Der Standard-Regelsatz eines neuen Betriebs.

Zwei Eigenschaften entscheiden hier alles, und beide sind unsichtbar, wenn man
sie nicht prüft:

* **Inaktiv.** Ein Vorschlag, der von selbst sendet, ist kein Vorschlag. Stünde
  `is_active` auf true, verschickte ein frisch registrierter Betrieb ab der
  ersten Buchung Nachrichten in unserem Wortlaut an seine Gäste — ohne sie je
  gelesen zu haben.
* **Idempotent.** Die Anlage läuft best-effort im Nebenpfad der Registrierung
  und kann wiederholt werden (Retry, manueller Nachtrag). Ein zweiter Satz
  wäre für den Betrieb nicht als Dublette erkennbar, sondern als doppelte
  Nachricht beim Gast.

Dazu die Platzhalter: sie müssen aus `felder.FELDER` stammen. Ein erfundener
Schlüssel fällt weder ruff noch pytest auf — er scheitert erst beim Versand an
`FeldFehlt`, und zwar bei jedem Gast.
"""

from __future__ import annotations

import re
from typing import Any

from src.core.mail_sprache import SUPPORTED
from src.core.mail_texte import text as mail_text
from src.features.inbox.felder import FELDER, MUSTER
from src.features.inbox.standard_regeln import REGELN, standard_regeln_anlegen

SCHLUESSEL = {f.schluessel for f in FELDER}


class _Res:
    def __init__(self, data: list) -> None:
        self.data = data


class _Query:
    def __init__(self, db: _FakeDb, tabelle: str) -> None:
        self._db = db
        self._tabelle = tabelle
        self._modus = "select"
        self._werte: Any = None

    def select(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def eq(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def in_(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def order(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def limit(self, *_a: Any, **_k: Any) -> _Query:
        return self

    def insert(self, werte: dict) -> _Query:
        self._modus = "insert"
        self._werte = werte
        return self

    def upsert(self, werte: list, **_k: Any) -> _Query:
        self._modus = "upsert"
        self._werte = werte
        return self

    def delete(self) -> _Query:
        self._modus = "delete"
        return self

    def execute(self) -> _Res:
        tabelle = self._db.tabellen.setdefault(self._tabelle, [])
        if self._modus == "insert":
            zeile = {"id": f"r{len(tabelle) + 1}", **self._werte}
            tabelle.append(zeile)
            return _Res([zeile])
        if self._modus == "upsert":
            tabelle.extend(self._werte)
            return _Res(list(self._werte))
        if self._modus == "delete":
            return _Res([])
        return _Res([dict(z) for z in tabelle])


class _FakeDb:
    def __init__(self, **tabellen: list) -> None:
        self.tabellen: dict[str, list] = dict(tabellen)

    def table(self, name: str) -> _Query:
        return _Query(self, name)


def test_vier_inaktive_regeln_entstehen() -> None:
    db = _FakeDb()

    anzahl = standard_regeln_anlegen(db, "t1", "de")

    assert anzahl == len(REGELN) == 4
    regeln = db.tabellen["message_automation"]
    assert [r["trigger"] for r in regeln] == [t for t, *_ in REGELN]
    assert all(r["is_active"] is False for r in regeln), (
        "ein Vorschlag darf nicht von selbst senden"
    )
    assert all(r["tenant_id"] == "t1" for r in regeln)
    # „alle Objekte / alle Kanäle" heißt NULL, nicht eine erfundene Auswahl.
    assert all(r["property_ids"] is None and r["channels"] is None for r in regeln)


def test_zweiter_aufruf_legt_nichts_nach() -> None:
    """Wurzel 2: der Nebenpfad der Registrierung ist wiederholbar."""
    db = _FakeDb()
    standard_regeln_anlegen(db, "t1", "de")
    vorher = len(db.tabellen["message_automation"])

    assert standard_regeln_anlegen(db, "t1", "de") == 0
    assert len(db.tabellen["message_automation"]) == vorher


def test_versatz_und_uhrzeit_stimmen() -> None:
    """Das Vorzeichen gehört dem Auslöser (0307), nicht der Tabelle hier."""
    db = _FakeDb()
    standard_regeln_anlegen(db, "t1", "de")
    nach_trigger = {r["trigger"]: r for r in db.tabellen["message_automation"]}

    assert nach_trigger["booking_new"]["offset_value"] == 5
    assert nach_trigger["booking_new"]["offset_unit"] == "minutes"
    assert nach_trigger["booking_new"]["send_time"] is None
    # „einen Tag VOR der Anreise" → negativ, abgeleitet aus dem Auslöser.
    assert nach_trigger["before_checkin"]["offset_value"] == -1
    assert nach_trigger["before_checkin"]["anchor"] == "arrival"
    assert nach_trigger["before_checkin"]["send_time"] == "18:00"
    # Tages-Auslöser: AM Ankertag, kein Abstand.
    assert nach_trigger["on_checkin"]["offset_value"] == 0
    assert nach_trigger["on_checkout"]["offset_value"] == 0
    assert nach_trigger["on_checkout"]["anchor"] == "departure"
    # Eine Uhrzeit ist nur in der Zeitzone des Objekts eine Aussage.
    assert nach_trigger["on_checkin"]["use_property_timezone"] is True
    assert nach_trigger["booking_new"]["use_property_timezone"] is True


def test_grundfassung_und_sprachfassung_stehen_beide() -> None:
    """Ohne Grundfassung bekäme ein Gast fremder Sprache gar nichts.

    `sprachen.fassung_waehlen` fällt am Ende genau dorthin zurück; ohne die
    Sprachfassung wiederum wäre der Text im Sprach-Reiter nicht pflegbar.
    """
    db = _FakeDb()
    standard_regeln_anlegen(db, "t1", "da")

    for regel in db.tabellen["message_automation"]:
        assert regel["message"], "Grundfassung fehlt"
        assert regel["subject"], "Betreff fehlt"
    fassungen = db.tabellen["message_automation_text"]
    assert len(fassungen) == len(REGELN)
    assert {f["lang"] for f in fassungen} == {"da"}
    assert all(f["tenant_id"] == "t1" for f in fassungen)


def test_nur_bekannte_platzhalter_im_katalog() -> None:
    """Ein erfundener Platzhalter scheitert erst beim Gast — hier statt dort."""
    unbekannt: set[str] = set()
    for trigger, *_rest in REGELN:
        for teil in ("betreff", "text"):
            for sprache in SUPPORTED:
                roh = mail_text(f"standardregeln.{trigger}.{teil}", sprache)
                unbekannt |= {
                    re.sub(r"\s+", "", t) for t in MUSTER.findall(roh)
                } - SCHLUESSEL
    assert not unbekannt, f"unbekannte Platzhalter: {sorted(unbekannt)}"


def test_jede_sprache_traegt_dieselben_platzhalter() -> None:
    """Gemini hat `{{feld}}` schon zu `{feld}` zusammengezogen (14.09.2026).

    Der NAME blieb dabei stehen, die zweite Klammer fiel weg — `MUSTER` erkennt
    das nicht mehr als Platzhalter, und der Gast läse wörtlich
    „{property_name}". Kein Gate schlägt dabei an; nur dieser Vergleich tut es.
    """
    for trigger, *_rest in REGELN:
        for teil in ("betreff", "text"):
            schluessel = f"standardregeln.{trigger}.{teil}"
            soll = set(MUSTER.findall(mail_text(schluessel, "de")))
            for sprache in SUPPORTED:
                ist = set(MUSTER.findall(mail_text(schluessel, sprache)))
                assert ist == soll, f"{schluessel} / {sprache}"
