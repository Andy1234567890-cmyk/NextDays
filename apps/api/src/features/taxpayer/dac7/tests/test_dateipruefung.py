"""Prüft den Prüfer der fertigen Datei.

WARUM DIESE TESTS ANDERS GEBAUT SIND: Ein Prüfer, der nie etwas findet, ist
immer grün. Jeder Test hier baut deshalb eine Datei mit GENAU EINEM Fehler
und verlangt, dass er gefunden wird — und eine saubere Datei muss sauber
bleiben. Ohne beide Richtungen beweist die Suite nichts.

Die geprüften Regeln stammen aus der amtlichen Vorlage; die Fundstellen
stehen in `dateipruefung.py` und in `docs/dac7/VORLAGE-BEFUNDE.md`.
"""
from __future__ import annotations

from src.features.taxpayer.dac7.dateipruefung import datei_pruefen
from src.features.taxpayer.dac7.spalten import SPALTEN, TRENNZEICHEN

_QUARTALE = (1, 2, 3, 4)
_ARTEN = ("CONS", "FEES", "TAX")


def _zeile(**werte: str) -> str:
    return TRENNZEICHEN.join(werte.get(s, "") for s in SPALTEN)


def _quartalsfelder(**abweichung: str) -> dict[str, str]:
    """Alle 28 Pflicht-Quartalsfelder, standardmäßig auf null."""
    felder = {f"RS_ACT_NUM_Q{q}": "0" for q in _QUARTALE}
    for art in _ARTEN:
        for q in _QUARTALE:
            felder[f"RS_ACT_{art}_Q{q}"] = "0"
            felder[f"RS_ACT_{art}_Q{q}_CCY"] = "DKK"
    felder.update(abweichung)
    return felder


def _message(**abweichung: str) -> str:
    grund = {
        "ROW_TYPE": "Message",
        "MSG_MESSAGE_REF_ID": "DK2025DK44179377AS25",
        "MSG_MESSAGE_TYPE_INDIC": "DPI401",
        "MSG_REPORTING_PERIOD": "31-12-2025",
        "MSG_VERSION": "1.0",
    }
    grund.update(abweichung)
    return _zeile(**grund)


def _betreiber(**abweichung: str) -> str:
    grund = {
        "ROW_TYPE": "PO_Platform_Operator",
        "PO_DOC_REF_ID": "DK202544179377AS",
        "DOC_TYPE_INDIC": "OECD1",
        "RESIDENCE": "DK",
        "TIN": "44179377",
        "TIN_ISSUED_BY": "DK",
        "TIN_UNKNOWN": "FALSK",
        "ADDR_CITY": "Bindslev",
        "ADDR_COUNTRY": "DK",
        "ADDR_LEGAL_ADDRESS_TYPE": "OECD304",
        "ORGANISATION_NAME": "AirSmil ApS",
        "PO_NEXUS": "RPONEX1",
    }
    grund.update(abweichung)
    return _zeile(**grund)


def _verkaeufer(**abweichung: str) -> str:
    grund = {
        "ROW_TYPE": "RS_IND_Individual_Seller",
        "RS_DOC_REF_ID": "DK202544179377001",
        "DOC_TYPE_INDIC": "OECD1",
        "RESIDENCE": "DK",
        "TIN": "1111112691",
        "TIN_ISSUED_BY": "DK",
        "TIN_UNKNOWN": "FALSK",
        "ADDR_CITY": "Bindslev",
        "ADDR_COUNTRY": "DK",
        "RS_BIRTH_DATE": "11-11-1979",
        "RS_NM_FIRST_NAME": "Anna",
        "RS_NM_LAST_NAME": "Jensen",
    }
    grund.update(abweichung)
    return _zeile(**grund)


def _objekt(**abweichung: str) -> str:
    grund = {
        "ROW_TYPE": "ACT_Immovable_Property",
        "RS_DOC_REF_ID": "DK202544179377001",
        "ADDR_CITY": "Bindslev",
        "ADDR_COUNTRY": "DK",
        "RS_ACT_PROP_TYPE": "DPI904",
        "RS_ACT_LAND_REG_NUM": "1234AB",
        "RS_ACT_RENTED_DAYS": "42",
        "RS_ACT_DK_GRI": "5836",
        "RS_ACT_DK_GRI_CCY": "DKK",
        "RS_ACT_DK_REAL_PROP_REG_NUM": "3175382",
    }
    grund.update(_quartalsfelder())
    grund.update(abweichung)
    return _zeile(**grund)


