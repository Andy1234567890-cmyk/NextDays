"""Prüft eine Meldung, BEVOR eine Datei entsteht.

Der Sinn ist nicht, Abstürze zu vermeiden — es ist, eine Falschmeldung zu
verhindern. Gegenüber einer Steuerbehörde ist ein abgebrochener Lauf mit
klarer Begründung immer besser als eine plausibel aussehende Datei mit einem
geratenen Wert darin.

Deshalb die harte Trennung im Prüfbericht:

  FEHLER   Die Datei wird nicht erzeugt. Eine Pflichtangabe fehlt oder ein
           Wert ist nicht zulässig.
  HINWEIS  Die Datei wird erzeugt, aber jemand sollte hinsehen. Betrifft
           Angaben, die die Richtlinie nur „sofern vorhanden" verlangt.

Jeder Befund benennt die Stelle in unseren Daten (`betrifft`) und das Feld,
damit der Nutzer sie findet. Eine Meldung „Pflichtfeld fehlt" ohne Fundort
wäre in einem Bestand mit hunderten Objekten wertlos.
"""
from __future__ import annotations

from decimal import Decimal

from . import enums
from .modell import (
    Anbieter,
    Anschrift,
    Meldung,
    Plattformbetreiber,
    Pruefbericht,
    Vermietung,
)

# Höchstlänge der frei vergebenen Referenz nach Vorgabe der Vorlage.
_REF_MAXLAENGE = 100


def _ref_zulaessig(ref: str) -> bool:
    """Referenzen dürfen nur Ziffern und Buchstaben enthalten.

    Vorgabe der Vorlage: keine Sonderzeichen. Ein Bindestrich in einer
    Kennung lässt die Behörde die Datei zurückweisen — und zwar erst nach
    dem Hochladen.
    """
    return bool(ref) and ref.isalnum() and len(ref) <= _REF_MAXLAENGE


def _anschrift_pruefen(
    bericht: Pruefbericht, betrifft: str, anschrift: Anschrift
) -> None:
    if not anschrift.land:
        bericht.fehler_melden(betrifft, "ADDR_COUNTRY", "Land der Anschrift fehlt")
    elif anschrift.land not in enums.LAENDER:
        bericht.fehler_melden(
            betrifft, "ADDR_COUNTRY", f"unbekannter Ländercode '{anschrift.land}'"
        )
    # Ort ODER Freitext: `ADDR_FREE` ist der amtliche Ausweg fuer
    # Anschriften, die strukturiert nicht abbildbar sind (Zellkommentar:
    # „Obligatorisk hvis de strukturerede adressefelter ikke kan
    # udfyldes."). Bis hierher verlangte die Pruefung den Ort unbedingt und
    # wies damit eine Anschrift ab, fuer die die Vorlage eine Loesung
    # kennt.
    if not anschrift.ort and not anschrift.freitext:
        bericht.fehler_melden(
            betrifft,
            "ADDR_CITY",
            "Ort der Anschrift fehlt und es liegt keine Freitextfassung "
            "(ADDR_FREE) vor",
        )
    elif not anschrift.ort:
        # Die fuenf amtlichen Beispielblaetter setzen `ADDR_CITY` auch dort,
        # wo `ADDR_FREE` gefuellt ist — der Freitext steht nie allein.
        bericht.hinweis_melden(
            betrifft,
            "ADDR_CITY",
            "gemeldet wird nur die Freitextfassung; die amtlichen Beispiele "
            "fuehren den Ort zusaetzlich",
        )
    if anschrift.art and anschrift.art not in enums.ANSCHRIFTSART:
        bericht.fehler_melden(
            betrifft,
            "ADDR_LEGAL_ADDRESS_TYPE",
            f"unbekannte Anschriftsart '{anschrift.art}'",
        )


