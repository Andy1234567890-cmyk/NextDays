"""Serialisiert eine Meldung als OECD-DPI-XML.

Das Gegenstueck zu `csv_dk.py`: derselbe Baum, das andere Zielformat. Ein
reiner UEBERSETZER — er rechnet nichts, entscheidet nichts, laesst nichts
weg. Alles Fachliche steht im Modell und im Rechner.

WARUM ES DIESE DATEI GIBT
=========================
Daenemark nimmt die Meldung fuer das Meldejahr 2025 als CSV entgegen und ab
2026 als DPI-XML. Bis zum 11.09.2026 konnte das Modul nur CSV erzeugen,
waehrend die Empfangsstelle bereits XML pruefte (`pruefung_xml.py`). Der
Weg war damit nur in eine Richtung befahrbar: Wir konnten pruefen, was wir
nicht erzeugen konnten.

Moeglich ist die Datei nur, weil `modell.py` formatneutral gebaut ist. Sie
fuegt dem Modell kein Feld hinzu und aendert keines.

WAS DIE CSV NICHT KANN UND DAS XML SCHON
=========================================
Die CSV kennt keine Wiederholgruppen: Eine zweite Ansaessigkeit oder eine
zweite Steuernummer braucht dort eine eigene Zusatzzeile
(`PO_Residence_Country_Code`, `RS_Tax_Identification_Number`). Im XML sind
es schlicht mehrere gleichnamige Elemente am selben Knoten. Die
Zusatzzeilen haben deshalb hier KEINE Entsprechung — sie sind ein Artefakt
des flachen Formats, keine fachliche Angabe.

Ebenso die Zugehoerigkeit: Was in der CSV ueber `RS_DOC_REF_ID` und die
Zeilenreihenfolge zusammenhaengt, haengt hier ineinander. Die
Kardinalitaet `1..1` aus dem Blatt `Vejledningstekster` beschreibt genau
diese Baumform.

FORMATVORGABEN
==============
  * Namensraum `urn:oecd:ties:dpi:v1`, Wurzel `DPI_OECD`
  * Datum ISO `YYYY-MM-DD` — NICHT das `DD-MM-YYYY` der CSV. Das
    daenische Tagesformat ist eine Eigenheit ihrer Tabellenvorlage; XML
    fuehrt Datumswerte nach ISO 8601.
  * Betraege ganzzahlig, Waehrung als Attribut `currCode` am Betrag
  * Zeitstempel `Timestamp` in UTC
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import UTC, date, datetime
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

NS_DPI = "urn:oecd:ties:dpi:v1"
NS_STF = "urn:oecd:ties:dpistf:v1"

# Die vier Quartale als Zeitraumkennung, wie das DPI-Schema sie fuehrt.
_QUARTALE = ("Q1", "Q2", "Q3", "Q4")


def _betrag(wert: Decimal | None) -> str:
    """Ein Geldbetrag als Ganzzahl — dieselbe Rundung wie in der CSV.

    Kaufmaennisch gerundet, nicht abgeschnitten: Abschneiden meldete
    systematisch zu wenig. Beide Serialisierer muessen denselben Wert
    ergeben, sonst widersprechen sich CSV und XML derselben Meldung.
    """
    if wert is None:
        return "0"
    return str(int(wert.quantize(Decimal(1), rounding=ROUND_HALF_UP)))


def _datum(wert: date | None) -> str:
    return wert.isoformat() if wert else ""


def _kind(eltern: ET.Element, name: str, text: str | None = None) -> ET.Element:
    """Ein Kindelement anlegen; leere Werte erzeugen KEIN Element.

    Ein leeres Element ist im XML eine Aussage („das Feld ist da und
    leer"), eine fehlende Angabe ist etwas anderes. Wer nichts weiss,
    schreibt nichts — nicht die leere Zeichenkette (Wurzel 4).
    """
    el = ET.SubElement(eltern, f"{{{NS_DPI}}}{name}")
    if text:
        el.text = text
    return el


def _wenn(eltern: ET.Element, name: str, text: str | None) -> None:
    """Ein Element nur anlegen, wenn ein Wert vorliegt."""
    if text:
        _kind(eltern, name, text)


def _anschrift(eltern: ET.Element, anschrift: Anschrift) -> None:
    """Eine Anschrift als `Address`-Knoten.

    Das DPI-Schema kennt die aufgeteilte Fassung (`AddressFix`) und die
    Freitextfassung (`AddressFree`) als WAHL, nicht als Paar — anders als
    die CSV, die beide Spalten nebeneinander fuehrt und in den amtlichen
    Beispielen auch beide fuellt.

    Deshalb hier eine Entscheidung statt einer Uebernahme: Liegt eine
    strukturierte Anschrift vor, wird sie strukturiert gemeldet und der
    Freitext zusaetzlich als `AddressFree` gefuehrt (das Schema erlaubt ihn
    neben `AddressFix`). Liegt NUR der Freitext vor, ist `AddressFree` die
    einzige zulaessige Fassung — ein leerer `AddressFix` waere ein
    Schemafehler.
    """
    el = _kind(eltern, "Address")
    if anschrift.land:
        _kind(el, "CountryCode", anschrift.land)
    strukturiert = any(
        (anschrift.strasse, anschrift.hausnummer, anschrift.plz, anschrift.ort)
    )
    if strukturiert:
        fix = _kind(el, "AddressFix")
        _wenn(fix, "Street", anschrift.strasse)
        _wenn(fix, "BuildingIdentifier", anschrift.hausnummer)
        _wenn(fix, "PostCode", anschrift.plz)
        _wenn(fix, "City", anschrift.ort)
    _wenn(el, "AddressFree", anschrift.freitext)
    if anschrift.art:
        el.set("legalAddressType", anschrift.art)


def _steuernummer(eltern: ET.Element, nummer: Steuernummer) -> None:
    """Eine Steuernummer als `TIN` mit ausstellendem Staat.

    `unknown="true"` ist die zulaessige Aussage „dieser Staat vergibt
    keine" — etwas anderes als eine fehlende Nummer.
    """
    el = _kind(eltern, "TIN", nummer.wert or "")
    if nummer.ausgestellt_von:
        el.set("issuedBy", nummer.ausgestellt_von)
    if nummer.unbekannt:
        el.set("unknown", "true")


def _docspec(eltern: ET.Element, kennung: str, art: str, korrigiert: str | None) -> None:
    """Der `DocSpec`-Knoten: Kennung und Satzart eines meldbaren Satzes.

    `CorrDocRefId` verweist auf den Satz, den dieser korrigiert. Ohne ihn
    kann sich eine Korrekturmeldung auf nichts beziehen.
    """
    el = _kind(eltern, "DocSpec")
    _wenn(el, "DocTypeIndic", art)
    _wenn(el, "DocRefId", kennung)
    _wenn(el, "CorrDocRefId", korrigiert)


def _quartalsbetraege(
    eltern: ET.Element, name: str, werte: Quartalswerte, waehrung: str
) -> None:
    """Vier Quartalsbetraege unter einem Sammelknoten.

    Die Waehrung steht als Attribut an jedem einzelnen Betrag, nicht am
    Sammelknoten — so fuehrt das DPI-Schema sie, und so prueft die
    Empfangsstelle sie auch.
    """
    sammel = _kind(eltern, name)
    for nr, quartal in enumerate(_QUARTALE, start=1):
        el = _kind(sammel, quartal, _betrag(werte[nr]))
        if waehrung:
            el.set("currCode", waehrung)


def _quartalszahlen(eltern: ET.Element, name: str, taetigkeit: Vermietung) -> None:
    sammel = _kind(eltern, name)
    for nr, quartal in enumerate(_QUARTALE, start=1):
        _kind(sammel, quartal, str(taetigkeit.anzahl[nr]))


def _messagespec(wurzel: ET.Element, meldung: Meldung) -> None:
    """Der Kopf der Nachricht.

    `TransmittingCountry` ist der uebermittelnde Staat, nicht der Staat des
    Betriebs. Beides faellt hier zusammen (Daenemark meldet an Daenemark),
    bleibt aber getrennt benannt, damit es bei einer Meldung aus einem
    anderen Mitgliedstaat nicht stillschweigend falsch wird.
    """
    spec = _kind(wurzel, "MessageSpec")
    _wenn(spec, "SendingEntityIN", meldung.absender_kennung)
    _kind(spec, "TransmittingCountry", meldung.betreiber.anschrift.land or "DK")
    _kind(spec, "ReceivingCountry", "DK")
    _kind(spec, "MessageType", "DPI")
    _wenn(spec, "Warning", meldung.hinweis)
    _wenn(spec, "Contact", meldung.kontakt)
    _kind(spec, "MessageRefId", meldung.melde_ref_id)
    _kind(spec, "MessageTypeIndic", meldung.meldeart)
    _kind(spec, "ReportingPeriod", _datum(meldung.zeitraum_ende))
    _kind(spec, "Timestamp", datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"))


def _betreiber(body: ET.Element, betreiber: Plattformbetreiber) -> None:
    el = _kind(body, "PlatformOperator")
    for land in betreiber.ansaessig_in:
        _kind(el, "ResCountryCode", land)
    for nummer in betreiber.steuernummern:
        _steuernummer(el, nummer)
    if betreiber.identifikationsnummer:
        inel = _kind(el, "IN", betreiber.identifikationsnummer)
        if betreiber.identifikationsnummer_land:
            inel.set("issuedBy", betreiber.identifikationsnummer_land)
        if betreiber.identifikationsnummer_art:
            inel.set("INType", betreiber.identifikationsnummer_art)
    _wenn(el, "VAT", betreiber.umsatzsteuer_id)
    name = _kind(el, "Name", betreiber.name)
    name.set("nameType", "OECD207")
    _wenn(el, "BusinessName", betreiber.geschaeftsname)
    _anschrift(el, betreiber.anschrift)
    _wenn(el, "Nexus", betreiber.nexus)
    # Nur schreiben, wenn wahr: `false` ist hier die Vorgabe, und ein
    # ausdrueckliches „nein" traegt keine Information.
    if betreiber.meldung_uebernommen:
        _kind(el, "AssumedReporting", "true")
    _docspec(
        el, betreiber.doc_ref_id, betreiber.satzart, betreiber.korrigiert_doc_ref_id
    )


def _person(el: ET.Element, anbieter: Anbieter) -> None:
    person = _kind(el, "Individual")
    name = _kind(person, "IndividualName")
    _wenn(name, "FirstName", anbieter.vorname)
    _wenn(name, "MiddleName", anbieter.zweitname)
    _wenn(name, "LastName", anbieter.nachname)
    if anbieter.geburtsdatum or anbieter.geburtsort:
        geburt = _kind(person, "BirthInfo")
        _wenn(geburt, "BirthDate", _datum(anbieter.geburtsdatum))
        if anbieter.geburtsort or anbieter.geburtsland:
            ort = _kind(geburt, "BirthPlace")
            _wenn(ort, "City", anbieter.geburtsort)
            _wenn(ort, "CountryCode", anbieter.geburtsland)


def _gesellschaft(el: ET.Element, anbieter: Anbieter) -> None:
    firma = _kind(el, "Entity")
    _kind(firma, "Name", anbieter.name or "")
    if anbieter.handelsregisternummer:
        inel = _kind(firma, "IN", anbieter.handelsregisternummer)
        if anbieter.handelsregister_land:
            inel.set("issuedBy", anbieter.handelsregister_land)
        if anbieter.handelsregister_art:
            inel.set("INType", anbieter.handelsregister_art)
    _wenn(firma, "PermanentEstablishment", anbieter.betriebsstaette_in)


def _verkaeufer(body: ET.Element, anbieter: Anbieter) -> None:
    el = _kind(body, "ReportableSeller")
    for land in anbieter.ansaessig_in:
        _kind(el, "ResCountryCode", land)
    for nummer in anbieter.steuernummern:
        _steuernummer(el, nummer)
    _wenn(el, "VAT", anbieter.umsatzsteuer_id)
    if anbieter.ist_person:
        _person(el, anbieter)
    else:
        _gesellschaft(el, anbieter)
    _anschrift(el, anbieter.anschrift)
    if anbieter.finanzkonto:
        konto = _kind(el, "FinancialIdentifier")
        _kind(konto, "Identifier", anbieter.finanzkonto.kennung)
        _wenn(konto, "AccountHolderName", anbieter.finanzkonto.inhaber)
    _docspec(el, anbieter.doc_ref_id, anbieter.satzart, anbieter.korrigiert_doc_ref_id)
    for taetigkeit in anbieter.taetigkeiten:
        _immobilie(el, taetigkeit)


def _immobilie(eltern: ET.Element, taetigkeit: Vermietung) -> None:
    """Eine vermietete Immobilie unter ihrem Verkaeufer.

    Die daenischen Zusatzfelder stehen in einem eigenen Knoten
    `DKSupplement`: Sie gehoeren NICHT zum OECD-Kern, und sie in ihn zu
    mischen hiesse, eine nationale Eigenheit als internationalen Standard
    auszugeben.
    """
    el = _kind(eltern, "Immovable")
    _anschrift(el, taetigkeit.anschrift)
    _wenn(el, "PropertyType", taetigkeit.objektart)
    _wenn(el, "OtherPropertyType", taetigkeit.objektart_freitext)
    _wenn(el, "LandRegistrationNumber", taetigkeit.grundbuchnummer)
    if taetigkeit.vermietete_tage is not None:
        _kind(el, "NumberOfRentedDays", str(taetigkeit.vermietete_tage))
    _quartalszahlen(el, "NumberOfActivities", taetigkeit)
    _quartalsbetraege(el, "Consideration", taetigkeit.verguetung, taetigkeit.waehrung)
    _quartalsbetraege(el, "Fees", taetigkeit.gebuehren, taetigkeit.waehrung)
    _quartalsbetraege(el, "Taxes", taetigkeit.steuern, taetigkeit.waehrung)
    if taetigkeit.daenisch:
        dk = taetigkeit.daenisch
        anhang = _kind(el, "DKSupplement")
        if dk.brutto_mieteinnahme is not None:
            gri = _kind(anhang, "GrossRentalIncome", _betrag(dk.brutto_mieteinnahme))
            if dk.brutto_mieteinnahme_waehrung:
                gri.set("currCode", dk.brutto_mieteinnahme_waehrung)
        _wenn(anhang, "RealPropertyRegistrationNumber", dk.bfe_nummer)


def schreiben(meldung: Meldung) -> str:
    """Die vollstaendige DPI-XML einer Meldung.

    Zweimal aufgerufen ergibt sie bis auf den `Timestamp` dieselbe
    Zeichenkette. Der Zeitstempel ist der Uebermittlungszeitpunkt und
    gehoert zur Nachricht, nicht zu den gemeldeten Daten — die Pruefsumme
    einer Meldung wird deshalb ueber die CSV gebildet, nicht hierueber.
    """
    ET.register_namespace("dpi", NS_DPI)
    ET.register_namespace("stf", NS_STF)
    wurzel = ET.Element(f"{{{NS_DPI}}}DPI_OECD", {"version": "1.0"})
    _messagespec(wurzel, meldung)
    body = _kind(wurzel, "DPIBody")
    _betreiber(body, meldung.betreiber)
    for anbieter in meldung.anbieter:
        _verkaeufer(body, anbieter)
    ET.indent(wurzel, space="  ")
    roh = ET.tostring(wurzel, encoding="unicode", xml_declaration=False)
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + roh + "\n"
