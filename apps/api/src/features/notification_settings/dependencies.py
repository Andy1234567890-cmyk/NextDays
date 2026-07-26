"""Dependencies des notification_settings-Slice: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import NotificationSettingsService


def get_notification_settings_service() -> NotificationSettingsService:
    # service_role: notification_settings ist per RLS + revoke für Nicht-
    # service_role gesperrt; der Scope wird im Service über ctx.user_id
    # erzwungen (Wurzel 3).
    return NotificationSettingsService(db=get_service_client())


NotificationSettingsServiceDep = Annotated[
    NotificationSettingsService, Depends(get_notification_settings_service)
]
