"""Dependencies des announcements-Slice: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import AnnouncementService


def get_announcement_service() -> AnnouncementService:
    # Nur service_role: `announcements` und `announcement_reads` sind für
    # anon/authenticated hart gesperrt (0337, Wurzel 6). Der Scope wird im
    # Service erzwungen — beim Dashboard-Pfad über die frisch gelesene Rolle,
    # beim Backoffice-Pfad über CurrentPlatformAdmin am Router.
    return AnnouncementService(db=get_service_client())


AnnouncementServiceDep = Annotated[
    AnnouncementService, Depends(get_announcement_service)
]
