"""Dependencies des account_deletion-Slice: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client
from src.features.auth.account_service import AccountService
from src.features.auth.dependencies import get_account_service

from .in_app import InAppLoeschung
from .service import AccountDeletionService


def get_account_deletion_service() -> AccountDeletionService:
    # service_role: account_deletion_requests ist für anon/authenticated hart
    # gesperrt (0413, Wurzel 6) — es gibt keinen Client-Direktpfad auf die
    # Adressen unserer Kunden.
    return AccountDeletionService(db=get_service_client())


AccountDeletionServiceDep = Annotated[
    AccountDeletionService, Depends(get_account_deletion_service)
]


def get_in_app_loeschung(
    account_service: Annotated[AccountService, Depends(get_account_service)],
) -> InAppLoeschung:
    """Der angemeldete Löschweg (Apple 5.1.1(v)).

    Nutzt denselben service_role-Client wie der öffentliche Weg (dieselbe
    gesperrte Tabelle) und den AccountService des auth-Slice für die
    Passwort-Rückfrage — die Hürde ist dort bereits fail-closed umgesetzt, eine
    zweite Umsetzung würde davon abdriften.
    """
    return InAppLoeschung(
        db=get_service_client(), account_service=account_service
    )


InAppLoeschungDep = Annotated[InAppLoeschung, Depends(get_in_app_loeschung)]