def _steuernummern_pruefen(
    bericht: Pruefbericht, betrifft: str, anbieter_oder_betreiber: object
) -> None:
    nummern = getattr(anbieter_oder_betreiber, "steuernummern", ())
    if not nummern:
        bericht.fehler_melden(
            betrifft, "TIN", "keine Steuer-Identifikationsnummer erhoben"
        )
        return
    for nummer in nummern:
        if not nummer.ausgestellt_von:
            bericht.fehler_melden(
                betrifft, "TIN_ISSUED_BY", "ausstellender Staat fehlt"
            )
        elif nummer.ausgestellt_von not in enums.LAENDER:
            bericht.fehler_melden(
                betrifft,
                "TIN_ISSUED_BY",
                f"unbekannter Ländercode '{nummer.ausgestellt_von}'",
            )
        if not nummer.meldefaehig:
            bericht.fehler_melden(
                betrifft,
                "TIN",
                "Steuernummer weder erhoben noch als nicht vergeben gekennzeichnet",
            )


def _betreiber_pruefen(
    bericht: Pruefbericht, betreiber: Plattformbetreiber
) -> None:
    betrifft = f"Plattformbetreiber {betreiber.name or betreiber.doc_ref_id}"

    if not betreiber.name:
        bericht.fehler_melden(betrifft, "ORGANISATION_NAME", "Name fehlt")
    if not _ref_zulaessig(betreiber.doc_ref_id):
        bericht.fehler_melden(
            betrifft,
            "PO_DOC_REF_ID",
            "Kennung fehlt oder enthält unzulässige Zeichen",
        )
    if betreiber.nexus not in enums.NEXUS:
        bericht.fehler_melden(
            betrifft, "PO_NEXUS", f"unzulässiger Grund der Meldepflicht '{betreiber.nexus}'"
        )
    if not betreiber.ansaessig_in:
        bericht.fehler_melden(betrifft, "RESIDENCE", "Ansässigkeitsstaat fehlt")
    for land in betreiber.ansaessig_in:
        if land not in enums.LAENDER:
            bericht.fehler_melden(
                betrifft, "RESIDENCE", f"unbekannter Ländercode '{land}'"
            )

    _steuernummern_pruefen(bericht, betrifft, betreiber)
    _anschrift_pruefen(bericht, betrifft, betreiber.anschrift)

    # Die Vorlage verlangt für den Betreiber mindestens eine Anschrift der
    # Art „eingetragener Sitz".
    if betreiber.anschrift.art != "OECD304":
        bericht.hinweis_melden(
            betrifft,
            "ADDR_LEGAL_ADDRESS_TYPE",
            "die Vorlage erwartet für den Betreiber den eingetragenen Sitz (OECD304)",
        )


def _name_pruefen(bericht: Pruefbericht, betrifft: str, anbieter: Anbieter) -> None:
    if anbieter.ist_person:
        if not anbieter.vorname:
            bericht.fehler_melden(betrifft, "RS_NM_FIRST_NAME", "Vorname fehlt")
        if not anbieter.nachname:
            bericht.fehler_melden(betrifft, "RS_NM_LAST_NAME", "Nachname fehlt")
        # Die Anleitung zu RS_BIRTH_DATE: "Obligatorisk", Kardinalitaet 1..1.
        # Das Geburtsdatum ist bei einer Privatperson Pflicht, unabhaengig
        # davon, ob eine Steuernummer vorliegt.
        if anbieter.geburtsdatum is None:
            bericht.fehler_melden(
                betrifft,
                "RS_BIRTH_DATE",
                "Geburtsdatum fehlt — die Anleitung fuehrt es als Pflicht",
            )
        # Die Anleitung zu RS_BIRTH_PLACE_CITY: "Obligatorisk hvis TIN
        # unknown." Massgeblich ist also das GESETZTE Flag, nicht eine
        # leere Nummer: Wer keine Nummer erhoben hat, hat einen anderen
        # Mangel (TIN), nicht diesen.
        tin_unbekannt = any(n.unbekannt for n in anbieter.steuernummern)
        if tin_unbekannt and not anbieter.geburtsort:
            bericht.fehler_melden(
                betrifft,
                "RS_BIRTH_PLACE_CITY",
                "bei TIN_UNKNOWN ist der Geburtsort Pflicht",
            )
        if anbieter.geburtsland and anbieter.geburtsland not in enums.LAENDER:
            bericht.fehler_melden(
                betrifft,
                "RS_BIRTH_COUNTRY",
                f"unbekannter Ländercode '{anbieter.geburtsland}'",
            )
    elif not anbieter.name:
        bericht.fehler_melden(betrifft, "ORGANISATION_NAME", "Firmenname fehlt")


