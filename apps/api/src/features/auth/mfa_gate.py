"""Der AAL2-Riegel: entscheidet je Request, ob ein Token durchkommt.

Aufgerufen zentral aus `core.security.get_current_user` — also auf JEDEM
geschuetzten Endpunkt und unabhaengig davon, wie das Token entstanden ist.
Das ist der ganze Punkt (Wurzel 7): Wer sich direkt gegen GoTrue anmeldet
(`POST /auth/v1/token`, anon-Key), umgeht `/api/v1/auth/login` vollstaendig —
aber nicht diesen Guard, weil jeder Endpunkt sein `ctx` von hier bekommt.

ZWEI-FAKTOR IST FREIWILLIG (Entscheidung vom 25.08.2026): Es gibt keine
Rollen-Pflicht mehr, keine Einrichtungsfrist und kein Banner, das dazu draengt.
Ein Betrieb haftet nicht dafuer, dass jemand keinen zweiten Faktor einrichtet
— eine erzwungene Einrichtung mit Sperrfrist war genau die Art Kontrolle, die
das nicht mehr sein soll. Frueher gab es hier eine zweite Pruefung
(`PFLICHT_ROLLEN`/`mfa_enforcement`), die admin/co_admin nach 14 Tagen ohne
Faktor aussperrte — sie ist ersatzlos entfernt, nicht nur abgeschaltet: ein
still funktionsloser Pflicht-Mechanismus im Code waere eine zweite, falsche
Wahrheit ueber den Zugang.

Was BLEIBT, ist etwas anderes: Wer sich SELBST einen Faktor eingerichtet hat,
muss ihn auch loesen. Sonst waere die eigene 2FA wirkungslos — ein gestohlenes
aal1-Token oder der direkte GoTrue-Login mit blossem Passwort wuerde sie
einfach umgehen. Das ist kein Zwang, etwas einzurichten; es ist das Honorieren
dessen, was jemand freiwillig eingerichtet hat.

Bewusst in einem eigenen Modul: `core.security` darf `features.auth` nicht auf
Modulebene importieren (Zirkel), und der Guard soll fuer sich testbar sein.
"""
from __future__ import annotations

from fastapi import HTTPException, Request, status

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import get_service_client

from .mfa_service import MfaError, MfaService

log = get_logger("nextdays.auth.mfa_gate")


def mfa_zugang_pruefen(request: Request, ctx: AuthContext) -> None:
    """Wirft 401, wenn ein VORHANDENER zweiter Faktor nicht geloest wurde.

    1. `aal2` → fertig. Der zweite Faktor wurde geloest, alles offen.
    2. API-Client-Token (Client-Credentials) → uebersprungen. Das ist eine
       Maschine ohne Telefon; ihr Schutz ist das Secret plus der Scope, nicht
       ein zweiter Faktor. Sie kann per Definition keinen loesen.
    3. Hat der Nutzer verifizierte Faktoren, ist `aal1` ein UMGANGENER Login
       → 401. Genau der Angriff aus Wurzel 7.
    4. Kein Faktor vorhanden → durch. Es gibt keine Pflicht (s. Moduldoc).
    """
    if ctx.aal == "aal2":
        return

    # Ein Entwickler-API-Token (Client-Credentials) ist kein Mensch: es gibt
    # kein Telefon, keinen Authenticator und keinen Browser fuer einen Passkey.
    # Der Schutz dort ist das Client-Secret und der eingeschraenkte Scope
    # (siehe api_clients).
    if ctx.api_scopes is not None:
        return

    service = MfaService(db=get_service_client())

    try:
        faktoren = service.faktoren(ctx.user_id)
    except MfaError as exc:
        # Fail-CLOSED (Wurzel 5): Ist der Faktor-Status nicht ermittelbar,
        # wird NICHT durchgelassen. Ein Ausfall der Statusabfrage darf nicht
        # zum Generalschluessel werden. 503, nicht 401 — die Sitzung ist
        # gueltig, wir koennen es gerade nur nicht pruefen.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="2FA-Status nicht prüfbar.",
        ) from exc

    if not faktoren:
        # Kein Faktor eingerichtet — es gibt nichts zu loesen, und es gibt
        # keine Pflicht. Optional fuer ALLE Rollen.
        return

    # Der Nutzer HAT einen zweiten Faktor, dieses Token hat ihn aber nicht
    # geloest. Das ist entweder der direkte GoTrue-Login mit blossem Passwort
    # oder ein gestohlenes aal1-Token. Beides ist zu.
    log.warning(
        "mfa_aal1_trotz_faktor",
        user_id=ctx.user_id,
        pfad=request.url.path,
        faktoren=len(faktoren),
    )
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Zweiter Faktor erforderlich.",
        headers={"X-MFA-Required": "challenge"},
    )
