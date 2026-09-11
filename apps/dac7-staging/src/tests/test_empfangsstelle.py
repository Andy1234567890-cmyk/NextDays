"""Die Empfangsstelle muss ABLEHNEN, was die Behoerde ablehnen wuerde.

Ein Pruefer, der alles annimmt, ist schlimmer als keiner: Er erzeugt die
Zuversicht, die Datei sei in Ordnung. Jeder Test hier baut deshalb GENAU
EINEN Fehler ein und erwartet, dass die Gegenstelle ihn findet.
"""
from __future__ import annotations

import os

os.environ.setdefault("STAGING_TOKEN", "test-token-nicht-echt")

import pytest
from fastapi.testclient import TestClient

from src.core import vorlage
from src.main import create_app
from src.v1 import einreichung

KOPF = "X-Staging-Token"
TOKEN = "test-token-nicht-echt"


@pytest.fixture
def client() -> TestClient:
    # Das Protokoll ist ein Modul-Global und ueberlebt daher den einzelnen
    # Test. Seit die Empfangsstelle dieselbe Datei kein zweites Mal annimmt,
    # wuerde jeder Test, der die Standarddatei sendet, an der Einreichung
    # eines FRUEHEREN Tests scheitern. Deshalb hier ein frischer Speicher je
    # Test — sonst haengt das Ergebnis an der Ausfuehrungsreihenfolge.
    einreichung.PROTOKOLL.leeren()
    return TestClient(create_app())


def _zeile(**felder: str) -> str:
    werte = dict.fromkeys(vorlage.SPALTEN, "")
    werte.update(felder)
    return vorlage.TRENNZEICHEN.join(werte[s] for s in vorlage.SPALTEN)


def _quartalsfelder() -> dict[str, str]:
    f: dict[str, str] = {}
    for q in (1, 2, 3, 4):
        f[f"RS_ACT_NUM_Q{q}"] = "0"
        for teil in ("CONS", "FEES", "TAX"):
            f[f"RS_ACT_{teil}_Q{q}"] = "0"
            f[f"RS_ACT_{teil}_Q{q}_CCY"] = "DKK"
    return f


def _message(**ab: str) -> str:
    grund = {
        "ROW_TYPE": "Message",
        "MSG_MESSAGE_REF_ID": "DK2025DK44179377_AS25",
        "MSG_SENDING_ENTITY_IN": "44179377",
        "MSG_MESSAGE_TYPE_INDIC": "DPI401",
        "MSG_REPORTING_PERIOD": "31-12-2025",
        "MSG_VERSION": "1.0",
    }
    grund.update(ab)
    return _zeile(**grund)


def _betreiber(**ab: str) -> str:
    grund = {
        "ROW_TYPE": "PO_Platform_Operator",
        "PO_DOC_REF_ID": "DK202544179377_AS2025",
        "DOC_TYPE_INDIC": "OECD1",
        "RESIDENCE": "DK",
        "TIN": "44179377",
        "TIN_ISSUED_BY": "DK",
        "ADDR_COUNTRY": "DK",
        "ADDR_LEGAL_ADDRESS_TYPE": "OECD304",
        "ORGANISATION_NAME": "Beispielbureau",
    }
    grund.update(ab)
    return _zeile(**grund)


def _verkaeufer(**ab: str) -> str:
    grund = {
        "ROW_TYPE": "RS_IND_Individual_Seller",
        "RS_DOC_REF_ID": "DK202544179377_001",
        "DOC_TYPE_INDIC": "OECD1",
        "RESIDENCE": "DK",
        "TIN": "010190-1234",
        "TIN_ISSUED_BY": "DK",
        "ADDR_COUNTRY": "DK",
        "ADDR_LEGAL_ADDRESS_TYPE": "OECD302",
        "RS_BIRTH_DATE": "11-11-1978",
        "RS_NM_FIRST_NAME": "Test",
        "RS_NM_LAST_NAME": "Person",
    }
    grund.update(ab)
    return _zeile(**grund)


