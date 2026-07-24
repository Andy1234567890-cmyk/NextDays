"""Router für privacy_settings. Gemountet unter /api/v1/privacy-settings.

Datenschutz-Präferenzen des eingeloggten Kontos (Airbnb „Konto → Datenschutz").
Scope über die eigene user_id im Service (Wurzel 3/9) — jeder eingeloggte Nutzer
sieht/ändert nur die EIGENE Zeile.
"""
from __future__ import annotations

from fastapi import APIRouter

from src.core.security import CurrentUser

from .dependencies import PrivacySettingsServiceDep
from .schemas import PrivacySettings, PrivacySettingsUpdate

router = APIRouter(prefix="/privacy-settings", tags=["privacy-settings"])


@router.get("", response_model=PrivacySettings)
def get_privacy_settings(
    ctx: CurrentUser, service: PrivacySettingsServiceDep
) -> PrivacySettings:
    """Datenschutz-Präferenzen des eingeloggten Nutzers (Defaults, falls keine)."""
    return service.get(ctx)


@router.patch("", response_model=PrivacySettings)
def update_privacy_settings(
    patch: PrivacySettingsUpdate,
    ctx: CurrentUser,
    service: PrivacySettingsServiceDep,
) -> PrivacySettings:
    """Einzelne Präferenzen ändern (nur gesetzte Felder). Legt die Zeile lazy an."""
    return service.update(ctx, patch)
