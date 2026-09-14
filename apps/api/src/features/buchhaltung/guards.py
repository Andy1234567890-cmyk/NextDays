"""Zugangs-Guards der Buchhaltung — EINE Quelle für Rollen- und Modul-Prüfung.

Bis zum 12.09.2026 standen sie in ``router.py``. Mit den dreizehn Bereichen
unter ``bereiche/`` brauchen sie viele Router; ein Import aus ``router.py``
wäre dort zirkulär (``router.py`` bindet die Bereiche am Ende ein). Deshalb
hier, ohne Abhängigkeit zum Router.

Verwendung in einem Bereichs-Router::

    from ...guards import Schreibrecht, Leserecht
    @router.get("/expenses")
    def liste(ctx: Leserecht, ...): ...

``Schreibrecht``/``Leserecht`` = Rollen-Guard (OWNER_REPORTING, Owner hart 403)
UND Kauf-Entitlement (402). Die ``_``-Aliase bleiben für den Bestand in
``router.py``.
"""

from typing import Annotated

from fastapi import Depends, HTTPException, status

from src.core.security import AuthContext, CurrentUser
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_granular_permission
from src.features.auth.granular_permissions import Permission
from src.features.subscriptions.entitlements import modul_aktiv


def _require_agency_finance(
    ctx: Annotated[AuthContext, Depends(require_granular_permission(Permission.OWNER_REPORTING))],
) -> AuthContext:
    """Zugang zur AGENTUR-Debitorenbuchhaltung (Kunden/Rechnungen/Nummernkreise
    des Betriebs).

    Zwei Ebenen: (1) OWNER_REPORTING (staff/cleaner ohne Finanz-Zugang raus).
    (2) Die owner-Rolle BESITZT OWNER_REPORTING zwar (für ihre eigene
    Auszahlungs-Abrechnung in owner_statements, dort self-scoped), hat in der
    tenant-weiten Debitorenbuchhaltung aber NICHTS zu suchen — sie würde sonst
    Rechnungen/Kunden-PII ALLER Objekte des Tenants sehen und sogar schreiben
    (§4.2: Owner read-only + nur eigene Daten). Deshalb Owner hier hart mit 403
    aussperren — die Owner-Finanzsicht ist ausschließlich /owner-statements.
    """
    if ctx.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kein Zugriff auf die Betriebsbuchhaltung.",
        )
    return ctx


# module_key des kostenpflichtigen Moduls, das diesen Slice freischaltet.
# Quelle: subscriptions.schemas.MODULE_KEYS / PLAN-stripe-preisliste.md Z. 94.
BUCHHALTUNG_MODULE_KEY = "modul3_buchhaltung"


def _require_buchhaltung_modul(ctx: AuthContext) -> AuthContext:
    """Ist „Modul 3 — Buchhaltung" für diesen Betrieb gebucht?

    Drei getrennte Dinge (nicht zusammenlegen): Authentifizierung (wer bist du),
    Autorisierung (`_require_agency_finance`: darf deine Rolle Finanzdaten sehen)
    und ENTITLEMENT (hat der Betrieb das Modul bezahlt). Dieser Guard prüft nur
    das Dritte — er ersetzt keinen Rollen-Guard, er kommt zusätzlich.

    Fail-CLOSED (Wurzel 5): ohne Tenant, ohne Zeile oder bei ``active = false``
    gilt das Modul als nicht gebucht → 402, wie in
    `pricing.settings_service` für „Dynamische Preise". Eine Quelle für die
    Antwort: `subscriptions.entitlements.modul_aktiv` — hier keine eigene
    Abfrage (drei Kopien heißt: eine wird fail-OPEN, ohne dass es auffällt).

    Serverseitig erzwungen, nicht nur im Frontend ausgeblendet
    (PLAN-stripe-preisliste.md Z. 142-144, Wurzel 3).
    """
    if not modul_aktiv(get_service_client(), ctx.tenant_id, BUCHHALTUNG_MODULE_KEY):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Buchhaltung ist ein kostenpflichtiges Modul. "
            "Bitte zuerst unter Erweiterungen aktivieren.",
        )
    return ctx


def _require_agency_finance_with_modul(
    ctx: Annotated[AuthContext, Depends(_require_agency_finance)],
) -> AuthContext:
    """Rollen-Guard UND Entitlement — in dieser Reihenfolge: erst 403 für die
    falsche Rolle, dann 402 für den fehlenden Kauf."""
    return _require_buchhaltung_modul(ctx)


# Schreib- UND Leserechte: Agentur-Finanzzugang (OWNER_REPORTING, ohne Owner)
# PLUS gebuchtes Modul 3 (402, wenn nicht gebucht).
_write = Annotated[AuthContext, Depends(_require_agency_finance_with_modul)]
_read = _write

# OHNE Entitlement: das Firmen-/Rechnungsprofil des Betriebs (`companies/me`,
# Logo, Stripe-Sync) sind KONTO-Stammdaten. Sie liegen historisch in diesem
# Slice, gehören aber zu Onboarding und /konto (web/lib/firmenprofil.ts) und
# müssen JEDEM Betrieb offenstehen — hinter Modul 3 gesperrt käme kein
# Neukunde durch das Onboarding und niemand an seine eigenen Firmendaten.
# Rollen-Guard bleibt, nur das Entitlement fällt weg.
_profile_write = Annotated[  # pylint: disable=invalid-name
    AuthContext, Depends(_require_agency_finance)
]


def _require_company_profile_read(ctx: CurrentUser) -> AuthContext:
    """Firmen-/Kontaktprofil des Betriebs LESEN (/konto): das sind Konto-
    Stammdaten, KEIN Debitoren-Finanzeinblick — deshalb eigener Guard statt
    OWNER_REPORTING (sonst sah der co_admin ein leeres /konto). admin und
    co_admin dürfen lesen; staff/cleaner (§4.3) und owner (§4.2) bleiben
    draußen. Schreiben bleibt am Finanz-Guard (admin)."""
    if ctx.role not in ("admin", "co_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kein Zugriff auf das Firmenprofil.",
        )
    return ctx


# Lesen des Firmenprofils (admin+co_admin). Alias-Muster wie _read/_write.
_profile_read = Annotated[  # pylint: disable=invalid-name
    AuthContext, Depends(_require_company_profile_read)
]

# Lesbare Namen für die Bereiche (dieselben Objekte wie die Aliase oben).
Schreibrecht = _write
Leserecht = _read
ProfilSchreibrecht = _profile_write
ProfilLeserecht = _profile_read