def _negativ_pruefen(
    taetigkeit: Vermietung, betrifft: str, bericht: Pruefbericht
) -> None:
    """Kein Betrag und keine Anzahl darf unter null liegen.

    Deckt ALLE Spalten ab, für die die Vorlage eine Untergrenze von 0 setzt —
    nicht nur Vergütung und Anzahl.
    """
    for q in (1, 2, 3, 4):
        for wert, spalte, was in (
            (taetigkeit.verguetung[q], f"RS_ACT_CONS_Q{q}", "Vergütung"),
            (taetigkeit.gebuehren[q], f"RS_ACT_FEES_Q{q}", "Gebühr"),
            (taetigkeit.steuern[q], f"RS_ACT_TAX_Q{q}", "Steuer"),
        ):
            if wert < Decimal(0):
                bericht.fehler_melden(
                    betrifft, spalte, f"negative {was} ist kein Meldewert"
                )
        if taetigkeit.anzahl[q] < 0:
            bericht.fehler_melden(
                betrifft, f"RS_ACT_NUM_Q{q}", "negative Anzahl"
            )

    if taetigkeit.vermietete_tage is not None and taetigkeit.vermietete_tage < 0:
        bericht.fehler_melden(
            betrifft, "RS_ACT_RENTED_DAYS", "negative Anzahl Miettage"
        )

    brutto = taetigkeit.daenisch.brutto_mieteinnahme if taetigkeit.daenisch else None
    if brutto is not None and brutto < Decimal(0):
        bericht.fehler_melden(
            betrifft, "RS_ACT_DK_GRI", "negative Bruttomieteinnahme"
        )


def _vermietung_pruefen(
    bericht: Pruefbericht, betrifft: str, taetigkeit: Vermietung
) -> None:
    _anschrift_pruefen(bericht, betrifft, taetigkeit.anschrift)

    if not taetigkeit.waehrung:
        bericht.fehler_melden(
            betrifft, "RS_ACT_CONS_Q1_CCY", "Währung der Vergütung fehlt"
        )
    elif taetigkeit.waehrung not in enums.WAEHRUNGEN:
        bericht.fehler_melden(
            betrifft,
            "RS_ACT_CONS_Q1_CCY",
            f"unbekannter Währungscode '{taetigkeit.waehrung}'",
        )

    if taetigkeit.objektart and taetigkeit.objektart not in enums.OBJEKTART:
        bericht.fehler_melden(
            betrifft,
            "RS_ACT_PROP_TYPE",
            f"unbekannte Objektart '{taetigkeit.objektart}'",
        )
    if (
        taetigkeit.objektart == enums.OBJEKTART_SONSTIGES
        and not taetigkeit.objektart_freitext
    ):
        bericht.fehler_melden(
            betrifft,
            "RS_ACT_OTHER_PROP_TYPE",
            "bei Objektart 'Sonstiges' ist die Beschreibung Pflicht",
        )

    # Negative Beträge sind kein gültiger Meldewert. Eine Erstattung mindert
    # die Vergütung des Quartals, in dem sie anfiel — sie erzeugt keinen
    # negativen Posten.
    #
    # Die Vorlage setzt das über ihre Datenvalidierung durch: JEDE Betrags-
    # und Zählspalte ist dort `type="whole"` mit `formula1=0`, also ganzzahlig
    # und mindestens null. Geprüft wurden hier zunächst nur Vergütung und
    # Anzahl; Gebühren, Steuern, Miettage und die Bruttomieteinnahme liefen
    # ungeprüft durch — ein negativer Wert hätte still die Datei erreicht.
    _negativ_pruefen(taetigkeit, betrifft, bericht)

    # Ein Quartal mit Vergütung, aber ohne Tätigkeit widerspricht sich.
    for q in (1, 2, 3, 4):
        if taetigkeit.verguetung[q] > Decimal(0) and taetigkeit.anzahl[q] == 0:
            bericht.hinweis_melden(
                betrifft,
                f"RS_ACT_NUM_Q{q}",
                "Vergütung ohne zugeordnete Tätigkeit im selben Quartal",
            )

    if taetigkeit.grundbuchnummer is None:
        bericht.hinweis_melden(
            betrifft,
            "RS_ACT_LAND_REG_NUM",
            "keine Grundbuchnummer erhoben (nur 'sofern vorhanden' verlangt)",
        )

    if taetigkeit.daenisch and taetigkeit.daenisch.brutto_mieteinnahme is not None:
        # Die dänische Anleitung verlangt die Bruttomieteinnahme in DKK.
        if taetigkeit.daenisch.brutto_mieteinnahme_waehrung != "DKK":
            bericht.fehler_melden(
                betrifft,
                "RS_ACT_DK_GRI_CCY",
                "die Bruttomieteinnahme ist zwingend in DKK zu melden",
            )

    _gri_pflicht_pruefen(bericht, betrifft, taetigkeit)


