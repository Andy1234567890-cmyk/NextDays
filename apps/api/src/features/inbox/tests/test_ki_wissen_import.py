"""Tests des PDF-Imports — vor allem der Grenzen und der Prüfstufe.

Der teuerste Fehler hier ist NICHT ein abgelehntes Dokument, sondern ein
angenommenes: Wer ein PDF ungeprüft in die Wissensdatenbank lässt, macht die KI
zur Sprecherin eines Textes, den niemand gelesen hat. Deshalb legt der Leseweg
KEINE Fakten an — das prüfen die Tests hier ausdrücklich.

Der zweite ist ein Deckel, der nicht greift: Ein 200-Seiten-PDF durch Gemini ist
der teuerste Einzelaufruf im Produkt.
"""

from __future__ import annotations

import pytest

from src.core.ki import KiAntwort
from src.features.inbox.errors import InboxError
from src.features.inbox.ki_wissen_import import (
    MAX_BYTES,
    MAX_UEBERNEHMEN,
    MAX_VORSCHLAEGE,
    KiWissenImportMixin,
    _dateiname_saeubern,
    _json_liste,
    _warnung,
)
from src.features.inbox.schemas import WissenImportVorschlag

_PDF = b"%PDF-1.4\nirgendwas"


class _Res:
    def __init__(self, data: list, count: int | None = None) -> None:
        self.data = data
        self.count = count


class _Query:
    def __init__(self, db: _FakeDb, tabelle: str) -> None:
        self._db = db
        self._tabelle = tabelle
        self._rows = list(db.tabellen.get(tabelle, []))

    def select(self, *_a, **_k) -> _Query:
        return self

    def eq(self, *_a) -> _Query:
        return self

    def limit(self, *_a) -> _Query:
        return self

    def insert(self, werte) -> _Query:
        self._db.inserts.append((self._tabelle, werte))
        if isinstance(werte, list):
            self._rows = [{**w, "id": f"neu{i}"} for i, w in enumerate(werte)]
        else:
            self._rows = [{**werte, "id": "neu1"}]
        return self

    def execute(self) -> _Res:
        return _Res(self._rows, len(self._rows))


class _Storage:
    def __init__(self, db: _FakeDb) -> None:
        self._db = db

    def from_(self, bucket: str) -> _Storage:
        self._bucket = bucket
        return self

    def upload(self, pfad: str, inhalt: bytes, _opts: dict) -> None:
        self._db.uploads.append((self._bucket, pfad, len(inhalt)))


class _FakeDb:
    def __init__(self, **tabellen: list) -> None:
        self.tabellen = tabellen
        self.inserts: list[tuple] = []
        self.uploads: list[tuple] = []
        self.storage = _Storage(self)

    def table(self, name: str) -> _Query:
        return _Query(self, name)


class _Ctx:
    tenant_id = "t1"
    user_id = "u1"


class _KiDouble:
    """Liefert eine feste Antwort und zählt die Aufrufe."""

    def __init__(self, text: str) -> None:
        self.text = text
        self.aufrufe = 0

    def erzeuge_multimodal(self, **_k) -> KiAntwort:
        self.aufrufe += 1
        return KiAntwort(
            text=self.text,
            modell="m",
            region="europe-west4",
            tokens_ein=1,
            tokens_aus=1,
            dauer_ms=10,
            abschlussgrund="STOP",
        )


class _Dienst(KiWissenImportMixin):
    def __init__(self, db: _FakeDb) -> None:
        self._db = db

    def _require(self, ctx):  # noqa: ANN001
        return self._db, ctx.tenant_id

    def _own_property(self, db, tenant_id, property_id) -> None:  # noqa: ANN001
        if property_id == "fremd":
            raise InboxError("Objekt nicht gefunden.", status_code=404)


def _db() -> _FakeDb:
    return _FakeDb(ki_wissen_quelle=[], inbox_knowledge_fact=[], site_ai_usage=[])


# --- Die Prüfstufe: LESEN legt nichts an ------------------------------------
def test_lesen_legt_keine_fakten_an() -> None:
    """Der Kern des zweistufigen Imports. Ohne diesen Test rutscht der
    Einzeiler `insert` beim nächsten Umbau wieder mit hinein."""
    db = _db()
    ki = _KiDouble('[{"titel":"Ruhezeiten","text":"22 bis 7 Uhr.","kategorie":"anreise"}]')
    vorschau = _Dienst(db).wissen_dokument_lesen(
        _Ctx(), inhalt=_PDF, dateiname="haus.pdf", property_id=None, client=ki
    )
    assert len(vorschau.items) == 1
    assert not [t for t, _ in db.inserts if t == "inbox_knowledge_fact"]


