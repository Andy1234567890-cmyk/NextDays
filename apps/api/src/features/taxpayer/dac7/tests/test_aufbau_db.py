"""Der Meldungsaufbau gegen die ECHTE Datenbank.

WARUM KEIN DOUBLE: Dieser Code liest `properties`, `owner_properties`,
`owners`, `reservations`, `payments` und `taxpayer_info` und rechnet über
Datums-, Status- und Geldspalten. Ein Fake müsste das Schema nachbauen — und
hätte beim Bau genau die Fehler verdeckt, die hier wirklich passiert sind:

  * `owners` hat KEIN `first_name`/`last_name`, sondern EIN `name`
  * die Firmenspalte heißt `company`, nicht `company_name`
  * dänische Konten stehen in `bank_reg_nr`/`bank_konto_nr`, nicht in `iban`
  * es gibt `cpr_number` — die dänische Steuer-ID einer Privatperson

Für Python ist ein falscher Spaltenname eine Zeichenkette, für ruff und
pylint unsichtbar und für eine Fake-DB harmlos: Sie nimmt jede erfundene
Spalte an. Sichtbar wird der Fehler erst beim echten Aufruf.

Diese Tests SCHREIBEN NICHT. Sie lesen den Bestand und prüfen, dass der
Aufbau ihn korrekt deutet.
"""
from __future__ import annotations

from collections.abc import Iterator

import pytest

from src.core.supabase import get_service_client
from src.features.taxpayer.dac7.aufbau import (
    MeldungsAufbau,
    _kontokennung,
    _namen_trennen,
)
from src.features.taxpayer.dac7.kanaele import Meldungsart

pytestmark = pytest.mark.integration

# Ein Jahr mit echtem Buchungsbestand.
JAHR = 2025


@pytest.fixture
def betrieb_mit_buchungen() -> Iterator[str]:
    """Ein Betrieb, der im Meldejahr Buchungen und Objekte hat."""
    db = get_service_client()
    zeilen = (
        db.table("reservations")
        .select("tenant_id")
        .gte("check_in", f"{JAHR}-01-01")
        .lt("check_in", f"{JAHR + 1}-01-01")
        .limit(500)
        .execute()
    ).data or []
    for tenant_id in {z["tenant_id"] for z in zeilen}:
        objekte = (
            db.table("properties")
            .select("id", count="exact")
            .eq("tenant_id", tenant_id)
            .execute()
        ).count or 0
        if objekte:
            yield tenant_id
            return
    pytest.skip("kein Betrieb mit Buchungen und Objekten im Meldejahr")


class TestSpaltennamen:
    """Belegt, dass jede gelesene Spalte wirklich existiert.

    Ein falscher Name wirft hier 42703 — genau der Fehler, den nur ein
    echter Aufruf zeigt.
    """

    def test_objekte_lesen(self, betrieb_mit_buchungen: str) -> None:
        aufbau = MeldungsAufbau(get_service_client())
        objekte = aufbau._objekte(betrieb_mit_buchungen)  # noqa: SLF001
        assert isinstance(objekte, list)

    def test_buchungen_lesen(self, betrieb_mit_buchungen: str) -> None:
        aufbau = MeldungsAufbau(get_service_client())
        buchungen = aufbau._buchungen(betrieb_mit_buchungen, JAHR)  # noqa: SLF001
        assert isinstance(buchungen, list)
        if buchungen:
            # Die Geldspalten, aus denen die Meldung rechnet.
            for feld in ("total_amount", "currency", "channel", "booked_at"):
                assert feld in buchungen[0]

    def test_verkaeufer_stammdaten_lesen(
        self, betrieb_mit_buchungen: str
    ) -> None:
        db = get_service_client()
        aufbau = MeldungsAufbau(db)
        objekte = aufbau._objekte(betrieb_mit_buchungen)  # noqa: SLF001
        if not objekte:
            pytest.skip("Betrieb ohne Objekte")
        from src.features.taxpayer.dac7.modell import Pruefbericht

        zuordnung = aufbau._verkaeufer_je_objekt(  # noqa: SLF001
            [o["id"] for o in objekte], Pruefbericht()
        )
        stammdaten = aufbau._verkaeufer_stammdaten(  # noqa: SLF001
            sorted(set(zuordnung.values()))
        )
        for person in stammdaten.values():
            # Genau die Spalten, die der Aufbau verwendet.
            for feld in ("name", "company", "tax_id", "cpr_number", "country"):
                assert feld in person


