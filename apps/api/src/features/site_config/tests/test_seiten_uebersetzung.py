"""Tests für die Sprachfassungen einer Website-Seite (0476).

Getestet wird, was UNSER Code entscheidet — nicht, ob das Modell gut übersetzt.

Die Auswahl folgt den Fehlern, die beim kritischen Gegenlesen gefunden wurden:
jeder Test hier steht für einen Bug, der real drin war.
"""
from __future__ import annotations

import pytest

from src.features.site_config import seiten_uebersetzung as su
from src.features.site_config.fehler import SiteConfigError
from src.features.site_config.ki_client import KiAntwort, KiError

from .test_site_config import _DB

TENANT = "tenant-a"
SEITE = {
    "id": "page-1",
    "tenant_id": TENANT,
    "title": "Kontakt",
    "seo_title": "Kontakt aufnehmen",
    "seo_description": "So erreichen Sie uns.",
    "seo_keywords": None,
    "excerpt": None,
    "og_image_alt": None,
}


def _antwort(text: str, abschluss: str = "STOP") -> KiAntwort:
    return KiAntwort(
        text=text,
        modell="gemini-2.5-flash",
        region="europe-west4",
        dauer_ms=10,
        tokens_ein=50,
        tokens_aus=20,
        abschlussgrund=abschluss,
    )


class _Client:
    """Ein Modell, das eine vorgegebene Folge von Antworten liefert."""

    is_configured = True
    modell = "gemini-2.5-flash"
    region = "europe-west4"

    def __init__(self, antworten: list) -> None:
        self._antworten = list(antworten)
        self.aufrufe = 0

    def erzeuge(self, **_kwargs) -> KiAntwort:  # noqa: ANN003
        self.aufrufe += 1
        naechste = self._antworten.pop(0)
        if isinstance(naechste, Exception):
            raise naechste
        return naechste


def _profil():  # noqa: ANN202
    from src.features.site_config.ki_profil import KiProfil

    return KiProfil()


# --- quelle_hash ------------------------------------------------------------


def test_hash_ist_stabil_und_feldgenau() -> None:
    """Der Hash ändert sich NUR, wenn sich ein Feld wirklich ändert.

    Er trägt die Idempotenz: ein zweiter Lauf mit unverändertem Text darf
    keinen Modellaufruf kosten.
    """
    a = su.quelle_hash(SEITE)
    assert a == su.quelle_hash(dict(SEITE))
    # `None` und `""` und „Feld fehlt ganz" sind derselbe Zustand: nichts da.
    ohne = {k: v for k, v in SEITE.items() if k != "excerpt"}
    assert su.quelle_hash(ohne) == a
    assert su.quelle_hash({**SEITE, "excerpt": ""}) == a
    # Eine echte Änderung schlägt durch.
    assert su.quelle_hash({**SEITE, "title": "Kontakt neu"}) != a


def test_hash_verwechselt_keine_feldgrenzen() -> None:
    """`ab`+`c` und `a`+`bc` dürfen nicht denselben Hash ergeben.

    Genau deshalb steht dort `json.dumps` und kein zusammengeklebter String.
    """
    eins = su.quelle_hash({**SEITE, "title": "ab", "seo_title": "c"})
    zwei = su.quelle_hash({**SEITE, "title": "a", "seo_title": "bc"})
    assert eins != zwei


# --- Der Lauf ---------------------------------------------------------------


def _db_mit(fassungen: list[dict]) -> _DB:
    return _DB({"site_page_translations": fassungen})


def test_unveraendert_kostet_keinen_aufruf() -> None:
    """Wurzel 2: derselbe Quelltext, kein zweiter Modellaufruf."""
    db = _db_mit(
        [
            {
                "page_id": "page-1",
                "sprache": "da",
                "title": "Kontakt",
                "geprueft": False,
                "quelle_hash": su.quelle_hash(SEITE),
            }
        ]
    )
    client = _Client([])
    lauf, antworten = su.seite_uebersetzen(
        client, db, TENANT, SEITE, "de", ["da"], _profil()
    )
    assert client.aufrufe == 0
    assert lauf.unveraendert == ["da"]
    assert antworten == []