def test_lesen_legt_die_quelle_an() -> None:
    """Die Quelle entsteht sofort — sie trägt die Datei, nicht die Fakten.
    Ein zweiter Anlauf soll dieselbe Datei nicht doppelt hochladen."""
    db = _db()
    _Dienst(db).wissen_dokument_lesen(
        _Ctx(),
        inhalt=_PDF,
        dateiname="haus.pdf",
        property_id="p1",
        client=_KiDouble("[]"),
    )
    quellen = [w for t, w in db.inserts if t == "ki_wissen_quelle"]
    assert quellen and quellen[0]["art"] == "dokument"
    assert quellen[0]["datei_name"] == "haus.pdf"
    assert db.uploads and db.uploads[0][0] == "ki-wissen-dokumente"


# --- Magic-Bytes und Grenzen (Wurzel 8) -------------------------------------
def test_nicht_pdf_wird_abgewiesen() -> None:
    """Der content_type des Clients ist frei wählbar und damit kein Schutz."""
    dienst = _Dienst(_db())
    with pytest.raises(InboxError) as exc:
        dienst.wissen_dokument_lesen(
            _Ctx(),
            inhalt=b"<html>gar kein PDF</html>",
            dateiname="haus.pdf",
            property_id=None,
            client=_KiDouble("[]"),
        )
    assert exc.value.status_code == 422


def test_zu_grosse_datei_wird_abgewiesen() -> None:
    dienst = _Dienst(_db())
    with pytest.raises(InboxError):
        dienst.wissen_dokument_lesen(
            _Ctx(),
            inhalt=_PDF + b"x" * MAX_BYTES,
            dateiname="haus.pdf",
            property_id=None,
            client=_KiDouble("[]"),
        )


def test_zu_grosse_datei_wird_gar_nicht_erst_hochgeladen() -> None:
    """Die Prüfung sitzt VOR dem Upload — sonst liegt die Datei schon."""
    db = _db()
    with pytest.raises(InboxError):
        _Dienst(db).wissen_dokument_lesen(
            _Ctx(),
            inhalt=_PDF + b"x" * MAX_BYTES,
            dateiname="haus.pdf",
            property_id=None,
            client=_KiDouble("[]"),
        )
    assert db.uploads == []


def test_fremdes_objekt_wird_abgewiesen() -> None:
    dienst = _Dienst(_db())
    with pytest.raises(InboxError) as exc:
        dienst.wissen_dokument_lesen(
            _Ctx(),
            inhalt=_PDF,
            dateiname="x.pdf",
            property_id="fremd",
            client=_KiDouble("[]"),
        )
    assert exc.value.status_code == 404


def test_vorschlaege_sind_gedeckelt() -> None:
    """Ein 400-seitiges Dokument darf nicht 400 Vorschläge erzeugen."""
    viele = ",".join(
        f'{{"titel":"T{i}","text":"Text {i}","kategorie":"sonstiges"}}'
        for i in range(MAX_VORSCHLAEGE + 20)
    )
    vorschau = _Dienst(_db()).wissen_dokument_lesen(
        _Ctx(),
        inhalt=_PDF,
        dateiname="x.pdf",
        property_id=None,
        client=_KiDouble(f"[{viele}]"),
    )
    assert len(vorschau.items) == MAX_VORSCHLAEGE


# --- Die Antwort des Modells lesen ------------------------------------------
def test_markdown_zaun_kippt_den_import_nicht() -> None:
    """Das Modell hält sich meistens an „nur JSON", aber nicht immer."""
    assert _json_liste('```json\n[{"a":1}]\n```') == [{"a": 1}]


def test_liste_in_einem_objekt_wird_gefunden() -> None:
    assert _json_liste('{"fakten": [{"a": 1}]}') == [{"a": 1}]


def test_kaputte_antwort_schlaegt_laut_fehl() -> None:
    """Kein stiller Rückfall auf eine leere Liste: der Betrieb hat ein
    Dokument hochgeladen und würde „0 Fakten gefunden" lesen (Wurzel 5)."""
    with pytest.raises(InboxError) as exc:
        _json_liste("Ich habe leider keinen Zugriff auf das Dokument.")
    assert exc.value.status_code == 502


