"""Prüft, dass eine unvollständige Meldung NICHT erzeugt wird.

Das ist das Sicherheitsmerkmal des Moduls: Gegenüber einer Steuerbehörde ist
ein abgebrochener Lauf mit klarer Begründung immer besser als eine plausibel
aussehende Datei mit einem geratenen Wert darin.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from src.features.taxpayer.dac7.modell import (
    Anbieter,
    Anschrift,
    DaenischerAnhang,
    Meldung,
    Plattformbetreiber,
    Quartalswerte,
    Quartalszahlen,
    Steuernummer,
    Vermietung,
)
from src.features.taxpayer.dac7.pruefung import pruefen


def _betreiber(**felder: object) -> Plattformbetreiber:
    grund: dict = {
        "doc_ref_id": "DK2025444444440PO",
        "name": "Beispielbetrieb",
        "ansaessig_in": ("DK",),
        "steuernummern": (Steuernummer(wert="44444444", ausgestellt_von="DK"),),
        "anschrift": Anschrift(
            land="DK", plz="9999", ort="Testby", art="OECD304"
        ),
        "nexus": "RPONEX1",
    }
    grund.update(felder)
    return Plattformbetreiber(**grund)


def _vermietung(**felder: object) -> Vermietung:
    grund: dict = {
        "anschrift": Anschrift(land="DK", plz="9881", ort="Bindslev"),
        "verguetung": Quartalswerte(q2=Decimal("5836")),
        "gebuehren": Quartalswerte(),
        "steuern": Quartalswerte(),
        "anzahl": Quartalszahlen(q2=6),
        "waehrung": "DKK",
        "objektart": "DPI904",
        "grundbuchnummer": "1234",
    }
    grund.update(felder)
    return Vermietung(**grund)


def _anbieter(**felder: object) -> Anbieter:
    grund: dict = {
        "doc_ref_id": "DK202544444444001",
        "ist_person": True,
        "ansaessig_in": ("DK",),
        "steuernummern": (Steuernummer(wert="1111112222", ausgestellt_von="DK"),),
        "anschrift": Anschrift(land="DK", plz="8270", ort="Testhoej"),
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


def _felder(bericht) -> set[str]:
    return {b.feld for b in bericht.fehler}


class TestVollstaendigeMeldung:
    def test_eine_vollstaendige_meldung_darf_erzeugt_werden(self) -> None:
        bericht = pruefen(_meldung())
        assert bericht.darf_melden, [b.grund for b in bericht.fehler]


class TestPflichtangaben:
    def test_ohne_steuernummer_und_ohne_geburtsort_kein_export(self) -> None:
        """Die Steuernummer ist die zentrale Angabe; der Geburtsort ersetzt sie."""
        bericht = pruefen(_meldung(anbieter=(_anbieter(steuernummern=()),)))
        assert not bericht.darf_melden
        assert "TIN" in _felder(bericht)

    def test_geburtsort_ersetzt_die_fehlende_steuernummer(self) -> None:
        anbieter = _anbieter(
            steuernummern=(
                Steuernummer(wert=None, ausgestellt_von="DK", unbekannt=True),
            ),
            geburtsort="Aarhus",
            geburtsland="DK",
        )
        assert pruefen(_meldung(anbieter=(anbieter,))).darf_melden

    def test_ohne_ansaessigkeit_kein_export(self) -> None:
        bericht = pruefen(_meldung(anbieter=(_anbieter(ansaessig_in=()),)))
        assert "RESIDENCE" in _felder(bericht)

    def test_ohne_ort_kein_export(self) -> None:
        bericht = pruefen(
            _meldung(anbieter=(_anbieter(anschrift=Anschrift(land="DK")),))
        )
        assert "ADDR_CITY" in _felder(bericht)

    def test_ohne_waehrung_kein_export(self) -> None:
        bericht = pruefen(
            _meldung(
                anbieter=(_anbieter(taetigkeiten=(_vermietung(waehrung=""),)),)
            )
        )
        assert "RS_ACT_CONS_Q1_CCY" in _felder(bericht)

    def test_ohne_namen_kein_export(self) -> None:
        bericht = pruefen(_meldung(anbieter=(_anbieter(nachname=None),)))
        assert "RS_NM_LAST_NAME" in _felder(bericht)

    def test_gesellschaft_ohne_firmennamen_kein_export(self) -> None:
        bericht = pruefen(
            _meldung(
                anbieter=(
                    _anbieter(ist_person=False, name=None, vorname=None, nachname=None),
                )
            )
        )
        assert "ORGANISATION_NAME" in _felder(bericht)


class TestWertelisten:
    def test_unbekanntes_land_faellt_auf(self) -> None:
        # "QQ" gibt es nicht. Bewusst NICHT "XX": das steht in der amtlichen
        # Liste (wie X5 und XK) und ist damit ein gueltiger Wert.
        bericht = pruefen(_meldung(anbieter=(_anbieter(ansaessig_in=("QQ",)),)))
        assert "RESIDENCE" in _felder(bericht)

    def test_unbekannte_waehrung_faellt_auf(self) -> None:
        bericht = pruefen(
            _meldung(
                anbieter=(_anbieter(taetigkeiten=(_vermietung(waehrung="XYZ"),)),)
            )
        )
        assert "RS_ACT_CONS_Q1_CCY" in _felder(bericht)

    def test_unbekannte_objektart_faellt_auf(self) -> None:
        bericht = pruefen(
            _meldung(
                anbieter=(
                    _anbieter(taetigkeiten=(_vermietung(objektart="DPI999"),)),
                )
            )
        )
        assert "RS_ACT_PROP_TYPE" in _felder(bericht)

    def test_unzulaessiger_nexus_faellt_auf(self) -> None:
        bericht = pruefen(_meldung(betreiber=_betreiber(nexus="RPONEX9")))
        assert "PO_NEXUS" in _felder(bericht)

    def test_objektart_sonstiges_verlangt_eine_beschreibung(self) -> None:
        bericht = pruefen(
            _meldung(
                anbieter=(
                    _anbieter(taetigkeiten=(_vermietung(objektart="DPI910"),)),
                )
            )
        )
        assert "RS_ACT_OTHER_PROP_TYPE" in _felder(bericht)


class TestKennungen:
    def test_kennung_mit_sonderzeichen_faellt_auf(self) -> None:
        """Die Vorlage erlaubt nur Ziffern und Buchstaben."""
        bericht = pruefen(
            _meldung(anbieter=(_anbieter(doc_ref_id="DK-2025-001"),))
        )
        assert "RS_DOC_REF_ID" in _felder(bericht)

    def test_doppelte_anbieterkennung_faellt_auf(self) -> None:
        """Sonst ordnet die Behörde Tätigkeiten dem falschen Anbieter zu."""
        bericht = pruefen(
            _meldung(
                anbieter=(
                    _anbieter(doc_ref_id="DK202544444444001"),
                    _anbieter(doc_ref_id="DK202544444444001", nachname="Zweit"),
                )
            )
        )
        assert "RS_DOC_REF_ID" in _felder(bericht)


class TestMeldearten:
    def test_korrektur_ohne_ursprungskennung_faellt_auf(self) -> None:
        bericht = pruefen(
            _meldung(
                meldeart="DPI402", anbieter=(_anbieter(satzart="OECD2"),)
            )
        )
        assert "CORR_DOC_REF_ID" in _felder(bericht)

    def test_neumeldung_mit_ursprungskennung_faellt_auf(self) -> None:
        bericht = pruefen(
            _meldung(
                anbieter=(
                    _anbieter(satzart="OECD1", korrigiert_doc_ref_id="DK123"),
                )
            )
        )
        assert "CORR_DOC_REF_ID" in _felder(bericht)

    def test_korrektursatz_in_einer_neumeldung_faellt_auf(self) -> None:
        """DPI401 erlaubt nur OECD0 und OECD1."""
        bericht = pruefen(
            _meldung(
                meldeart="DPI401",
                anbieter=(
                    _anbieter(satzart="OECD2", korrigiert_doc_ref_id="DK123"),
                ),
            )
        )
        assert "DOC_TYPE_INDIC" in _felder(bericht)

    def test_nullmeldung_mit_anbietern_faellt_auf(self) -> None:
        bericht = pruefen(_meldung(meldeart="DPI403"))
        assert "MSG_MESSAGE_TYPE_INDIC" in _felder(bericht)

    def test_leere_meldung_muss_eine_nullmeldung_sein(self) -> None:
        bericht = pruefen(_meldung(anbieter=()))
        assert "MSG_MESSAGE_TYPE_INDIC" in _felder(bericht)

    def test_nullmeldung_ohne_anbieter_ist_gueltig(self) -> None:
        assert pruefen(_meldung(meldeart="DPI403", anbieter=())).darf_melden


class TestPlausibilitaet:
    def test_negative_verguetung_faellt_auf(self) -> None:
        bericht = pruefen(
            _meldung(
                anbieter=(
                    _anbieter(
                        taetigkeiten=(
                            _vermietung(
                                verguetung=Quartalswerte(q1=Decimal("-100"))
                            ),
                        )
                    ),
                )
            )
        )
        assert "RS_ACT_CONS_Q1" in _felder(bericht)

    def test_anbieter_ohne_taetigkeit_faellt_auf(self) -> None:
        bericht = pruefen(_meldung(anbieter=(_anbieter(taetigkeiten=()),)))
        assert not bericht.darf_melden

    def test_verguetung_ohne_taetigkeit_ist_nur_ein_hinweis(self) -> None:
        """Auffällig, aber kein Grund, die Meldung zu verweigern."""
        bericht = pruefen(
            _meldung(
                anbieter=(
                    _anbieter(
                        taetigkeiten=(
                            _vermietung(
                                verguetung=Quartalswerte(q1=Decimal("500")),
                                anzahl=Quartalszahlen(q2=1),
                            ),
                        )
                    ),
                )
            )
        )
        assert bericht.darf_melden
        assert any(h.feld == "RS_ACT_NUM_Q1" for h in bericht.hinweise)

    def test_fehlende_grundbuchnummer_ist_nur_ein_hinweis(self) -> None:
        """Die Richtlinie verlangt sie nur 'sofern vorhanden'."""
        bericht = pruefen(
            _meldung(
                anbieter=(
                    _anbieter(taetigkeiten=(_vermietung(grundbuchnummer=None),)),
                )
            )
        )
        assert bericht.darf_melden
        assert any(h.feld == "RS_ACT_LAND_REG_NUM" for h in bericht.hinweise)

    def test_bruttomieteinnahme_muss_in_dkk_sein(self) -> None:
        bericht = pruefen(
            _meldung(
                anbieter=(
                    _anbieter(
                        taetigkeiten=(
                            _vermietung(
                                daenisch=DaenischerAnhang(
                                    brutto_mieteinnahme=Decimal("1000"),
                                    brutto_mieteinnahme_waehrung="EUR",
                                )
                            ),
                        )
                    ),
                )
            )
        )
        assert "RS_ACT_DK_GRI_CCY" in _felder(bericht)


class TestBerichtsqualitaet:
    def test_alle_befunde_werden_gesammelt_nicht_nur_der_erste(self) -> None:
        """Wer eine Meldung vorbereitet, braucht die ganze Arbeitsliste."""
        bericht = pruefen(
            _meldung(
                anbieter=(
                    _anbieter(
                        steuernummern=(),
                        ansaessig_in=(),
                        anschrift=Anschrift(land="DK"),
                    ),
                )
            )
        )
        assert len(bericht.fehler) >= 3

    def test_jeder_befund_nennt_seinen_fundort(self) -> None:
        """Eine Fehlermeldung ohne Fundort ist bei hunderten Objekten wertlos."""
        bericht = pruefen(
            _meldung(anbieter=(_anbieter(nachname=None, steuernummern=()),))
        )
        for befund in bericht.fehler:
            assert befund.betrifft
            assert befund.feld
            assert befund.grund


class TestVorlagenPflichten:
    """Regeln, die woertlich in der amtlichen Anleitung stehen."""

    def test_geburtsdatum_ist_pflicht(self) -> None:
        """RS_BIRTH_DATE: "Obligatorisk", Kardinalitaet 1..1."""
        bericht = pruefen(_meldung(anbieter=(_anbieter(geburtsdatum=None),)))
        assert "RS_BIRTH_DATE" in _felder(bericht)

    def test_gesellschaft_braucht_kein_geburtsdatum(self) -> None:
        """Die Pflicht gilt nur fuer RS_IND_Individual_Seller."""
        bericht = pruefen(
            _meldung(
                anbieter=(
                    _anbieter(
                        ist_person=False,
                        name="Ferien ApS",
                        vorname=None,
                        nachname=None,
                        geburtsdatum=None,
                    ),
                )
            )
        )
        assert "RS_BIRTH_DATE" not in _felder(bericht)

    def test_geburtsort_haengt_am_tin_unknown_flag(self) -> None:
        """RS_BIRTH_PLACE_CITY: "Obligatorisk hvis TIN unknown."."""
        ohne_ort = _anbieter(
            steuernummern=(
                Steuernummer(wert=None, ausgestellt_von="DK", unbekannt=True),
            ),
            geburtsort=None,
        )
        assert "RS_BIRTH_PLACE_CITY" in _felder(pruefen(_meldung(anbieter=(ohne_ort,))))

    def test_ohne_flag_kein_geburtsort_noetig(self) -> None:
        """Wer eine Nummer hat, braucht den Geburtsort nicht."""
        mit_nummer = _anbieter(geburtsort=None)
        assert "RS_BIRTH_PLACE_CITY" not in _felder(
            pruefen(_meldung(anbieter=(mit_nummer,)))
        )

    def test_korrektur_braucht_eine_neue_kennung(self) -> None:
        """Anleitung zu Beispiel 1.1: "en ny unik vaerdi for DOC_REF_ID"."""
        bericht = pruefen(
            _meldung(
                meldeart="DPI402",
                betreiber=_betreiber(satzart="OECD0"),
                anbieter=(
                    _anbieter(
                        doc_ref_id="DK202544444444001",
                        satzart="OECD2",
                        korrigiert_doc_ref_id="DK202544444444001",
                    ),
                ),
            )
        )
        assert "RS_DOC_REF_ID" in _felder(bericht)

    def test_betreiber_wird_in_korrektur_erneut_gesendet(self) -> None:
        """Anleitung: PO_Platform_Operator traegt dort OECD0."""
        bericht = pruefen(
            _meldung(
                meldeart="DPI402",
                betreiber=_betreiber(satzart="OECD1"),
                anbieter=(
                    _anbieter(
                        doc_ref_id="DK202544444444002",
                        satzart="OECD2",
                        korrigiert_doc_ref_id="DK202544444444001",
                    ),
                ),
            )
        )
        assert any(
            b.feld == "DOC_TYPE_INDIC" and b.betrifft.startswith("Plattformbetreiber")
            for b in bericht.fehler
        )

    def test_gueltige_korrektur_geht_durch(self) -> None:
        bericht = pruefen(
            _meldung(
                meldeart="DPI402",
                betreiber=_betreiber(satzart="OECD0"),
                anbieter=(
                    _anbieter(
                        doc_ref_id="DK202544444444002",
                        satzart="OECD2",
                        korrigiert_doc_ref_id="DK202544444444001",
                    ),
                ),
            )
        )
        assert bericht.darf_melden, [b.grund for b in bericht.fehler]


class TestNegativeBetraege:
    """Kein Meldewert darf unter null liegen.

    Die Vorlage setzt das ueber ihre Datenvalidierung durch: jede Betrags-
    und Zaehlspalte ist `type="whole"` mit `formula1=0`. Geprueft wurden hier
    zunaechst nur Verguetung und Anzahl — Gebuehren, Steuern, Miettage und
    die Bruttomieteinnahme liefen ungeprueft in die Datei.
    """

    def test_negative_gebuehr(self) -> None:
        meldung = _meldung(
            anbieter=(
                _anbieter(
                    taetigkeiten=(
                        _vermietung(gebuehren=Quartalswerte(q2=Decimal("-1"))),
                    )
                ),
            )
        )
        assert "RS_ACT_FEES_Q2" in _felder(pruefen(meldung))

    def test_negative_steuer(self) -> None:
        meldung = _meldung(
            anbieter=(
                _anbieter(
                    taetigkeiten=(
                        _vermietung(steuern=Quartalswerte(q3=Decimal("-50"))),
                    )
                ),
            )
        )
        assert "RS_ACT_TAX_Q3" in _felder(pruefen(meldung))

    def test_negative_miettage(self) -> None:
        meldung = _meldung(
            anbieter=(
                _anbieter(taetigkeiten=(_vermietung(vermietete_tage=-1),)),
            )
        )
        assert "RS_ACT_RENTED_DAYS" in _felder(pruefen(meldung))

    def test_negative_bruttomieteinnahme(self) -> None:
        meldung = _meldung(
            anbieter=(
                _anbieter(
                    taetigkeiten=(
                        _vermietung(
                            daenisch=DaenischerAnhang(
                                brutto_mieteinnahme=Decimal("-5"),
                                brutto_mieteinnahme_waehrung="DKK",
                                bfe_nummer="1234567",
                            )
                        ),
                    )
                ),
            )
        )
        assert "RS_ACT_DK_GRI" in _felder(pruefen(meldung))

    def test_saubere_werte_bleiben_fehlerfrei(self) -> None:
        """Gegenprobe: die Pruefung darf nicht pauschal meckern."""
        bericht = pruefen(_meldung())
        negativ = {
            f
            for f in _felder(bericht)
            if f.startswith(("RS_ACT_FEES", "RS_ACT_TAX", "RS_ACT_DK_GRI"))
        }
        assert not negativ

    def test_bfe_ohne_bruttomieteinnahme_faellt_auf(self) -> None:
        """Die Bruttomieteinnahme ist Pflicht, SOBALD eine BFE-Nummer steht.

        Woertlich im Feldkommentar zu `RS_ACT_DK_GRI` der amtlichen
        Vorlage: „Obligatorisk hvis Real Property Registration Number BFE
        er angivet." Beide Felder sind einzeln freiwillig — eine
        Feld-fuer-Feld-Pruefung sieht diese Regel deshalb nie.
        """
        meldung = _meldung(
            anbieter=(
                _anbieter(
                    taetigkeiten=(
                        _vermietung(
                            daenisch=DaenischerAnhang(
                                brutto_mieteinnahme=None,
                                brutto_mieteinnahme_waehrung=None,
                                bfe_nummer="3155601",
                            )
                        ),
                    )
                ),
            )
        )
        assert "RS_ACT_DK_GRI" in _felder(pruefen(meldung))

    def test_bfe_mit_bruttomieteinnahme_ist_in_ordnung(self) -> None:
        """Die Gegenprobe — sonst wuerde die Regel jede Meldung blockieren."""
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
        assert "RS_ACT_DK_GRI" not in _felder(pruefen(meldung))

    def test_ohne_bfe_bleibt_die_bruttomieteinnahme_freiwillig(self) -> None:
        """Ohne BFE-Nummer entsteht die Pflicht gar nicht erst."""
        meldung = _meldung(
            anbieter=(_anbieter(taetigkeiten=(_vermietung(daenisch=None),)),)
        )
        assert "RS_ACT_DK_GRI" not in _felder(pruefen(meldung))