def _datei(*zeilen: str) -> str:
    kopf = TRENNZEICHEN.join(SPALTEN)
    return "\n".join([kopf, *zeilen]) + "\n"


def _gueltig() -> str:
    return _datei(_message(), _betreiber(), _verkaeufer(), _objekt())


def _regeln(bericht) -> set[str]:  # noqa: ANN001 — Testhelfer
    return {f"{b.spalte}/{b.regel}" for b in bericht.fehler}


class TestGueltigeDatei:
    def test_besteht(self) -> None:
        bericht = datei_pruefen(_gueltig())
        assert bericht.besteht, [
            (f.zeile, f.spalte, f.grund) for f in bericht.fehler
        ]

    def test_zaehlt_die_zeilentypen(self) -> None:
        bericht = datei_pruefen(_gueltig())
        assert bericht.zeilen == 4
        assert bericht.zeilentypen["ACT_Immovable_Property"] == 1

    def test_ein_objekt_je_zeile(self) -> None:
        """Die Vorlage verlangt eine Zeile je Immobilie."""
        datei = _datei(
            _message(),
            _betreiber(),
            _verkaeufer(),
            _objekt(RS_ACT_DK_REAL_PROP_REG_NUM="3175382"),
            _objekt(RS_ACT_DK_REAL_PROP_REG_NUM="4560004"),
        )
        bericht = datei_pruefen(datei)
        assert bericht.besteht
        assert bericht.zeilentypen["ACT_Immovable_Property"] == 2


class TestWahrheitswerte:
    def test_null_statt_falsk_faellt_auf(self) -> None:
        datei = _datei(_message(), _betreiber(TIN_UNKNOWN="0"))
        assert "TIN_UNKNOWN/Wahrheitswert" in _regeln(datei_pruefen(datei))

    def test_englisch_faellt_auf(self) -> None:
        datei = _datei(_message(), _betreiber(PO_ASSUMED_REPORTING="TRUE"))
        regeln = _regeln(datei_pruefen(datei))
        assert "PO_ASSUMED_REPORTING/Wahrheitswert" in regeln

    def test_sandt_ist_zulaessig(self) -> None:
        datei = _datei(_message(), _betreiber(PO_ASSUMED_REPORTING="SANDT"))
        regeln = _regeln(datei_pruefen(datei))
        assert "PO_ASSUMED_REPORTING/Wahrheitswert" not in regeln


class TestKennungen:
    def test_nachrichtenkennung_in_folgezeile_faellt_auf(self) -> None:
        datei = _datei(
            _message(), _betreiber(MSG_MESSAGE_REF_ID="DK2025DK44179377AS25")
        )
        regeln = _regeln(datei_pruefen(datei))
        assert "MSG_MESSAGE_REF_ID/Zeilenzuordnung" in regeln

    def test_betreiberkennung_beim_verkaeufer_faellt_auf(self) -> None:
        datei = _datei(
            _message(),
            _betreiber(),
            _verkaeufer(PO_DOC_REF_ID="DK202544179377AS"),
        )
        assert "PO_DOC_REF_ID/Zeilenzuordnung" in _regeln(datei_pruefen(datei))

    def test_sonderzeichen_faellt_auf(self) -> None:
        datei = _datei(_message(MSG_MESSAGE_REF_ID="DK-2025-AS"))
        assert "MSG_MESSAGE_REF_ID/Kennung" in _regeln(datei_pruefen(datei))

    def test_zu_lange_kennung_faellt_auf(self) -> None:
        datei = _datei(_message(MSG_MESSAGE_REF_ID="D" * 101))
        assert "MSG_MESSAGE_REF_ID/Kennung" in _regeln(datei_pruefen(datei))


