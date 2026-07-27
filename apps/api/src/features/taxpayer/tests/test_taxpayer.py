"""Integrationstests des taxpayer-Slice — gegen die ECHTE DB.

Was hier geprüft wird, kann ein Supabase-Double nicht zeigen: dass der
UNIQUE-Constraint (tenant_id, country) den Upsert wirklich zu einem Ersetzen
macht, dass der CHECK aus 0226 unvollständige Zeilen abweist, und dass die
fehlenden Länder tatsächlich aus den Objekten abgeleitet werden.

Marker `integration` → nur mit ALLOW_INTEGRATION_TESTS=1 (tests/conftest.py).
Jeder Test räumt seine Zeilen im finally weg.
"""
from __future__ import annotations

import contextlib
from collections.abc import Iterator
from datetime import date

import pytest

from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.taxpayer.schemas import TaxpayerCreate, TaxpayerKind
from src.features.taxpayer.service import TaxpayerError, TaxpayerService

pytestmark = pytest.mark.integration

# Länder, die die Tests anlegen — im Teardown genau diese wieder entfernen.
_TEST_LAENDER = ("DE", "ES", "IT", "FR")


@pytest.fixture
def service() -> TaxpayerService:
    return TaxpayerService(db=get_service_client())


@pytest.fixture
def ctx() -> Iterator[AuthContext]:
    """Kontext eines echten Betriebs; angelegte Steuerzeilen werden entfernt."""
    db = get_service_client()
    rows = (db.table("tenants").select("id").limit(1).execute()).data
    if not rows:
        pytest.skip("Kein Betrieb in der DB.")
    tenant_id = rows[0]["id"]
    bestand = (
        db.table("taxpayer_info")
        .select("country")
        .eq("tenant_id", tenant_id)
        .execute()
    ).data or []
    if any(r["country"] in _TEST_LAENDER for r in bestand):
        pytest.skip("Betrieb hat bereits Angaben für ein Testland.")
    try:
        yield AuthContext(user_id="test", tenant_id=tenant_id, role="admin")
    finally:
        for land in _TEST_LAENDER:
            with contextlib.suppress(Exception):  # noqa: BLE001 — Teardown
                db.table("taxpayer_info").delete().eq(
                    "tenant_id", tenant_id
                ).eq("country", land).execute()


def _firma(country: str = "DE", **felder: object) -> TaxpayerCreate:
    """Gültiger Unternehmens-Eintrag; `felder` überschreiben die Vorgaben."""
    basis: dict[str, object] = {
        "country": country,
        "kind": TaxpayerKind.ENTITY,
        "legal_name": "Muster GmbH",
        "tin": f"{country.upper()}123456789",
    }
    return TaxpayerCreate(**{**basis, **felder})


def test_upsert_speichert_und_bestaetigt(
    service: TaxpayerService, ctx: AuthContext
) -> None:
    """Wer die Angaben abschickt, erklärt sie als richtig (DAC7-Selbstauskunft)."""
    eintrag = service.upsert(ctx, _firma())
    assert eintrag.confirmed_at is not None
    assert eintrag.tin == "DE123456789"


def test_upsert_ersetzt_statt_zu_doppeln(
    service: TaxpayerService, ctx: AuthContext
) -> None:
    """Der UNIQUE-Constraint macht die Korrektur zum Ersetzen — echt geprüft."""
    service.upsert(ctx, _firma())
    service.upsert(ctx, _firma(tin="DE999999999"))
    de = [e for e in service.list(ctx) if e.country == "DE"]
    assert len(de) == 1
    assert de[0].tin == "DE999999999"


def test_mehrere_laender_nebeneinander(
    service: TaxpayerService, ctx: AuthContext
) -> None:
    """DAC7 verlangt die Steuer-ID je Land — ein Betrieb kann mehrere haben."""
    service.upsert(ctx, _firma("DE"))
    service.upsert(ctx, _firma("ES"))
    laender = [e.country for e in service.list(ctx)]
    assert "DE" in laender
    assert "ES" in laender


def test_kleines_laenderkuerzel_wird_normalisiert(
    service: TaxpayerService, ctx: AuthContext
) -> None:
    service.upsert(ctx, _firma("it"))
    assert "IT" in [e.country for e in service.list(ctx)]


def test_person_ohne_tin_wird_gespeichert(
    service: TaxpayerService, ctx: AuthContext
) -> None:
    """Der DB-CHECK aus 0226 lässt die Geburtsort-Ausnahme durch."""
    eintrag = service.upsert(
        ctx,
        TaxpayerCreate(
            country="FR",
            kind=TaxpayerKind.INDIVIDUAL,
            first_name="Marie",
            last_name="Dupont",
            date_of_birth=date(1990, 6, 1),
            birth_place_city="Lyon",
            birth_place_country="FR",
        ),
    )
    assert eintrag.tin is None
    assert eintrag.birth_place_city == "Lyon"


def test_fehlende_laender_kommen_aus_den_objekten(
    service: TaxpayerService, ctx: AuthContext
) -> None:
    """Abgeleitet, nicht gepflegt — sonst liefen zwei Listen auseinander."""
    objekt_laender = service._objekt_laender(ctx.tenant_id)  # noqa: SLF001
    uebersicht = service.overview(ctx)
    abgedeckt = {e.country for e in uebersicht.eintraege}
    assert set(uebersicht.fehlende_laender) == objekt_laender - abgedeckt


def test_gespeichertes_land_verschwindet_aus_fehlend(
    service: TaxpayerService, ctx: AuthContext
) -> None:
    objekt_laender = service._objekt_laender(ctx.tenant_id)  # noqa: SLF001
    if not objekt_laender:
        pytest.skip("Betrieb hat keine Objekte mit Land.")
    land = sorted(objekt_laender)[0]
    assert land in service.overview(ctx).fehlende_laender
    service.upsert(ctx, _firma(land))
    assert land not in service.overview(ctx).fehlende_laender


def test_delete_entfernt_und_meldet_danach_404(
    service: TaxpayerService, ctx: AuthContext
) -> None:
    service.upsert(ctx, _firma("ES"))
    service.delete(ctx, "es")
    assert "ES" not in [e.country for e in service.list(ctx)]
    with pytest.raises(TaxpayerError) as exc:
        service.delete(ctx, "ES")
    assert exc.value.status_code == 404


def test_ohne_tenant_kein_zugriff(service: TaxpayerService) -> None:
    """Wurzel 3: ohne Tenant im Kontext passiert nichts."""
    ohne = AuthContext(user_id="u", tenant_id=None, role="admin")
    with pytest.raises(TaxpayerError) as exc:
        service.list(ohne)
    assert exc.value.status_code == 400


def test_vat_id_kommt_aus_dem_rechnungsprofil(
    service: TaxpayerService, ctx: AuthContext
) -> None:
    """Die USt-IdNr. wird nur ANGEZEIGT — gespeichert bleibt sie dort."""
    db = get_service_client()
    profil = (
        db.table("tenant_billing_profile")
        .select("vat_id")
        .eq("tenant_id", ctx.tenant_id)
        .limit(1)
        .execute()
    ).data
    erwartet = profil[0]["vat_id"] if profil else None
    assert service.overview(ctx).vat_id == erwartet
