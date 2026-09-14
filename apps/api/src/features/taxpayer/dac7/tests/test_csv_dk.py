"""Prüft die erzeugte CSV gegen die Formatvorgaben der Vorlage."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from src.features.taxpayer.dac7.csv_dk import schreiben
from src.features.taxpayer.dac7.modell import (
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
from src.features.taxpayer.dac7.spalten import SPALTEN


def _betreiber(**felder: object) -> Plattformbetreiber:
    grund: dict = {
        "doc_ref_id": "DK2025444444440PO",
        "name": "Beispielbetrieb",
        "ansaessig_in": ("DK",),
        "steuernummern": (Steuernummer(wert="44444444", ausgestellt_von="DK"),),
        "anschrift": Anschrift(
            land="DK", strasse="Testvej", hausnummer="1", plz="9999",
            ort="Testby", art="OECD304",
        ),
        "nexus": "RPONEX1",
    }
    grund.update(felder)
    return Plattformbetreiber(**grund)


def _vermietung(**felder: object) -> Vermietung:
    grund: dict = {
        "anschrift": Anschrift(land="DK", plz="9881", ort="Bindslev"),
        "verguetung": Quartalswerte(q2=Decimal("5836"), q3=Decimal("28472")),
        "gebuehren": Quartalswerte(q2=Decimal("2794"), q3=Decimal("8117")),
        "steuern": Quartalswerte(),
        "anzahl": Quartalszahlen(q2=6, q3=4),
        "waehrung": "DKK",
        "objektart": "DPI904",
        "vermietete_tage": 79,
    }
    grund.update(felder)
    return Vermietung(**grund)


def _anbieter(**felder: object) -> Anbieter:
    grund: dict = {
        "doc_ref_id": "DK202544444444001",
        "ist_person": True,
        "ansaessig_in": ("DK",),
        "steuernummern": (Steuernummer(wert="1111112222", ausgestellt_von="DK"),),
        "anschrift": Anschrift(
            land="DK", strasse="Testgade", hausnummer="8", plz="8270",
            ort="Testhoej", art="OECD302",
        ),
        "vorname": "Anna",
        "nachname": "Testperson",
        "geburtsdatum": date(1978, 11, 11),
        "taetigkeiten": (_vermietung(),),
    }
    grund.update(felder)
    return Anbieter(**grund)


def _meldung(**felder: object) -> Meldung:
    grund: dict = {
        "melde_ref_id": "DK2025DK44444444AS25",
        "jahr": 2025,
        "meldeart": "DPI401",
        "betreiber": _betreiber(),
        "anbieter": (_anbieter(),),
    }
    grund.update(felder)
    return Meldung(**grund)


def _zeilen(text: str) -> list[list[str]]:
    """Die Datei in Felder zerlegen — wie jeder echte Leser.

    `lstrip("\ufeff")` zieht die BOM ab: Sie steht VOR der Kopfzeile und
    ist kein Teil der ersten Spalte. Jeder Leser der Datei entfernt sie
    ebenso — die Empfangsstelle beim Dekodieren mit `utf-8-sig`, unsere
    Dateipruefung ausdruecklich. Ein Test, der sie in `ROW_TYPE`
    hineinrechnet, pruefte etwas, das nirgends passiert.
    """
    ohne_bom = text.lstrip("\ufeff")
    return [z.split(";") for z in ohne_bom.rstrip("\n").split("\n")]


def _feld(zeile: list[str], spalte: str) -> str:
    return zeile[SPALTEN.index(spalte)]


class TestAufbau:
    def test_datei_beginnt_mit_bom(self) -> None:
        """UTF-8 MIT BOM — so exportiert die amtliche Vorlage selbst.

        Ihr Makro `EksporterCSV` (in `xl/vbaProject.bin`) speichert mit
        `FileFormat: xlCSVUTF8`, und genau dieses Excel-Format schreibt
        die BOM; das ist sein Unterschied zum aelteren `xlCSV`.

        Warum das ein eigener Test ist: Die BOM faellt still weg, wenn
        jemand den Serialisierer umbaut — JEDER Leser strippt sie, also
        bleibt jeder andere Test gruen. Sichtbar wird ihr Fehlen erst in
        Excel: Ohne sie erkennt es auf einem deutschen oder daenischen
        System das `;` nicht als Trennzeichen und legt die ganze Zeile in
        EINE Spalte. Die Datei sieht dann hochkant aus (live gemeldet am
        11.09.2026).
        """
        assert schreiben(_meldung()).startswith("\ufeff")

    def test_kopfzeile_ist_die_spaltenliste(self) -> None:
        assert _zeilen(schreiben(_meldung()))[0] == list(SPALTEN)

    def test_jede_zeile_hat_genau_89_felder(self) -> None:
        """Eine Zeile mit abweichender Feldzahl bricht den Einleseweg."""
        for zeile in _zeilen(schreiben(_meldung())):
            assert len(zeile) == len(SPALTEN)

    def test_reihenfolge_nachricht_betreiber_anbieter_taetigkeit(self) -> None:
        zeilen = _zeilen(schreiben(_meldung()))[1:]
        assert [z[0] for z in zeilen] == [
            "Message",
            "PO_Platform_Operator",
            "RS_IND_Individual_Seller",
            "ACT_Immovable_Property",
        ]

    def test_nachrichtenkennung_nur_in_der_message_zeile(self) -> None:
        """Die Kennung steht genau einmal, nicht in jeder Zeile.

        Hier stand einmal die Erwartung, ALLE Zeilen trügen sie — nach der
        Kardinalitaet `1..1`, die die Feldtabelle bei jedem Zeilentyp fuehrt.
        Die beschreibt aber das DPI-XML-Zielschema. In der flachen CSV
        entsteht die Zuordnung ueber Reihenfolge und RS_DOC_REF_ID; alle
        fuenf Beispielblaetter der Vorlage lassen die Spalte ab Zeile 2 leer.
        """
        zeilen = _zeilen(schreiben(_meldung()))[1:]
        assert _feld(zeilen[0], "ROW_TYPE") == "Message"
        assert _feld(zeilen[0], "MSG_MESSAGE_REF_ID") == "DK2025DK44444444AS25"
        for z in zeilen[1:]:
            assert _feld(z, "MSG_MESSAGE_REF_ID") == ""

    def test_betreiberkennung_nur_in_der_betreiberzeile(self) -> None:
        zeilen = _zeilen(schreiben(_meldung()))[1:]
        mit = [z for z in zeilen if _feld(z, "PO_DOC_REF_ID")]
        assert len(mit) == 1
        assert _feld(mit[0], "ROW_TYPE") == "PO_Platform_Operator"

    def test_taetigkeit_haengt_an_ihrem_anbieter(self) -> None:
        """Die Zuordnung entsteht allein über die Anbieterkennung."""
        zeilen = _zeilen(schreiben(_meldung()))[1:]
        anbieter = next(z for z in zeilen if z[0] == "RS_IND_Individual_Seller")
        taetigkeit = next(z for z in zeilen if z[0] == "ACT_Immovable_Property")
        assert _feld(anbieter, "RS_DOC_REF_ID") == _feld(taetigkeit, "RS_DOC_REF_ID")


class TestFormat:
    def test_meldezeitraum_ist_der_jahresletzte(self) -> None:
        zeile = _zeilen(schreiben(_meldung()))[1]
        assert _feld(zeile, "MSG_REPORTING_PERIOD") == "31-12-2025"

    def test_geburtsdatum_als_tag_monat_jahr(self) -> None:
        zeilen = _zeilen(schreiben(_meldung()))
        anbieter = next(z for z in zeilen if z[0] == "RS_IND_Individual_Seller")
        assert _feld(anbieter, "RS_BIRTH_DATE") == "11-11-1978"

    def test_betraege_sind_ganzzahlig(self) -> None:
        meldung = _meldung(
            anbieter=(
                _anbieter(
                    taetigkeiten=(
                        _vermietung(verguetung=Quartalswerte(q1=Decimal("1234.56"))),
                    )
                ),
            )
        )
        zeile = next(
            z for z in _zeilen(schreiben(meldung)) if z[0] == "ACT_Immovable_Property"
        )
        assert _feld(zeile, "RS_ACT_CONS_Q1") == "1235"

    def test_betraege_werden_kaufmaennisch_gerundet(self) -> None:
        """Abschneiden meldete systematisch zu wenig."""
        meldung = _meldung(
            anbieter=(
                _anbieter(
                    taetigkeiten=(
                        _vermietung(verguetung=Quartalswerte(q1=Decimal("0.5"))),
                    )
                ),
            )
        )
        zeile = next(
            z for z in _zeilen(schreiben(meldung)) if z[0] == "ACT_Immovable_Property"
        )
        assert _feld(zeile, "RS_ACT_CONS_Q1") == "1"

    def test_waehrung_steht_bei_jedem_quartal(self) -> None:
        zeile = next(
            z
            for z in _zeilen(schreiben(_meldung()))
            if z[0] == "ACT_Immovable_Property"
        )
        for q in (1, 2, 3, 4):
            assert _feld(zeile, f"RS_ACT_CONS_Q{q}_CCY") == "DKK"

    def test_wahrheitswerte_auf_daenisch(self) -> None:
        """SANDT/FALSK, nicht 0/1.

        Die Vorlage sagt es an vier Stellen: Datenvalidierung auf R und AJ
        ("SANDT,FALSK"), `Eksempel Oversigt` G9 woertlich
        (PO_ASSUMED_REPORTING=SANDT), Beispiel 2 Zelle AJ3 als Text, und ihr
        Exportmakro ersetzt ;TRUE;->;SANDT;.
        """
        zeile = _zeilen(schreiben(_meldung()))[2]
        assert _feld(zeile, "PO_ASSUMED_REPORTING") == "FALSK"
        assert _feld(zeile, "TIN_UNKNOWN") == "FALSK"

    def test_kommas_bleiben_erhalten(self) -> None:
        """Ein Komma im Namen darf nicht verschwinden.

        Es wurde hier einmal durch ein Leerzeichen ersetzt. Der Exporter der
        Vorlage erhaelt es aber (Komma -> `|` -> Komma), und die Behoerde
        schreibt selbst Kommas in ihre Beispieldaten:
        "Jesperhus Alle 2, 7000 Fredericia" in ADDR_FREE. Ein Firmenname
        `Muster, Meier & Co` als `Muster Meier & Co` zu melden waere eine
        Verfaelschung.
        """
        meldung = _meldung(betreiber=_betreiber(name="Muster, Meier & Co"))
        text = schreiben(meldung)
        zeile = next(z for z in _zeilen(text) if z[0] == "PO_Platform_Operator")
        assert _feld(zeile, "ORGANISATION_NAME") == "Muster, Meier & Co"
        assert len(zeile) == len(SPALTEN)

    def test_semikolon_im_text_wird_ersetzt(self) -> None:
        """Anders als das Komma zerreisst ein Semikolon die Zeile.

        Die Vorlage schuetzt sich davor nicht und kennt kein Maskieren —
        hier sind wir bewusst strenger.
        """
        meldung = _meldung(betreiber=_betreiber(name="Muster; Meier"))
        text = schreiben(meldung)
        zeile = next(z for z in _zeilen(text) if z[0] == "PO_Platform_Operator")
        assert ";" not in _feld(zeile, "ORGANISATION_NAME")
        assert len(zeile) == len(SPALTEN)

    def test_semikolon_im_text_zerstoert_die_zeile_nicht(self) -> None:
        meldung = _meldung(betreiber=_betreiber(name="Muster; Meier"))
        for zeile in _zeilen(schreiben(meldung)):
            assert len(zeile) == len(SPALTEN)

    def test_zeilenumbruch_im_text_zerstoert_die_datei_nicht(self) -> None:
        meldung = _meldung(betreiber=_betreiber(name="Zeile1\nZeile2"))
        zeilen = _zeilen(schreiben(meldung))
        assert len(zeilen) == 5
        for zeile in zeilen:
            assert len(zeile) == len(SPALTEN)


class TestInhalt:
    def test_gesellschaft_erzeugt_den_anderen_zeilentyp(self) -> None:
        meldung = _meldung(
            anbieter=(
                _anbieter(
                    ist_person=False,
                    name="Ferien GmbH",
                    vorname=None,
                    nachname=None,
                    geburtsdatum=None,
                    handelsregisternummer="HRB123",
                    handelsregister_land="DE",
                    handelsregister_art="BRN",
                ),
            )
        )
        zeilen = _zeilen(schreiben(meldung))
        gesellschaft = next(z for z in zeilen if z[0] == "RS_ENT_Entity_Seller")
        assert _feld(gesellschaft, "ORGANISATION_NAME") == "Ferien GmbH"
        assert _feld(gesellschaft, "IN") == "HRB123"

    def test_weitere_ansaessigkeit_bekommt_eine_eigene_zeile(self) -> None:
        """Eine CSV kennt keine Wiederholgruppen."""
        meldung = _meldung(anbieter=(_anbieter(ansaessig_in=("DK", "DE")),))
        zeilen = _zeilen(schreiben(meldung))
        zusatz = [z for z in zeilen if z[0] == "RS_Residence_Country_Code"]
        assert len(zusatz) == 1
        assert _feld(zusatz[0], "RESIDENCE") == "DE"

    def test_weitere_steuernummer_bekommt_eine_eigene_zeile(self) -> None:
        meldung = _meldung(
            anbieter=(
                _anbieter(
                    steuernummern=(
                        Steuernummer(wert="111", ausgestellt_von="DK"),
                        Steuernummer(wert="222", ausgestellt_von="DE"),
                    )
                ),
            )
        )
        zusatz = [
            z
            for z in _zeilen(schreiben(meldung))
            if z[0] == "RS_Tax_Identification_Number"
        ]
        assert len(zusatz) == 1
        assert _feld(zusatz[0], "TIN") == "222"

    def test_finanzkonto_wird_uebernommen(self) -> None:
        meldung = _meldung(
            anbieter=(
                _anbieter(
                    finanzkonto=Finanzkonto(
                        kennung="5470-0003768159", art="Reg.nr. og kontonr."
                    )
                ),
            )
        )
        zeile = next(
            z
            for z in _zeilen(schreiben(meldung))
            if z[0] == "RS_IND_Individual_Seller"
        )
        assert _feld(zeile, "RS_FI_ACCT_NUMBER") == "5470-0003768159"

    def test_daenische_zusatzfelder(self) -> None:
        meldung = _meldung(
            anbieter=(
                _anbieter(
                    taetigkeiten=(
                        _vermietung(
                            daenisch=DaenischerAnhang(
                                brutto_mieteinnahme=Decimal("34308"),
                                brutto_mieteinnahme_waehrung="DKK",
                                bfe_nummer="3155601",
                            )
                        ),
                    )
                ),
            )
        )
        zeile = next(
            z
            for z in _zeilen(schreiben(meldung))
            if z[0] == "ACT_Immovable_Property"
        )
        assert _feld(zeile, "RS_ACT_DK_GRI") == "34308"
        assert _feld(zeile, "RS_ACT_DK_GRI_CCY") == "DKK"
        assert _feld(zeile, "RS_ACT_DK_REAL_PROP_REG_NUM") == "3155601"

    def test_nullmeldung_hat_keine_anbieterzeilen(self) -> None:
        text = schreiben(_meldung(meldeart="DPI403", anbieter=()))
        typen = [z[0] for z in _zeilen(text)[1:]]
        assert typen == ["Message", "PO_Platform_Operator"]

    def test_korrektur_traegt_die_ursprungskennung(self) -> None:
        meldung = _meldung(
            meldeart="DPI402",
            anbieter=(
                _anbieter(
                    satzart="OECD2", korrigiert_doc_ref_id="DK202544444444001"
                ),
            ),
        )
        zeile = next(
            z
            for z in _zeilen(schreiben(meldung))
            if z[0] == "RS_IND_Individual_Seller"
        )
        assert _feld(zeile, "DOC_TYPE_INDIC") == "OECD2"
        assert _feld(zeile, "CORR_DOC_REF_ID") == "DK202544444444001"


class TestReproduzierbarkeit:
    def test_zweimal_erzeugt_ergibt_dieselbe_datei(self) -> None:
        """Ohne das lässt sich keine Korrekturmeldung begründen."""
        meldung = _meldung()
        assert schreiben(meldung) == schreiben(meldung)

    def test_mehrere_anbieter_behalten_ihre_reihenfolge(self) -> None:
        meldung = _meldung(
            anbieter=(
                _anbieter(doc_ref_id="DK202544444444001", nachname="Aaa"),
                _anbieter(doc_ref_id="DK202544444444002", nachname="Bbb"),
            )
        )
        kennungen = [
            _feld(z, "RS_DOC_REF_ID")
            for z in _zeilen(schreiben(meldung))
            if z[0] == "RS_IND_Individual_Seller"
        ]
        assert kennungen == ["DK202544444444001", "DK202544444444002"]
