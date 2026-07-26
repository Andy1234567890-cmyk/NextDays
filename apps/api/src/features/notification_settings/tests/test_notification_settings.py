"""Integrationstests des notification_settings-Slice — gegen die ECHTE DB.

Bewusst KEIN Supabase-Double: Was hier geprüft wird (Upsert-Semantik, Defaults
aus dem Schema, dass die Zeile wirklich entsteht), kann ein Mock nicht zeigen —
er antwortet genau das, was der Test ihm vorgibt. Die reine Regel-Logik ohne
Persistenz steckt in test_katalog.py und läuft immer.

Marker `integration` → nur mit ALLOW_INTEGRATION_TESTS=1 (siehe tests/conftest.py).
Jeder Test räumt seine Zeile im finally wieder weg.
"""
from __future__ import annotations

import contextlib
from collections.abc import Iterator

import pytest

from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.notification_settings.katalog import MARKETING_SPALTEN, Kanal
from src.features.notification_settings.schemas import NotificationSettingsUpdate
from src.features.notification_settings.service import NotificationSettingsService

pytestmark = pytest.mark.integration


@pytest.fixture
def service() -> NotificationSettingsService:
    return NotificationSettingsService(db=get_service_client())


@pytest.fixture
def ctx() -> Iterator[AuthContext]:
    """Kontext eines echten Nutzers; die Präferenzzeile wird danach entfernt.

    Es wird KEIN Nutzer angelegt — das würde einen Auth-User und einen Tenant
    erzeugen. Der Test nutzt einen vorhandenen und fasst nur seine (vorher nicht
    existierende) notification_settings-Zeile an.
    """
    db = get_service_client()
    rows = (db.table("users").select("id").limit(1).execute()).data
    if not rows:
        pytest.skip("Kein Nutzer in der DB.")
    user_id = rows[0]["id"]
    bestand = (
        db.table("notification_settings")
        .select("user_id")
        .eq("user_id", user_id)
        .execute()
    ).data
    if bestand:
        pytest.skip("Nutzer hat bereits Präferenzen — Test würde sie überschreiben.")
    try:
        yield AuthContext(user_id=user_id, tenant_id=None, role="admin")
    finally:
        with contextlib.suppress(Exception):  # noqa: BLE001 — Teardown best effort
            db.table("notification_settings").delete().eq(
                "user_id", user_id
            ).execute()


def test_get_liefert_defaults_ohne_zeile(
    service: NotificationSettingsService, ctx: AuthContext
) -> None:
    """Ohne gespeicherte Zeile gelten die Schema-Defaults — nicht leer, nicht None."""
    s = service.get(ctx)
    assert s.insights_tips_email is True
    assert s.insights_tips_sms is False
    assert s.listing_activity_sms is True


def test_update_legt_zeile_lazy_an(
    service: NotificationSettingsService, ctx: AuthContext
) -> None:
    service.update(ctx, NotificationSettingsUpdate(insights_tips_email=False))
    assert service.get(ctx).insights_tips_email is False


def test_pflicht_email_laesst_sich_nicht_abschalten(
    service: NotificationSettingsService, ctx: AuthContext
) -> None:
    """Richtlinien-Mails sind vertraglich nötig — der Service erzwingt sie."""
    service.update(ctx, NotificationSettingsUpdate(guest_policies_email=False))
    assert service.get(ctx).guest_policies_email is True


def test_sammel_optout_schaltet_alle_marketing_kanaele_aus(
    service: NotificationSettingsService, ctx: AuthContext
) -> None:
    """Wurzel 1: das Flag pflegt den Gegenzustand, sonst widerspricht es den Spalten."""
    service.update(ctx, NotificationSettingsUpdate(marketing_unsubscribed_all=True))
    s = service.get(ctx)
    assert not [spalte for spalte in MARKETING_SPALTEN if getattr(s, spalte)]


def test_sammel_optout_faellt_wenn_kanal_wieder_an(
    service: NotificationSettingsService, ctx: AuthContext
) -> None:
    service.update(ctx, NotificationSettingsUpdate(marketing_unsubscribed_all=True))
    service.update(ctx, NotificationSettingsUpdate(insights_tips_email=True))
    s = service.get(ctx)
    assert s.insights_tips_email is True
    assert s.marketing_unsubscribed_all is False


def test_sammel_optout_aus_schaltet_nichts_automatisch_an(
    service: NotificationSettingsService, ctx: AuthContext
) -> None:
    """Wurzel 4: welche Kategorien der Nutzer zurückwill, weiß nur er."""
    service.update(ctx, NotificationSettingsUpdate(marketing_unsubscribed_all=True))
    service.update(ctx, NotificationSettingsUpdate(marketing_unsubscribed_all=False))
    s = service.get(ctx)
    assert s.marketing_unsubscribed_all is False
    assert s.insights_tips_email is False


def test_soll_senden_folgt_der_praeferenz(
    service: NotificationSettingsService, ctx: AuthContext
) -> None:
    service.update(ctx, NotificationSettingsUpdate(insights_pricing_email=False))
    assert not service.soll_senden(ctx.user_id, "insights_pricing", Kanal.EMAIL)


def test_soll_senden_ignoriert_praeferenz_bei_pflicht_mail(
    service: NotificationSettingsService, ctx: AuthContext
) -> None:
    assert service.soll_senden(ctx.user_id, "guest_policies", Kanal.EMAIL)


def test_soll_senden_false_fuer_nicht_angebotenen_kanal(
    service: NotificationSettingsService, ctx: AuthContext
) -> None:
    """guest_policies kennt keinen Telefon-Kanal → nie senden."""
    assert not service.soll_senden(ctx.user_id, "guest_policies", Kanal.PHONE)


def test_soll_senden_wirft_bei_unbekannter_kategorie(
    service: NotificationSettingsService, ctx: AuthContext
) -> None:
    with pytest.raises(ValueError, match="Unbekannte"):
        service.soll_senden(ctx.user_id, "gibt_es_nicht", Kanal.EMAIL)


def test_overview_markiert_gesperrte_schalter(
    service: NotificationSettingsService, ctx: AuthContext
) -> None:
    """Die UI erfährt vom Server, welcher Schalter gesperrt ist."""
    uebersicht = service.overview(ctx)
    policies = next(
        k for k in uebersicht.kategorien if k.schluessel == "guest_policies"
    )
    email = next(k for k in policies.kanaele if k.kanal == "email")
    assert email.aenderbar is False
    assert email.aktiv is True

    tips = next(k for k in uebersicht.kategorien if k.schluessel == "insights_tips")
    assert all(k.aenderbar for k in tips.kanaele)
