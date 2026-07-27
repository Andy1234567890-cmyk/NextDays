"""Die Backoffice-Buchungssicht gegen die ECHTE DB.

Warum nicht gegen ein Double: Diese Sicht führt fünf Tabellen zusammen
(reservations, properties, guests, portal_guests, payments, platform_fees) und
rechnet Nächte aus Datumsspalten. Ein Fake müsste all das nachbauen — und würde
genau die Fehler verdecken, die hier zählen: falsche Spaltennamen, fehlende
Joins, ein UUID-Format, das Postgres ablehnt.

Die Tests sind LESEND und legen nichts an: der Bestand der DB ist die Vorlage.
Wo kein passender Datensatz existiert, wird übersprungen statt geraten.
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


def test_liste_laedt(svc: PlatformAdminService) -> None:
    liste = svc.buchungen(limit=50)
    if liste.total == 0:
        pytest.skip("Keine Buchungen in der DB.")
    assert liste.items


def test_naechte_werden_gerechnet_nicht_gespeichert(
    svc: PlatformAdminService,
) -> None:
    """Wurzel 1: eine zweite Quelle für dieselbe Zahl liefe auseinander."""
    liste = svc.buchungen(limit=50)
    if not liste.items:
        pytest.skip("Keine Buchungen in der DB.")
    for b in liste.items:
        assert b.naechte == (b.check_out - b.check_in).days
        assert b.naechte > 0


def test_keine_erfundene_waehrung(svc: PlatformAdminService) -> None:
    """Wurzel 4: fehlt die Währung, bleibt sie None — kein `or 'EUR'`."""
    liste = svc.buchungen(limit=50)
    if not liste.items:
        pytest.skip("Keine Buchungen in der DB.")
    for b in liste.items:
        assert b.currency is None or len(b.currency) == 3


def test_statusfilter_greift(svc: PlatformAdminService) -> None:
    gefiltert = svc.buchungen(limit=50, status_filter="cancelled")
    assert all(b.status == "cancelled" for b in gefiltert.items)


def test_kanalfilter_greift(svc: PlatformAdminService) -> None:
    gefiltert = svc.buchungen(limit=50, channel="direct")
    assert all(b.channel == "direct" for b in gefiltert.items)


def test_betriebsfilter_greift(svc: PlatformAdminService) -> None:
    liste = svc.buchungen(limit=1)
    if not liste.items:
        pytest.skip("Keine Buchungen in der DB.")
    tenant_id = liste.items[0].tenant_id
    gefiltert = svc.buchungen(limit=50, tenant_id=tenant_id)
    assert gefiltert.items
    assert all(b.tenant_id == tenant_id for b in gefiltert.items)


def test_limit_ist_gedeckelt(svc: PlatformAdminService) -> None:
    """Wurzel 8: kein unbegrenzter Bereich."""
    assert len(svc.buchungen(limit=10_000).items) <= 200


def test_detail_hat_beide_seiten(svc: PlatformAdminService) -> None:
    """Der eigentliche Auftrag: Betrieb/Objekt UND Gast/Zahlung."""
    liste = svc.buchungen(limit=1)
    if not liste.items:
        pytest.skip("Keine Buchungen in der DB.")
    b = liste.items[0]
    detail = svc.buchung(b.id)
    assert detail is not None
    # Objektseite
    assert detail.objekt.id == b.property_id
    # Gastseite existiert immer als Objekt, auch wenn leer (OTA ohne Konto)
    assert detail.gast is not None
    # Geldseite
    assert isinstance(detail.zahlungen, list)
    assert isinstance(detail.provisionen, list)
    # Die Listenfelder bleiben identisch — das Detail ERWEITERT nur
    assert detail.naechte == b.naechte
    assert detail.total_amount == b.total_amount
    assert detail.tenant_name == b.tenant_name


def test_gastseite_widerspricht_der_buchung_nicht(
    svc: PlatformAdminService,
) -> None:
    """Die Reservierung ist die führende Quelle; Gastakte und Plattform-Konto
    ergänzen sie nur. Eine abweichende E-Mail wäre ein Anzeigefehler mit
    echten Folgen (falscher Gast kontaktiert)."""
    liste = svc.buchungen(limit=20)
    if not liste.items:
        pytest.skip("Keine Buchungen in der DB.")
    db = get_service_client()
    for b in liste.items[:5]:
        detail = svc.buchung(b.id)
        assert detail is not None
        roh = (
            db.table("reservations")
            .select("guest_email")
            .eq("id", b.id)
            .limit(1)
            .execute()
        ).data[0]
        assert detail.gast.email == roh["guest_email"]


def test_unbekannte_id_gibt_none(svc: PlatformAdminService) -> None:
    """Kein 500 bei einer gültig geformten, aber unbekannten UUID."""
    assert svc.buchung("00000000-0000-4000-8000-000000000000") is None
