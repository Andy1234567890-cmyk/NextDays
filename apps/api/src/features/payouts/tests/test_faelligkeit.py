"""Tests der Auszahlungs-Rechenlogik.

Schwerpunkt: Fälligkeit erst NACH der Abreise, Aufteilung geht immer auf, und
es wird nie ein negativer Betrag ausgezahlt.
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import pytest

from src.features.payouts.faelligkeit import (
    KARENZ_TAGE,
    KARENZ_TAGE_MAX,
    NACHTRAGEFRIST_TAGE,
    FaelligkeitFehler,
    basis_faelligkeit,
    berechne_aufteilung,
    faellig_ab,
    pruefe_karenz,
    verrechne,
)

# Mittwoch, 15. Juli 2026
MITTWOCH = datetime(2026, 7, 15, 10, 30, tzinfo=UTC)


# --- Basis-Fälligkeit -------------------------------------------------------


def test_tatsaechlicher_checkout_hat_vorrang() -> None:
    """Der echte Checkout ist der Beleg, dass der Aufenthalt vorbei ist."""
    assert basis_faelligkeit(
        checked_out_at=MITTWOCH, check_out=date(2026, 7, 20), karenz_tage=0
    ) == MITTWOCH


def test_rueckfall_auf_geplantes_datum() -> None:
    """Ohne Checkout: geplantes Datum + 1 Tag Nachtragefrist. Ohne diesen
    Rückfall bliebe Geld liegen, wenn ein Betrieb nie auscheckt."""
    basis = basis_faelligkeit(
        checked_out_at=None, check_out=date(2026, 7, 15), karenz_tage=0
    )
    assert basis == datetime(2026, 7, 16, tzinfo=UTC)


def test_ohne_jede_angabe_fehler() -> None:
    with pytest.raises(FaelligkeitFehler) as exc:
        basis_faelligkeit(checked_out_at=None, check_out=None, karenz_tage=0)
    assert exc.value.status_code == 422


# --- Karenz (0411) ----------------------------------------------------------
#
# Die Prüffrist ist der Grund, warum das Geld überhaupt bei uns liegen bleibt:
# in diesen Tagen kommen Schadensmeldung, Beschwerde und Chargeback. Ist es
# schon beim Betrieb, holt es niemand zurück — Rückforderungen werden nur mit
# der nächsten Auszahlung verrechnet, nie eingezogen.


def test_karenz_wirkt_auch_bei_eingetragenem_checkout() -> None:
    """DER wichtigste Karenz-Test.

    Läge die Frist nur auf dem Fallback-Pfad, hätte ein Betrieb sie in der Hand:
    Checkout eintragen → Geld ohne Prüffrist. Genau der Fall, für den die Frist
    gedacht ist (ein Schaden fällt erst am Tag nach der Abreise auf), wäre dann
    der ungeschützte.
    """
    basis = basis_faelligkeit(
        checked_out_at=MITTWOCH, check_out=None, karenz_tage=3
    )
    assert basis == datetime(2026, 7, 18, 10, 30, tzinfo=UTC)


def test_karenz_kommt_zur_nachtragefrist_hinzu() -> None:
    """Auf dem Fallback-Pfad addieren sich beide Fristen — sie sind NICHT
    dasselbe: die Nachtragefrist deckt einen fehlenden Checkout ab, die Karenz
    die Prüfung des Aufenthalts. Wer sie zusammenwirft, verkürzt eine von
    beiden."""
    basis = basis_faelligkeit(
        checked_out_at=None, check_out=date(2026, 7, 15), karenz_tage=3
    )
    assert basis == datetime(
        2026, 7, 15 + NACHTRAGEFRIST_TAGE + 3, tzinfo=UTC
    )


def test_karenz_null_ist_das_bisherige_verhalten() -> None:
    """Grenzwert 0: keine Frist heisst wirklich keine — kein Off-by-one, der
    stillschweigend einen Tag zugibt."""
    assert basis_faelligkeit(
        checked_out_at=MITTWOCH, check_out=None, karenz_tage=0
    ) == MITTWOCH


@pytest.mark.parametrize(
    ("intervall", "erwartet"),
    [
        # Abreise Mi 15.07. + 3 Tage Karenz = Sa 18.07.
        ("daily", datetime(2026, 7, 19, 10, 30, tzinfo=UTC)),
        # Nächster Donnerstag nach dem 19.07. (So) = 23.07.
        ("weekly", datetime(2026, 7, 23, tzinfo=UTC)),
        # 15. des Monats nach dem Karenzende (Juli) = 15.08.
        ("monthly", datetime(2026, 8, 15, tzinfo=UTC)),
    ],
)
def test_karenz_wirkt_in_jedem_rhythmus(intervall: str, erwartet: datetime) -> None:
    f = faellig_ab(
        checked_out_at=MITTWOCH,
        check_out=None,
        intervall=intervall,
        karenz_tage=3,
    )
    assert f == erwartet


def test_karenz_kann_den_monatsstichtag_verschieben() -> None:
    """Reist der Gast Ende Juli ab, schiebt die Karenz ihn in den August — und
    damit den monatlichen Stichtag auf den 15. SEPTEMBER.

    Das ist kein Fehler, sondern die Folge davon, dass die Karenz vor dem
    Rhythmus liegt (Basis, nicht Aufschlag). Der Test hält es ausdrücklich fest,
    damit es niemand später als Bug „repariert" und die Frist damit aushebelt.
    """
    ende_juli = datetime(2026, 7, 30, 11, 0, tzinfo=UTC)
    f = faellig_ab(
        checked_out_at=ende_juli,
        check_out=None,
        intervall="monthly",
        karenz_tage=3,
    )
    assert f == datetime(2026, 9, 15, tzinfo=UTC)


def test_faelligkeit_liegt_immer_nach_dem_karenzende() -> None:
    """Die Kernregel mit Frist: kein Rhythmus zahlt innerhalb der Karenz aus."""
    karenzende = MITTWOCH + timedelta(days=KARENZ_TAGE)
    for intervall in ("daily", "weekly", "monthly"):
        f = faellig_ab(
            checked_out_at=MITTWOCH,
            check_out=None,
            intervall=intervall,
            karenz_tage=KARENZ_TAGE,
        )
        assert f > karenzende, intervall


@pytest.mark.parametrize("wert", [-1, KARENZ_TAGE_MAX + 1, 300])
def test_karenz_ausserhalb_des_bereichs_faellt_durch(wert: int) -> None:
    """Fail-closed (Wurzel 5): ein negativer Wert zahlte mitten im Aufenthalt
    aus, ein zu grosser nie. Beides ist ein Datenfehler — nicht etwas, das
    stillschweigend auf den nächsten erlaubten Wert gebogen wird (Wurzel 4)."""
    with pytest.raises(FaelligkeitFehler) as exc:
        basis_faelligkeit(
            checked_out_at=MITTWOCH, check_out=None, karenz_tage=wert
        )
    assert exc.value.status_code == 422


@pytest.mark.parametrize("wert", [True, 3.5, "3", None])
def test_karenz_muss_eine_ganze_zahl_sein(wert: object) -> None:
    """`True` ist in Python ein int (und wäre eine Karenz von 1 Tag), `3.5`
    ergäbe eine halbe Karenz. Beides ist ein Programmierfehler → 500, kein
    zurechtgerundeter Wert."""
    with pytest.raises(FaelligkeitFehler) as exc:
        pruefe_karenz(wert)  # type: ignore[arg-type]
    assert exc.value.status_code == 500


def test_karenz_grenzwert_max_ist_erlaubt() -> None:
    """Die Grenze selbst gilt noch — kein Off-by-one am Rand."""
    assert pruefe_karenz(KARENZ_TAGE_MAX) == KARENZ_TAGE_MAX


# --- Rhythmus ---------------------------------------------------------------


def test_taeglich_ein_tag_nach_abreise() -> None:
    f = faellig_ab(
        checked_out_at=MITTWOCH, check_out=None, intervall="daily", karenz_tage=0
    )
    assert f == datetime(2026, 7, 16, 10, 30, tzinfo=UTC)


def test_woechentlich_naechster_donnerstag() -> None:
    """Abreise Mittwoch → Auszahlung am Donnerstag darauf."""
    f = faellig_ab(
        checked_out_at=MITTWOCH, check_out=None, intervall="weekly", karenz_tage=0
    )
    assert f.weekday() == 3
    assert f == datetime(2026, 7, 16, tzinfo=UTC)


def test_woechentlich_abreise_am_donnerstag_wartet_eine_woche() -> None:
    """Reist der Gast donnerstags ab, wird NICHT am selben Tag ausgezahlt —
    sonst flösse Geld, bevor der Tag vorbei ist."""
    donnerstag = datetime(2026, 7, 16, 9, 0, tzinfo=UTC)
    f = faellig_ab(
        checked_out_at=donnerstag, check_out=None, intervall="weekly", karenz_tage=0
    )
    assert f.weekday() == 3
    assert f == datetime(2026, 7, 23, tzinfo=UTC)


def test_monatlich_stichtag_folgemonat() -> None:
    f = faellig_ab(
        checked_out_at=MITTWOCH, check_out=None, intervall="monthly", karenz_tage=0
    )
    assert f == datetime(2026, 8, 15, tzinfo=UTC)


def test_monatlich_jahreswechsel() -> None:
    dezember = datetime(2026, 12, 28, tzinfo=UTC)
    f = faellig_ab(
        checked_out_at=dezember, check_out=None, intervall="monthly", karenz_tage=0
    )
    assert f == datetime(2027, 1, 15, tzinfo=UTC)


def test_unbekannter_rhythmus_faellt_durch() -> None:
    with pytest.raises(FaelligkeitFehler):
        faellig_ab(
        checked_out_at=MITTWOCH, check_out=None, intervall="hourly", karenz_tage=0
    )


def test_faelligkeit_liegt_immer_nach_der_abreise() -> None:
    """Die Kernregel des Modells — für jeden Rhythmus."""
    for intervall in ("daily", "weekly", "monthly"):
        f = faellig_ab(
            checked_out_at=MITTWOCH,
            check_out=None,
            intervall=intervall,
            karenz_tage=0,
        )
        assert f > MITTWOCH, intervall


# --- Aufteilung -------------------------------------------------------------


def test_aufteilung_geht_auf() -> None:
    """1000 €, 8 % Provision, 3 % Spende, 50 € Co-Gastgeber."""
    a = berechne_aufteilung(
        brutto_cents=100_000,
        plattform_cents=8_000,
        spende_cents=3_000,
        cohost_cents=5_000,
    )
    assert a.netto_cents == 84_000
    assert (
        a.netto_cents + a.plattform_cents + a.spende_cents + a.cohost_cents
        == a.brutto_cents
    )


def test_aufteilung_ohne_abzuege() -> None:
    a = berechne_aufteilung(
        brutto_cents=50_000, plattform_cents=0, spende_cents=0, cohost_cents=0
    )
    assert a.netto_cents == 50_000


def test_abzuege_ueber_brutto_schlagen_fehl() -> None:
    """Fail-closed statt negativer Auszahlung (Wurzel 5)."""
    with pytest.raises(FaelligkeitFehler) as exc:
        berechne_aufteilung(
            brutto_cents=10_000,
            plattform_cents=8_000,
            spende_cents=3_000,
            cohost_cents=0,
        )
    assert exc.value.status_code == 422


def test_negativer_bruttobetrag_faellt_durch() -> None:
    with pytest.raises(FaelligkeitFehler):
        berechne_aufteilung(
            brutto_cents=-1, plattform_cents=0, spende_cents=0, cohost_cents=0
        )


# --- Verrechnung (der Kern des Modells) -------------------------------------


def test_verrechnung_zieht_offene_posten_ab() -> None:
    auszahlbar, verrechnet = verrechne(
        netto_cents=90_000, offene_posten_cents=20_000
    )
    assert auszahlbar == 70_000
    assert verrechnet == 20_000


def test_verrechnung_zahlt_nie_negativ_aus() -> None:
    """Übersteigen die Posten die Auszahlung, wird alles einbehalten — der Rest
    bleibt für die nächste stehen. Airbnb macht es genauso."""
    auszahlbar, verrechnet = verrechne(
        netto_cents=30_000, offene_posten_cents=50_000
    )
    assert auszahlbar == 0
    assert verrechnet == 30_000


def test_verrechnung_ohne_posten() -> None:
    auszahlbar, verrechnet = verrechne(
        netto_cents=90_000, offene_posten_cents=0
    )
    assert auszahlbar == 90_000
    assert verrechnet == 0


def test_verrechnung_genau_aufgehend() -> None:
    auszahlbar, verrechnet = verrechne(
        netto_cents=50_000, offene_posten_cents=50_000
    )
    assert auszahlbar == 0
    assert verrechnet == 50_000


def test_verrechnung_negativ_faellt_durch() -> None:
    with pytest.raises(FaelligkeitFehler):
        verrechne(netto_cents=-1, offene_posten_cents=0)
