"""Dependencies des pro_tools-Slice: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client
from src.features.properties.service import PropertiesService
from src.features.rates.service import RatesService

from .service import ProToolsService


def get_pro_tools_service() -> ProToolsService:
    # Die Massenbearbeitung schreibt NICHT selbst, sie beauftragt die beiden
    # Dienste, die dieselbe Änderung auch einzeln erledigen. Deshalb werden sie
    # hier gebaut und hineingegeben, statt im Dienst erzeugt zu werden: so ist
    # im Test prüfbar, WAS beauftragt wurde — und niemand kann daneben einen
    # zweiten, stilleren Schreibweg legen.
    client = get_service_client()
    return ProToolsService(
        db=client,
        properties=PropertiesService(service_client=client),
        rates=RatesService(service_client=client),
    )


ProToolsServiceDep = Annotated[ProToolsService, Depends(get_pro_tools_service)]
