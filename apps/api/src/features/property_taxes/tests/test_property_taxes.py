"""Integrationstests der Objektsteuern — gegen die ECHTE DB.

Der Kern hier ist die Berechnung: Sie bestimmt, was der Gast zahlt. Ein Fehler
faellt niemandem sofort auf und wiederholt sich bei jeder Buchung.

Marker `integration` → nur mit ALLOW_INTEGRATION_TESTS=1 (tests/conftest.py).
"""
from __future__ import annotations

import contextlib
from collections.abc import Iterator

import pytest

from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.property_taxes.schemas import (
    ChargeMode,
    PropertyTaxInput,
    PropertyTaxResponse,
    TaxableBase,
)
from src.features.property_taxes.service import (
    PropertyTaxError,
    PropertyTaxService,
)

pytestmark = pytest.mark.integration


@pytest.fixture
def service() -> PropertyTaxService:
    return PropertyTaxService(db=get_service_client())


@pytest.fixture
def ctx_und_objekt() -> Iterator[tuple[AuthContext, str]]:
    """Echter Betrieb mit echtem Objekt; angelegte Steuern werden entfernt."""
    db = get_service_client()
    rows = (
        db.table("properties").select("id, tenant_id").limit(1).execute()
    ).data
    if not rows:
        pytest.skip("Kein Objekt in der DB.")
    tenant_id, property_id = rows[0]["tenant_id"], rows[0]["id"]
    try:
        yield (
            AuthContext(user_id="test", tenant_id=tenant_id, role="admin"),
            property_id,
        )
    finally:
        with contextlib.suppress(Exception):  # noqa: BLE001 — Teardown
            db.table("property_taxes").delete().eq(
                "property_id", property_id
            ).execute()


def _prozent(**felder: object) -> PropertyTaxInput:
    basis: dict[str, object] = {
        "tax_type": "Kurtaxe",
        "charge_mode": ChargeMode.PERCENTAGE_PER_BOOKING,
        "rate_bps": 500,
        "taxable_base": [TaxableBase.BASE_PRICE],
        "registration_number": "DE-TEST-1",
    }
    return PropertyTaxInput(**{**basis, **felder})


def _fest(**felder: object) -> PropertyTaxInput:
    basis: dict[str, object] = {
        "tax_type": "Tourismusabgabe",
        "charge_mode": ChargeMode.PER_GUEST_PER_NIGHT,
        "amount_minor": 300,
        "registration_number": "DE-TEST-2",
    }
    return PropertyTaxInput(**{**basis, **felder})


def test_prozent_und_festbetrag_nebeneinander(
    service: PropertyTaxService, ctx_und_objekt: tuple[AuthContext, str]
) -> None:
    """Ein Objekt kann mehrere Steuern haben — Kurtaxe UND Tourismusabgabe."""
    ctx, prop = ctx_und_objekt
    service.create(ctx, prop, _prozent())
    service.create(ctx, prop, _fest())
    arten = {s.tax_type for s in service.list(ctx, prop)}
    assert arten == {"Kurtaxe", "Tourismusabgabe"}


def test_prozentsatz_mit_betrag_wird_abgewiesen() -> None:
    """5 % UND 3 EUR gleichzeitig waere nicht entscheidbar."""
    with pytest.raises(ValueError, match="Prozentsatz"):
        _prozent(amount_minor=300)


def test_festbetrag_ohne_bemessungsgrundlage() -> None:
    """Eine Bemessungsgrundlage ohne Prozentsatz taeuscht Genauigkeit vor."""
    with pytest.raises(ValueError, match="Bemessungsgrundlage"):
        _fest(taxable_base=[TaxableBase.BASE_PRICE])


def test_prozent_ohne_grundlage_wird_abgewiesen() -> None:
    """Ohne Grundlage waere unklar, worauf der Satz rechnet."""
    with pytest.raises(ValueError, match="Bemessungsgrundlage"):
        _prozent(taxable_base=[])


def test_fremdes_objekt_bleibt_verschlossen(
    service: PropertyTaxService, ctx_und_objekt: tuple[AuthContext, str]
) -> None:
    """Wurzel 3: mit fremder property_id darf nichts entstehen."""
    _, prop = ctx_und_objekt
    fremd = AuthContext(
        user_id="x",
        tenant_id="00000000-0000-0000-0000-000000000000",
        role="admin",
    )
    with pytest.raises(PropertyTaxError) as exc:
        service.create(fremd, prop, _prozent())
    assert exc.value.status_code == 404


