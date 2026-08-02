"""Dependencies des reviews-Slice: Service + Berechtigungs-Aliase.

Bewertungen haben eigene Fähigkeiten (VIEW_REVIEWS / MANAGE_REVIEWS) statt auf
Kalender-Rechten mitzureiten: wer den Belegungsplan sehen darf, muss nicht
automatisch öffentlich im Namen des Betriebs antworten dürfen.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .automation import ReviewAutomation
from .service import ReviewsService


def get_reviews_service() -> ReviewsService:
    # service_role: reviews/channex_review sind für anon/authenticated gesperrt
    # bzw. read-only; der Scope wird im Service erzwungen (Wurzel 3).
    return ReviewsService(service_client=get_service_client())


def get_review_automation() -> ReviewAutomation:
    return ReviewAutomation(service_client=get_service_client())


ReviewsServiceDep = Annotated[ReviewsService, Depends(get_reviews_service)]
AutomationDep = Annotated[ReviewAutomation, Depends(get_review_automation)]

ViewCtx = Annotated[
    AuthContext, Depends(require_permission(Capability.VIEW_REVIEWS))
]
ManageCtx = Annotated[
    AuthContext, Depends(require_permission(Capability.MANAGE_REVIEWS))
]