def _objekt(**ab: str) -> str:
    grund = {
        "ROW_TYPE": "ACT_Immovable_Property",
        "RS_DOC_REF_ID": "DK202544179377_001",
        "ADDR_COUNTRY": "DK",
        "ADDR_CITY": "Bindslev",
        "RS_ACT_PROP_TYPE": "DPI904",
        "RS_ACT_RENTED_DAYS": "42",
        "RS_ACT_LAND_REG_NUM": "1234AB",
        "RS_ACT_DK_GRI": "5836",
        "RS_ACT_DK_GRI_CCY": "DKK",
        "RS_ACT_DK_REAL_PROP_REG_NUM": "3155601",
    }
    grund.update(_quartalsfelder())
    grund.update(ab)
    return _zeile(**grund)


def _datei(*zeilen: str) -> str:
    return "\n".join([vorlage.TRENNZEICHEN.join(vorlage.SPALTEN), *zeilen]) + "\n"


def _gueltig() -> str:
    return _datei(_message(), _betreiber(), _verkaeufer(), _objekt())


def _senden(client: TestClient, inhalt: str, name: str = "m.csv", **kopf: str):
    return client.post(
        "/v1/einreichung",
        files={"datei": (name, inhalt.encode("utf-8"), "text/csv")},
        headers={KOPF: TOKEN, **kopf},
    )


class TestZugang:
    def test_ohne_token_abgewiesen(self, client: TestClient) -> None:
        antwort = client.post(
            "/v1/einreichung",
            files={"datei": ("m.csv", b"x", "text/csv")},
        )
        assert antwort.status_code == 401

    def test_falsches_token_abgewiesen(self, client: TestClient) -> None:
        antwort = client.post(
            "/v1/einreichung",
            files={"datei": ("m.csv", b"x", "text/csv")},
            headers={KOPF: "falsch"},
        )
        assert antwort.status_code == 401


class TestGueltigeDatei:
    def test_wird_angenommen(self, client: TestClient) -> None:
        daten = _senden(client, _gueltig()).json()
        assert daten["angenommen"], daten["fehler"]
        assert daten["zeilen"] == 4

    def test_quittung_traegt_nummer_und_pruefsumme(self, client: TestClient) -> None:
        daten = _senden(client, _gueltig()).json()
        # `angenommen` mitpruefen: Nummer und Pruefsumme traegt auch eine
        # ZURUECKGEWIESENE Quittung. Ohne diese Zeile blieben beide Tests
        # gruen, obwohl die Datei abgelehnt wurde.
        assert daten["angenommen"], daten["fehler"]
        assert daten["quittungsnummer"].startswith("DK-")
        assert len(daten["pruefsumme"]) == 64

    def test_quittung_ist_abrufbar(self, client: TestClient) -> None:
        erste = _senden(client, _gueltig()).json()
        assert erste["angenommen"], erste["fehler"]
        nummer = erste["quittungsnummer"]
        antwort = client.get(f"/v1/quittungen/{nummer}", headers={KOPF: TOKEN})
        assert antwort.status_code == 200
        assert antwort.json()["quittungsnummer"] == nummer


class TestAufbau:
    def test_falscher_spaltenkopf(self, client: TestClient) -> None:
        daten = _senden(client, "A;B;C\n1;2;3\n").json()
        assert not daten["angenommen"]
        assert any(f["regel"] == "Spaltenkopf" for f in daten["fehler"])

    def test_semikolon_zerreisst_die_zeile(self, client: TestClient) -> None:
        kaputt = _gueltig().replace("Beispielbureau", "Bureau;GmbH")
        daten = _senden(client, kaputt).json()
        assert any(f["regel"] == "Feldzahl" for f in daten["fehler"])

    def test_fehlende_message_zeile(self, client: TestClient) -> None:
        daten = _senden(client, _datei(_betreiber(), _verkaeufer(), _objekt())).json()
        assert any(f["regel"] == "Aufbau" for f in daten["fehler"])

    def test_objekt_ohne_verkaeufer_ist_verwaist(self, client: TestClient) -> None:
        datei = _datei(_message(), _betreiber(), _objekt())
        daten = _senden(client, datei).json()
        assert any(f["regel"] == "Bezug" for f in daten["fehler"])


