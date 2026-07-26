"""Dependencies des diagnostics-Slice: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import DiagnosticsService


def get_diagnostics_service() -> DiagnosticsService:
    # service_role: support_diagnostics ist für anon/authenticated komplett
    # gesperrt (Wurzel 6). Den Scope erzwingt der Service — beim Schreiben über
    # die Identität des Aufrufers, beim Lesen über die aktive Debug-Freigabe.
    return DiagnosticsService(db=get_service_client())


DiagnosticsServiceDep = Annotated[
    DiagnosticsService, Depends(get_diagnostics_service)
]
