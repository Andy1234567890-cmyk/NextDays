"""Der Kreuztest gegen die AMTLICHEN Beispielblaetter der Vorlage.

WARUM DIESE TESTS GEBRAUCHT WERDEN
==================================
Die uebrigen 80 Tests pruefen die Empfangsstelle gegen Dateien, die WIR
gebaut haben — nach unserer Vorstellung davon, wie eine Meldung aussieht.
Ein Denkfehler, den Erzeugung und Pruefung teilen, bleibt darin
unsichtbar.

Diese fuenf Dateien stammen nicht von uns. Sie sind die Beispielblaetter
der Vorlage `CSV fil indberetning til DAC7 2025.xlsm` (Skattestyrelsen),
Blaetter `Eksempel 1 Initiel`, `Eksempel 1.1 Korrektion`, `Eks 2 Anvende
anden indberetter`, `Eksempel 2.1 Initiel` und `Eksempel 3
Nulindberetning` — von der Behoerde selbst als korrekte Meldungen
vorgefuehrt.

Damit sind sie der einzige Pruefstein in diesem Modul, der nicht aus
unserem Kopf kommt. Als er am 11.09.2026 erstmals angelegt wurde, fand er
auf Anhieb VIER Fehler, die alle 80 Tests durchgelassen hatten:

* **Befund 56** — die Empfangsstelle wies den UTF-8-BOM als „unbekannte
  Spalte" ab. Sie haette damit jede Datei zurueckgewiesen, die unsere
  eigene Erzeugung schreibt (`csv_dk.py` setzt ihn bewusst, sonst oeffnet
  Excel die Datei einspaltig).
* **Befund 57** — `TIN_UNKNOWN` war als Pflicht gefuehrt. In keiner
  Verkaeuferzeile der Beispiele ist es belegt; die `1..1` der Feldtabelle
  gilt je Wiederholgruppe, nicht je Zeile.
* **Befund 58** — alle 28 Quartalsspalten waren Pflicht. Die Beispiele
  lassen sie quartalsweise leer, wo nichts vermietet wurde.
* **Befund 59** — die DKK-Regel fuer `RS_ACT_DK_GRI` galt pauschal. Im
  Fahrzeugblock fuehrt die Vorlage dasselbe Feld in EUR.

Die Dateien tragen die erfundenen Musterdaten der Behoerde
(„Western Cocktails", CVR `57008113`), keine echten Personendaten. Das
Arbeitsblatt `Indberetning` derselben Vorlage enthaelt echte CPR-Nummern
und ist deshalb NICHT hier abgelegt.

ERZEUGT AUS DER VORLAGE, nicht von Hand gepflegt: Die Blaetter wurden
ausgelesen, Datumszellen ueber ihr Zahlenformat in `DD-MM-YYYY`
aufgeloest (Befund 60 — roh gelesen sind sie Excel-Seriennummern) und
Semikola in Textfeldern durch Kommata ersetzt, weil `;` das Trennzeichen
ist. Bei einer neuen Fassung der Vorlage neu ableiten.
"""
from __future__ import annotations

import pathlib

import pytest

from src.core.pruefung_csv import csv_pruefen

_BEISPIELE = pathlib.Path(__file__).parent / "vorlage-beispiele"

# Wie viele Verkaeufer- und Taetigkeitszeilen jedes Blatt traegt. Steht hier,
# damit ein stiller Ausfall auffaellt: Eine Datei, die nur noch aus der
# Kopfzeile besteht, wuerde sonst als „angenommen" durchgehen.
_ERWARTET = {
    "eks1": 14,
    "eks1_1": 7,
    "eks2": 4,
    "eks2_1": 13,
    "eks3": 5,
}


def _lesen(name: str) -> str:
    return (_BEISPIELE / f"{name}.csv").read_text(encoding="utf-8")


@pytest.mark.parametrize("name", sorted(_ERWARTET))
def test_amtliches_beispiel_wird_angenommen(name: str) -> None:
    """Jedes Beispielblatt der Behoerde muss fehlerfrei durchgehen.

    Ein Fehler hier heisst NICHT, dass die Datei schlecht ist — sie kommt
    von der Behoerde. Er heisst, dass unsere Pruefung eine Regel erfindet
    oder eine echte falsch auslegt.
    """
    quittung = csv_pruefen(_lesen(name))
    assert quittung.angenommen, [
        f"Z{b.zeile} {b.spalte} [{b.regel}] {b.grund}" for b in quittung.fehler
    ]


@pytest.mark.parametrize(("name", "zeilen"), sorted(_ERWARTET.items()))
def test_beispiel_ist_vollstaendig_gelesen(name: str, zeilen: int) -> None:
    """Gegenprobe zum Test oben: Eine leere Datei ist auch fehlerfrei."""
    quittung = csv_pruefen(_lesen(name))
    assert quittung.zeilen == zeilen - 1  # ohne Kopfzeile


def test_bom_wird_nicht_bemaengelt() -> None:
    """Befund 56 — der BOM ist bei dieser Meldung erwartet, nicht geduldet.

    Ohne ihn oeffnet Excel die Datei auf daenischen und deutschen
    Installationen als eine einzige Spalte, weshalb unsere Erzeugung ihn
    setzt. Eine Empfangsstelle, die ihn abweist, weist unsere eigene Datei
    ab.
    """
    mit_bom = _lesen("eks1")
    assert mit_bom.startswith("﻿"), "die Testdatei traegt keinen BOM"
    ohne_bom = mit_bom.lstrip("﻿")
    assert csv_pruefen(mit_bom).angenommen
    assert csv_pruefen(ohne_bom).angenommen