def test_geprueft_wird_nicht_ueberschrieben() -> None:
    """Eine von Hand korrigierte Fassung bleibt stehen — auch wenn sich das
    Original geändert hat. Sie wird gemeldet, nicht angefasst."""
    db = _db_mit(
        [
            {
                "page_id": "page-1",
                "sprache": "da",
                "title": "Von Hand",
                "geprueft": True,
                "quelle_hash": "alter-hash",
            }
        ]
    )
    client = _Client([])
    lauf, _ = su.seite_uebersetzen(
        client, db, TENANT, SEITE, "de", ["da"], _profil()
    )
    assert client.aufrufe == 0
    assert lauf.geschuetzt == ["da"]
    assert lauf.uebersetzt == []


def test_ein_fehler_kostet_nur_seine_sprache() -> None:
    """Wurzel 5: ein 502 in Sprache 1 darf Sprache 2 nicht verhindern."""
    db = _db_mit([])
    client = _Client(
        [
            KiError("Modell kaputt", status_code=502),
            _antwort('{"title": "Kontakt"}'),
        ]
    )
    lauf, _ = su.seite_uebersetzen(
        client, db, TENANT, SEITE, "de", ["da", "en"], _profil()
    )
    assert lauf.fehlgeschlagen == {"da": "Modell kaputt"}
    assert lauf.uebersetzt == ["en"]


def test_unbekannte_sprache_beendet_den_lauf_nicht() -> None:
    """`sprache_benennen` wirft `SiteConfigError` — die Schleife muss sie
    genauso fangen wie `KiError`, sonst gehen die schon geschriebenen
    Fassungen verloren, ohne dass jemand davon erfährt."""
    db = _db_mit([])
    client = _Client([_antwort('{"title": "Kontakt"}')])
    lauf, _ = su.seite_uebersetzen(
        client, db, TENANT, SEITE, "de", ["xx", "en"], _profil()
    )
    assert "xx" in lauf.fehlgeschlagen
    assert lauf.uebersetzt == ["en"]


def test_abgeschnittene_antwort_wird_nicht_gespeichert() -> None:
    """MAX_TOKENS: NICHT speichern.

    Sonst bekäme die halbe Übersetzung den aktuellen `quelle_hash`, gälte damit
    als aktuell und würde nie wieder angefasst — die Idempotenz zementierte den
    Fehler.
    """
    db = _db_mit([])
    client = _Client([_antwort('{"title": "Kont"}', abschluss="MAX_TOKENS")])
    lauf, _ = su.seite_uebersetzen(
        client, db, TENANT, SEITE, "de", ["da"], _profil()
    )
    assert lauf.uebersetzt == []
    assert "da" in lauf.fehlgeschlagen
    assert db.tables["site_page_translations"] == []


def test_ohne_titel_keine_zeile() -> None:
    """`title` ist NOT NULL und der Menüpunkt. Ohne ihn wird nichts
    geschrieben, statt die Spalte zu verletzen."""
    db = _db_mit([])
    client = _Client([_antwort('{"seo_title": "nur meta"}')])
    lauf, _ = su.seite_uebersetzen(
        client, db, TENANT, SEITE, "de", ["da"], _profil()
    )
    assert lauf.uebersetzt == []
    assert db.tables["site_page_translations"] == []


def test_ausgangssprache_wird_uebersprungen() -> None:
    """Die Quelle steht in `site_pages` selbst — eine Fassung dafür wäre eine
    zweite Wahrheit über denselben Text."""
    db = _db_mit([])
    client = _Client([])
    lauf, _ = su.seite_uebersetzen(
        client, db, TENANT, SEITE, "de", ["de"], _profil()
    )
    assert client.aufrufe == 0
    assert lauf.uebersetzt == []


def test_deckel_wird_vor_jeder_sprache_geprueft() -> None:
    """Ein Lauf über n Sprachen sind n Aufrufe. Ein Deckel, der nur den ersten
    sieht, lässt n-1 darüber hinaus zu."""
    db = _db_mit([])
    client = _Client([_antwort('{"title": "A"}'), _antwort('{"title": "B"}')])
    gerufen = {"n": 0}

    def deckel() -> None:
        gerufen["n"] += 1
        if gerufen["n"] > 1:
            raise KiError("Tageslimit erreicht", status_code=429)

    lauf, _ = su.seite_uebersetzen(
        client, db, TENANT, SEITE, "de", ["da", "en"], _profil(), deckel=deckel
    )
    # Die erste Sprache geht durch, die zweite wird vom Deckel gestoppt —
    # und die erste bleibt erhalten.
    assert lauf.uebersetzt == ["da"]
    assert "en" in lauf.fehlgeschlagen
    assert client.aufrufe == 1


