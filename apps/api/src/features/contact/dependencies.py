"""Dependencies des contact-Slice: Service-Factory.

Kein `get_service_client()` wie in den anderen Slices — dieser Slice hat keine
Tabelle. Ein DB-Handle, das niemand braucht, wäre ein Zugriff, den niemand
prüft.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from .service import ContactService


def get_contact_service() -> ContactService:
    return ContactService()


ContactServiceDep = Annotated[ContactService, Depends(get_contact_service)]
