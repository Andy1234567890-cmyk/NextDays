"""Dependencies des DAC7-Moduls: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import Dac7Service


def get_dac7_service() -> Dac7Service:
    # service_role: die Meldelauf-Tabellen sind fuer anon/authenticated per
    # revoke gesperrt (Wurzel 6). Der Tenant-Scope wird im Service erzwungen
    # (Wurzel 3) — der Service-Client umgeht RLS.
    return Dac7Service(db=get_service_client())


Dac7ServiceDep = Annotated[Dac7Service, Depends(get_dac7_service)]