def _gri_pflicht_pruefen(
    bericht: Pruefbericht, betrifft: str, taetigkeit: Vermietung
) -> None:
    """Mit einer BFE-Nummer wird die Bruttomieteinnahme zur Pflicht.

    Wörtlich im Feldkommentar zu `RS_ACT_DK_GRI`: „Obligatorisk hvis Real
    Property Registration Number BFE er angivet." Beide Felder sind für
    sich genommen freiwillig, zusammen aber nicht — genau die Art Regel,
    die eine Feld-für-Feld-Prüfung nicht sieht.

    In der echten Meldung der Vorlage ist sie eingehalten: Alle 23
    Objektzeilen tragen BFE UND Bruttomieteinnahme.
    """
    dk = taetigkeit.daenisch
    if dk is None or not dk.bfe_nummer:
        return
    if dk.brutto_mieteinnahme is None:
        bericht.fehler_melden(
            betrifft,
            "RS_ACT_DK_GRI",
            "mit einer BFE-Nummer ist die Bruttomieteinnahme Pflicht "
            "(Obligatorisk hvis Real Property Registration Number BFE "
            "er angivet)",
        )


def _anbieter_pruefen(bericht: Pruefbericht, anbieter: Anbieter) -> None:
    bezeichnung = anbieter.name or " ".join(
        t for t in (anbieter.vorname, anbieter.nachname) if t
    )
    betrifft = f"Anbieter {bezeichnung or anbieter.doc_ref_id}"

    if not _ref_zulaessig(anbieter.doc_ref_id):
        bericht.fehler_melden(
            betrifft,
            "RS_DOC_REF_ID",
            "Kennung fehlt oder enthält unzulässige Zeichen",
        )
    if anbieter.satzart not in enums.SATZART:
        bericht.fehler_melden(
            betrifft, "DOC_TYPE_INDIC", f"unzulässige Satzart '{anbieter.satzart}'"
        )
    if anbieter.satzart in {"OECD2", "OECD3"} and not anbieter.korrigiert_doc_ref_id:
        bericht.fehler_melden(
            betrifft,
            "CORR_DOC_REF_ID",
            "Korrektur und Löschung verlangen die Kennung des Ursprungssatzes",
        )
    # Die Vorlage zu Beispiel 1.1: "endelig skal der oplyses en ny unik
    # vaerdi for DOC_REF_ID" — die Korrektur bekommt eine NEUE Kennung, die
    # alte steht in CORR_DOC_REF_ID. Sind beide gleich, verweist der Satz
    # auf sich selbst und die Behoerde kann ihn nicht zuordnen.
    if (
        anbieter.korrigiert_doc_ref_id
        and anbieter.korrigiert_doc_ref_id == anbieter.doc_ref_id
    ):
        bericht.fehler_melden(
            betrifft,
            "RS_DOC_REF_ID",
            "eine Korrektur braucht eine NEUE Kennung; die bisherige "
            "gehoert in CORR_DOC_REF_ID",
        )
    if anbieter.satzart in {"OECD0", "OECD1"} and anbieter.korrigiert_doc_ref_id:
        bericht.fehler_melden(
            betrifft,
            "CORR_DOC_REF_ID",
            "eine Neumeldung darf keine Ursprungskennung tragen",
        )

    if not anbieter.ansaessig_in:
        bericht.fehler_melden(betrifft, "RESIDENCE", "Ansässigkeitsstaat fehlt")
    for land in anbieter.ansaessig_in:
        if land not in enums.LAENDER:
            bericht.fehler_melden(
                betrifft, "RESIDENCE", f"unbekannter Ländercode '{land}'"
            )

    _steuernummern_pruefen(bericht, betrifft, anbieter)
    _name_pruefen(bericht, betrifft, anbieter)
    _anschrift_pruefen(bericht, betrifft, anbieter.anschrift)

    if not anbieter.taetigkeiten:
        bericht.fehler_melden(
            betrifft,
            "ACT_Immovable_Property",
            "Anbieter ohne Tätigkeit — er gehört dann nicht in die Meldung",
        )
    for taetigkeit in anbieter.taetigkeiten:
        _vermietung_pruefen(
            bericht, f"{betrifft} / {taetigkeit.anschrift.ort or '?'}", taetigkeit
        )


