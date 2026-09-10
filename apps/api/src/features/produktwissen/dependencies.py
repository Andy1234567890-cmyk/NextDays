"""Dependencies des produktwissen-Slice: Service-Factory."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import ProduktwissenService


def get_produktwissen_service() -> ProduktwissenService:
    # service_role, obwohl die Tabelle für anon lesbar ist: der Aufruf geht
    # über die RPC `produktwissen_suchen`, deren EXECUTE anon und
    # authenticated entzogen ist (Wurzel 6). Die Suche kostet Rechenzeit und
    # soll durch die App laufen, wo der Rate-Limit-Bucket greift — nicht
    # beliebig oft direkt an PostgREST.
    return ProduktwissenService(db=get_service_client())


ProduktwissenServiceDep = Annotated[
    ProduktwissenService, Depends(get_produktwissen_service)
]
