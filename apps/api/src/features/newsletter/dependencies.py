"""Dependencies des newsletter-Slice: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import NewsletterService


def get_newsletter_service() -> NewsletterService:
    # service_role: newsletter_subscribers ist für anon/authenticated hart
    # gesperrt (Wurzel 6) — es gibt keinen Client-Direktpfad auf E-Mail-Adressen.
    return NewsletterService(db=get_service_client())


NewsletterServiceDep = Annotated[
    NewsletterService, Depends(get_newsletter_service)
]