def test_tin_unknown_ist_beim_verkaeufer_keine_pflicht() -> None:
    """Befund 57 — belegt an den Beispielen selbst.

    In keiner Verkaeuferzeile der fuenf Blaetter ist `TIN_UNKNOWN` belegt.
    Der Test liest das aus den Dateien, statt es zu behaupten: Aendert die
    Behoerde ihre Beispiele, faellt es hier auf.
    """
    verkaeufer = ("RS_IND_Individual_Seller", "RS_ENT_Entity_Seller")
    gefunden = 0
    for name in _ERWARTET:
        quittung = csv_pruefen(_lesen(name))
        for satz in quittung.saetze:
            if satz.get("ROW_TYPE") in verkaeufer:
                gefunden += 1
                assert "TIN_UNKNOWN" not in satz, (
                    f"{name}: TIN_UNKNOWN ist belegt — die Annahme aus "
                    "Befund 57 gilt nicht mehr"
                )
                # Was dort sehr wohl stehen MUSS:
                assert satz.get("TIN"), f"{name}: Verkaeufer ohne TIN"
                assert satz.get("TIN_ISSUED_BY"), f"{name}: TIN ohne Staat"
    assert gefunden >= 7, f"nur {gefunden} Verkaeuferzeilen gefunden"


def test_quartale_duerfen_einzeln_leer_bleiben() -> None:
    """Befund 58 — `Eksempel 2.1` traegt eine Zeile mit nur Q1.

    Die Waehrung steht dort in ALLEN vier Quartalen, der Betrag nur im
    ersten: Die Behoerde fuehrt die Waehrung als Eigenschaft der Spalte,
    den Betrag als Eigenschaft des Geschaefts.
    """
    quittung = csv_pruefen(_lesen("eks2_1"))
    assert quittung.angenommen
    nur_q1 = [
        satz
        for satz in quittung.saetze
        if satz.get("ROW_TYPE") == "ACT_Immovable_Property"
        and satz.get("RS_ACT_CONS_Q1")
        and "RS_ACT_CONS_Q2" not in satz
    ]
    assert nur_q1, "das Blatt traegt keine Zeile mit nur einem Quartal mehr"
    for satz in nur_q1:
        assert satz.get("RS_ACT_CONS_Q4_CCY") == "DKK"


def test_gri_in_eur_ist_ausserhalb_von_immobilien_erlaubt() -> None:
    """Befund 59 — dasselbe Feld, zwei Bedeutungen.

    `Eksempel 1` fuehrt `RS_ACT_DK_GRI_CCY` auf Fahrzeugzeilen in EUR. Eine
    pauschale DKK-Regel wies das Blatt der Behoerde als fehlerhaft ab.
    """
    quittung = csv_pruefen(_lesen("eks1"))
    assert quittung.angenommen
    fremdwaehrung = [
        satz
        for satz in quittung.saetze
        if satz.get("RS_ACT_DK_GRI_CCY") not in (None, "DKK")
    ]
    assert fremdwaehrung, "das Blatt fuehrt kein GRI in Fremdwaehrung mehr"
    for satz in fremdwaehrung:
        assert not satz["ROW_TYPE"].startswith("ACT_Immovable")


def test_eine_manipulierte_datei_wird_abgewiesen() -> None:
    """Die Gegenprobe: Die Pruefung laesst nicht einfach alles durch.

    Ohne diesen Test koennte man jeden Test oben gruen machen, indem man
    die Pruefung abschaltet.
    """
    zeilen = [
        z.split(";") for z in _lesen("eks2_1").lstrip("﻿").split("\n") if z.strip()
    ]
    kopf = zeilen[0]

    def ohne(spalte: str, zeilentyp: str) -> str:
        """Eine Spalte in der ersten Zeile dieses Typs leeren.

        Ueber den Zeilentyp, nicht ueber die Position: Ein Test, der
        Zeile 4 leert, prueft etwas anderes, sobald die Behoerde ihr
        Beispiel umstellt — und meldet dann gruen.
        """
        geaendert = [list(z) for z in zeilen]
        for satz in geaendert[1:]:
            if satz[0] == zeilentyp:
                satz[kopf.index(spalte)] = ""
                break
        else:
            raise AssertionError(f"keine Zeile vom Typ {zeilentyp}")
        return "﻿" + "\n".join(";".join(z) for z in geaendert) + "\n"

    # Die Steuernummer des Verkaeufers — die zentrale Angabe bei DAC7.
    assert not csv_pruefen(ohne("TIN", "RS_IND_Individual_Seller")).angenommen
    # Der Name des meldenden Betriebs.
    assert not csv_pruefen(
        ohne("ORGANISATION_NAME", "PO_Platform_Operator")
    ).angenommen
    # Die Anschriftsart des Betreibers muss der eingetragene Sitz sein.
    assert not csv_pruefen(
        ohne("ADDR_LEGAL_ADDRESS_TYPE", "PO_Platform_Operator")
    ).angenommen