class TestWerte:
    def test_unbekannte_objektart(self, client: TestClient) -> None:
        datei = _datei(
            _message(), _betreiber(), _verkaeufer(), _objekt(RS_ACT_PROP_TYPE="DPI999")
        )
        daten = _senden(client, datei).json()
        assert any(f["spalte"] == "RS_ACT_PROP_TYPE" for f in daten["fehler"])

    def test_falsches_datumsformat(self, client: TestClient) -> None:
        datei = _datei(
            _message(MSG_REPORTING_PERIOD="2025-12-31"),
            _betreiber(),
            _verkaeufer(),
            _objekt(),
        )
        daten = _senden(client, datei).json()
        assert any(f["regel"] == "Datumsformat" for f in daten["fehler"])

    def test_negativer_betrag(self, client: TestClient) -> None:
        datei = _datei(
            _message(), _betreiber(), _verkaeufer(), _objekt(RS_ACT_CONS_Q2="-5")
        )
        daten = _senden(client, datei).json()
        assert any(f["regel"] == "Betrag" for f in daten["fehler"])

    def test_bfe_ohne_bruttomieteinnahme(self, client: TestClient) -> None:
        """Feldkommentar: Pflicht, sobald die BFE-Nummer steht."""
        datei = _datei(
            _message(),
            _betreiber(),
            _verkaeufer(),
            _objekt(RS_ACT_DK_GRI="", RS_ACT_DK_GRI_CCY=""),
        )
        daten = _senden(client, datei).json()
        assert any(f["regel"] == "Pflicht bei BFE-Nummer" for f in daten["fehler"])

    def test_matrikel_mit_zu_vielen_ziffern_ist_ein_hinweis(
        self, client: TestClient
    ) -> None:
        """Sieben Ziffern verletzen „max fire cifre"; kein harter Fehler."""
        datei = _datei(
            _message(), _betreiber(), _verkaeufer(), _objekt(RS_ACT_LAND_REG_NUM="3155601")
        )
        daten = _senden(client, datei).json()
        assert any(h["regel"] == "Matrikelnummer" for h in daten["hinweise"])

    def test_kennung_darf_nicht_doppelt_stehen(self, client: TestClient) -> None:
        datei = _datei(_message(), _message(), _betreiber(), _verkaeufer(), _objekt())
        daten = _senden(client, datei).json()
        assert any(f["regel"] == "Einmaligkeit" for f in daten["fehler"])


class TestErzwungeneFehlerfaelle:
    """Der Gutfall laesst sich auch echt pruefen — der Fehlerpfad nicht."""

    def test_ablehnen(self, client: TestClient) -> None:
        daten = _senden(client, _gueltig(), **{"X-Staging-Verhalten": "ablehnen"}).json()
        assert not daten["angenommen"]

    def test_wartung_gibt_503(self, client: TestClient) -> None:
        antwort = _senden(client, _gueltig(), **{"X-Staging-Verhalten": "wartung"})
        assert antwort.status_code == 503

    def test_doppelte_meldung(self, client: TestClient) -> None:
        daten = _senden(client, _gueltig(), **{"X-Staging-Verhalten": "doppelt"}).json()
        assert not daten["angenommen"]
        assert any("bereits eine Meldung" in f["grund"] for f in daten["fehler"])

    def test_unbekanntes_verhalten_wird_abgewiesen(self, client: TestClient) -> None:
        antwort = _senden(client, _gueltig(), **{"X-Staging-Verhalten": "quatsch"})
        assert antwort.status_code == 400