class TestBetraege:
    def test_negativer_betrag_faellt_auf(self) -> None:
        datei = _datei(
            _message(),
            _betreiber(),
            _verkaeufer(),
            _objekt(**_quartalsfelder(RS_ACT_FEES_Q1="-5")),
        )
        assert "RS_ACT_FEES_Q1/Untergrenze" in _regeln(datei_pruefen(datei))

    def test_nachkommastelle_faellt_auf(self) -> None:
        datei = _datei(
            _message(),
            _betreiber(),
            _verkaeufer(),
            _objekt(**_quartalsfelder(RS_ACT_CONS_Q1="58.50")),
        )
        assert "RS_ACT_CONS_Q1/Ganzzahl" in _regeln(datei_pruefen(datei))

    def test_null_ist_zulaessig(self) -> None:
        """Die Vorlage schreibt Nullen aus, sie sind kein Fehler."""
        assert datei_pruefen(_gueltig()).besteht


class TestWertelisten:
    def test_unbekanntes_land_faellt_auf(self) -> None:
        datei = _datei(_message(), _betreiber(TIN_ISSUED_BY="QQ"))
        assert "TIN_ISSUED_BY/Werteliste" in _regeln(datei_pruefen(datei))

    def test_xx_ist_zulaessig(self) -> None:
        """XX steht in der amtlichen Liste — wie XK und X5."""
        datei = _datei(_message(), _betreiber(TIN_ISSUED_BY="XX"))
        assert "TIN_ISSUED_BY/Werteliste" not in _regeln(datei_pruefen(datei))

    def test_unbekannte_objektart_faellt_auf(self) -> None:
        datei = _datei(
            _message(),
            _betreiber(),
            _verkaeufer(),
            _objekt(RS_ACT_PROP_TYPE="DPI999"),
        )
        assert "RS_ACT_PROP_TYPE/Werteliste" in _regeln(datei_pruefen(datei))

    def test_unbekannte_waehrung_faellt_auf(self) -> None:
        datei = _datei(
            _message(),
            _betreiber(),
            _verkaeufer(),
            _objekt(**_quartalsfelder(RS_ACT_CONS_Q1_CCY="XYZ")),
        )
        assert "RS_ACT_CONS_Q1_CCY/Waehrung" in _regeln(datei_pruefen(datei))


class TestPflichtangaben:
    def test_fehlendes_geburtsdatum_faellt_auf(self) -> None:
        datei = _datei(
            _message(), _betreiber(), _verkaeufer(RS_BIRTH_DATE="")
        )
        assert "RS_BIRTH_DATE/Pflichtangabe" in _regeln(datei_pruefen(datei))

    def test_fehlender_quartalswert_faellt_auf(self) -> None:
        felder = _quartalsfelder()
        felder["RS_ACT_TAX_Q3"] = ""
        datei = _datei(
            _message(), _betreiber(), _verkaeufer(), _objekt(**felder)
        )
        assert "RS_ACT_TAX_Q3/Pflichtangabe" in _regeln(datei_pruefen(datei))

    def test_fehlender_sitz_beim_betreiber_faellt_auf(self) -> None:
        datei = _datei(_message(), _betreiber(ADDR_LEGAL_ADDRESS_TYPE=""))
        regeln = _regeln(datei_pruefen(datei))
        assert "ADDR_LEGAL_ADDRESS_TYPE/Pflichtangabe" in regeln


class TestDatumsformat:
    def test_iso_format_faellt_auf(self) -> None:
        datei = _datei(_message(MSG_REPORTING_PERIOD="2025-12-31"))
        regeln = _regeln(datei_pruefen(datei))
        assert "MSG_REPORTING_PERIOD/Datumsformat" in regeln

    def test_geburtsdatum_falsch_faellt_auf(self) -> None:
        datei = _datei(
            _message(), _betreiber(), _verkaeufer(RS_BIRTH_DATE="1979-11-11")
        )
        assert "RS_BIRTH_DATE/Datumsformat" in _regeln(datei_pruefen(datei))


