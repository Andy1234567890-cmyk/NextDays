"""Dependencies des public_portal-Slice: Service-Factories und Rechte-Guard."""
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, status

from src.core.logging import get_logger
from src.core.security import AuthContext, get_current_user
from src.core.supabase import get_service_client
from src.features.auth.dependencies import AccountServiceDep
from src.features.auth.granular_permissions import (
    Permission,
    has_permission,
    has_pm_access,
)
from src.features.auth.permissions import Capability, effective_capabilities

from .dienstleistungen import DienstleistungsService
from .familie import FamilieError, OwnerFamilyService
from .service import PublicPortalService

log = get_logger("nextdays.public_portal.guard")

# Ein Text für JEDE Ablehnung: sprechend genug, dass der Eigentümer weiß, wen
# er fragen muss (die Verwaltung), aber ohne zu verraten, WELCHE der beiden
# Prüfungen gegriffen hat. Sonst wäre die Fehlermeldung eine Landkarte des
# Rechtesystems für jeden, der Rechte sucht (Wurzel 9: kein Recon).
_ABGELEHNT = "Dieser Bereich ist für Ihren Zugang nicht freigegeben."


def get_public_portal_service() -> PublicPortalService:
    return PublicPortalService(service_client=get_service_client())


PublicPortalServiceDep = Annotated[
    PublicPortalService, Depends(get_public_portal_service)
]


def get_owner_family_service() -> OwnerFamilyService:
    return OwnerFamilyService(service_client=get_service_client())


OwnerFamilyServiceDep = Annotated[
    OwnerFamilyService, Depends(get_owner_family_service)
]


def get_dienstleistungs_service() -> DienstleistungsService:
    return DienstleistungsService(service_client=get_service_client())


DienstleistungsServiceDep = Annotated[
    DienstleistungsService, Depends(get_dienstleistungs_service)
]


def require_portal_recht(
    perm: Permission, cap: Capability
) -> Callable[..., AuthContext]:
    """Guard für die granularen Eigentümer-Rechte im Portal.

    Er prüft ZWEI Dinge, weil im Projekt zwei Rechtesysteme nebeneinander
    laufen und jedes für sich löchrig wäre:

    1. **Die granulare Berechtigung** (`users.permissions`, z. B.
       `pm_property_area`) — der Schalter, den die Verwaltung im
       Rechte-Dialog umlegt. Rolle UND Rechte kommen dabei aus der DATENBANK
       (`AccountService.role_and_permissions`), nie aus dem JWT: ein
       entzogenes Recht muss sofort wirken und nicht erst beim nächsten Token
       (Wurzel 7).
    2. **Die Fähigkeit** über `effective_capabilities` — inklusive der
       Familien-Deckelung (0389). Ein Familienmitglied trägt in `users`
       ebenfalls `role='owner'` und hätte damit die volle Eigentümer-Matrix;
       seine Stufe (`owner_family_members.access`) deckelt sie. Ohne diesen
       zweiten Schritt käme die Tochter mit der Stufe `nutzung` an die
       Auslastungszahlen, die der Vater ihr nicht freigegeben hat.

    Warum nicht `require_permission` bzw. `require_granular_permission`
    allein: Ersteres kennt die granularen Schalter nicht, Letzteres kennt die
    Familienstufe nicht. Beide Guards bleiben unverändert für ihre Fälle; hier
    steht die Kombination, die das Eigentümer-Portal braucht.

    Fail-closed (Wurzel 5): fehlende Rolle, fehlender Tenant, unbekannte
    Familienstufe → 403, nie ein Durchlassen bei unbekanntem Zustand.
    """

    def _guard(
        ctx: Annotated[AuthContext, Depends(get_current_user)],
        konto: AccountServiceDep,
        familie: OwnerFamilyServiceDep,
    ) -> AuthContext:
        role, stored = konto.role_and_permissions(ctx)
        if not has_permission(role, stored, perm):
            log.info(
                "portal_recht_abgelehnt",
                grund="permission",
                recht=perm.value,
                faehigkeit=cap.value,
                user_id=ctx.user_id,
                rolle=role.value if role else None,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=_ABGELEHNT
            )
        try:
            stufe = familie.stufe(ctx)
        except FamilieError as exc:
            # Kein Tenant/Nutzer im Konto: hier ist das keine 400-Auskunft,
            # sondern ein unbekannter Zustand an einer Rechte-Prüfung.
            log.info(
                "portal_recht_abgelehnt",
                grund="kein_konto",
                recht=perm.value,
                user_id=ctx.user_id,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=_ABGELEHNT
            ) from exc
        caps = effective_capabilities(
            role,
            has_pm_access=has_pm_access(role, stored),
            family_access=stufe,
        )
        if cap not in caps:
            log.info(
                "portal_recht_abgelehnt",
                grund="capability",
                recht=perm.value,
                faehigkeit=cap.value,
                user_id=ctx.user_id,
                rolle=role.value if role else None,
                familienstufe=stufe,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=_ABGELEHNT
            )
        log.debug(
            "portal_recht_erteilt",
            recht=perm.value,
            faehigkeit=cap.value,
            user_id=ctx.user_id,
            familienstufe=stufe,
        )
        return ctx

    return _guard
