"""Die Stufenlogik der § 23-Kaskade — reine Zeitrechnung, keine DB.

Warum das ohne DB testbar ist: `_naechste_stufe` bekommt den Vorgang als dict
und die Zeit als Parameter. Die Fristen sind gesetzlich fix, ihre Einhaltung
ist damit eine reine Rechenfrage — und die darf nicht von einem laufenden
Server abhängen.

Der Durchlauf gegen die echte DB steht in test_taxpayer_enforcement_db.py.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from src.features.taxpayer.enforcement import (
    ERINNERUNG_1_TAGE,
    ERINNERUNG_2_TAGE,
    FRIST_MINDESTENS_TAGE,
    FRIST_SPAETESTENS_TAGE,
    TaxpayerEnforcement,
)

T0 = datetime(2026, 1, 1, tzinfo=UTC)


def _vorgang(**felder: object) -> dict:
    basis: dict[str, object] = {
        "id": "v1",
        "country": "DE",
        "requested_at": T0.isoformat(),
        "reminder_1_at": None,
        "reminder_2_at": None,
        "enforced_at": None,
    }
    return {**basis, **felder}


def _stufe(vorgang: dict, tage: int) -> str | None:
    return TaxpayerEnforcement._naechste_stufe(  # noqa: SLF001
        vorgang, T0 + timedelta(days=tage)
    )


def test_fristen_entsprechen_dem_gesetz() -> None:
    """§ 23 Satz 2: „spätestens nach 180 Tagen, nicht aber vor Ablauf von 60"."""
    assert FRIST_MINDESTENS_TAGE == 60
    assert FRIST_SPAETESTENS_TAGE == 180


def test_erinnerungen_liegen_vor_der_frist() -> None:
    """Beide Erinnerungen MÜSSEN vor Tag 60 liegen — sonst wäre die Maßnahme
    fällig, bevor die zweite Erinnerung überhaupt raus ist."""
    assert ERINNERUNG_1_TAGE < ERINNERUNG_2_TAGE < FRIST_MINDESTENS_TAGE


@pytest.mark.parametrize("tage", [0, 5, ERINNERUNG_1_TAGE - 1])
def test_vor_der_ersten_erinnerung_passiert_nichts(tage: int) -> None:
    assert _stufe(_vorgang(), tage) is None


def test_erste_erinnerung_ab_tag_20() -> None:
    assert _stufe(_vorgang(), ERINNERUNG_1_TAGE) == "erinnerung_1"


def test_zweite_erinnerung_erst_nach_der_ersten() -> None:
    vorgang = _vorgang(reminder_1_at=T0.isoformat())
    assert _stufe(vorgang, ERINNERUNG_2_TAGE - 1) is None
    assert _stufe(vorgang, ERINNERUNG_2_TAGE) == "erinnerung_2"


def test_kein_einbehalt_vor_tag_60() -> None:
    """Die gesetzliche UNTERgrenze — ein Tag zu früh wäre rechtswidrig."""
    vorgang = _vorgang(
        reminder_1_at=T0.isoformat(), reminder_2_at=T0.isoformat()
    )
    assert _stufe(vorgang, FRIST_MINDESTENS_TAGE - 1) is None


def test_einbehalt_ab_tag_60() -> None:
    vorgang = _vorgang(
        reminder_1_at=T0.isoformat(), reminder_2_at=T0.isoformat()
    )
    assert _stufe(vorgang, FRIST_MINDESTENS_TAGE) == "einbehalt"


def test_ohne_zweite_erinnerung_kein_einbehalt() -> None:
    """§ 23 Satz 2 setzt beide Erinnerungen voraus — auch nach 300 Tagen."""
    vorgang = _vorgang(reminder_1_at=T0.isoformat())
    assert _stufe(vorgang, 300) == "erinnerung_2"


def test_nach_dem_einbehalt_ist_nichts_mehr_zu_tun() -> None:
    vorgang = _vorgang(
        reminder_1_at=T0.isoformat(),
        reminder_2_at=T0.isoformat(),
        enforced_at=T0.isoformat(),
    )
    assert _stufe(vorgang, 500) is None


def test_stufen_folgen_streng_aufeinander() -> None:
    """Ein Durchlauf über die ganze Frist: jede Stufe genau einmal."""
    vorgang = _vorgang()
    gesehen: list[str] = []
    for tag in range(0, FRIST_MINDESTENS_TAGE + 1):
        stufe = _stufe(vorgang, tag)
        if stufe is None:
            continue
        gesehen.append(stufe)
        vorgang[{"erinnerung_1": "reminder_1_at",
                 "erinnerung_2": "reminder_2_at",
                 "einbehalt": "enforced_at"}[stufe]] = (
            T0 + timedelta(days=tag)
        ).isoformat()
    assert gesehen == ["erinnerung_1", "erinnerung_2", "einbehalt"]
