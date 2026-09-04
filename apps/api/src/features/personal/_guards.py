"""Gemeinsame Routen-Guards des Slice `personal` (0544, Vertrag §0).

Bis 0543 standen die Annotated-Guards in `router.py`. Seit die Pakete
(Planung, Bedarf/KI, Terminal, Berichte) eigene Teil-Router mitbringen, liegen
sie hier — ein Teil-Router kann nichts aus `router.py` importieren, ohne einen
Import-Zirkel zu bauen (`router.py` inkludiert die Teil-Router).

Autorisierung (Wurzel 9): jede Route trägt die Fähigkeit ihres Fachgebiets, nicht
nur `get_current_user`. Der Personen-Scope sitzt zusätzlich im Dienst.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException

from src.core.security import AuthContext, get_current_user
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from ._base import PersonalError

# pylint: disable=invalid-name
_MANAGE = require_permission(Capability.MANAGE_PERSONAL)
_PLAN = require_permission(Capability.PLAN_SCHICHTEN)
_TEAM = require_permission(Capability.VIEW_TEAM_SCHEDULE)
_OWN = require_permission(Capability.VIEW_OWN_SCHEDULE)
_TIME = require_permission(Capability.TRACK_OWN_TIME)
_ABSENCE = require_permission(Capability.REQUEST_ABSENCE)
_APPROVE = require_permission(Capability.APPROVE_ABSENCE)
_CONFIRM = require_permission(Capability.CONFIRM_TIME)
_EXPORT = require_permission(Capability.EXPORT_LOHN)
# pylint: enable=invalid-name

Manage = Annotated[AuthContext, Depends(_MANAGE)]
Plan = Annotated[AuthContext, Depends(_PLAN)]
Team = Annotated[AuthContext, Depends(_TEAM)]
Own = Annotated[AuthContext, Depends(_OWN)]
Time = Annotated[AuthContext, Depends(_TIME)]
Absence = Annotated[AuthContext, Depends(_ABSENCE)]
Approve = Annotated[AuthContext, Depends(_APPROVE)]
Confirm = Annotated[AuthContext, Depends(_CONFIRM)]
Export = Annotated[AuthContext, Depends(_EXPORT)]
Current = Annotated[AuthContext, Depends(get_current_user)]


def fehler(exc: PersonalError) -> HTTPException:
    """PersonalError → HTTPException; `details` (z. B. `code`, `konflikte`) bleiben erhalten."""
    detail: object = exc.message
    if exc.details:
        detail = {"message": exc.message, **exc.details}
    return HTTPException(status_code=exc.status_code, detail=detail)
