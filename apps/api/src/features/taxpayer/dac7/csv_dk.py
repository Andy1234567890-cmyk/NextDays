"""Serialisiert eine Meldung als dänische DAC7-CSV.

Dies ist ein reiner ÜBERSETZER: Er rechnet nichts, er entscheidet nichts, er
lässt nichts weg. Alles Fachliche steht im Modell und im Rechner; hier wird
der Baum nur flachgeklopft. Das ist die Trennung, die den Wechsel auf DPI-XML
(Meldejahr 2026) zu einer zweiten Datei dieser Art macht statt zu einem
Umbau.

FORMATVORGABEN aus der amtlichen Vorlage von Skattestyrelsen:
  * Trennzeichen `;`, Zeichensatz UTF-8 **mit BOM**
  * 89 Spalten in fester Reihenfolge (siehe `spalten.py`)
  * Datum `DD-MM-YYYY`
  * Beträge GANZZAHLIG, ohne Tausendertrenner
  * Wahrheitswerte als `SANDT`/`FALSK`
  * Kommas bleiben im Textfeld erhalten, Semikolons werden ersetzt

AUFBAU DER DATEI: eine Kopfzeile, dann Datenzeilen. Jede Datenzeile trägt in
Spalte ROW_TYPE ihren Typ, der bestimmt, welche Spalten überhaupt gefüllt
sind.

WIE DIE HIERARCHIE ENTSTEHT — und wie NICHT: Die Nachrichtenkennung steht
AUSSCHLIESSLICH in der `Message`-Zeile, die Betreiberkennung ausschliesslich
in der `PO_Platform_Operator`-Zeile. Die Zugehörigkeit der übrigen Zeilen
ergibt sich aus ihrer REIHENFOLGE und aus `RS_DOC_REF_ID`: Die Zeilen eines
Anbieters tragen dieselbe, seine Objektzeilen ebenfalls.

Hier stand einmal, alle Zeilen trügen dieselbe MSG_MESSAGE_REF_ID — nach der
Kardinalität `1..1`, die `Vejledningstekster` bei jedem Zeilentyp führt. Die
beschreibt aber das DPI-XML-Zielschema, wo die Zuordnung aus dem Baum folgt.
In der flachgeklopften CSV ist sie genau einmal vorhanden. Belegt durch alle
fünf Beispielblätter und die Belegungsmatrix im Blatt `Kolonner`.
"""
from __future__ import annotations

from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from .modell import (
    Anbieter,
    Anschrift,
    Meldung,
    Plattformbetreiber,
    Quartalswerte,
    Steuernummer,
    Vermietung,
)
from .spalten import SPALTEN, TRENNZEICHEN

# Zeichen, die ein Textfeld nicht enthalten darf, weil sie die Satzstruktur
# zerstören würden. Das KOMMA gehört bewusst NICHT dazu — siehe `_text`.
_ERSETZUNGEN = {
    ";": " ",
    "\n": " ",
    "\r": " ",
    '"': "'",
}


def _text(wert: str | None) -> str:
    """Ein Textfeld satzsicher machen — ohne den Inhalt zu verfälschen.

    WARUM DAS KOMMA BLEIBT: Hier wurde es einmal durch ein Leerzeichen
    ersetzt, begründet mit "die Vorlage ersetzt Kommas vor dem Export". Das
    war nur die halbe Wahrheit. Ihr Makro tauscht Kommas vor dem Speichern
    gegen `|`, damit Excel sie nicht als Trennzeichen nimmt, und dreht das
    danach wieder um (`Replace(strContents, "|", ",")`). Ein Komma
    überlebt den Export also unverändert.

    Beweis aus der Vorlage selbst, Blatt `Eksempel 2.1 Initiel`, Spalte
    ADDR_FREE: "Jesperhus Allé 2, 7000 Fredericia" und "Budapest, Hős u.
    8-10, 1087 Ungarn". Die Behörde schreibt Kommas in ihre eigenen
    Meldedaten.

    Ein Komma zu ersetzen war damit kein Formatschutz, sondern eine
    Verfälschung gemeldeter Daten: "LeCampz, SARL" wurde zu "LeCampz SARL".

    Das SEMIKOLON wird weiter ersetzt. Die Vorlage tut das nicht und kennt
    auch kein Maskieren — ein Semikolon im Feldwert zerreißt dort die Zeile.
    An dieser Stelle sind wir bewusst strenger als die Vorlage.
    """
    if wert is None:
        return ""
    sauber = str(wert).strip()
    for alt, neu in _ERSETZUNGEN.items():
        sauber = sauber.replace(alt, neu)
    # Mehrfache Leerzeichen aus den Ersetzungen wieder zusammenziehen.
    return " ".join(sauber.split())


