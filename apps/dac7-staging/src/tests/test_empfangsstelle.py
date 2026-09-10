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

KOPF = "X-Staging-Token"
TOKEN = "test-token-nicht-echt"


@pytest.fixture
def client() -> TestClient:
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
        assert daten["quittungsnummer"].startswith("DK-")
        assert len(daten["pruefsumme"]) == 64

    def test_quittung_ist_abrufbar(self, client: TestClient) -> None:
        nummer = _senden(client, _gueltig()).json()["quittungsnummer"]
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
