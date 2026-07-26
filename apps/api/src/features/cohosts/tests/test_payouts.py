"""Tests der Beteiligungs-Berechnung.

Hier wird Geld verteilt — die Tests decken deshalb genau die Fälle ab, in
denen jemand zu viel oder zu wenig bekäme:

  1. Die Plattform-Gebühr bleibt unangetastet, egal was vereinbart wurde.
  2. Die Summe geht exakt auf (keine verlorenen Cent).
  3. Zu hohe Beteiligungen fallen auf, statt den Gastgeber ins Minus zu ziehen.
  4. Ein Fixbetrag in fremder Währung wird nicht geraten umgerechnet.
"""
import pytest

from src.features.cohosts.payouts import (
    BeteiligungFehler,
    berechne_aufteilung,
    pruefe_vereinbarung_gegen_gebuehr,
)

# 8 % Plattform-Gebühr, wie im Marktplatz-Modell.
PLATTFORM_BPS = 800


def _vereinbarung(**over: object) -> dict:
    basis = {
        "id": "c1",
        "user_id": "u1",
        "share_kind": "none",
        "share_bps": None,
        "share_fixed_cents": None,
        "share_currency": None,
    }
    return {**basis, **over}


def test_ohne_cohosts_bleibt_alles_beim_gastgeber() -> None:
    """1000 € Buchung, 8 % Plattform → 920 € Gastgeber."""
    a = berechne_aufteilung(
        brutto_cents=100_000,
        plattform_bps=PLATTFORM_BPS,
        vereinbarungen=[],
        currency="EUR",
    )
    assert a.plattform_cents == 8_000
    assert a.gastgeber_cents == 92_000
    assert a.cohosts == []


def test_unentgeltlicher_cohost_erzeugt_keine_zeile() -> None:
    """Der häufigste Fall: Familie hilft mit, ohne Beteiligung."""
    a = berechne_aufteilung(
        brutto_cents=100_000,
        plattform_bps=PLATTFORM_BPS,
        vereinbarungen=[_vereinbarung(share_kind="none")],
        currency="EUR",
    )
    assert a.cohosts == []
    assert a.gastgeber_cents == 92_000


def test_prozentuale_beteiligung_geht_zulasten_des_gastgebers() -> None:
    """10 % Co-Gastgeber: Die Plattform bekommt UNVERÄNDERT ihre 8 %.

    Das ist die Kernregel — die Beteiligung kommt obendrauf, nicht aus der
    Plattform-Gebühr.
    """
    a = berechne_aufteilung(
        brutto_cents=100_000,
        plattform_bps=PLATTFORM_BPS,
        vereinbarungen=[_vereinbarung(share_kind="percent", share_bps=1000)],
        currency="EUR",
    )
    assert a.plattform_cents == 8_000  # unverändert
    assert a.cohosts_gesamt_cents == 10_000
    assert a.gastgeber_cents == 82_000


def test_fixe_beteiligung() -> None:
    a = berechne_aufteilung(
        brutto_cents=100_000,
        plattform_bps=PLATTFORM_BPS,
        vereinbarungen=[
            _vereinbarung(
                share_kind="fixed", share_fixed_cents=5_000, share_currency="EUR"
            )
        ],
        currency="EUR",
    )
    assert a.plattform_cents == 8_000
    assert a.cohosts_gesamt_cents == 5_000
    assert a.gastgeber_cents == 87_000


def test_mehrere_cohosts_summieren_sich() -> None:
    a = berechne_aufteilung(
        brutto_cents=100_000,
        plattform_bps=PLATTFORM_BPS,
        vereinbarungen=[
            _vereinbarung(id="c1", user_id="u1", share_kind="percent", share_bps=500),
            _vereinbarung(
                id="c2", user_id="u2", share_kind="fixed",
                share_fixed_cents=2_000, share_currency="EUR",
            ),
        ],
        currency="EUR",
    )
    assert a.cohosts_gesamt_cents == 7_000
    assert a.gastgeber_cents == 85_000


