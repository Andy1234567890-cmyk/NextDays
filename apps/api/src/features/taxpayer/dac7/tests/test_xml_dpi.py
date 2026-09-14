"""Der DPI-XML-Serialisierer (`xml_dpi.py`).

Geprueft wird, dass CSV und XML DIESELBE Meldung beschreiben. Das ist der
Kern: Beide lesen denselben gerechneten Baum, und wo sie
auseinanderlaufen, ist einer von beiden falsch.

Die Gegenprobe gegen die unabhaengige Empfangsstelle
(`apps/dac7-staging`) laeuft NICHT hier — die beiden Dienste teilen
bewusst keinen Import. Sie ist Teil der Teststufe.

Zu `# noqa: S314`: Die Regel warnt davor, FREMDES XML mit der Stdlib zu
lesen (XXE, billion laughs). Hier wird ausschliesslich der eigene, eben
erzeugte Text geparst — es gibt keine fremde Eingabe. Der Pruefer der
Empfangsstelle, der wirklich fremdes XML liest, weist DTD und Entities
vorher ab (`pruefung_xml._GEFAEHRLICH`).
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import date
from decimal import Decimal

import pytest

from ..csv_dk import schreiben as schreiben_csv
from ..modell import (
    Anbieter,
    Anschrift,
    DaenischerAnhang,
    Finanzkonto,
    Meldung,
    Plattformbetreiber,
    Quartalswerte,
    Quartalszahlen,
    Steuernummer,
    Vermietung,
)
from ..xml_dpi import NS_DPI, schreiben

NS = {"d": NS_DPI}


def _meldung(*, mit_firma: bool = True) -> Meldung:
    betrieb = Plattformbetreiber(
        doc_ref_id="DK202539128454_PO",
        name="Nordstrand Feriehusudlejning ApS",
        ansaessig_in=("DK",),
        steuernummern=(Steuernummer("39128454", "DK"),),
        anschrift=Anschrift(
            "DK", "Havnegade", "14", "6950", "Ringkøbing", "OECD304"
        ),
        nexus="RPONEX1",
        umsatzsteuer_id="DK39128454",
    )
    vermietung = Vermietung(
        anschrift=Anschrift("DK", "Badevej", "12", "6950", "Søndervig"),
        verguetung=Quartalswerte(
            Decimal(0), Decimal(18500), Decimal(42300), Decimal(6200)
        ),
        gebuehren=Quartalswerte(
            Decimal(0), Decimal(2775), Decimal(6345), Decimal(930)
        ),
        steuern=Quartalswerte(Decimal(0), Decimal(0), Decimal(0), Decimal(0)),
        anzahl=Quartalszahlen(0, 3, 7, 1),
        waehrung="DKK",
        objektart="DPI904",
        vermietete_tage=63,
        grundbuchnummer="14BK",
        daenisch=DaenischerAnhang(Decimal(67000), "DKK", "5012847"),
    )
    person = Anbieter(
        doc_ref_id="DK202539128454_001",
        ist_person=True,
        ansaessig_in=("DK",),
        steuernummern=(Steuernummer("120385-4127", "DK"),),
        anschrift=Anschrift(
            "DK", "Badevej", "12", "6950", "Søndervig", "OECD302"
        ),
        vorname="Lars",
        zweitname="Bak",
        nachname="Nielsen",
        geburtsdatum=date(1985, 3, 12),
        geburtsort="Ringkøbing",
        geburtsland="DK",
        finanzkonto=Finanzkonto(
            "7620-0001234567", "Reg.nr. og kontonr.", "Lars Bak Nielsen"
        ),
        taetigkeiten=(vermietung,),
    )
    anbieter: tuple[Anbieter, ...] = (person,)
    if mit_firma:
        anbieter = (
            *anbieter,
            Anbieter(
                doc_ref_id="DK202539128454_002",
                ist_person=False,
                ansaessig_in=("DK",),
                steuernummern=(Steuernummer("25968719", "DK"),),
                anschrift=Anschrift(
                    "DK", "Havnegade", "3", "6950", "Ringkøbing", "OECD304"
                ),
                name="Vestkyst Udlejning ApS",
                handelsregisternummer="25968719",
                handelsregister_land="DK",
                taetigkeiten=(vermietung,),
            ),
        )
    return Meldung(
        melde_ref_id="DK2025DK39128454_T",
        jahr=2025,
        meldeart="DPI401",
        betreiber=betrieb,
        anbieter=anbieter,
        kontakt="Theresa Gruber",
        absender_kennung="39128454",
    )


@pytest.fixture
def baum() -> ET.Element:
    return ET.fromstring(schreiben(_meldung()))  # noqa: S314 — eigener Text


def test_wurzel_und_namensraum(baum: ET.Element) -> None:
    """Ohne beides ist es kein DPI-XML, sondern irgendein XML."""
    assert baum.tag == f"{{{NS_DPI}}}DPI_OECD"


def test_messagespec_traegt_die_pflichtangaben(baum: ET.Element) -> None:
    spec = baum.find("d:MessageSpec", NS)
    assert spec is not None
    for feld, wert in (
        ("TransmittingCountry", "DK"),
        ("MessageRefId", "DK2025DK39128454_T"),
        ("MessageTypeIndic", "DPI401"),
        ("ReportingPeriod", "2025-12-31"),
    ):
        assert spec.findtext(f"d:{feld}", namespaces=NS) == wert, feld


def test_datum_ist_iso_nicht_daenisch(baum: ET.Element) -> None:
    """`2025-12-31`, nicht `31-12-2025`.

    Das Tagesformat der CSV ist eine Eigenheit der Tabellenvorlage; XML
    fuehrt Datumswerte nach ISO 8601. Beides zu verwechseln ist der
    naheliegende Fehler beim Abschreiben vom CSV-Serialisierer.
    """
    spec = baum.find("d:MessageSpec", NS)
    assert spec is not None
    assert spec.findtext("d:ReportingPeriod", namespaces=NS) == "2025-12-31"
    geburt = baum.find(".//d:BirthDate", NS)
    assert geburt is not None
    assert geburt.text == "1985-03-12"


def test_baum_statt_zeilen(baum: ET.Element) -> None:
    """Die Immobilie haengt UNTER ihrem Verkaeufer.

    In der CSV verknuepft `RS_DOC_REF_ID` sie; hier ist die Zuordnung die
    Verschachtelung selbst. Genau deshalb gibt es im XML keine
    Zusatzzeilen.
    """
    body = baum.find("d:DPIBody", NS)
    assert body is not None
    verkaeufer = body.findall("d:ReportableSeller", NS)
    assert len(verkaeufer) == 2
    for v in verkaeufer:
        assert len(v.findall("d:Immovable", NS)) == 1


def test_person_und_gesellschaft_unterscheiden_sich(baum: ET.Element) -> None:
    body = baum.find("d:DPIBody", NS)
    assert body is not None
    erst, zweit = body.findall("d:ReportableSeller", NS)
    assert erst.find("d:Individual", NS) is not None
    assert erst.find("d:Entity", NS) is None
    assert zweit.find("d:Entity", NS) is not None
    assert zweit.find("d:Individual", NS) is None


def test_waehrung_steht_am_betrag(baum: ET.Element) -> None:
    """`currCode` als Attribut je Betrag — so prueft die Gegenstelle es."""
    consideration = baum.find(".//d:Consideration", NS)
    assert consideration is not None
    quartale = list(consideration)
    assert len(quartale) == 4
    for q in quartale:
        assert q.get("currCode") == "DKK"
    assert [q.text for q in quartale] == ["0", "18500", "42300", "6200"]


def test_betraege_sind_ganzzahlig_wie_in_der_csv() -> None:
    """Beide Serialisierer runden gleich.

    Liefen sie auseinander, widersprächen sich CSV und XML derselben
    Meldung — und niemand koennte sagen, welche die richtige ist.
    """
    meldung = _meldung(mit_firma=False)
    # Ein Betrag mit Nachkommastellen: 18500,50 muss in BEIDEN 18501 sein
    # (kaufmaennisch), nicht 18500 in einem und 18501 im anderen.
    taetigkeit = meldung.anbieter[0].taetigkeiten[0]
    krumm = Vermietung(
        anschrift=taetigkeit.anschrift,
        verguetung=Quartalswerte(Decimal(0), Decimal("18500.50"), Decimal(0), Decimal(0)),
        gebuehren=taetigkeit.gebuehren,
        steuern=taetigkeit.steuern,
        anzahl=taetigkeit.anzahl,
        waehrung="DKK",
        objektart=taetigkeit.objektart,
    )
    person = Anbieter(
        doc_ref_id=meldung.anbieter[0].doc_ref_id,
        ist_person=True,
        ansaessig_in=("DK",),
        steuernummern=meldung.anbieter[0].steuernummern,
        anschrift=meldung.anbieter[0].anschrift,
        vorname="Lars",
        nachname="Nielsen",
        taetigkeiten=(krumm,),
    )
    eine = Meldung(
        melde_ref_id=meldung.melde_ref_id,
        jahr=2025,
        meldeart="DPI401",
        betreiber=meldung.betreiber,
        anbieter=(person,),
    )
    baum = ET.fromstring(schreiben(eine))  # noqa: S314 — eigener Text
    q2 = list(baum.find(".//d:Consideration", NS))[1]
    assert q2.text == "18501"
    assert ";18501;" in schreiben_csv(eine)


def test_daenische_felder_stehen_getrennt(baum: ET.Element) -> None:
    """`DKSupplement` — nationale Zusatzfelder nicht im OECD-Kern.

    Sie in den Kern zu mischen hiesse, eine daenische Eigenheit als
    internationalen Standard auszugeben.
    """
    anhang = baum.find(".//d:DKSupplement", NS)
    assert anhang is not None
    gri = anhang.find("d:GrossRentalIncome", NS)
    assert gri is not None
    assert gri.text == "67000"
    assert gri.get("currCode") == "DKK"
    assert (
        anhang.findtext("d:RealPropertyRegistrationNumber", namespaces=NS)
        == "5012847"
    )


def test_leere_angaben_erzeugen_kein_element() -> None:
    """Ein leeres Element ist eine Aussage, eine fehlende Angabe nicht.

    Wer nichts weiss, schreibt nichts — nicht die leere Zeichenkette
    (Wurzel 4).
    """
    meldung = _meldung(mit_firma=False)
    ohne = Anbieter(
        doc_ref_id="X1",
        ist_person=True,
        ansaessig_in=("DK",),
        steuernummern=(Steuernummer("120385-4127", "DK"),),
        anschrift=Anschrift("DK", ort="Søndervig"),
        vorname="Lars",
        nachname="Nielsen",
        # kein Zweitname, kein Geburtsdatum, kein Konto
    )
    text = schreiben(
        Meldung(
            melde_ref_id="X",
            jahr=2025,
            meldeart="DPI401",
            betreiber=meldung.betreiber,
            anbieter=(ohne,),
        )
    )
    assert "MiddleName" not in text
    assert "BirthInfo" not in text
    assert "FinancialIdentifier" not in text


def test_zweimal_erzeugt_ergibt_dasselbe_bis_auf_den_zeitstempel() -> None:
    """Reproduzierbarkeit — Voraussetzung fuer eine Korrekturmeldung.

    Der `Timestamp` ist der Uebermittlungszeitpunkt und gehoert zur
    Nachricht, nicht zu den gemeldeten Daten. Deshalb wird die Pruefsumme
    einer Meldung ueber die CSV gebildet, nicht hierueber.
    """
    import re

    meldung = _meldung()
    ohne_zeit = lambda t: re.sub(  # noqa: E731
        r"<dpi:Timestamp>[^<]+</dpi:Timestamp>", "", t
    )
    assert ohne_zeit(schreiben(meldung)) == ohne_zeit(schreiben(meldung))


def test_mehrere_ansaessigkeiten_brauchen_keine_zusatzzeile() -> None:
    """Im XML sind es mehrere gleichnamige Elemente.

    Die CSV braucht dafuer eine `RS_Residence_Country_Code`-Zusatzzeile —
    ein Artefakt des flachen Formats, keine fachliche Angabe.
    """
    meldung = _meldung(mit_firma=False)
    mehrfach = Anbieter(
        doc_ref_id="X1",
        ist_person=True,
        ansaessig_in=("DK", "DE", "SE"),
        steuernummern=(
            Steuernummer("120385-4127", "DK"),
            Steuernummer("12345678901", "DE"),
        ),
        anschrift=Anschrift("DK", ort="Søndervig"),
        vorname="Lars",
        nachname="Nielsen",
    )
    baum = ET.fromstring(  # noqa: S314 — eigener Text
        schreiben(
            Meldung(
                melde_ref_id="X",
                jahr=2025,
                meldeart="DPI401",
                betreiber=meldung.betreiber,
                anbieter=(mehrfach,),
            )
        )
    )
    verkaeufer = baum.find(".//d:ReportableSeller", NS)
    assert verkaeufer is not None
    assert [
        e.text for e in verkaeufer.findall("d:ResCountryCode", NS)
    ] == ["DK", "DE", "SE"]
    assert len(verkaeufer.findall("d:TIN", NS)) == 2
