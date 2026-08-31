"""Zusatzleistungen uebersetzen.

Der Kern dieser Tests ist die ZAHL der Modellaufrufe, nicht der Text. Live
tragen 61 Zeilen nur fuenf verschiedene Namen (gemessen 31.08.2026); zeilenweise
uebersetzt waeren das 1403 bezahlte Aufrufe statt 115. Ein Test, der nur prueft
„es steht jetzt etwas auf Daenisch drin", waere gruen geblieben, waehrend die
Rechnung um das Zwoelffache stieg.
"""
from __future__ import annotations

import json

import pytest

from src.core.ki import KiAntwort, KiError
from src.features.addons.uebersetzung import (
    AddonUebersetzungError,
    addon_uebersetzen,
    gleiche_quelltexte,
)

from .test_addons import _DB


class _FakeClient:
    """Vertex-Ersatz, der mitzaehlt und aufzeichnet, wonach gefragt wurde."""

    def __init__(
        self,
        *,
        fehler_bei: set[str] | None = None,
        abschlussgrund: str = "STOP",
    ) -> None:
        self.abschlussgrund = abschlussgrund
        self.aufrufe = 0
        self.prompts: list[str] = []
        self._fehler_bei = fehler_bei or set()
        self.is_configured = True
        self.modell = "gemini-test"
        self.region = "europe-west4"

    def erzeuge(
        self, *, system: str, user: str, temperature: float, max_tokens: int
    ) -> KiAntwort:
        self.aufrufe += 1
        self.prompts.append(system)
        eingabe = json.loads(user)
        for marker in self._fehler_bei:
            if marker in system:
                raise KiError("Modell nicht erreichbar", status_code=502)
        antwort = {"name": f"[x] {eingabe['name']}"}
        if "description" in eingabe:
            antwort["description"] = f"[x] {eingabe['description']}"
        return KiAntwort(
            text=json.dumps(antwort, ensure_ascii=False),
            modell=self.modell,
            region=self.region,
            tokens_ein=10,
            tokens_aus=10,
            dauer_ms=5,
            abschlussgrund=self.abschlussgrund,
        )


def _zeile(zid: str, prop: str, *, name: dict, beschreibung: dict | None = None) -> dict:
    return {
        "id": zid,
        "property_id": prop,
        "name": name,
        "description": beschreibung if beschreibung is not None else {},
    }


# --- Der eigentliche Zweck: ein Aufruf je Sprache, nicht je Zeile ------------

def test_geschwister_teilen_einen_aufruf() -> None:
    """Zwanzig Zeilen mit demselben Namen kosten NICHT zwanzigmal.

    Das ist der Test, um den es geht: `geschwister` bekommen die fertige
    Fassung geschrieben, ohne dass ein zweiter Aufruf laeuft.
    """
    haupt = _zeile("a-1", "p-1", name={"de": "Babybett faltbar"})
    andere = [
        _zeile(f"a-{i}", f"p-{i}", name={"de": "Babybett faltbar"})
        for i in range(2, 21)
    ]
    db = _DB({"property_addons": [haupt, *andere]})
    client = _FakeClient()

    lauf, antworten = addon_uebersetzen(
        client, db, haupt, ["da", "sv"], quelle="de", geschwister=andere
    )

    # Zwei Sprachen, zwanzig Zeilen -> ZWEI Aufrufe.
    assert client.aufrufe == 2
    assert len(antworten) == 2
    assert lauf.uebersetzt == ["da", "sv"]
    # Alle zwanzig Zeilen wurden geschrieben.
    assert lauf.zeilen == 20
    for row in db.tables["property_addons"]:
        assert row["name"]["da"] == "[x] Babybett faltbar"
        assert row["name"]["sv"] == "[x] Babybett faltbar"


def test_alle_geschwister_bekommen_denselben_text() -> None:
    """Dasselbe Babybett darf nicht zwanzig verschiedene Namen haben."""
    haupt = _zeile("a-1", "p-1", name={"de": "Wäschepaket"})
    andere = [_zeile("a-2", "p-2", name={"de": "Wäschepaket"})]
    db = _DB({"property_addons": [haupt, *andere]})

    addon_uebersetzen(
        _FakeClient(), db, haupt, ["da"], quelle="de", geschwister=andere
    )

    namen = {r["name"]["da"] for r in db.tables["property_addons"]}
    assert len(namen) == 1


# --- Kein Ueberschreiben: „vorhanden" ist die menschliche Entscheidung -------