def _datum(wert: date | None) -> str:
    return wert.strftime("%d-%m-%Y") if wert else ""


def _betrag(wert: Decimal | None) -> str:
    """Ein Geldbetrag als Ganzzahl.

    Die Vorlage erlaubt keine Nachkommastellen. Kaufmännisch gerundet — nicht
    abgeschnitten: Abschneiden meldete systematisch zu wenig.
    """
    if wert is None:
        return ""
    return str(int(wert.quantize(Decimal(1), rounding=ROUND_HALF_UP)))


def _zahl(wert: int | None) -> str:
    return "" if wert is None else str(wert)


def _wahrheit(wert: bool | None) -> str:
    """Wahrheitswerte auf Dänisch: SANDT / FALSK.

    Hier stand einmal 0/1, begründet mit "so führt die Vorlage sie in ihren
    Beispielen". Das war ein Lesefehler: In den Beispielzellen steht ein
    Excel-Boolean (`t="b"` mit Wert 0), kein Zifferntext. Wer die rohe XML
    ohne Beachtung des t-Attributs liest, sieht dort eine 0.

    Was die Vorlage wirklich verlangt, sagen vier Stellen übereinstimmend:
      * Datenvalidierung auf den Spalten R und AJ: Liste "SANDT,FALSK"
      * `Eksempel Oversigt` G9 woertlich: PO_ASSUMED_REPORTING=SANDT
      * Beispiel 2, Zelle AJ3, als Text abgelegt: SANDT
      * der Export der Vorlage ersetzt ;TRUE;->;SANDT; und ;FALSE;->;FALSK;
    """
    if wert is None:
        return ""
    return "SANDT" if wert else "FALSK"


class _Zeile:
    """Eine Datenzeile im Aufbau.

    Setzt Werte über den SPALTENNAMEN, nie über eine Position. Ein
    Tippfehler im Namen fällt dadurch sofort auf (KeyError), statt still in
    die falsche Spalte zu schreiben.
    """

    __slots__ = ("_werte",)

    def __init__(self, zeilentyp: str) -> None:
        self._werte: dict[str, str] = {"ROW_TYPE": zeilentyp}

    def setze(self, spalte: str, wert: str) -> _Zeile:
        if spalte not in _SPALTENMENGE:
            msg = f"Unbekannte DAC7-Spalte: {spalte}"
            raise KeyError(msg)
        if wert:
            self._werte[spalte] = wert
        return self

    def als_text(self) -> str:
        return TRENNZEICHEN.join(self._werte.get(s, "") for s in SPALTEN)


_SPALTENMENGE = frozenset(SPALTEN)


def _kopf() -> str:
    return TRENNZEICHEN.join(SPALTEN)


def _anschrift_setzen(zeile: _Zeile, anschrift: Anschrift) -> None:
    """Die Anschriftsspalten füllen — für jeden Zeilentyp dieselben."""
    zeile.setze("ADDR_FREE", _text(anschrift.freitext))
    zeile.setze("ADDR_STREET", _text(anschrift.strasse))
    zeile.setze("ADDR_BUILDING", _text(anschrift.hausnummer))
    zeile.setze("ADDR_POST_CODE", _text(anschrift.plz))
    zeile.setze("ADDR_CITY", _text(anschrift.ort))
    zeile.setze("ADDR_COUNTRY", _text(anschrift.land))
    zeile.setze("ADDR_LEGAL_ADDRESS_TYPE", _text(anschrift.art))


