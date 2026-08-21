"""Dependencies des notification_settings-Slice: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .geraete import PushGeraeteService
from .glocke import GlockeService
from .service import NotificationSettingsService


def get_notification_settings_service() -> NotificationSettingsService:
    # service_role: notification_settings ist per RLS + revoke für Nicht-
    # service_role gesperrt; der Scope wird im Service über ctx.user_id
    # erzwungen (Wurzel 3).
    return NotificationSettingsService(db=get_service_client())


NotificationSettingsServiceDep = Annotated[
    NotificationSettingsService, Depends(get_notification_settings_service)
]


def get_glocke_service() -> GlockeService:
    # service_role wie oben: `notifications` ist per revoke gegen direktes
    # Schreiben gesperrt, `select` ist für authenticated nur über die eigene
    # Zeile offen (Realtime). Der Scope kommt hier aus ctx (Wurzel 3/9).
    return GlockeService(db=get_service_client())


GlockeServiceDep = Annotated[GlockeService, Depends(get_glocke_service)]


def get_push_geraete_service() -> PushGeraeteService:
    # service_role: `push_devices` ist per revoke fuer anon/authenticated
    # komplett gesperrt (Migration 0414) — ein FCM-Token ist ein Zustellkanal
    # ans Geraet, kein lesbares Nutzerfeld. Der Scope kommt aus ctx.user_id.
    return PushGeraeteService(db=get_service_client())


PushGeraeteServiceDep = Annotated[
    PushGeraeteService, Depends(get_push_geraete_service)
]
