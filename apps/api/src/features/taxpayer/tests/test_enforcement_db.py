"""Die § 23-Kaskade gegen die ECHTE DB — inklusive Auszahlungssperre.

Was ein Double hier nicht zeigen könnte: dass der UNIQUE-Index den Upsert zum
Neustart macht, dass `zahlungen_einbehalten` wirklich über zwei Tabellen hinweg
greift, und dass der Auszahlungslauf die Sperre tatsächlich sieht.

Zeit wird über den `jetzt`-Parameter gesteuert — so ist der 180-Tage-Ablauf in
Sekunden prüfbar, ohne die Systemuhr anzufassen.
"""
from __future__ import annotations

import contextlib
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest

from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.taxpayer.enforcement import (
    ERINNERUNG_1_TAGE,
    ERINNERUNG_2_TAGE,
    FRIST_MINDESTENS_TAGE,
    FRIST_SPAETESTENS_TAGE,
    TaxpayerEnforcement,
)
from src.features.taxpayer.schemas import TaxpayerCreate, TaxpayerKind
from src.features.taxpayer.service import TaxpayerService

pytestmark = pytest.mark.integration

T0 = datetime(2026, 1, 1, tzinfo=UTC)


@pytest.fixture
def umgebung() -> Iterator[tuple[TaxpayerEnforcement, AuthContext, str]]:
    """Betrieb mit mindestens einem Land ohne Steuerangaben."""
    db = get_service_client()
    tax = TaxpayerService(db)
    rows = (db.table("tenants").select("id").limit(1).execute()).data
    if not rows:
        pytest.skip("Kein Betrieb in der DB.")
    tenant_id = rows[0]["id"]
    ctx = AuthContext(user_id="test", tenant_id=tenant_id, role="admin")

    fehlend = tax.overview(ctx).fehlende_laender
    if not fehlend:
        pytest.skip("Betrieb hat für alle Objektländer schon Angaben.")
    land = fehlend[0]

    if (
        db.table("taxpayer_enforcement")
        .select("id")
        .eq("tenant_id", tenant_id)
        .execute()
    ).data:
        pytest.skip("Betrieb hat bereits laufende Mahnvorgänge.")

    try:
        yield TaxpayerEnforcement(db), ctx, land
    finally:
        for tabelle in ("taxpayer_enforcement", "taxpayer_info"):
            with contextlib.suppress(Exception):  # noqa: BLE001 — Teardown
                db.table(tabelle).delete().eq("tenant_id", tenant_id).eq(
                    "country", land
                ).execute()


def _tag(n: int) -> datetime:
    return T0 + timedelta(days=n)


def test_erste_pruefung_fordert_auf(
    umgebung: tuple[TaxpayerEnforcement, AuthContext, str],
) -> None:
    enf, ctx, land = umgebung
    assert land in enf.pruefe_und_aktualisiere(ctx.tenant_id, jetzt=T0).aufgefordert


def test_kein_einbehalt_vor_tag_60(
    umgebung: tuple[TaxpayerEnforcement, AuthContext, str],
) -> None:
    """Die gesetzliche Untergrenze, gegen die echte DB geprüft."""
    enf, ctx, _ = umgebung
    for tag in (0, ERINNERUNG_1_TAGE, ERINNERUNG_2_TAGE, FRIST_MINDESTENS_TAGE - 1):
        enf.pruefe_und_aktualisiere(ctx.tenant_id, jetzt=_tag(tag))
    assert not enf.zahlungen_einbehalten(ctx.tenant_id)


def test_einbehalt_ab_tag_60(
    umgebung: tuple[TaxpayerEnforcement, AuthContext, str],
) -> None:
    enf, ctx, land = umgebung
    for tag in (0, ERINNERUNG_1_TAGE, ERINNERUNG_2_TAGE):
        enf.pruefe_und_aktualisiere(ctx.tenant_id, jetzt=_tag(tag))
    ergebnis = enf.pruefe_und_aktualisiere(
        ctx.tenant_id, jetzt=_tag(FRIST_MINDESTENS_TAGE)
    )
    assert land in ergebnis.eingehalten
    assert enf.zahlungen_einbehalten(ctx.tenant_id)


def test_lauf_ist_idempotent(
    umgebung: tuple[TaxpayerEnforcement, AuthContext, str],
) -> None:
    """Wurzel 2: mehrfach am selben Tag darf nichts zusätzlich passieren."""
    enf, ctx, _ = umgebung
    enf.pruefe_und_aktualisiere(ctx.tenant_id, jetzt=T0)
    zweiter = enf.pruefe_und_aktualisiere(ctx.tenant_id, jetzt=T0)
    assert not zweiter.aufgefordert
    assert not zweiter.erinnert


def test_nachlieferung_hebt_einbehalt_auf(
    umgebung: tuple[TaxpayerEnforcement, AuthContext, str],
) -> None:
    """§ 23 Satz 3: „sind aufzuheben, sobald der Anbieter […] vorgelegt hat."
    Keine Kulanz — Pflicht, und darum automatisch."""
    enf, ctx, land = umgebung
    for tag in (0, ERINNERUNG_1_TAGE, ERINNERUNG_2_TAGE, FRIST_MINDESTENS_TAGE):
        enf.pruefe_und_aktualisiere(ctx.tenant_id, jetzt=_tag(tag))
    assert enf.zahlungen_einbehalten(ctx.tenant_id)

    TaxpayerService(get_service_client()).upsert(
        ctx,
        TaxpayerCreate(
            country=land,
            kind=TaxpayerKind.ENTITY,
            legal_name="Test GmbH",
            tin=f"{land}123456789",
        ),
    )
    ergebnis = enf.pruefe_und_aktualisiere(
        ctx.tenant_id, jetzt=_tag(FRIST_MINDESTENS_TAGE + 1)
    )
    assert land in ergebnis.aufgehoben
    assert not enf.zahlungen_einbehalten(ctx.tenant_id)


def test_ueberfaellig_meldet_verstrichene_obergrenze(
    umgebung: tuple[TaxpayerEnforcement, AuthContext, str],
) -> None:
    """Tag 180 ohne Einbehalt wäre ein Verstoß (§ 25 Abs. 1 Nr. 6) — der Fall
    muss sichtbar werden, nicht still bleiben."""
    enf, ctx, land = umgebung
    enf.pruefe_und_aktualisiere(ctx.tenant_id, jetzt=T0)
    assert enf.ueberfaellig(ctx.tenant_id, jetzt=_tag(FRIST_SPAETESTENS_TAGE - 1)) == []
    assert land in enf.ueberfaellig(
        ctx.tenant_id, jetzt=_tag(FRIST_SPAETESTENS_TAGE + 1)
    )


def test_auszahlungslauf_sieht_die_sperre(
    umgebung: tuple[TaxpayerEnforcement, AuthContext, str],
) -> None:
    """Die Verbindung zum Geld: payouts fragt genau diese Methode."""
    from src.features.payouts.service import PayoutsService  # noqa: PLC0415

    enf, ctx, _ = umgebung
    payouts = PayoutsService(db=get_service_client())
    assert not payouts._steuerangaben_fehlen(ctx.tenant_id)  # noqa: SLF001

    for tag in (0, ERINNERUNG_1_TAGE, ERINNERUNG_2_TAGE, FRIST_MINDESTENS_TAGE):
        enf.pruefe_und_aktualisiere(ctx.tenant_id, jetzt=_tag(tag))
    assert payouts._steuerangaben_fehlen(ctx.tenant_id)  # noqa: SLF001
