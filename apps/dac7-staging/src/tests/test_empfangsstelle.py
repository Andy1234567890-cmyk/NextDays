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


class TestMeldungsansicht:
    """Was uebermittelt wurde, muss SICHTBAR sein.

    Die Stelle zeigte nur Pruefsumme und Zeilenzahl. Damit laesst sich
    nicht pruefen, was in der Meldung steht — und genau dafuer gibt es
    sie: sehen, was gemeldet wird, bevor es zur Behoerde geht.
    """

    def test_quittung_liefert_die_saetze(self, client: TestClient) -> None:
        daten = _senden(client, _gueltig()).json()
        assert len(daten["saetze"]) == daten["zeilen"]
        erster = daten["saetze"][0]
        assert erster["ROW_TYPE"] == "Message"
        assert erster["MSG_MESSAGE_REF_ID"] == "DK2025DK44179377_AS25"

    def test_leere_spalten_fehlen(self, client: TestClient) -> None:
        """Eine Zeile traegt 89 Spalten und fuellt ein Dutzend."""
        satz = _senden(client, _gueltig()).json()["saetze"][0]
        assert len(satz) < 20
        assert all(w.strip() for s, w in satz.items() if s != "__nr")

    def test_detailseite_zeigt_die_felder(self, client: TestClient) -> None:
        nummer = _senden(client, _gueltig()).json()["quittungsnummer"]
        seite = client.get(f"/meldung/{nummer}").text
        assert "Übermittelte Daten" in seite
        assert "MSG_MESSAGE_REF_ID" in seite
        assert "DK2025DK44179377_AS25" in seite
        assert "Beispielbureau" in seite

    def test_je_objekt_eine_zeile(self, client: TestClient) -> None:
        """Die Tabelle ist aufgebaut wie die CSV: ein Satz, eine Zeile.

        Ein Betrieb mit 100 Objekten hat 100 ACT-Zeilen — sie gehoeren
        untereinander in EINE Tabelle, sonst laesst sich eine Spalte nicht
        ueber alle Objekte vergleichen.
        """
        drei = _datei(
            _message(),
            _betreiber(),
            _verkaeufer(),
            _objekt(ADDR_CITY="Aarhus"),
            _objekt(ADDR_CITY="Odense"),
            _objekt(ADDR_CITY="Aalborg"),
        )
        nummer = _senden(client, drei).json()["quittungsnummer"]
        seite = client.get(f"/meldung/{nummer}").text
        # EINE Tabelle ueber die ganze Datei: 3 Objekte + Message +
        # Betreiber + Verkaeufer = 6 Zeilen.
        assert "6 Zeilen" in seite
        assert seite.count("ACT_Immovable_Property") >= 3
        for ort in ("Aarhus", "Odense", "Aalborg"):
            assert ort in seite

    def test_volle_breite_ohne_karten(self, client: TestClient) -> None:
        """Die Tabelle hat bis zu 89 Spalten.

        In einer 52rem breiten Karte sieht man fuenf davon und rollt durch
        einen Briefschlitz — fuer eine Pruefung unbrauchbar.
        """
        nummer = _senden(client, _gueltig()).json()["quittungsnummer"]
        seite = client.get(f"/meldung/{nummer}").text
        assert 'class="rahmen weit"' in seite
        assert 'class="karte"' not in seite

    def test_startseite_bleibt_schmal(self, client: TestClient) -> None:
        """Nur die Meldungsseite ist weit — der Posteingang liest sich schmal."""
        seite = client.get("/").text
        assert "rahmen weit" not in seite

    def test_nur_eine_tabelle(self, client: TestClient) -> None:
        """Die Datei ist EIN Raster, keine Sammlung von Bloecken.

        Erst standen die Saetze in Bloecken je Satztyp — das ist nicht,
        wie die CSV aussieht. Eine Tabelle, ein Spaltenkopf, jede Zeile
        der Datei eine Zeile der Tabelle.
        """
        nummer = _senden(client, _gueltig()).json()["quittungsnummer"]
        seite = client.get(f"/meldung/{nummer}").text
        assert seite.count('<table class="csv">') == 1

    def test_row_type_steht_als_spalte(self, client: TestClient) -> None:
        """Im Raster ist der Satztyp eine SPALTE, keine Ueberschrift."""
        nummer = _senden(client, _gueltig()).json()["quittungsnummer"]
        seite = client.get(f"/meldung/{nummer}").text
        assert "<th><code>ROW_TYPE</code></th>" in seite

    def test_spaltenkopf_steht_einmal_je_typ(self, client: TestClient) -> None:
        """Nicht je Satz ein eigener Block — ein Kopf, darunter die Saetze."""
        zwei = _datei(
            _message(), _betreiber(), _verkaeufer(),
            _objekt(ADDR_CITY="Aarhus"), _objekt(ADDR_CITY="Odense"),
        )
        nummer = _senden(client, zwei).json()["quittungsnummer"]
        seite = client.get(f"/meldung/{nummer}").text
        # Genau EIN Tabellenkopf. Das zweite Vorkommen im Quelltext ist der
        # Spaltenkopf in der Rohansicht der Datei — der gehoert dorthin.
        assert seite.count("<th><code>RS_ACT_PROP_TYPE</code></th>") == 1

    def test_spalten_in_der_reihenfolge_der_vorlage(
        self, client: TestClient
    ) -> None:
        """Wer die CSV danebenlegt, findet die Spalte an derselben Stelle."""
        nummer = _senden(client, _gueltig()).json()["quittungsnummer"]
        seite = client.get(f"/meldung/{nummer}").text
        # RESIDENCE (15) steht in der Vorlage vor TIN (16) vor ADDR_CITY (27)
        assert seite.index("RESIDENCE") < seite.index(">TIN<")
        assert seite.index(">TIN<") < seite.index("ADDR_CITY")

    def test_detailseite_zeigt_die_rohdatei(self, client: TestClient) -> None:
        nummer = _senden(client, _gueltig()).json()["quittungsnummer"]
        seite = client.get(f"/meldung/{nummer}").text
        assert "Datei im Original" in seite
        # Der Spaltenkopf der Vorlage steht darin, unveraendert.
        assert "ROW_TYPE;MSG_MESSAGE_REF_ID" in seite

    def test_datei_laesst_sich_herunterladen(self, client: TestClient) -> None:
        inhalt = _gueltig()
        nummer = _senden(client, inhalt).json()["quittungsnummer"]
        antwort = client.get(f"/meldung/{nummer}/datei")
        assert antwort.status_code == 200
        assert antwort.text == inhalt
        # Niemals als Markup ausliefern — der Inhalt kommt von aussen.
        assert antwort.headers["content-type"].startswith("text/plain")
        assert "attachment" in antwort.headers["content-disposition"]

    def test_unbekannte_quittung_gibt_404(self, client: TestClient) -> None:
        assert client.get("/meldung/DK-19700101-000000").status_code == 404

    def test_leeren_verwirft_auch_die_inhalte(self, client: TestClient) -> None:
        """Der Notausgang muss die Rohdaten mitnehmen, nicht nur die Liste."""
        nummer = _senden(client, _gueltig()).json()["quittungsnummer"]
        client.delete("/v1/quittungen", headers={KOPF: TOKEN})
        assert client.get(f"/meldung/{nummer}").status_code == 404
        assert client.get(f"/meldung/{nummer}/datei").status_code == 404


