"""Tests der Auszahlungs-Rechenlogik.

Schwerpunkt: Fälligkeit erst NACH der Abreise, Aufteilung geht immer auf, und
es wird nie ein negativer Betrag ausgezahlt.
"""
from __future__ import annotations

from datetime import UTC, date, datetime

import pytest

from src.features.payouts.faelligkeit import (
    FaelligkeitFehler,
    basis_faelligkeit,
    berechne_aufteilung,
    faellig_ab,
    verrechne,
)

# Mittwoch, 15. Juli 2026
MITTWOCH = datetime(2026, 7, 15, 10, 30, tzinfo=UTC)


# --- Basis-Fälligkeit -------------------------------------------------------


def test_tatsaechlicher_checkout_hat_vorrang() -> None:
    """Der echte Checkout ist der Beleg, dass der Aufenthalt vorbei ist."""
    assert basis_faelligkeit(
        checked_out_at=MITTWOCH, check_out=date(2026, 7, 20)
    ) == MITTWOCH


def test_rueckfall_auf_geplantes_datum() -> None:
    """Ohne Checkout: geplantes Datum + 1 Tag Nachtragefrist. Ohne diesen
    Rückfall bliebe Geld liegen, wenn ein Betrieb nie auscheckt."""
    basis = basis_faelligkeit(checked_out_at=None, check_out=date(2026, 7, 15))
    assert basis == datetime(2026, 7, 16, tzinfo=UTC)


def test_ohne_jede_angabe_fehler() -> None:
    with pytest.raises(FaelligkeitFehler) as exc:
        basis_faelligkeit(checked_out_at=None, check_out=None)
    assert exc.value.status_code == 422


# --- Rhythmus ---------------------------------------------------------------


def test_taeglich_ein_tag_nach_abreise() -> None:
    f = faellig_ab(checked_out_at=MITTWOCH, check_out=None, intervall="daily")
    assert f == datetime(2026, 7, 16, 10, 30, tzinfo=UTC)


def test_woechentlich_naechster_donnerstag() -> None:
    """Abreise Mittwoch → Auszahlung am Donnerstag darauf."""
    f = faellig_ab(checked_out_at=MITTWOCH, check_out=None, intervall="weekly")
    assert f.weekday() == 3
    assert f == datetime(2026, 7, 16, tzinfo=UTC)


def test_woechentlich_abreise_am_donnerstag_wartet_eine_woche() -> None:
    """Reist der Gast donnerstags ab, wird NICHT am selben Tag ausgezahlt —
    sonst flösse Geld, bevor der Tag vorbei ist."""
    donnerstag = datetime(2026, 7, 16, 9, 0, tzinfo=UTC)
    f = faellig_ab(checked_out_at=donnerstag, check_out=None, intervall="weekly")
    assert f.weekday() == 3
    assert f == datetime(2026, 7, 23, tzinfo=UTC)


def test_monatlich_stichtag_folgemonat() -> None:
    f = faellig_ab(checked_out_at=MITTWOCH, check_out=None, intervall="monthly")
    assert f == datetime(2026, 8, 15, tzinfo=UTC)


def test_monatlich_jahreswechsel() -> None:
    dezember = datetime(2026, 12, 28, tzinfo=UTC)
    f = faellig_ab(checked_out_at=dezember, check_out=None, intervall="monthly")
    assert f == datetime(2027, 1, 15, tzinfo=UTC)


def test_unbekannter_rhythmus_faellt_durch() -> None:
    with pytest.raises(FaelligkeitFehler):
        faellig_ab(checked_out_at=MITTWOCH, check_out=None, intervall="hourly")


def test_faelligkeit_liegt_immer_nach_der_abreise() -> None:
    """Die Kernregel des Modells — für jeden Rhythmus."""
    for intervall in ("daily", "weekly", "monthly"):
        f = faellig_ab(
            checked_out_at=MITTWOCH, check_out=None, intervall=intervall
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
