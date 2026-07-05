"""Owner-Sperre für die Betriebsbuchhaltung (§4.2).

Die owner-Rolle besitzt zwar OWNER_REPORTING (für die eigene Auszahlungs-
Abrechnung in owner_statements), darf aber NICHT auf die tenant-weite
Debitorenbuchhaltung (Kunden/Rechnungen/Nummernkreise) zugreifen — weder lesen
noch schreiben.
"""
import pytest
from fastapi import HTTPException

from src.core.security import AuthContext
from src.features.buchhaltung.router import _require_agency_finance


def test_owner_blocked_from_buchhaltung() -> None:
    ctx = AuthContext(user_id="u", tenant_id="t1", role="owner")
    with pytest.raises(HTTPException) as exc:
        _require_agency_finance(ctx)
    assert exc.value.status_code == 403


def test_admin_and_coadmin_allowed() -> None:
    for role in ("admin", "co_admin"):
        ctx = AuthContext(user_id="u", tenant_id="t1", role=role)
        assert _require_agency_finance(ctx) is ctx