def _steuernummer_setzen(zeile: _Zeile, nummer: Steuernummer) -> None:
    zeile.setze("TIN", _text(nummer.wert))
    zeile.setze("TIN_ISSUED_BY", _text(nummer.ausgestellt_von))
    zeile.setze("TIN_UNKNOWN", _wahrheit(nummer.unbekannt))


def _quartalswerte_setzen(
    zeile: _Zeile, praefix: str, werte: Quartalswerte, waehrung: str
) -> None:
    """Vier Quartalsbeträge samt Währung setzen.

    Die Währung steht je Quartal eigens in der Datei — auch wenn sie bei uns
    für alle vier gleich ist. Sie wird trotzdem viermal geschrieben, weil die
    Vorlage sie viermal verlangt.
    """
    for q in (1, 2, 3, 4):
        zeile.setze(f"{praefix}_Q{q}", _betrag(werte[q]))
        zeile.setze(f"{praefix}_Q{q}_CCY", _text(waehrung))


def _zeile_message(meldung: Meldung) -> _Zeile:
    zeile = _Zeile("Message")
    zeile.setze("MSG_MESSAGE_REF_ID", _text(meldung.melde_ref_id))
    zeile.setze("MSG_SENDING_ENTITY_IN", _text(meldung.absender_kennung))
    zeile.setze("MSG_WARNING", _text(meldung.hinweis))
    zeile.setze("MSG_CONTACT", _text(meldung.kontakt))
    zeile.setze("MSG_MESSAGE_TYPE_INDIC", _text(meldung.meldeart))
    zeile.setze("MSG_REPORTING_PERIOD", _datum(meldung.zeitraum_ende))
    zeile.setze("MSG_VERSION", _text(meldung.fassung))
    return zeile


def _zeile_betreiber(betreiber: Plattformbetreiber) -> _Zeile:
    zeile = _Zeile("PO_Platform_Operator")
    zeile.setze("PO_DOC_REF_ID", _text(betreiber.doc_ref_id))
    zeile.setze("DOC_TYPE_INDIC", _text(betreiber.satzart))
    zeile.setze("CORR_DOC_REF_ID", _text(betreiber.korrigiert_doc_ref_id))
    # Erste Ansässigkeit und erste Steuernummer stehen in der Hauptzeile;
    # weitere bekommen eigene Zusatzzeilen.
    if betreiber.ansaessig_in:
        zeile.setze("RESIDENCE", _text(betreiber.ansaessig_in[0]))
    if betreiber.steuernummern:
        _steuernummer_setzen(zeile, betreiber.steuernummern[0])
    _anschrift_setzen(zeile, betreiber.anschrift)
    zeile.setze("IN", _text(betreiber.identifikationsnummer))
    zeile.setze("IN_ISSUED_BY", _text(betreiber.identifikationsnummer_land))
    zeile.setze("IN_TYPE", _text(betreiber.identifikationsnummer_art))
    zeile.setze("ORGANISATION_NAME", _text(betreiber.name))
    zeile.setze("PO_NEXUS", _text(betreiber.nexus))
    zeile.setze("PO_ASSUMED_REPORTING", _wahrheit(betreiber.meldung_uebernommen))
    zeile.setze("VAT", _text(betreiber.umsatzsteuer_id))
    zeile.setze("BUSINESS_NAME", _text(betreiber.geschaeftsname))
    return zeile


def _zeilen_betreiber_zusatz(betreiber: Plattformbetreiber) -> list[_Zeile]:
    """Weitere Ansässigkeiten und Steuernummern des Betreibers.

    Die erste steht bereits in der Hauptzeile; alles Weitere braucht eigene
    Zeilen, weil eine CSV keine Wiederholgruppen kennt.
    """
    zeilen: list[_Zeile] = []
    for land in betreiber.ansaessig_in[1:]:
        z = _Zeile("PO_Residence_Country_Code")
        z.setze("RESIDENCE", _text(land))
        zeilen.append(z)
    for nummer in betreiber.steuernummern[1:]:
        z = _Zeile("PO_Tax_Identification_Number")
        _steuernummer_setzen(z, nummer)
        zeilen.append(z)
    return zeilen


