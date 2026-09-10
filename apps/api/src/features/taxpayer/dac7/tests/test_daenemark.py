"""Die dänischen Steuernummern.

Diese Prüfungen entscheiden, ob die Behörde die Datei annimmt. Ein falsches
Format fällt sonst erst beim Hochladen auf — und eine Person mit
Firmennummer fällt womöglich gar nicht auf, sondern wird schlicht falsch
veranlagt.
"""
from __future__ import annotations

from src.features.taxpayer.dac7.daenemark import (
    cpr_pruefen,
    cvr_aus_vat_id,
    cvr_pruefen,
    steuernummer_pruefen,
    ziffern,
)


class TestNormalisieren:
    def test_bindestrich_faellt_weg(self) -> None:
        """Die amtliche Anleitung nennt das Format "1234567891" — ohne Strich.

        Live stehen die Nummern bei uns MIT Bindestrich in der Datenbank.
        Ohne diese Normalisierung würde die Datei abgelehnt.
        """
        assert ziffern("010190-1234") == "0101901234"

    def test_leerzeichen_und_punkte_fallen_weg(self) -> None:
        assert ziffern("01 01 90 12 34") == "0101901234"
        assert ziffern("44.17.93.77") == "44179377"

    def test_leer_bleibt_leer(self) -> None:
        assert ziffern(None) == ""
        assert ziffern("") == ""


class TestCpr:
    def test_zehn_ziffern_mit_gueltigem_datum(self) -> None:
        pruefung = cpr_pruefen("0101901234")
        assert pruefung.gueltig
        assert pruefung.wert == "010190-1234"
        assert pruefung.art == "CPR"

    def test_bindestrich_wird_gesetzt(self) -> None:
        """Die Meldung schreibt CPR-Nummern MIT Bindestrich.

        Die echte Meldung im Blatt `Indberetning` der amtlichen Vorlage
        traegt alle 18 Personennummern als `DDMMJJ-XXXX`. Das
        Formatbeispiel des Feldkommentars (`"1234567891"`) steht dem
        entgegen; wo beide auseinandergehen, gilt die Belegung.
        """
        assert cpr_pruefen("0101901234").wert == "010190-1234"
        assert cpr_pruefen("010190-1234").wert == "010190-1234"

    def test_zu_kurz_faellt_auf(self) -> None:
        pruefung = cpr_pruefen("111179269")
        assert not pruefung.gueltig
        assert "10 Ziffern" in (pruefung.grund or "")

    def test_zu_lang_faellt_auf(self) -> None:
        assert not cpr_pruefen("01019012341").gueltig

    def test_unmoegliches_datum_faellt_auf(self) -> None:
        """Tag 32 gibt es nicht — ein Zahlendreher fällt so hier auf."""
        assert not cpr_pruefen("3201902691").gueltig

    def test_monat_dreizehn_faellt_auf(self) -> None:
        assert not cpr_pruefen("0113902691").gueltig

    def test_neunundzwanzigster_februar_ist_zulaessig(self) -> None:
        """Sonst scheiterte eine gültige Nummer an der Jahrhundertwahl."""
        assert cpr_pruefen("2902001234").gueltig

    def test_ohne_nummer_faellt_auf(self) -> None:
        pruefung = cpr_pruefen(None)
        assert not pruefung.gueltig
        assert pruefung.wert is None

    def test_alte_pruefziffer_wird_nicht_erzwungen(self) -> None:
        """Die modulo-11-Probe wurde 2007 abgeschafft.

        Seither gibt es gültige Nummern, die sie nicht bestehen. Eine
        Prüfung darauf würde echte Menschen zurückweisen.
        """
        # Diese Nummer besteht die alte Probe nicht, ist aber formal gültig.
        assert cpr_pruefen("0101010000").gueltig


class TestCvr:
    def test_echte_nummern_bestehen(self) -> None:
        """Drei tatsächlich vergebene dänische CVR-Nummern."""
        for nummer in ("44179377", "19435075", "25052943"):
            assert cvr_pruefen(nummer).gueltig, nummer

    def test_erfundene_nummer_faellt_durch(self) -> None:
        pruefung = cvr_pruefen("12345678")
        assert not pruefung.gueltig
        assert "Prüfziffer" in (pruefung.grund or "")

    def test_zahlendreher_faellt_auf(self) -> None:
        """Genau wofür die Prüfziffer da ist."""
        assert cvr_pruefen("44179377").gueltig
        assert not cvr_pruefen("44179737").gueltig

    def test_falsche_laenge_faellt_auf(self) -> None:
        pruefung = cvr_pruefen("4417937")
        assert not pruefung.gueltig
        assert "8 Ziffern" in (pruefung.grund or "")

    def test_ohne_nummer_faellt_auf(self) -> None:
        assert not cvr_pruefen("").gueltig


class TestArtWaehlen:
    """Welche Nummer gilt, entscheidet der Anbieter — nicht das Feld."""

    def test_person_bekommt_die_cpr_pruefung(self) -> None:
        pruefung = steuernummer_pruefen("0101901234", ist_person=True)
        assert pruefung.art == "CPR"
        assert pruefung.gueltig
        assert pruefung.wert == "010190-1234"

    def test_gesellschaft_bekommt_die_cvr_pruefung(self) -> None:
        pruefung = steuernummer_pruefen("44179377", ist_person=False)
        assert pruefung.art == "CVR"
        assert pruefung.gueltig

    def test_firmennummer_bei_einer_person_faellt_auf(self) -> None:
        """Der Fall, der sonst still falsch gemeldet würde.

        Eine achtstellige CVR-Nummer bei einer Privatperson ist keine
        gültige CPR-Nummer — und die Person würde unter einer fremden
        Kennung veranlagt.
        """
        pruefung = steuernummer_pruefen("44179377", ist_person=True)
        assert not pruefung.gueltig
        assert pruefung.art == "CPR"

    def test_personennummer_bei_einer_gesellschaft_faellt_auf(self) -> None:
        pruefung = steuernummer_pruefen("0101901234", ist_person=False)
        assert not pruefung.gueltig
        assert pruefung.art == "CVR"


class TestCvrAusVatId:
    """In Daenemark ist die USt-IdNr. dieselbe Zahl wie die CVR-Nummer."""

    def test_daenische_vat_id_liefert_die_cvr(self) -> None:
        assert cvr_aus_vat_id("DK44179377") == "44179377"

    def test_schreibweisen_sind_egal(self) -> None:
        assert cvr_aus_vat_id("dk 44 17 93 77") == "44179377"

    def test_fremdes_land_liefert_nichts(self) -> None:
        """Nur in Daenemark sind USt-IdNr. und Steuernummer dieselbe Zahl."""
        assert cvr_aus_vat_id("DE312457890") is None
        assert cvr_aus_vat_id("ATU67421908") is None

    def test_ungueltige_pruefziffer_liefert_nichts(self) -> None:
        """Lieber die Selbstauskunft verlangen als eine falsche Nummer melden."""
        assert cvr_aus_vat_id("DK44179737") is None

    def test_leer_liefert_nichts(self) -> None:
        assert cvr_aus_vat_id(None) is None
        assert cvr_aus_vat_id("") is None
