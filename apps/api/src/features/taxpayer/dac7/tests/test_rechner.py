"""Prüft die Rechenregeln der Meldung.

Jeder Test hier deckt eine Entscheidung ab, die man auch anders hätte
treffen können — und die falsch getroffen eine Falschmeldung ergäbe.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from src.features.taxpayer.dac7.kanaele import (
    Meldungsart,
    ausschlussgrund,
    gehoert_zu,
)
from src.features.taxpayer.dac7.modell import Pruefbericht
from src.features.taxpayer.dac7.rechner import (
    Buchungswerte,
    buchung_verbuchen,
    buchungen_auswaehlen,
    quartal_von,
    zahlungszeitpunkt,
)


def _buchung(**felder: object) -> dict:
    """Eine Buchung mit sinnvollen Grundwerten; Felder gezielt überschreiben."""
    grund = {
        "id": "b1",
        "status": "completed",
        "channel": "portal",
        "currency": "DKK",
        "total_amount": "1000.00",
        "ota_commission": None,
        "channel_fee": None,
        "check_in": "2025-06-10",
        "check_out": "2025-06-17",
        "booked_at": "2025-03-05T10:00:00+00:00",
    }
    grund.update(felder)
    return grund


class TestQuartal:
    def test_monatsgrenzen(self) -> None:
        assert quartal_von(date(2025, 1, 1)) == 1
        assert quartal_von(date(2025, 3, 31)) == 1
        assert quartal_von(date(2025, 4, 1)) == 2
        assert quartal_von(date(2025, 12, 31)) == 4


class TestZahlungszeitpunkt:
    def test_zahlung_schlaegt_buchungszeitpunkt(self) -> None:
        """Die erfasste Zahlung ist die genauere Quelle."""
        buchung = _buchung(booked_at="2025-03-05T10:00:00+00:00")
        zahlungen = [{"created_at": "2025-07-02T08:00:00+00:00"}]
        assert zahlungszeitpunkt(buchung, zahlungen) == date(2025, 7, 2)

    def test_ohne_zahlung_gilt_der_buchungszeitpunkt(self) -> None:
        assert zahlungszeitpunkt(_buchung(), []) == date(2025, 3, 5)

    def test_created_at_ist_keine_quelle(self) -> None:
        """Unsere Verarbeitungszeit darf nie den Zeitpunkt bestimmen.

        Ein Feed-Import legt hunderte Buchungen mit derselben Sekunde an;
        sie alle in dasselbe Quartal zu legen wäre eine Falschmeldung.
        """
        buchung = _buchung(booked_at=None)
        buchung["created_at"] = "2025-09-09T12:00:00+00:00"
        assert zahlungszeitpunkt(buchung, []) is None

    def test_frueheste_zahlung_gewinnt(self) -> None:
        zahlungen = [
            {"created_at": "2025-08-01T00:00:00+00:00"},
            {"created_at": "2025-04-01T00:00:00+00:00"},
        ]
        assert zahlungszeitpunkt(_buchung(), zahlungen) == date(2025, 4, 1)


class TestVerbuchen:
    def test_verguetung_kommt_aus_der_buchung_nicht_aus_zahlungen(self) -> None:
        """Der Kern: ohne Zahlungssatz trotzdem die volle Vergütung.

        Bei Portalbuchungen zahlt der Gast ans Portal; es gibt bei uns keinen
        Zahlungssatz. Live sind das 732 von 732 Buchungen des Meldejahres.
        """
        werte = Buchungswerte()
        bericht = Pruefbericht()
        assert buchung_verbuchen(werte, _buchung(), 2025, bericht, [])
        assert werte.verguetung.summe == Decimal("1000.00")
        assert werte.verguetung[1] == Decimal("1000.00")  # booked_at im März

    def test_quartal_folgt_der_zahlung(self) -> None:
        werte = Buchungswerte()
        buchung_verbuchen(
            werte,
            _buchung(),
            2025,
            Pruefbericht(),
            [{"created_at": "2025-11-02T00:00:00+00:00"}],
        )
        assert werte.verguetung[4] == Decimal("1000.00")
        assert werte.verguetung[1] == Decimal(0)

    def test_gebuehren_summieren_provision_und_kanalgebuehr(self) -> None:
        werte = Buchungswerte()
        buchung_verbuchen(
            werte,
            _buchung(ota_commission="150.50", channel_fee="20.00"),
            2025,
            Pruefbericht(),
            [],
        )
        assert werte.gebuehren.summe == Decimal("170.50")

    def test_fehlende_gebuehr_ist_null_nicht_geraten(self) -> None:
        werte = Buchungswerte()
        buchung_verbuchen(werte, _buchung(), 2025, Pruefbericht(), [])
        assert werte.gebuehren.summe == Decimal(0)

    def test_naechte_werden_gezaehlt(self) -> None:
        werte = Buchungswerte()
        buchung_verbuchen(werte, _buchung(), 2025, Pruefbericht(), [])
        assert werte.vermietete_tage == 7

    def test_eine_buchung_ist_eine_taetigkeit_auch_bei_zwei_raten(self) -> None:
        """Zwei Zahlungen, eine Buchung: die Tätigkeit zählt einmal."""
        werte = Buchungswerte()
        buchung_verbuchen(
            werte,
            _buchung(),
            2025,
            Pruefbericht(),
            [
                {"created_at": "2025-02-01T00:00:00+00:00"},
                {"created_at": "2025-05-01T00:00:00+00:00"},
            ],
        )
        assert werte.anzahl.summe == 1

    def test_anderes_meldejahr_wird_nicht_eingerechnet(self) -> None:
        werte = Buchungswerte()
        bericht = Pruefbericht()
        assert not buchung_verbuchen(
            werte, _buchung(booked_at="2024-03-05T10:00:00+00:00"), 2025, bericht, []
        )
        assert werte.anzahl.summe == 0
        assert bericht.ausgeschlossene_buchungen

    def test_ohne_zeitpunkt_kein_einbezug_und_ein_vermerk(self) -> None:
        werte = Buchungswerte()
        bericht = Pruefbericht()
        assert not buchung_verbuchen(
            werte, _buchung(booked_at=None), 2025, bericht, []
        )
        assert any(
            "Quartal nicht bestimmbar" in grund
            for grund in bericht.ausgeschlossene_buchungen
        )

    def test_gemischte_waehrungen_werden_erkannt(self) -> None:
        """Über Währungsgrenzen zu addieren wäre fachlich falsch."""
        werte = Buchungswerte()
        bericht = Pruefbericht()
        buchung_verbuchen(werte, _buchung(currency="DKK"), 2025, bericht, [])
        buchung_verbuchen(
            werte, _buchung(id="b2", currency="EUR"), 2025, bericht, []
        )
        assert werte.waehrungen_gemischt
        assert not werte.meldefaehig

    def test_belege_werden_mitgefuehrt(self) -> None:
        """Jede Zahl muss auf ihre Buchungen zurückführbar sein."""
        werte = Buchungswerte()
        buchung_verbuchen(werte, _buchung(id="abc"), 2025, Pruefbericht(), [])
        assert werte.belege == ["abc"]


class TestAuswahl:
    def test_nur_verguetete_status(self) -> None:
        bericht = Pruefbericht()
        gewaehlt = buchungen_auswaehlen(
            [
                _buchung(id="a", status="completed"),
                _buchung(id="b", status="cancelled"),
                _buchung(id="c", status="pending"),
            ],
            Meldungsart.MARKTPLATZ,
            bericht,
        )
        assert [b["id"] for b in gewaehlt] == ["a"]

    def test_portalbuchungen_gehoeren_nicht_in_unsere_meldung(self) -> None:
        """Booking und Airbnb melden selbst — sonst doppelte Veranlagung."""
        bericht = Pruefbericht()
        gewaehlt = buchungen_auswaehlen(
            [
                _buchung(id="a", channel="booking"),
                _buchung(id="b", channel="airbnb"),
                _buchung(id="c", channel="portal"),
            ],
            Meldungsart.MARKTPLATZ,
            bericht,
        )
        assert [b["id"] for b in gewaehlt] == ["c"]
        assert bericht.einbezogene_buchungen == 1

    def test_betriebsmeldung_nimmt_jeden_kanal(self) -> None:
        """Der Betrieb meldet ALLE Vermietungen seiner Eigentuemer.

        Frueher blieb hier nur `website` uebrig. Massgeblich ist aber der
        Vermittlungsvertrag mit dem Hauseigentuemer, nicht der Weg, auf dem
        der Gast kam — die Agentur hat ihn in jedem dieser Faelle.
        """
        bericht = Pruefbericht()
        gewaehlt = buchungen_auswaehlen(
            [
                _buchung(id="a", channel="website"),
                _buchung(id="b", channel="portal"),
                _buchung(id="c", channel="booking"),
                _buchung(id="d", channel="airbnb"),
                _buchung(id="e", channel="direct"),
            ],
            Meldungsart.BETRIEB,
            bericht,
        )
        assert [b["id"] for b in gewaehlt] == ["a", "b", "c", "d", "e"]
        assert bericht.einbezogene_buchungen == 5

    def test_direktbuchung_gehoert_in_die_betriebsmeldung(self) -> None:
        """Telefon und Mail sind kein Grund, eine Vermietung zu verschweigen.

        „Direktbuchung ohne Plattform (kein meldepflichtiger Vorgang)" war
        eine erfundene Begruendung: Der Eigentuemer erzielt die Einnahme
        ueber die Agentur, die mit ihm abrechnet.
        """
        bericht = Pruefbericht()
        assert buchungen_auswaehlen(
            [_buchung(channel="direct")], Meldungsart.BETRIEB, bericht
        )
        assert not buchungen_auswaehlen(
            [_buchung(channel="direct")], Meldungsart.MARKTPLATZ, bericht
        )

    def test_unbekannter_kanal_faellt_nicht_aus_der_betriebsmeldung(self) -> None:
        """Ein neuer Vertriebsweg darf keine Vermietung unterschlagen.

        Vorher landete ein unbekannter Kanal in KEINER Meldung und erzeugte
        nur einen Hinweis — die Buchung fehlte damit still in der Datei.
        """
        bericht = Pruefbericht()
        assert buchungen_auswaehlen(
            [_buchung(channel="ein_neuer_kanal")], Meldungsart.BETRIEB, bericht
        )

    def test_jeder_ausschluss_wird_begruendet(self) -> None:
        """Die Differenz zum Gesamtbestand muss vollständig erklärt sein."""
        bericht = Pruefbericht()
        buchungen = [
            _buchung(id="a", channel="booking"),
            _buchung(id="b", status="cancelled"),
            _buchung(id="c", channel="direct"),
            _buchung(id="d", channel="portal"),
        ]
        gewaehlt = buchungen_auswaehlen(buchungen, Meldungsart.MARKTPLATZ, bericht)
        ausgeschlossen = sum(bericht.ausgeschlossene_buchungen.values())
        assert len(gewaehlt) + ausgeschlossen == len(buchungen)


class TestKanalIstFuerDenBetriebOhneBelang:
    """Der Vermittlungsvertrag entscheidet, nicht der Buchungskanal.

    Woertlich in der DAC7-Anleitung fuer daenische Ferienhausvermittler
    (feriehusudlejerne.dk, mit der Skattestyrelsen abgestimmt): Bei mehreren
    Vermittlern ist „den formidler, der har formidlingsaftale og foretager
    afregning med husejer" meldepflichtig. Das ist der Betrieb — auch wenn
    der Gast ueber Booking, Airbnb oder das Telefon kam.

    Vorher siebte der Code nach `channel` aus und verwarf bei einem realen
    Betrieb 463 von 694 Buchungen mit erfundenen Begruendungen („Booking.com
    meldet als Plattformbetreiber selbst"). Seine tatsaechlich abgegebene
    Meldung enthaelt 231.
    """

    def test_alle_kanaele_gehoeren_in_die_betriebsmeldung(self) -> None:
        for kanal in (
            "booking",
            "airbnb",
            "vrbo",
            "expedia",
            "agoda",
            "tripadvisor",
            "direct",
            "website",
            "portal",
            "ein_neuer_kanal",
        ):
            assert gehoert_zu(kanal, Meldungsart.BETRIEB), kanal

    def test_auch_ohne_kanal_gehoert_die_buchung_in_die_betriebsmeldung(
        self,
    ) -> None:
        """Ein fehlender Kanal ist kein Grund, eine Vermietung zu verschweigen."""
        assert gehoert_zu(None, Meldungsart.BETRIEB)

    def test_kein_portal_wird_mehr_als_selbstmeldend_ausgegeben(self) -> None:
        """Die Gegenprobe zum alten Fehler — er darf nicht zurueckkehren."""
        for kanal in ("booking", "airbnb", "vrbo", "expedia", "direct"):
            grund = ausschlussgrund(kanal, Meldungsart.BETRIEB)
            assert "meldet als Plattformbetreiber selbst" not in grund
            assert "kein meldepflichtiger Vorgang" not in grund


class TestMarktplatzmeldung:
    """myBestDays meldet nur, was ueber den eigenen Marktplatz lief."""

    def test_nur_der_marktplatzkanal_zaehlt(self) -> None:
        assert gehoert_zu("portal", Meldungsart.MARKTPLATZ)
        for kanal in ("booking", "airbnb", "website", "direct", None):
            assert not gehoert_zu(kanal, Meldungsart.MARKTPLATZ), kanal

    def test_fremdkanal_verweist_auf_die_betriebsmeldung(self) -> None:
        grund = ausschlussgrund("booking", Meldungsart.MARKTPLATZ)
        assert "Meldung des Betriebs" in grund
