"""Router für notification_settings. Gemountet unter /api/v1/notification-settings.

Benachrichtigungs-Präferenzen des eingeloggten Kontos (Airbnb „Konto →
Benachrichtigungen"). Scope über die eigene user_id im Service (Wurzel 3/9) —
jeder eingeloggte Nutzer sieht/ändert nur die EIGENE Zeile.
"""
from __future__ import annotations

from fastapi import APIRouter

from src.core.security import CurrentUser

from .dependencies import NotificationSettingsServiceDep
from .schemas import (
    NotificationOverview,
    NotificationSettings,
    NotificationSettingsUpdate,
)

router = APIRouter(
    prefix="/notification-settings", tags=["notification-settings"]
)


@router.get("", response_model=NotificationOverview)
def get_overview(
    ctx: CurrentUser, service: NotificationSettingsServiceDep
) -> NotificationOverview:
    """Alle Kategorien mit Kanal-Zustand und Sperr-Information für den Tab."""
    return service.overview(ctx)


@router.get("/raw", response_model=NotificationSettings)
def get_raw(
    ctx: CurrentUser, service: NotificationSettingsServiceDep
) -> NotificationSettings:
    """Die flachen Präferenzen (ein bool je Kategorie×Kanal)."""
    return service.get(ctx)


@router.patch("", response_model=NotificationSettings)
def update_settings(
    patch: NotificationSettingsUpdate,
    ctx: CurrentUser,
    service: NotificationSettingsServiceDep,
) -> NotificationSettings:
    """Einzelne Präferenzen ändern (nur gesetzte Felder). Pflicht-E-Mails
    bleiben an, das Sammel-Opt-out pflegt die Marketing-Kanäle mit."""
    return service.update(ctx, patch)