def test_leere_seite_wird_abgelehnt() -> None:
    """Ohne Titel gibt es nichts zu übersetzen — 422 statt eines Laufs, der
    nichts tut."""
    with pytest.raises(SiteConfigError) as exc:
        su.seite_uebersetzen(
            _Client([]),
            _db_mit([]),
            TENANT,
            {**SEITE, "title": "  "},
            "de",
            ["da"],
            _profil(),
        )
    assert exc.value.status_code == 422


# --- Antwort lesen (Wurzel 8: Fremd-Input) ----------------------------------


def test_fremde_schluessel_werden_verworfen() -> None:
    db = _db_mit([])
    client = _Client(
        [_antwort('{"title": "Kontakt", "boeses_feld": "x", "seo_title": 3}')]
    )
    lauf, _ = su.seite_uebersetzen(
        client, db, TENANT, SEITE, "de", ["da"], _profil()
    )
    assert lauf.uebersetzt == ["da"]
    zeile = db.tables["site_page_translations"][0]
    assert "boeses_feld" not in zeile
    # Eine Zahl, wo Text stehen soll, wird verworfen statt zu `"3"` gemacht.
    assert zeile["seo_title"] is None


def test_kaputtes_json_ist_ein_fehler_kein_leerer_text() -> None:
    db = _db_mit([])
    client = _Client([_antwort("das ist kein json")])
    lauf, _ = su.seite_uebersetzen(
        client, db, TENANT, SEITE, "de", ["da"], _profil()
    )
    assert lauf.uebersetzt == []
    assert "da" in lauf.fehlgeschlagen


# --- Fassungen lesen --------------------------------------------------------


def test_veraltet_wird_berechnet_nicht_gespeichert() -> None:
    """Eine geprüfte Fassung mit altem Hash ist veraltet — sichtbar, aber
    unangetastet."""
    db = _db_mit(
        [
            {
                "page_id": "page-1",
                "sprache": "da",
                "title": "Kontakt DA",
                "geprueft": True,
                "quelle_hash": "alt",
            },
            {
                "page_id": "page-1",
                "sprache": "en",
                "title": "Contact",
                "geprueft": False,
                "quelle_hash": su.quelle_hash(SEITE),
            },
        ]
    )
    fassungen = {f.sprache: f for f in su.fassungen_fuer_seite(db, "page-1", SEITE)}
    assert fassungen["da"].veraltet is True
    assert fassungen["da"].geprueft is True
    assert fassungen["en"].veraltet is False


def test_fassung_schreiben_setzt_geprueft() -> None:
    """Der einzige Weg, `geprueft` auf true zu bringen. Ohne ihn wäre der
    Schutzmechanismus eine Spalte, die nie true wird."""
    db = _db_mit([])
    fassung = su.fassung_schreiben(
        db,
        TENANT,
        SEITE,
        {"sprache": "da", "title": "Kontakt DA", "seo_title": "  "},
        "user-1",
    )
    assert fassung.geprueft is True
    assert fassung.veraltet is False
    zeile = db.tables["site_page_translations"][0]
    assert zeile["geprueft"] is True
    assert zeile["geprueft_von"] == "user-1"
    # Leere Felder werden zu NULL, nicht zu "".
    assert zeile["seo_title"] is None
    # Der Hash ist der AKTUELLE Stand der Seite.
    assert zeile["quelle_hash"] == su.quelle_hash(SEITE)


def test_fassung_schreiben_lehnt_unbekannte_sprache_ab() -> None:
    with pytest.raises(SiteConfigError) as exc:
        su.fassung_schreiben(
            _db_mit([]), TENANT, SEITE, {"sprache": "xx", "title": "X"}, None
        )
    assert exc.value.status_code == 422