def pruefen(meldung: Meldung, bericht: Pruefbericht | None = None) -> Pruefbericht:
    """Eine Meldung vollständig prüfen.

    Sammelt ALLE Befunde, statt beim ersten abzubrechen: Wer eine Meldung
    vorbereitet, will die vollständige Arbeitsliste sehen und nicht nach
    jeder Korrektur erneut suchen.
    """
    bericht = bericht or Pruefbericht()

    if not _ref_zulaessig(meldung.melde_ref_id):
        bericht.fehler_melden(
            "Meldung",
            "MSG_MESSAGE_REF_ID",
            "Kennung fehlt oder enthält unzulässige Zeichen",
        )
    if meldung.meldeart not in enums.MELDEART:
        bericht.fehler_melden(
            "Meldung",
            "MSG_MESSAGE_TYPE_INDIC",
            f"unzulässige Meldeart '{meldung.meldeart}'",
        )
    if meldung.fassung not in {"1.0"}:
        bericht.fehler_melden(
            "Meldung", "MSG_VERSION", f"unbekannte Fassung '{meldung.fassung}'"
        )

    _betreiber_pruefen(bericht, meldung.betreiber)

    # Die Vorlage zu Beispiel 1.1: In einer Korrekturmeldung traegt
    # PO_Platform_Operator DOC_TYPE_INDIC=OECD0 (gensendt) — es sei denn,
    # der Betreiber selbst wird korrigiert.
    if meldung.meldeart == "DPI402" and meldung.betreiber.satzart not in {
        "OECD0",
        "OECD2",
    }:
        bericht.fehler_melden(
            f"Plattformbetreiber {meldung.betreiber.name}",
            "DOC_TYPE_INDIC",
            "in einer Korrekturmeldung ist der Betreiber erneut zu senden "
            f"(OECD0), nicht '{meldung.betreiber.satzart}'",
        )

    # Die Meldeart schränkt ein, welche Satzarten vorkommen dürfen.
    erlaubte = enums.SATZARTEN_JE_MELDEART.get(meldung.meldeart, frozenset())
    for anbieter in meldung.anbieter:
        if anbieter.satzart not in erlaubte:
            bericht.fehler_melden(
                f"Anbieter {anbieter.doc_ref_id}",
                "DOC_TYPE_INDIC",
                f"Satzart '{anbieter.satzart}' ist in einer "
                f"{meldung.meldeart}-Meldung nicht zulässig",
            )
        _anbieter_pruefen(bericht, anbieter)

    if meldung.ist_nullmeldung and meldung.anbieter:
        bericht.fehler_melden(
            "Meldung",
            "MSG_MESSAGE_TYPE_INDIC",
            "eine Nullmeldung darf keine Anbieter enthalten",
        )
    if not meldung.ist_nullmeldung and not meldung.anbieter:
        bericht.fehler_melden(
            "Meldung",
            "MSG_MESSAGE_TYPE_INDIC",
            "ohne Anbieter ist eine Nullmeldung (DPI403) zu erstellen",
        )

    # Kennungen müssen innerhalb der Meldung eindeutig sein, sonst ordnet die
    # Behörde Tätigkeiten dem falschen Anbieter zu.
    kennungen = [a.doc_ref_id for a in meldung.anbieter]
    doppelte = {k for k in kennungen if kennungen.count(k) > 1}
    for kennung in sorted(doppelte):
        bericht.fehler_melden(
            f"Anbieter {kennung}", "RS_DOC_REF_ID", "Kennung mehrfach vergeben"
        )

    return bericht
