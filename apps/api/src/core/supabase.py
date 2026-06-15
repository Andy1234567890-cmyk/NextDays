"""Supabase-Client-Factory. Anon- und Service-Role-Client getrennt.

Service-Role umgeht RLS → nur in vertrauenswürdigen Server-Pfaden nutzen,
nie mit Gast-/User-Input ohne tenant-Scope.
"""
from functools import lru_cache

from supabase import Client, create_client

from .config import get_settings


@lru_cache
def get_anon_client() -> Client:
    """Client mit Anon-Key. Respektiert RLS. Default für User-gebundene Calls."""
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key.get_secret_value(),
    )


@lru_cache
def get_service_client() -> Client:
    """Client mit Service-Role-Key. Umgeht RLS. Nur für Admin-/System-Pfade."""
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key.get_secret_value(),
    )