class TestXml:
    def test_wohlgeformtes_dpi_wird_angenommen(self, client: TestClient) -> None:
        xml = """<?xml version="1.0" encoding="UTF-8"?>
<DPI_OECD xmlns="urn:oecd:ties:dpi:v1">
  <MessageSpec>
    <TransmittingCountry>DK</TransmittingCountry>
    <MessageType>DPI</MessageType>
    <MessageRefId>DK2025DK44179377_AS25</MessageRefId>
    <MessageTypeIndic>DPI401</MessageTypeIndic>
    <ReportingPeriod>2025-12-31</ReportingPeriod>
  </MessageSpec>
  <DPIBody>
    <PlatformOperator>
      <ResCountryCode>DK</ResCountryCode>
      <TIN issuedBy="DK">44179377</TIN>
      <DocSpec><DocRefId>DK202544179377_AS2025</DocRefId></DocSpec>
    </PlatformOperator>
    <ReportableSeller>
      <Individual><ResCountryCode>DK</ResCountryCode></Individual>
      <DocSpec><DocRefId>DK202544179377_001</DocRefId></DocSpec>
      <Immovable>
        <Address><CountryCode>DK</CountryCode></Address>
        <PropertyType>DPI904</PropertyType>
      </Immovable>
    </ReportableSeller>
  </DPIBody>
</DPI_OECD>"""
        antwort = client.post(
            "/v1/einreichung",
            files={"datei": ("m.xml", xml.encode("utf-8"), "application/xml")},
            headers={KOPF: TOKEN},
        )
        daten = antwort.json()
        assert daten["format"] == "xml"
        assert daten["angenommen"], daten["fehler"]

    def test_dtd_wird_abgewiesen(self, client: TestClient) -> None:
        """XXE-Schutz: fremdes XML ist angreiferkontrolliert (Wurzel 8)."""
        boese = (
            '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x SYSTEM '
            '"file:///etc/passwd">]><DPI_OECD><MessageSpec/></DPI_OECD>'
        )
        antwort = client.post(
            "/v1/einreichung",
            files={"datei": ("m.xml", boese.encode("utf-8"), "application/xml")},
            headers={KOPF: TOKEN},
        )
        daten = antwort.json()
        assert not daten["angenommen"]
        assert any(f["regel"] == "Sicherheit" for f in daten["fehler"])

    def test_fehlender_betreiber(self, client: TestClient) -> None:
        xml = (
            '<?xml version="1.0"?><DPI_OECD xmlns="urn:oecd:ties:dpi:v1">'
            "<MessageSpec><TransmittingCountry>DK</TransmittingCountry>"
            "<MessageRefId>x</MessageRefId><ReportingPeriod>2025-12-31"
            "</ReportingPeriod></MessageSpec><DPIBody/></DPI_OECD>"
        )
        antwort = client.post(
            "/v1/einreichung",
            files={"datei": ("m.xml", xml.encode("utf-8"), "application/xml")},
            headers={KOPF: TOKEN},
        )
        daten = antwort.json()
        assert any(f["spalte"] == "PlatformOperator" for f in daten["fehler"])


class TestProtokoll:
    def test_leeren_verwirft_alles(self, client: TestClient) -> None:
        _senden(client, _gueltig())
        antwort = client.delete("/v1/quittungen", headers={KOPF: TOKEN})
        assert antwort.status_code == 200
        assert client.get("/v1/quittungen", headers={KOPF: TOKEN}).json() == []