def test_gefuellte_sprache_bleibt_unangetastet() -> None:
    """Eine von Hand eingetragene Fassung wird nicht ersetzt.

    Es gibt hier keine `geprueft`-Spalte (anders als bei den Aufgabenregeln):
    dass ein Wert DA ist, IST das Signal. Ihn zu ueberschreiben waere stiller
    Datenverlust.
    """
    haupt = _zeile(
        "a-1", "p-1", name={"de": "Wäschepaket", "en": "Linen package"}
    )
    db = _DB({"property_addons": [haupt]})
    client = _FakeClient()

    lauf, _ = addon_uebersetzen(client, db, haupt, ["en", "da"], quelle="de")

    assert lauf.vorhanden == ["en"]
    assert lauf.uebersetzt == ["da"]
    assert client.aufrufe == 1
    assert db.tables["property_addons"][0]["name"]["en"] == "Linen package"


def test_quellsprache_wird_uebersprungen() -> None:
    """Die Ausgangssprache steht schon in der Karte — keine zweite Wahrheit."""
    haupt = _zeile("a-1", "p-1", name={"de": "Kinderhochstuhl"})
    db = _DB({"property_addons": [haupt]})
    client = _FakeClient()

    lauf, _ = addon_uebersetzen(client, db, haupt, ["de", "da"], quelle="de")

    assert "de" not in lauf.uebersetzt
    assert client.aufrufe == 1


# --- Wurzel 1: die Karte wird ergaenzt, nicht ersetzt ------------------------

def test_bestehende_sprachen_der_geschwister_bleiben() -> None:
    """Ein Geschwister mit eigener Fassung verliert sie nicht.

    Geschwister sind nur im QUELLTEXT gleich, nicht im Rest ihrer Karte. Ein
    pauschales Ueberschreiben verloere, was auf dieser Zeile schon stand.
    """
    haupt = _zeile("a-1", "p-1", name={"de": "Wäschepaket"})
    geschwister = _zeile(
        "a-2", "p-2", name={"de": "Wäschepaket", "fr": "Linge de maison"}
    )
    db = _DB({"property_addons": [haupt, geschwister]})

    addon_uebersetzen(
        _FakeClient(), db, haupt, ["da"], quelle="de", geschwister=[geschwister]
    )

    zweite = next(r for r in db.tables["property_addons"] if r["id"] == "a-2")
    assert zweite["name"]["fr"] == "Linge de maison"
    assert zweite["name"]["da"] == "[x] Wäschepaket"


def test_beschreibung_wird_mituebersetzt() -> None:
    """Der Gast entscheidet an der Beschreibung, ob er kauft."""
    haupt = _zeile(
        "a-1",
        "p-1",
        name={"de": "Wäschepaket"},
        beschreibung={"de": "1 Bettbezug, 1 Laken 90x200"},
    )
    db = _DB({"property_addons": [haupt]})

    addon_uebersetzen(_FakeClient(), db, haupt, ["da"], quelle="de")

    row = db.tables["property_addons"][0]
    assert row["description"]["da"] == "[x] 1 Bettbezug, 1 Laken 90x200"


def test_zeile_ohne_beschreibung_bekommt_keine() -> None:
    """Eine Zeile ohne Beschreibung erbt nicht die des Geschwisters."""
    haupt = _zeile(
        "a-1", "p-1", name={"de": "Wäschepaket"}, beschreibung={"de": "1 Laken"}
    )
    ohne = _zeile("a-2", "p-2", name={"de": "Wäschepaket"}, beschreibung={})
    db = _DB({"property_addons": [haupt, ohne]})

    addon_uebersetzen(
        _FakeClient(), db, haupt, ["da"], quelle="de", geschwister=[ohne]
    )

    zweite = next(r for r in db.tables["property_addons"] if r["id"] == "a-2")
    assert "da" not in zweite["description"]


# --- Wurzel 5: Fehler benennen, nicht verschlucken --------------------------

def test_fehler_in_einer_sprache_kostet_nur_diese() -> None:
    """Ein 502 auf Daenisch darf die schwedische Fassung nicht kosten."""
    haupt = _zeile("a-1", "p-1", name={"de": "Kinderhochstuhl"})
    db = _DB({"property_addons": [haupt]})
    # Der Fake wirft, wenn der Sprachname im System-Prompt steht.
    client = _FakeClient(fehler_bei={"Dänisch"})

    lauf, _ = addon_uebersetzen(client, db, haupt, ["da", "sv"], quelle="de")

    assert "da" in lauf.fehlgeschlagen
    assert lauf.uebersetzt == ["sv"]
    assert db.tables["property_addons"][0]["name"]["sv"]
    assert "da" not in db.tables["property_addons"][0]["name"]