def test_summe_geht_exakt_auf() -> None:
    """Kein Cent darf verloren gehen — auch bei krummen Beträgen nicht."""
    a = berechne_aufteilung(
        brutto_cents=33_333,
        plattform_bps=PLATTFORM_BPS,
        vereinbarungen=[_vereinbarung(share_kind="percent", share_bps=777)],
        currency="EUR",
    )
    assert (
        a.plattform_cents + a.cohosts_gesamt_cents + a.gastgeber_cents
        == a.brutto_cents
    )


def test_zu_hohe_beteiligung_faellt_auf() -> None:
    """95 % Beteiligung + 8 % Plattform > 100 % → Fehler statt Minus."""
    with pytest.raises(BeteiligungFehler) as exc:
        berechne_aufteilung(
            brutto_cents=100_000,
            plattform_bps=PLATTFORM_BPS,
            vereinbarungen=[_vereinbarung(share_kind="percent", share_bps=9500)],
            currency="EUR",
        )
    assert exc.value.status_code == 422


def test_fixbetrag_groesser_als_buchung_faellt_auf() -> None:
    """Ein 500-€-Fixanteil bei einer 100-€-Buchung darf nicht durchgehen."""
    with pytest.raises(BeteiligungFehler):
        berechne_aufteilung(
            brutto_cents=10_000,
            plattform_bps=PLATTFORM_BPS,
            vereinbarungen=[
                _vereinbarung(
                    share_kind="fixed", share_fixed_cents=50_000,
                    share_currency="EUR",
                )
            ],
            currency="EUR",
        )


def test_fixbetrag_in_fremder_waehrung_wird_nicht_umgerechnet() -> None:
    """Umrechnen wäre Raten (Wurzel 4) — klar fehlschlagen."""
    with pytest.raises(BeteiligungFehler) as exc:
        berechne_aufteilung(
            brutto_cents=100_000,
            plattform_bps=PLATTFORM_BPS,
            vereinbarungen=[
                _vereinbarung(
                    share_kind="fixed", share_fixed_cents=5_000,
                    share_currency="CHF",
                )
            ],
            currency="EUR",
        )
    assert exc.value.status_code == 422


def test_unstimmige_vereinbarung_faellt_auf() -> None:
    """'percent' ohne Satz zahlt nicht still 0 aus, sondern fällt auf."""
    with pytest.raises(BeteiligungFehler) as exc:
        berechne_aufteilung(
            brutto_cents=100_000,
            plattform_bps=PLATTFORM_BPS,
            vereinbarungen=[_vereinbarung(share_kind="percent", share_bps=None)],
            currency="EUR",
        )
    assert exc.value.status_code == 500


def test_fehlende_waehrung_faellt_auf() -> None:
    with pytest.raises(BeteiligungFehler):
        berechne_aufteilung(
            brutto_cents=100_000,
            plattform_bps=PLATTFORM_BPS,
            vereinbarungen=[],
            currency="",
        )


# --- Vorabprüfung beim Festlegen --------------------------------------------


def test_vorabpruefung_erlaubt_was_passt() -> None:
    """5 % neu + 10 % bestehend + 8 % Plattform = 23 % → passt."""
    pruefe_vereinbarung_gegen_gebuehr(
        share_kind="percent",
        share_bps=500,
        plattform_bps=PLATTFORM_BPS,
        bestehende_bps=1000,
    )


def test_vorabpruefung_faengt_zu_hohe_summe() -> None:
    """85 % bestehend + 10 % neu > 92 % verfügbar → Fehler im Dialog."""
    with pytest.raises(BeteiligungFehler) as exc:
        pruefe_vereinbarung_gegen_gebuehr(
            share_kind="percent",
            share_bps=1000,
            plattform_bps=PLATTFORM_BPS,
            bestehende_bps=8500,
        )
    assert exc.value.status_code == 422
    # Die Meldung nennt die konkrete Grenze — sonst rät der Nutzer.
    assert "92" in exc.value.message


def test_vorabpruefung_ignoriert_fixbetraege() -> None:
    """Ob ein Fixbetrag zu hoch ist, hängt vom Buchungsbetrag ab."""
    pruefe_vereinbarung_gegen_gebuehr(
        share_kind="fixed",
        share_bps=None,
        plattform_bps=PLATTFORM_BPS,
        bestehende_bps=9000,
    )