def _zeile_anbieter(anbieter: Anbieter) -> _Zeile:
    zeilentyp = (
        "RS_IND_Individual_Seller"
        if anbieter.ist_person
        else "RS_ENT_Entity_Seller"
    )
    zeile = _Zeile(zeilentyp)
    zeile.setze("RS_DOC_REF_ID", _text(anbieter.doc_ref_id))
    zeile.setze("DOC_TYPE_INDIC", _text(anbieter.satzart))
    zeile.setze("CORR_DOC_REF_ID", _text(anbieter.korrigiert_doc_ref_id))
    if anbieter.ansaessig_in:
        zeile.setze("RESIDENCE", _text(anbieter.ansaessig_in[0]))
    if anbieter.steuernummern:
        _steuernummer_setzen(zeile, anbieter.steuernummern[0])
    _anschrift_setzen(zeile, anbieter.anschrift)
    zeile.setze("VAT", _text(anbieter.umsatzsteuer_id))

    if anbieter.finanzkonto:
        zeile.setze("RS_FI_ACCT_NUMBER", _text(anbieter.finanzkonto.kennung))
        zeile.setze("RS_FI_ACCT_NUMBER_TYPE", _text(anbieter.finanzkonto.art))
        zeile.setze("RS_FI_ACCT_HOLDER_NAME", _text(anbieter.finanzkonto.inhaber))

    if anbieter.ist_person:
        zeile.setze("RS_BIRTH_DATE", _datum(anbieter.geburtsdatum))
        zeile.setze("RS_BIRTH_PLACE_CITY", _text(anbieter.geburtsort))
        zeile.setze("RS_BIRTH_COUNTRY", _text(anbieter.geburtsland))
        zeile.setze("RS_NM_FIRST_NAME", _text(anbieter.vorname))
        zeile.setze("RS_NM_MIDDLE_NAME", _text(anbieter.zweitname))
        zeile.setze("RS_NM_LAST_NAME", _text(anbieter.nachname))
    else:
        zeile.setze("ORGANISATION_NAME", _text(anbieter.name))
        zeile.setze("IN", _text(anbieter.handelsregisternummer))
        zeile.setze("IN_ISSUED_BY", _text(anbieter.handelsregister_land))
        zeile.setze("IN_TYPE", _text(anbieter.handelsregister_art))
        zeile.setze("RS_PERM_ESTABLISHMENT", _text(anbieter.betriebsstaette_in))
    return zeile


def _zeilen_anbieter_zusatz(anbieter: Anbieter) -> list[_Zeile]:
    zeilen: list[_Zeile] = []
    for land in anbieter.ansaessig_in[1:]:
        z = _Zeile("RS_Residence_Country_Code")
        z.setze("RS_DOC_REF_ID", _text(anbieter.doc_ref_id))
        z.setze("RESIDENCE", _text(land))
        zeilen.append(z)
    for nummer in anbieter.steuernummern[1:]:
        z = _Zeile("RS_Tax_Identification_Number")
        z.setze("RS_DOC_REF_ID", _text(anbieter.doc_ref_id))
        _steuernummer_setzen(z, nummer)
        zeilen.append(z)
    return zeilen


