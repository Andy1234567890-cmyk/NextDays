"""Tests der Spam-Heuristik.

Der Schwerpunkt liegt bewusst auf den ECHTEN Anfragen, die NICHT hängen bleiben
dürfen: eine Heuristik, die Spam fängt und dabei Kunden aussperrt, ist teurer als
keine. Deshalb steht zu jeder Ablehnung ein Gegenbeispiel.
"""
from __future__ import annotations

import pytest

from src.features.contact import spamnetz


class TestZeitfalle:
    def test_millisekunden_sind_ein_skript(self) -> None:
        with pytest.raises(spamnetz.SpamVerdacht) as exc:
            spamnetz.pruefen(
                email="a@example.com", nachricht="x" * 30, dauer_sekunden=0.08
            )
        assert "zu_schnell" in exc.value.grund

    def test_knapp_unter_der_grenze_faellt_durch(self) -> None:
        with pytest.raises(spamnetz.SpamVerdacht):
            spamnetz.pruefen(
                email="a@example.com",
                nachricht="x" * 30,
                dauer_sekunden=spamnetz.MIN_SEKUNDEN - 0.01,
            )

    def test_genau_die_grenze_ist_erlaubt(self) -> None:
        """Die Grenze selbst darf nicht abweisen — sonst ist sie faktisch höher."""
        spamnetz.pruefen(
            email="a@example.com",
            nachricht="x" * 30,
            dauer_sekunden=spamnetz.MIN_SEKUNDEN,
        )

    def test_mensch_der_normal_tippt_kommt_durch(self) -> None:
        spamnetz.pruefen(
            email="kunde@hotel-seeblick.de",
            nachricht="Wir haben 12 Zimmer und suchen eine Lösung.",
            dauer_sekunden=45.0,
        )

    def test_tab_ueber_nacht_offen_ist_noch_erlaubt(self) -> None:
        spamnetz.pruefen(
            email="kunde@hotel-seeblick.de",
            nachricht="Wir haben 12 Zimmer und suchen eine Lösung.",
            dauer_sekunden=8 * 60 * 60.0,
        )

    def test_erfundene_riesendauer_faellt_auf(self) -> None:
        """Ein Bot, der die Untergrenze mit einer Fantasiezahl umgeht."""
        with pytest.raises(spamnetz.SpamVerdacht) as exc:
            spamnetz.pruefen(
                email="a@example.com",
                nachricht="x" * 30,
                dauer_sekunden=99_999_999.0,
            )
        assert "unglaubwuerdig" in exc.value.grund

    def test_fehlende_dauer_ist_kein_verstoss(self) -> None:
        """Alte Seite im Cache, JavaScript aus — darf nicht abgewiesen werden."""
        spamnetz.pruefen(
            email="kunde@hotel-seeblick.de",
            nachricht="Wir haben 12 Zimmer und suchen eine Lösung.",
            dauer_sekunden=None,
        )


class TestWegwerfAdressen:
    def test_bekannter_dienst_wird_abgewiesen(self) -> None:
        with pytest.raises(spamnetz.SpamVerdacht) as exc:
            spamnetz.pruefen(
                email="xyz@mailinator.com", nachricht="x" * 30, dauer_sekunden=20.0
            )
        assert exc.value.grund == "wegwerf_adresse"

    def test_gross_klein_egal(self) -> None:
        with pytest.raises(spamnetz.SpamVerdacht):
            spamnetz.pruefen(
                email="XYZ@MailInator.COM", nachricht="x" * 30, dauer_sekunden=20.0
            )

    def test_echte_freemail_ist_erlaubt(self) -> None:
        """gmail/gmx sind KEIN Wegwerf-Dienst — dort schreiben echte Vermieter."""
        for adresse in ("a@gmail.com", "b@gmx.de", "c@web.de", "d@outlook.com"):
            spamnetz.pruefen(
                email=adresse, nachricht="x" * 30, dauer_sekunden=20.0
            )

    def test_kein_teilstring_treffer(self) -> None:
        """„mailinator-consulting.de" ist eine echte Firma, kein Wegwerf-Dienst."""
        spamnetz.pruefen(
            email="info@mailinator-consulting.de",
            nachricht="x" * 30,
            dauer_sekunden=20.0,
        )

    def test_subdomain_ist_kein_treffer(self) -> None:
        """Nur die exakte Domain zählt (`rpartition` auf das @)."""
        spamnetz.pruefen(
            email="info@mail.hotel-tempmail.com",
            nachricht="x" * 30,
            dauer_sekunden=20.0,
        )


class TestLinkHaeufung:
    def test_werbetext_mit_vielen_links(self) -> None:
        text = (
            "Buy now at http://spam1.example.com and http://spam2.example.com "
            "and also www.spam3.com plus http://spam4.top"
        )
        with pytest.raises(spamnetz.SpamVerdacht) as exc:
            spamnetz.pruefen(
                email="a@gmail.com", nachricht=text, dauer_sekunden=20.0
            )
        assert "zu_viele_links" in exc.value.grund

    def test_zwei_links_sind_erlaubt(self) -> None:
        """Jemand nennt seine Website und ein Inserat — das ist normal."""
        text = (
            "Unsere Website ist https://hotel-seeblick.de, das Inserat steht "
            "auf https://booking.com/hotel-seeblick. Wir suchen ein PMS."
        )
        spamnetz.pruefen(email="a@gmail.com", nachricht=text, dauer_sekunden=30.0)

    def test_schemalose_domains_zaehlen_mit(self) -> None:
        """Ohne http:// geschrieben, um einfache Filter zu umgehen."""
        assert spamnetz.links_zaehlen("spam1.top spam2.xyz spam3.click") == 3

    def test_normaler_text_ohne_links(self) -> None:
        assert (
            spamnetz.links_zaehlen(
                "Guten Tag, wir betreiben ein Gästehaus mit 8 Zimmern."
            )
            == 0
        )

    def test_deutscher_text_mit_punkt_ist_kein_link(self) -> None:
        """Ein Satzende darf keine Domain sein — sonst trifft es jede Anfrage."""
        text = (
            "Guten Tag. Wir haben Fragen zur Abrechnung. Bitte um Rückruf. "
            "Vielen Dank."
        )
        assert spamnetz.links_zaehlen(text) == 0


class TestAntworttext:
    def test_grund_bleibt_intern(self) -> None:
        """Der Absender erfährt NICHT, welche Prüfung angesprochen hat."""
        exc = spamnetz.SpamVerdacht("zu_schnell (0.05s < 3.0s)")
        assert "zu_schnell" in exc.grund
        assert "zu_schnell" not in exc.antwort
        assert "0.05" not in exc.antwort