def test_erfundene_kategorie_wird_zu_sonstiges() -> None:
    """Hier KEIN 422: das Modell hat sie erfunden, nicht der Betrieb — ein
    Fehlschlag würde den ganzen Import wegen eines Vorschlags kippen."""
    vorschau = _Dienst(_db()).wissen_dokument_lesen(
        _Ctx(),
        inhalt=_PDF,
        dateiname="x.pdf",
        property_id=None,
        client=_KiDouble('[{"titel":"T","text":"X","kategorie":"wlan"}]'),
    )
    assert vorschau.items[0].kategorie == "sonstiges"


def test_leerer_text_faellt_weg() -> None:
    vorschau = _Dienst(_db()).wissen_dokument_lesen(
        _Ctx(),
        inhalt=_PDF,
        dateiname="x.pdf",
        property_id=None,
        client=_KiDouble('[{"titel":"T","text":"   ","kategorie":"objekt"}]'),
    )
    assert vorschau.items == []


# --- Die Warnung ------------------------------------------------------------
@pytest.mark.parametrize(
    "text",
    [
        "Übernachtung ab 89 €",
        "Die Kaution beträgt 200 EUR.",
        "Reinigung 450 kr.",
        "Preis: 1.200,00 CHF",
    ],
)
def test_betraege_werden_gewarnt(text: str) -> None:
    """Ein alter Preis in der Wissensdatenbank ist eine falsche Zusage — und
    sie sieht aus wie eine richtige."""
    assert _warnung("Preise", text) == "betrag"


def test_jahreszahl_wird_gewarnt() -> None:
    assert _warnung("Preisliste 2024", "Gültig ab Januar") == "jahr"


@pytest.mark.parametrize(
    "text",
    ["Das WLAN heißt Gast.", "Nachtruhe ab 22 Uhr.", "Der Strand ist 300 m entfernt."],
)
def test_harmlose_fakten_werden_nicht_gewarnt(text: str) -> None:
    assert _warnung("Titel", text) is None


# --- Übernehmen -------------------------------------------------------------
def _vorschlag(**f) -> WissenImportVorschlag:
    return WissenImportVorschlag(**{"titel": "T", "fact": "Text", "kategorie": "objekt", **f})


def test_uebernehmen_legt_die_fakten_an() -> None:
    db = _FakeDb(
        ki_wissen_quelle=[{"id": "q1"}], inbox_knowledge_fact=[], site_ai_usage=[]
    )
    anzahl = _Dienst(db).wissen_import_uebernehmen(
        _Ctx(), quelle_id="q1", items=[_vorschlag(), _vorschlag()], property_id="p1"
    )
    assert anzahl == 2
    zeilen = [w for t, w in db.inserts if t == "inbox_knowledge_fact"][0]
    assert all(z["source"] == "document" and z["quelle_id"] == "q1" for z in zeilen)


def test_uebernehmen_ohne_auswahl_ist_kein_fehler() -> None:
    assert (
        _Dienst(_db()).wissen_import_uebernehmen(
            _Ctx(), quelle_id="q1", items=[], property_id=None
        )
        == 0
    )


def test_fremde_quelle_wird_abgewiesen() -> None:
    """Wurzel 3: ohne diese Prüfung liessen sich eigene Fakten als „aus deren
    Hausordnung" ausweisen."""
    db = _db()  # ki_wissen_quelle ist leer
    with pytest.raises(InboxError) as exc:
        _Dienst(db).wissen_import_uebernehmen(
            _Ctx(), quelle_id="fremd", items=[_vorschlag()], property_id=None
        )
    assert exc.value.status_code == 404


def test_uebernehmen_ist_gedeckelt() -> None:
    db = _FakeDb(ki_wissen_quelle=[{"id": "q1"}], inbox_knowledge_fact=[])
    with pytest.raises(InboxError) as exc:
        _Dienst(db).wissen_import_uebernehmen(
            _Ctx(),
            quelle_id="q1",
            items=[_vorschlag() for _ in range(MAX_UEBERNEHMEN + 1)],
            property_id=None,
        )
    assert exc.value.status_code == 422


# --- Dateiname --------------------------------------------------------------
@pytest.mark.parametrize(
    ("eingabe", "erwartet"),
    [
        # split("/")[-1] verwirft die Pfadanteile — genau das ist der Sinn.
        ("../../etc/passwd", "passwd.pdf"),
        ("Hausordnung 2026.pdf", "Hausordnung 2026.pdf"),
        ("mit\nZeilenumbruch.pdf", "mit_Zeilenumbruch.pdf"),
        ("", "dokument.pdf"),
        ("ohne-endung", "ohne-endung.pdf"),
    ],
)
def test_dateiname_saeubern(eingabe: str, erwartet: str) -> None:
    assert _dateiname_saeubern(eingabe) == erwartet
