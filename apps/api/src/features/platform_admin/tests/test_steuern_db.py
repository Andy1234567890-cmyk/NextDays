"""Die Steuer-Prüfsicht des Betreibers gegen die ECHTE DB.

Diese Sicht ist die Kontrolle zu einer BUSSGELDBEWEHRTEN Pflicht: Nach § 23
PStTG muss der Plattformbetreiber die Mitwirkung durchsetzen, das Unterlassen
kostet nach § 25 Abs. 1 Nr. 6 bis zu 30.000 EUR. Eine Zahl, die hier falsch
ist, führt dazu, dass jemand eine Frist verpasst — darum wird jede Kennzahl
gegen die Rohdaten gegengerechnet, nicht gegen ein Double.
"""
from __future__ import annotations

from collections.abc import Iterator

import pytest

from src.core.supabase import get_service_client
from src.features.platform_admin.service import PlatformAdminService

pytestmark = pytest.mark.integration


@pytest.fixture
def svc() -> Iterator[PlatformAdminService]:
    yield PlatformAdminService(db=get_service_client())


def test_alle_betriebe_erscheinen(svc: PlatformAdminService) -> None:
    """Ein fehlender Betrieb wäre eine Lücke, die niemand bemerkt."""
    db = get_service_client()
    gesamt = (
        db.table("tenants").select("id", count="exact").execute()
    ).count or 0
    if gesamt == 0:
        pytest.skip("Keine Betriebe in der DB.")
    uebersicht = svc.steuer_uebersicht()
    assert uebersicht.betriebe_gesamt == gesamt
    assert len(uebersicht.betriebe) == gesamt


def test_pflichtlaender_sind_oder_verknuepft(
    svc: PlatformAdminService,
) -> None:
    """Sitzland ODER Objektland — nicht nur die Objekte.

    Ein deutscher Betrieb mit ausschließlich spanischen Objekten ist auch in
    Deutschland meldepflichtig. Nur die Objektländer zu prüfen wäre zu eng
    und würde genau diesen Fall übersehen.
    """
    db = get_service_client()
    props = (
        db.table("properties").select("tenant_id, country").execute()
    ).data or []
    for b in svc.steuer_uebersicht().betriebe:
        erwartet = {
            (r["country"] or "").upper()
            for r in props
            if r["tenant_id"] == b.tenant_id and r.get("country")
        }
        if b.country:
            erwartet.add(b.country.upper())
        assert set(b.pflicht_laender) == erwartet


def test_fehlend_ist_pflicht_minus_erfasst(
    svc: PlatformAdminService,
) -> None:
    """Wurzel 1: die drei Listen müssen zueinander passen. Eine eigenständig
    gepflegte `fehlende_laender` liefe auseinander."""
    for b in svc.steuer_uebersicht().betriebe:
        assert set(b.fehlende_laender) == set(b.pflicht_laender) - set(
            b.erfasste_laender
        )


def test_objektzahlen_stimmen(svc: PlatformAdminService) -> None:
    db = get_service_client()
    props = (
        db.table("properties")
        .select("tenant_id, land_registration_number, "
                "land_registration_unavailable")
        .execute()
    ).data or []
    for b in svc.steuer_uebersicht().betriebe:
        eigene = [r for r in props if r["tenant_id"] == b.tenant_id]
        assert b.objekte_gesamt == len(eigene)
        offen = sum(
            1
            for r in eigene
            if not r.get("land_registration_number")
            and not r.get("land_registration_unavailable")
        )
        assert b.objekte_ohne_angabe == offen


def test_kennzahlen_stimmen_mit_der_liste(
    svc: PlatformAdminService,
) -> None:
    u = svc.steuer_uebersicht()
    assert u.betriebe_mit_luecke == sum(
        1 for b in u.betriebe if b.fehlende_laender
    )
    assert u.betriebe_ueberfaellig == sum(
        1 for b in u.betriebe if b.ueberfaellig
    )
    assert u.zahlungen_einbehalten == sum(
        1 for b in u.betriebe if b.zahlungen_einbehalten
    )
    assert u.betriebe_vollstaendig == sum(
        1 for b in u.betriebe if b.vollstaendig
    )


def test_filter_zeigt_nur_unvollstaendige(
    svc: PlatformAdminService,
) -> None:
    gefiltert = svc.steuer_uebersicht(nur_luecken=True)
    assert all(not b.vollstaendig for b in gefiltert.betriebe)
    # Die Kennzahlen im Kopf beziehen sich weiter auf ALLE Betriebe —
    # sonst zeigte der Filter eine geschönte Gesamtlage.
    assert gefiltert.betriebe_gesamt == svc.steuer_uebersicht().betriebe_gesamt


def test_ueberfaellig_nur_ohne_massnahme(
    svc: PlatformAdminService,
) -> None:
    """Überfällig heißt: Frist verstrichen UND nichts passiert. Ein Betrieb
    mit laufendem Einbehalt ist NICHT überfällig — dort wurde gehandelt."""
    for b in svc.steuer_uebersicht().betriebe:
        if b.zahlungen_einbehalten:
            assert not b.ueberfaellig
