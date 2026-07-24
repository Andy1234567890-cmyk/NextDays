"""Dependencies des privacy_settings-Slice: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import PrivacySettingsService


def get_privacy_settings_service() -> PrivacySettingsService:
    # service_role: privacy_settings ist per RLS für Nicht-service_role gesperrt;
    # der Scope wird im Service über ctx.user_id erzwungen (Wurzel 3).
    return PrivacySettingsService(db=get_service_client())


PrivacySettingsServiceDep = Annotated[
    PrivacySettingsService, Depends(get_privacy_settings_service)
]
