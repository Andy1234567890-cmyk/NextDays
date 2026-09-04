"""Dependencies des personal-Slice: Service-Factories (nur service_role).

Alle personal_*-Tabellen sind für anon/authenticated gesperrt oder nur lesbar
(0541, Wurzel 6) — der Schreibweg läuft ausschließlich hier durch.
"""

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .abwesenheiten import AbwesenheitenService
from .auswertung import AuswertungService
from .kartei import KarteiService
from .schichten import SchichtenService
from .service import PersonalService
from .terminal import TerminalService
from .ueberstunden import UeberstundenService
from .zeiterfassung import ZeiterfassungService


def get_personal_service() -> PersonalService:
    return PersonalService(service_client=get_service_client())


def get_schichten_service() -> SchichtenService:
    return SchichtenService(service_client=get_service_client())


def get_abwesenheiten_service() -> AbwesenheitenService:
    return AbwesenheitenService(service_client=get_service_client())


def get_zeiterfassung_service() -> ZeiterfassungService:
    return ZeiterfassungService(service_client=get_service_client())


def get_auswertung_service() -> AuswertungService:
    return AuswertungService(service_client=get_service_client())


def get_kartei_service() -> KarteiService:
    return KarteiService(service_client=get_service_client())


PersonalServiceDep = Annotated[PersonalService, Depends(get_personal_service)]
SchichtenServiceDep = Annotated[SchichtenService, Depends(get_schichten_service)]
AbwesenheitenServiceDep = Annotated[AbwesenheitenService, Depends(get_abwesenheiten_service)]
ZeiterfassungServiceDep = Annotated[ZeiterfassungService, Depends(get_zeiterfassung_service)]
AuswertungServiceDep = Annotated[AuswertungService, Depends(get_auswertung_service)]
KarteiServiceDep = Annotated[KarteiService, Depends(get_kartei_service)]


# Die zwei Dienste des Ausbaus, deren eigene Factory einen optionalen
# `db`-Parameter hat (für die Tests). FastAPI würde diesen Parameter als
# Query-Parameter lesen und am Supabase-Client scheitern — deshalb hier eine
# argumentlose Fassung für die Router.
def get_terminal_service_dep() -> TerminalService:
    return TerminalService(service_client=get_service_client())


def get_ueberstunden_service_dep() -> UeberstundenService:
    return UeberstundenService(service_client=get_service_client())


TerminalServiceDep = Annotated[TerminalService, Depends(get_terminal_service_dep)]
UeberstundenServiceDep = Annotated[
    UeberstundenService, Depends(get_ueberstunden_service_dep)
]