class TestAufbauEndeZuEnde:
    def test_meldung_bauen_wirft_nicht(self, betrieb_mit_buchungen: str) -> None:
        """Der vollständige Lauf gegen echte Daten.

        Ob eine Meldung entsteht, hängt vom Datenbestand ab — der Test
        prüft, dass der Aufbau sauber durchläuft und im Zweifel einen
        begründeten Bericht liefert statt zu werfen.
        """
        aufbau = MeldungsAufbau(get_service_client())
        meldung, bericht = aufbau.bauen(
            tenant_id=betrieb_mit_buchungen,
            jahr=JAHR,
            art=Meldungsart.BETRIEB,
            referenz="TEST",
        )
        # Entweder es entstand eine Meldung, oder der Bericht sagt warum
        # nicht — ein stilles Nichts darf es nicht geben.
        assert meldung is not None or bericht.fehler

    def test_jeder_befund_nennt_seinen_fundort(
        self, betrieb_mit_buchungen: str
    ) -> None:
        aufbau = MeldungsAufbau(get_service_client())
        _, bericht = aufbau.bauen(
            tenant_id=betrieb_mit_buchungen,
            jahr=JAHR,
            art=Meldungsart.BETRIEB,
            referenz="TEST",
        )
        for befund in [*bericht.fehler, *bericht.hinweise]:
            assert befund.betrifft
            assert befund.feld
            assert befund.grund

    def test_reproduzierbar(self, betrieb_mit_buchungen: str) -> None:
        """Zwei Läufe über dieselben Daten ergeben dieselbe Meldung."""
        aufbau = MeldungsAufbau(get_service_client())
        erste, _ = aufbau.bauen(
            tenant_id=betrieb_mit_buchungen,
            jahr=JAHR,
            art=Meldungsart.BETRIEB,
            referenz="TEST",
        )
        zweite, _ = aufbau.bauen(
            tenant_id=betrieb_mit_buchungen,
            jahr=JAHR,
            art=Meldungsart.BETRIEB,
            referenz="TEST",
        )
        if erste is None or zweite is None:
            pytest.skip("keine vollständige Meldung im Bestand")
        from src.features.taxpayer.dac7.csv_dk import schreiben

        assert schreiben(erste) == schreiben(zweite)

    def test_fremde_betriebe_bleiben_draussen(
        self, betrieb_mit_buchungen: str
    ) -> None:
        """Der Scope ist die wichtigste Eigenschaft dieser Meldung.

        Eine Steuermeldung mit Daten eines fremden Betriebs wäre der
        schlimmste denkbare Fall.
        """
        db = get_service_client()
        aufbau = MeldungsAufbau(db)
        objekte = aufbau._objekte(betrieb_mit_buchungen)  # noqa: SLF001
        eigene = {o["id"] for o in objekte}

        alle = (
            db.table("properties")
            .select("id, tenant_id")
            .neq("tenant_id", betrieb_mit_buchungen)
            .limit(50)
            .execute()
        ).data or []
        fremde = {o["id"] for o in alle}
        assert not (eigene & fremde)


class TestNamenTrennen:
    """Die Heuristik, die aus einem Namensfeld zwei macht."""

    def test_zwei_teile(self) -> None:
        assert _namen_trennen("Anna Jensen") == ("Anna", "Jensen")

    def test_mehrteiliger_vorname(self) -> None:
        assert _namen_trennen("Anna Maria Jensen") == ("Anna Maria", "Jensen")

    def test_einzelner_name_ist_der_nachname(self) -> None:
        """Einen Vornamen zu erfinden wäre schlimmer als das leere Feld."""
        assert _namen_trennen("Jensen") == (None, "Jensen")

    def test_leer_bleibt_leer(self) -> None:
        assert _namen_trennen(None) == (None, None)
        assert _namen_trennen("   ") == (None, None)


class TestKontokennung:
    def test_daenisches_konto_wird_zusammengesetzt(self) -> None:
        konto = _kontokennung(
            {"bank_reg_nr": "5470", "bank_konto_nr": "0003768159"}
        )
        assert konto is not None
        assert konto.kennung == "5470-0003768159"
        assert konto.art == "Reg.nr. og kontonr."

    def test_iban_als_rueckfall(self) -> None:
        konto = _kontokennung({"iban": "DK5000400440116243"})
        assert konto is not None
        assert konto.art == "IBAN"

    def test_ohne_konto_kein_eintrag(self) -> None:
        assert _kontokennung({}) is None