class TestAufbau:
    def test_objekt_ohne_verkaeufer_faellt_auf(self) -> None:
        datei = _datei(
            _message(), _betreiber(), _objekt(RS_DOC_REF_ID="GIBTESNICHT")
        )
        assert "RS_DOC_REF_ID/Aufbau" in _regeln(datei_pruefen(datei))

    def test_doppelte_verkaeuferkennung_faellt_auf(self) -> None:
        datei = _datei(
            _message(), _betreiber(), _verkaeufer(), _verkaeufer()
        )
        assert "RS_DOC_REF_ID/Aufbau" in _regeln(datei_pruefen(datei))

    def test_zweiter_betreiber_faellt_auf(self) -> None:
        datei = _datei(_message(), _betreiber(), _betreiber())
        assert "ROW_TYPE/Aufbau" in _regeln(datei_pruefen(datei))

    def test_erste_zeile_muss_message_sein(self) -> None:
        datei = _datei(_betreiber(), _message())
        assert "ROW_TYPE/Aufbau" in _regeln(datei_pruefen(datei))

    def test_unbekannter_zeilentyp_faellt_auf(self) -> None:
        datei = _datei(_message(), _zeile(ROW_TYPE="ACT_Erfunden"))
        assert "ROW_TYPE/Zeilentyp" in _regeln(datei_pruefen(datei))

    def test_leere_datei_faellt_auf(self) -> None:
        assert not datei_pruefen("").besteht


class TestKopfzeile:
    def test_falsche_spaltenzahl_faellt_auf(self) -> None:
        bericht = datei_pruefen("ROW_TYPE;MSG_MESSAGE_REF_ID\nMessage;X\n")
        assert not bericht.besteht
        assert any(f.regel == "Kopfzeile" for f in bericht.fehler)

    def test_vertauschte_spalte_faellt_auf(self) -> None:
        vertauscht = list(SPALTEN)
        vertauscht[1], vertauscht[2] = vertauscht[2], vertauscht[1]
        bericht = datei_pruefen(TRENNZEICHEN.join(vertauscht) + "\n")
        assert not bericht.besteht
        assert any(f.regel == "Kopfzeile" for f in bericht.fehler)

    def test_bom_stoert_nicht(self) -> None:
        """Excel schreibt UTF-8 mit BOM — das darf kein Befund sein."""
        assert datei_pruefen("﻿" + _gueltig()).besteht


class TestSatzlaenge:
    def test_trennzeichen_im_text_faellt_auf(self) -> None:
        kaputt = _betreiber(ORGANISATION_NAME="Muster") + TRENNZEICHEN + "x"
        bericht = datei_pruefen(_datei(_message(), kaputt))
        assert any(f.regel == "Satzlaenge" for f in bericht.fehler)

    def test_komma_im_text_ist_kein_fehler(self) -> None:
        """Kommas gehören in die Datei — die Vorlage schreibt selbst welche."""
        datei = _datei(
            _message(),
            _betreiber(ORGANISATION_NAME="AirSmil, ApS"),
            _verkaeufer(),
            _objekt(),
        )
        assert datei_pruefen(datei).besteht


class TestBedingtePflicht:
    """Pflichten, die erst durch ein anderes Feld entstehen."""

    def test_bfe_ohne_bruttomieteinnahme_faellt_auf(self) -> None:
        """Feldkommentar RS_ACT_DK_GRI: Pflicht, sobald die BFE-Nummer steht.

        Einzeln ist keines der beiden Felder Pflicht — deshalb faengt nur
        eine Regel, die beide zusammen ansieht, diesen Fall.
        """
        datei = _datei(
            _message(),
            _betreiber(),
            _verkaeufer(),
            _objekt(RS_ACT_DK_GRI="", RS_ACT_DK_GRI_CCY=""),
        )
        bericht = datei_pruefen(datei)
        assert not bericht.besteht
        assert "RS_ACT_DK_GRI/Pflicht bei BFE-Nummer" in _regeln(bericht)

    def test_ohne_bfe_keine_pflicht(self) -> None:
        """Die Gegenprobe: ohne BFE-Nummer entsteht die Pflicht nicht."""
        datei = _datei(
            _message(),
            _betreiber(),
            _verkaeufer(),
            _objekt(
                RS_ACT_DK_REAL_PROP_REG_NUM="",
                RS_ACT_DK_GRI="",
                RS_ACT_DK_GRI_CCY="",
            ),
        )
        bericht = datei_pruefen(datei)
        assert "RS_ACT_DK_GRI/Pflicht bei BFE-Nummer" not in _regeln(bericht)