def test_deckel_wird_vor_jedem_aufruf_geprueft() -> None:
    """Nicht einmal vorab: 23 Sprachen sind 23 Aufrufe."""
    haupt = _zeile("a-1", "p-1", name={"de": "Frühstück"})
    db = _DB({"property_addons": [haupt]})
    zaehler = {"n": 0}

    def deckel() -> None:
        zaehler["n"] += 1
        if zaehler["n"] > 2:
            raise KiError("Tageslimit erreicht", status_code=429)

    client = _FakeClient()
    with pytest.raises(KiError):
        addon_uebersetzen(
            client, db, haupt, ["da", "sv", "fi", "nl"], quelle="de", deckel=deckel
        )
    # Zwei Aufrufe durchgelassen, dann gestoppt — nicht alle vier.
    assert client.aufrufe == 2


def test_abgeschnittene_antwort_wird_nicht_gespeichert() -> None:
    """MAX_TOKENS heisst: mitten im Satz am Budget — nicht speichern.

    Hier waere das Speichern schlimmer als bei den Website-Seiten (0476): dort
    markiert ein abweichender Hash die Fassung noch als veraltet. HIER ist der
    Riegel „die Sprache ist gefuellt", ein halber Satz gaelte damit als
    menschliche Entscheidung und wuerde NIE wieder angefasst.
    """
    haupt = _zeile("a-1", "p-1", name={"de": "Wäschepaket"})
    db = _DB({"property_addons": [haupt]})
    client = _FakeClient(abschlussgrund="MAX_TOKENS")

    lauf, antworten = addon_uebersetzen(client, db, haupt, ["da"], quelle="de")

    assert lauf.uebersetzt == []
    assert "da" in lauf.fehlgeschlagen
    assert antworten == []
    assert "da" not in db.tables["property_addons"][0]["name"]


def test_fehlender_quelltext_wirft() -> None:
    """Ohne Quelltext waere jede Uebersetzung geraten (Wurzel 4)."""
    haupt = _zeile("a-1", "p-1", name={"en": "Breakfast"})
    db = _DB({"property_addons": [haupt]})

    with pytest.raises(AddonUebersetzungError):
        addon_uebersetzen(_FakeClient(), db, haupt, ["da"], quelle="de")


def test_zu_langes_feld_ist_datenfehler() -> None:
    """Ein eingefuegter Roman ist kein Uebersetzungsauftrag (Wurzel 8)."""
    haupt = _zeile("a-1", "p-1", name={"de": "x" * 2001})
    db = _DB({"property_addons": [haupt]})

    with pytest.raises(AddonUebersetzungError):
        addon_uebersetzen(_FakeClient(), db, haupt, ["da"], quelle="de")


# --- Wurzel 3: die Buendelung darf nicht in fremde Betriebe greifen ---------

def test_gleiche_quelltexte_bleibt_im_tenant() -> None:
    """Zwei Betriebe mit demselben Wort sind nicht dieselbe Leistung."""
    eigen = _zeile("a-1", "p-1", name={"de": "Wäschepaket"})
    db = _DB(
        {
            "properties": [
                {"id": "p-1", "tenant_id": "t-1"},
                {"id": "p-2", "tenant_id": "t-1"},
                {"id": "p-9", "tenant_id": "t-FREMD"},
            ],
            "property_addons": [
                eigen,
                _zeile("a-2", "p-2", name={"de": "Wäschepaket"}),
                _zeile("a-9", "p-9", name={"de": "Wäschepaket"}),
            ],
        }
    )

    treffer = gleiche_quelltexte(db, "t-1", eigen, "de")

    ids = {r["id"] for r in treffer}
    assert ids == {"a-2"}


def test_gleiche_quelltexte_unterscheidet_beschreibungen() -> None:
    """Gleicher Name, andere Beschreibung = nicht dieselbe Leistung.

    Live gibt es zwei „Wäschepaket" mit unterschiedlichem Inhalt (eines mit
    „frisch aus der Wäscherei in Folie verpackt"). Sie zusammenzuwerfen hiesse,
    dem Gast den falschen Lieferumfang zu uebersetzen.
    """
    eigen = _zeile(
        "a-1", "p-1", name={"de": "Wäschepaket"}, beschreibung={"de": "1 Laken"}
    )
    db = _DB(
        {
            "properties": [
                {"id": "p-1", "tenant_id": "t-1"},
                {"id": "p-2", "tenant_id": "t-1"},
            ],
            "property_addons": [
                eigen,
                _zeile(
                    "a-2",
                    "p-2",
                    name={"de": "Wäschepaket"},
                    beschreibung={"de": "2 Laken, in Folie"},
                ),
            ],
        }
    )

    assert gleiche_quelltexte(db, "t-1", eigen, "de") == []