class TestEinmaligkeit:
    """Dieselbe Datei zweimal — die Behoerde nimmt sie nur einmal an.

    "Indtaegten skal kun indberettes een gang og ikke dobbelt"
    (DAC7-Anleitung feriehusudlejerne.dk, S. 5). Aufgefallen ist die Luecke
    nicht im Test, sondern beim ersten echten Versand aus dem PMS: derselbe
    Inhalt bekam zwei Quittungen, und damit waere dieselbe Einnahme zweimal
    gemeldet gewesen.
    """

    def test_zweite_einreichung_wird_zurueckgewiesen(
        self, client: TestClient
    ) -> None:
        inhalt = _gueltig()
        erste = _senden(client, inhalt).json()
        assert erste["angenommen"], erste["fehler"]

        zweite = _senden(client, inhalt).json()
        assert not zweite["angenommen"]
        assert any(f["regel"] == "Einmaligkeit" for f in zweite["fehler"])
        # Die Quittung der ersten Einreichung wird genannt, damit der
        # Absender nachvollziehen kann, was schon vorliegt.
        assert erste["quittungsnummer"] in str(zweite["fehler"])

    def test_dateiname_aendert_nichts(self, client: TestClient) -> None:
        """Geprueft wird der Inhalt, nicht der Name — er ist eine Behauptung."""
        inhalt = _gueltig()
        _senden(client, inhalt, name="meldung.csv")
        zweite = _senden(client, inhalt, name="anders.csv").json()
        assert not zweite["angenommen"]

    def test_andere_datei_wird_angenommen(self, client: TestClient) -> None:
        """Eine geaenderte Meldung ist keine Dublette."""
        _senden(client, _gueltig())
        andere = _datei(
            _message(MSG_MESSAGE_REF_ID="DK2025DK44179377_AS26"),
            _betreiber(),
            _verkaeufer(),
            _objekt(),
        )
        assert _senden(client, andere).json()["angenommen"]

    def test_zurueckgewiesene_datei_sperrt_nicht(self, client: TestClient) -> None:
        """Nur ANGENOMMENES sperrt.

        Sonst koennte eine fehlerhafte Datei nach der Korrektur nicht mehr
        eingereicht werden — und wer unveraendert erneut sendet, soll
        weiterhin SEINEN Fehler sehen, nicht den Dublettenhinweis.
        """
        kaputt = _datei(_betreiber(), _verkaeufer(), _objekt())
        erste = _senden(client, kaputt).json()
        assert not erste["angenommen"]

        zweite = _senden(client, kaputt).json()
        assert not zweite["angenommen"]
        assert not any(f["regel"] == "Einmaligkeit" for f in zweite["fehler"])


class TestPosteingang:
    """Die Startseite ist die Sicht der BEHOERDE: was ist angekommen.

    Sie zeigte zuerst nur ein Hochladeformular — die Sicht des Absenders.
    Ein Amt reicht nichts ein, es empfaengt.
    """

    def test_leerer_eingang_wird_benannt(self, client: TestClient) -> None:
        seite = client.get("/").text
        assert "Posteingang" in seite
        assert "keine Meldung vor" in seite

    def test_eingegangene_meldung_erscheint(self, client: TestClient) -> None:
        nummer = _senden(client, _gueltig()).json()["quittungsnummer"]
        seite = client.get("/").text
        assert nummer in seite
        assert "angenommen" in seite

    def test_abgewiesene_meldung_erscheint_als_abgewiesen(
        self, client: TestClient
    ) -> None:
        _senden(client, _datei(_betreiber(), _verkaeufer(), _objekt()))
        assert "abgewiesen" in client.get("/").text

    def test_posteingang_nennt_keine_inhalte_der_datei(
        self, client: TestClient
    ) -> None:
        """Kein Name, keine CPR, kein Betrag — die Stelle protokolliert nur.

        Die Vorlage traegt echte Personendaten; was hier versehentlich
        angezeigt wuerde, stuende auf einer oeffentlich erreichbaren Seite.
        """
        _senden(client, _gueltig())
        seite = client.get("/").text
        assert "Beispielbureau" not in seite
        assert "5836" not in seite

    def test_zaehler_stimmt(self, client: TestClient) -> None:
        _senden(client, _gueltig())
        _senden(client, _datei(_betreiber()))
        seite = client.get("/").text
        # zwei Meldungen, davon eine angenommen
        assert "<b>2</b>Meldungen" in seite
        assert "<b>1</b>angenommen" in seite
        assert "<b>1</b>abgewiesen" in seite