def test_fremde_steuer_laesst_sich_nicht_aendern(
    service: PropertyTaxService, ctx_und_objekt: tuple[AuthContext, str]
) -> None:
    """Wurzel 9: der {id}-Pfad prueft denselben Scope wie die Liste."""
    ctx, prop = ctx_und_objekt
    eigen = service.create(ctx, prop, _prozent())
    fremd = AuthContext(
        user_id="x",
        tenant_id="00000000-0000-0000-0000-000000000000",
        role="admin",
    )
    with pytest.raises(PropertyTaxError) as exc:
        service.update(fremd, eigen.id, _prozent(rate_bps=9000))
    assert exc.value.status_code == 404


# --- Berechnung ------------------------------------------------------------
# Ohne DB: reine Rechenlogik, aber der geldwirksamste Teil des Slice.


def _antwort(**felder: object) -> PropertyTaxResponse:
    basis: dict[str, object] = {
        "id": "1",
        "property_id": "p",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
        "tax_type": "Kurtaxe",
        "charge_mode": ChargeMode.PER_NIGHT,
        "amount_minor": 300,
        "registration_number": "X",
    }
    return PropertyTaxResponse(**{**basis, **felder})


def test_prozent_rechnet_auf_die_gewaehlte_grundlage() -> None:
    """5 % auf Grundpreis + Reinigung, nicht auf alles."""
    steuer = _antwort(
        charge_mode=ChargeMode.PERCENTAGE_PER_BOOKING,
        rate_bps=500,
        amount_minor=None,
        taxable_base=[TaxableBase.BASE_PRICE, TaxableBase.CLEANING_FEE],
    )
    ergebnis = PropertyTaxService.berechne(
        [steuer],
        naechte=3,
        gaeste=2,
        basis_minor={
            "base_price": 30000,
            "cleaning_fee": 5000,
            "resort_fee": 9999,  # nicht gewaehlt → darf nicht zaehlen
        },
    )
    assert ergebnis == [("Kurtaxe", 1750)]


def test_pro_gast_pro_nacht() -> None:
    steuer = _antwort(charge_mode=ChargeMode.PER_GUEST_PER_NIGHT)
    assert PropertyTaxService.berechne(
        [steuer], naechte=4, gaeste=2, basis_minor={}
    ) == [("Kurtaxe", 2400)]


def test_langzeitbefreiung_streicht_die_steuer_ganz() -> None:
    """Greift die Befreiung, faellt die Steuer KOMPLETT weg."""
    steuer = _antwort(long_stay_exempt_nights=28)
    assert (
        PropertyTaxService.berechne(
            [steuer], naechte=30, gaeste=1, basis_minor={}
        )
        == []
    )


def test_nur_die_ersten_naechte_zaehlen() -> None:
    """Bei 10 Naechten und Grenze 7 werden 7 berechnet, nicht 10."""
    steuer = _antwort(taxable_first_nights=7)
    assert PropertyTaxService.berechne(
        [steuer], naechte=10, gaeste=1, basis_minor={}
    ) == [("Kurtaxe", 2100)]


def test_obergrenze_deckelt() -> None:
    steuer = _antwort(max_amount_minor=1000)
    assert PropertyTaxService.berechne(
        [steuer], naechte=10, gaeste=1, basis_minor={}
    ) == [("Kurtaxe", 1000)]


def test_inaktive_steuer_wird_uebersprungen() -> None:
    steuer = _antwort(active=False)
    assert (
        PropertyTaxService.berechne(
            [steuer], naechte=3, gaeste=1, basis_minor={}
        )
        == []
    )


def test_jede_steuer_einzeln_ausgewiesen() -> None:
    """Keine Summe: der Gast soll sehen, was er wofuer zahlt."""
    ergebnis = PropertyTaxService.berechne(
        [
            _antwort(tax_type="Kurtaxe"),
            _antwort(tax_type="Tourismusabgabe", amount_minor=150),
        ],
        naechte=2,
        gaeste=1,
        basis_minor={},
    )
    assert ergebnis == [("Kurtaxe", 600), ("Tourismusabgabe", 300)]
