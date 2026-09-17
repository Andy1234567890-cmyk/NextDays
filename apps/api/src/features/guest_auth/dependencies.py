"""Dependencies des guest_auth-Slice: Service-Factory (Muster wie auth)."""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_anon_client, get_service_client
from src.features.payments.identity import IdentityService
from src.features.payments.welt import marktplatz_client

from .codeanmeldung import GuestCodeService
from .service import GuestAuthService


def get_guest_auth_service() -> GuestAuthService:
    return GuestAuthService(
        anon_client=get_anon_client(),
        service_client=get_service_client(),
    )


GuestAuthServiceDep = Annotated[GuestAuthService, Depends(get_guest_auth_service)]


def get_guest_code_service() -> GuestCodeService:
    return GuestCodeService(
        anon_client=get_anon_client(),
        service_client=get_service_client(),
    )


GuestCodeServiceDep = Annotated[GuestCodeService, Depends(get_guest_code_service)]


def get_guest_identity_service() -> IdentityService:
    """Die Ausweispruefung fuer Marktplatz-Gaeste.

    Derselbe Dienst wie bei den Gastgebern — dieselbe Strenge, derselbe
    Webhook, dieselbe Statusabbildung. Verschieden ist nur die Zeile, an der
    das Ergebnis landet.

    `marktplatz_client()` statt des Mandanten-Wegs: ein Gast gehoert keinem
    Betrieb, seine Welt ist die des Marktplatzes. `None` heisst „der gewohnte
    Live-Client" — die Entscheidung selbst steht in `payments.welt`, nicht
    hier.
    """
    return IdentityService(
        service_client=get_service_client(),
        stripe=marktplatz_client(),
    )


GuestIdentityServiceDep = Annotated[
    IdentityService, Depends(get_guest_identity_service)
]
