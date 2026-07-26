"""Tests der Spenden-Rechenlogik.

Schwerpunkt: die Spende darf NIE die Plattform-Gebühr schmälern, nie mehr
ergeben als vereinbart, und bei Unstimmigkeiten klar fehlschlagen statt still
0 zu liefern.
"""
from __future__ import annotations

import pytest

from src.features.donations.berechnung import (
    MAX_SHARE_BPS,
    SpendeFehler,
    berechne_spende,
    pruefe_satz_gegen_verpflichtungen,
)

RECIPIENT = "11111111-1111-1111-1111-111111111111"


def _einstellung(bps: int, recipient: str | None = RECIPIENT) -> dict:
    return {"share_bps": bps, "recipient_id": recipient}


# --- berechne_spende --------------------------------------------------------


def test_ohne_einstellung_keine_spende() -> None:
    assert berechne_spende(brutto_cents=100_000, einstellung=None) is None


def test_satz_null_ergibt_keine_zeile() -> None:
    """0 % ist der Normalfall — er darf keine Nullzeile im Ledger erzeugen."""
    assert berechne_spende(brutto_cents=100_000, einstellung=_einstellung(0)) is None


def test_drei_prozent_von_1000_euro() -> None:
    """Airbnb-Beispiel: 3 % von 250 € sind 7,50 €."""
    spende = berechne_spende(brutto_cents=25_000, einstellung=_einstellung(300))
    assert spende is not None
    assert spende.betrag_cents == 750
    assert spende.share_bps == 300
    assert spende.recipient_id == RECIPIENT


def test_ganzzahl_arithmetik_schneidet_ab() -> None:
    """Abschneiden statt Runden — zugunsten des Gastgebers, der die Spende
    trägt. 1 % von 999 Cent wären 9,99 Cent → 9."""
    spende = berechne_spende(brutto_cents=999, einstellung=_einstellung(100))
    assert spende is not None
    assert spende.betrag_cents == 9


def test_zu_kleiner_betrag_ergibt_keine_zeile() -> None:
    """Unter einem Cent keine Zeile, statt 0 zu buchen."""
    assert berechne_spende(brutto_cents=50, einstellung=_einstellung(100)) is None


def test_satz_ohne_empfaenger_schlaegt_fehl() -> None:
    """Ein Satz ohne Ziel darf nicht still verfallen — das Geld hätte keinen
    Empfänger (Wurzel 4/5)."""
    with pytest.raises(SpendeFehler) as exc:
        berechne_spende(brutto_cents=100_000, einstellung=_einstellung(300, None))
    assert exc.value.status_code == 500


def test_satz_ueber_obergrenze_schlaegt_fehl() -> None:
    with pytest.raises(SpendeFehler):
        berechne_spende(
            brutto_cents=100_000, einstellung=_einstellung(MAX_SHARE_BPS + 1)
        )


def test_negativer_betrag_schlaegt_fehl() -> None:
    with pytest.raises(SpendeFehler) as exc:
        berechne_spende(brutto_cents=-1, einstellung=_einstellung(300))
    assert exc.value.status_code == 422


def test_plattform_gebuehr_bleibt_unberuehrt() -> None:
    """Der Kern der Regel: Bei 1000 € mit 8 % Gebühr und 3 % Spende bekommt
    die Plattform ihre vollen 80 €, die Spende geht vom Gastgeber ab."""
    brutto = 100_000
    plattform_bps = 800
    spende = berechne_spende(brutto_cents=brutto, einstellung=_einstellung(300))
    assert spende is not None

    plattform_cents = brutto * plattform_bps // 10000
    assert plattform_cents == 8_000          # 80 € unverändert
    assert spende.betrag_cents == 3_000      # 30 € Spende
    gastgeber = brutto - plattform_cents - spende.betrag_cents
    assert gastgeber == 89_000               # 890 €
    # Nichts geht verloren.
    assert plattform_cents + spende.betrag_cents + gastgeber == brutto


# --- pruefe_satz_gegen_verpflichtungen --------------------------------------


def test_pruefung_laesst_normalen_satz_durch() -> None:
    pruefe_satz_gegen_verpflichtungen(
        share_bps=300, plattform_bps=800, cohost_bps=0
    )


def test_pruefung_null_immer_erlaubt() -> None:
    """Abschalten muss auch dann gehen, wenn kein Spielraum mehr besteht."""
    pruefe_satz_gegen_verpflichtungen(
        share_bps=0, plattform_bps=800, cohost_bps=9_200
    )


def test_pruefung_faengt_uebersteigenden_satz() -> None:
    """8 % Gebühr + 90 % Co-Gastgeber lassen nur 2 % — 5 % müssen scheitern."""
    with pytest.raises(SpendeFehler) as exc:
        pruefe_satz_gegen_verpflichtungen(
            share_bps=500, plattform_bps=800, cohost_bps=9_000
        )
    assert exc.value.status_code == 422
    # Die Meldung nennt die konkrete Grenze, statt nur „zu hoch".
    assert "2,00 %" in exc.value.message or "2.00" in exc.value.message


def test_pruefung_ohne_spielraum() -> None:
    with pytest.raises(SpendeFehler) as exc:
        pruefe_satz_gegen_verpflichtungen(
            share_bps=100, plattform_bps=800, cohost_bps=9_200
        )
    assert "kein Anteil" in exc.value.message


def test_pruefung_negativer_satz() -> None:
    with pytest.raises(SpendeFehler):
        pruefe_satz_gegen_verpflichtungen(
            share_bps=-1, plattform_bps=800, cohost_bps=0
        )


def test_pruefung_exakt_an_der_grenze_erlaubt() -> None:
    """Genau die Grenze ist zulässig — nur darüber wird abgelehnt."""
    pruefe_satz_gegen_verpflichtungen(
        share_bps=1_200, plattform_bps=800, cohost_bps=8_000
    )