def _zeile_vermietung(anbieter: Anbieter, taetigkeit: Vermietung) -> _Zeile:
    zeile = _Zeile("ACT_Immovable_Property")
    zeile.setze("RS_DOC_REF_ID", _text(anbieter.doc_ref_id))
    _anschrift_setzen(zeile, taetigkeit.anschrift)

    for q in (1, 2, 3, 4):
        zeile.setze(f"RS_ACT_NUM_Q{q}", _zahl(taetigkeit.anzahl[q]))
    _quartalswerte_setzen(
        zeile, "RS_ACT_CONS", taetigkeit.verguetung, taetigkeit.waehrung
    )
    _quartalswerte_setzen(
        zeile, "RS_ACT_FEES", taetigkeit.gebuehren, taetigkeit.waehrung
    )
    _quartalswerte_setzen(
        zeile, "RS_ACT_TAX", taetigkeit.steuern, taetigkeit.waehrung
    )

    zeile.setze("RS_ACT_LAND_REG_NUM", _text(taetigkeit.grundbuchnummer))
    zeile.setze("RS_ACT_PROP_TYPE", _text(taetigkeit.objektart))
    zeile.setze("RS_ACT_OTHER_PROP_TYPE", _text(taetigkeit.objektart_freitext))
    zeile.setze("RS_ACT_RENTED_DAYS", _zahl(taetigkeit.vermietete_tage))

    if taetigkeit.daenisch:
        dk = taetigkeit.daenisch
        zeile.setze("RS_ACT_DK_GRI", _betrag(dk.brutto_mieteinnahme))
        zeile.setze("RS_ACT_DK_GRI_CCY", _text(dk.brutto_mieteinnahme_waehrung))
        zeile.setze("RS_ACT_DK_REAL_PROP_REG_NUM", _text(dk.bfe_nummer))
    return zeile


# Byte Order Mark. Sie steht am Anfang der Datei und sagt dem Leser:
# „das ist UTF-8".
#
# WARUM SIE SEIN MUSS — und warum das kein Schönheitsfehler ist:
# Das Export-Makro der amtlichen Vorlage (`EksporterCSV` in
# `xl/vbaProject.bin`) speichert mit `FileFormat: xlCSVUTF8`. Genau dieses
# Excel-Format schreibt UTF-8 MIT BOM; das ist sein Unterschied zum älteren
# `xlCSV`. Wer die Datei der Behörde nachbaut, muss sie also mit BOM
# schreiben.
#
# Was ohne BOM live passiert (11.09.2026 gemeldet): Excel auf einem
# deutschen oder dänischen System erkennt `;` nicht als Trennzeichen und
# legt die ganze Zeile in EINE Spalte. Die Datei sieht dann hochkant aus —
# 22 Zeilen à einem Feld statt 22 × 89. Der Inhalt ist korrekt, unbrauchbar
# ist die Ansicht. Genau so wurde es berichtet: „die csv zum download kommt
# immer noch hochformat".
#
# Beide Prüfstellen verkraften sie: Die Empfangsstelle liest `utf-8-sig`
# (`einreichung._text_lesen`), unsere eigene Dateiprüfung strippt sie
# (`dateipruefung`, Zeile 489). Die Zeichenkette selbst bleibt unverändert —
# das BOM kommt erst beim Kodieren dazu.
_BOM = "\ufeff"


def schreiben(meldung: Meldung) -> str:
    """Die vollständige CSV einer Meldung, mit BOM.

    Die Reihenfolge ist festgelegt und wiederholbar: Nachricht, Betreiber
    samt Zusatzzeilen, dann je Anbieter seine Zeile, seine Zusatzzeilen und
    seine Tätigkeiten. Zweimal aufgerufen ergibt sie dieselbe Zeichenkette —
    Voraussetzung dafür, eine Korrekturmeldung begründen zu können.
    """
    zeilen: list[_Zeile] = [_zeile_message(meldung)]
    zeilen.append(_zeile_betreiber(meldung.betreiber))
    zeilen.extend(_zeilen_betreiber_zusatz(meldung.betreiber))

    for anbieter in meldung.anbieter:
        zeilen.append(_zeile_anbieter(anbieter))
        zeilen.extend(_zeilen_anbieter_zusatz(anbieter))
        for taetigkeit in anbieter.taetigkeiten:
            zeilen.append(_zeile_vermietung(anbieter, taetigkeit))

    return _BOM + "\n".join([_kopf(), *(z.als_text() for z in zeilen)]) + "\n"