class TestKeinFormular:
    def test_startseite_hat_kein_hochladeformular(self, client: TestClient) -> None:
        """Ein Amt reicht nichts ein, es empfaengt."""
        seite = client.get("/").text
        assert "<form" not in seite
        assert "type=\"file\"" not in seite

    def test_einreichen_route_gibt_es_nicht_mehr(self, client: TestClient) -> None:
        antwort = client.post(
            "/einreichen", files={"datei": ("m.csv", b"x", "text/csv")}
        )
        assert antwort.status_code == 405 or antwort.status_code == 404


class TestUebermittlungUndSchutz:
    """Die Stelle muss zeigen, wie zuverlaessig sie laeuft und wie sie schuetzt.

    Eine DAC7-Meldung wird einmal im Jahr eingereicht. Laeuft sie dann in
    ein Zeitlimit, steht der Betrieb ohne Quittung da. Wer das vorher
    wissen will, braucht Laufzeiten — und wer der Stelle Steuerdaten
    anvertraut, muss sehen koennen, was sie schuetzt.
    """

    def test_kennzahlen_erscheinen(self, client: TestClient) -> None:
        _senden(client, _gueltig())
        seite = client.get("/").text
        assert "Übermittlung" in seite
        assert "angenommen" in seite
        assert "im Mittel" in seite
        assert "langsamstes Fünftel" in seite

    def test_ohne_einreichung_keine_leeren_kennzahlen(
        self, client: TestClient
    ) -> None:
        """Eine Quote ueber null Faelle waere eine erfundene Zahl."""
        assert "langsamstes Fünftel" not in client.get("/").text

    def test_quote_rechnet_richtig(self, client: TestClient) -> None:
        _senden(client, _gueltig())
        _senden(client, _datei(_betreiber()))
        assert "50 %" in client.get("/").text

    def test_dauer_wird_gemessen(self, client: TestClient) -> None:
        _senden(client, _gueltig())
        gesundheit = client.get("/health").json()
        assert gesundheit["einreichungen"] == 1
        assert gesundheit["dauer_mittel_ms"] > 0
        assert gesundheit["annahmequote_prozent"] == 100.0

    def test_health_nennt_keine_inhalte(self, client: TestClient) -> None:
        """`/health` geht ohne Anmeldung hinaus — nur Zahlen, nie Daten."""
        _senden(client, _gueltig())
        roh = client.get("/health").text
        assert "Beispielbureau" not in roh
        assert "DK-" not in roh

    def test_schutz_wird_benannt(self, client: TestClient) -> None:
        seite = client.get("/").text
        for punkt in ("Zugang", "Fail-closed", "Obergrenze", "Einmaligkeit",
                      "Aufbewahrung", "CORS"):
            assert punkt in seite

    def test_schutz_verraet_kein_geheimnis(self, client: TestClient) -> None:
        """Die Seite ist erreichbar — wer angreift, soll nichts mitnehmen.

        Kein Token, kein Auszug, keine Laenge: Schon die Zeichenzahl
        grenzt den Suchraum ein.
        """
        seite = client.get("/").text
        assert TOKEN not in seite
        assert TOKEN[:6] not in seite
        assert str(len(TOKEN)) + " Zeichen" not in seite
