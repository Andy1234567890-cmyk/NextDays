"""Hält die Spaltenliste mit der amtlichen Vorlage deckungsgleich.

WARUM DIESER TEST DER WICHTIGSTE IST: Die Spaltennamen sind der Vertrag mit
der Behörde. Eine umbenannte, vertauschte oder fehlende Spalte lässt die
Datei beim Hochladen durchfallen — und zwar erst dort, nicht hier. Deshalb
liest dieser Test die Vorlage selbst und vergleicht sie mit dem, was wir
schreiben.

Er liest die Vorlage direkt aus der `.xlsm` (eine ZIP-Datei mit XML darin),
ohne Fremdbibliothek: `openpyxl` gehört nicht zu den Abhängigkeiten des
Backends, und für das Auslesen einer Kopfzeile lohnt sie nicht.

Fehlt die Vorlage im Arbeitsverzeichnis, wird der Test übersprungen statt zu
scheitern — sie ist ein Dokument, kein Quellcode, und in einer schlanken
Auscheckung womöglich nicht dabei.
"""
from __future__ import annotations

import xml.etree.ElementTree as ET  # noqa: S405 — feste Datei im Repo, kein Fremdinput
import zipfile
from pathlib import Path

import pytest

from src.features.taxpayer.dac7.spalten import DK_ZUSATZ, SPALTEN

_VORLAGE_IM_REPO = Path("docs/Duck7/CSV fil indberetning til DAC7 2025.xlsm")


def _vorlage_suchen() -> Path | None:
    """Die Vorlage über ein Merkmal der Repo-Wurzel finden.

    Nicht über eine feste Zahl von Elternebenen: Die stimmt genau so lange,
    bis jemand die Datei verschiebt — und dann wird der Test stillschweigend
    übersprungen, statt zu scheitern. Ein Test, der sich selbst abschaltet,
    ist schlimmer als keiner.
    """
    for verzeichnis in Path(__file__).resolve().parents:
        kandidat = verzeichnis / _VORLAGE_IM_REPO
        if kandidat.exists():
            return kandidat
    return None


_VORLAGE = _vorlage_suchen()

_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
# Das Blatt, dessen Inhalt die Vorlage als CSV exportiert.
_BLATT = "Indberetning"


def _spalte_zu_nummer(bezug: str) -> int:
    """'AB12' → 28. Nur der Buchstabenteil zählt."""
    nummer = 0
    for zeichen in bezug:
        if not zeichen.isalpha():
            break
        nummer = nummer * 26 + (ord(zeichen.upper()) - 64)
    return nummer


def _kopfzeile_der_vorlage() -> list[str]:
    """Die erste Zeile des Blattes 'Indberetning' als Spaltennamen.

    Die `# noqa: S314` unten sind bewusst: Gelesen wird eine versionierte
    Datei aus dem Repo, kein zugelieferter Inhalt. `defusedxml` gehoert
    nicht zu den Abhaengigkeiten und waere hier ohne Schutzwirkung.
    """
    assert _VORLAGE is not None
    with zipfile.ZipFile(_VORLAGE) as archiv:
        texte = [
            "".join(t.text or "" for t in eintrag.iter(f"{_NS}t"))
            for eintrag in ET.fromstring(archiv.read("xl/sharedStrings.xml"))  # noqa: S314
        ]

        arbeitsmappe = ET.fromstring(archiv.read("xl/workbook.xml"))  # noqa: S314
        bezuege = ET.fromstring(archiv.read("xl/_rels/workbook.xml.rels"))  # noqa: S314
        ziel_je_id = {b.get("Id"): b.get("Target") for b in bezuege}

        rid = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
        blatt_datei = next(
            ziel_je_id[blatt.get(rid)]
            for blatt in arbeitsmappe.find(f"{_NS}sheets")
            if blatt.get("name") == _BLATT
        )

        blatt = ET.fromstring(archiv.read(f"xl/{blatt_datei}"))  # noqa: S314

    namen: list[tuple[int, str]] = []
    for zeile in blatt.iter(f"{_NS}row"):
        if zeile.get("r") != "1":
            continue
        for zelle in zeile:
            wert = zelle.find(f"{_NS}v")
            if wert is None:
                continue
            inhalt = (
                texte[int(wert.text)] if zelle.get("t") == "s" else (wert.text or "")
            )
            namen.append((_spalte_zu_nummer(zelle.get("r")), inhalt.strip()))
    return [name for _, name in sorted(namen)]


vorlage_vorhanden = pytest.mark.skipif(
    _VORLAGE is None, reason="amtliche Vorlage nicht im Arbeitsverzeichnis"
)


@vorlage_vorhanden
def test_spalten_stimmen_mit_der_vorlage_ueberein() -> None:
    """Namen UND Reihenfolge müssen exakt der Vorlage entsprechen."""
    assert list(SPALTEN) == _kopfzeile_der_vorlage()


@vorlage_vorhanden
def test_keine_spalte_fehlt_und_keine_ist_zuviel() -> None:
    """Getrennt geprüft, damit eine Abweichung lesbar berichtet wird.

    Der Vergleich ganzer Listen zeigt bei 89 Einträgen nur, DASS sie
    abweichen; diese beiden Mengen zeigen, WELCHE.
    """
    aus_vorlage = set(_kopfzeile_der_vorlage())
    unsere = set(SPALTEN)
    assert not (aus_vorlage - unsere), "Spalten der Vorlage fehlen bei uns"
    assert not (unsere - aus_vorlage), "wir schreiben Spalten, die es nicht gibt"


def test_spaltennamen_sind_eindeutig() -> None:
    assert len(set(SPALTEN)) == len(SPALTEN)


def test_daenische_zusatzfelder_sind_teil_der_spalten() -> None:
    """Der Länderanhang muss aus derselben Liste stammen, nicht daneben."""
    assert DK_ZUSATZ <= set(SPALTEN)


def test_daenische_zusatzfelder_sind_als_solche_erkennbar() -> None:
    """Alles mit '_DK_' im Namen gehört in den Länderanhang — und nur das.

    Diese Regel trägt den Wechsel auf DPI-XML: Was hier steht, hat im
    gemeinsamen OECD-Kern kein Gegenstück.
    """
    assert DK_ZUSATZ == {s for s in SPALTEN if "_DK_" in s}
