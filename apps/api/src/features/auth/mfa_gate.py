"""Der AAL2-Riegel: entscheidet je Request, ob ein Token durchkommt.

Aufgerufen zentral aus `core.security.get_current_user` — also auf JEDEM
geschuetzten Endpunkt und unabhaengig davon, wie das Token entstanden ist.
Das ist der ganze Punkt (Wurzel 7): Wer sich direkt gegen GoTrue anmeldet
(`POST /auth/v1/token`, anon-Key), umgeht `/api/v1/auth/login` vollstaendig —
aber nicht diesen Guard, weil jeder Endpunkt sein `ctx` von hier bekommt.

Bewusst in einem eigenen Modul: `core.security` darf `features.auth` nicht auf
Modulebene importieren (Zirkel), und der Guard soll fuer sich testbar sein.
"""
from __future__ import annotations

from fastapi import HTTPException, Request, status

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import get_service_client

from .mfa_service import ENROLLMENT_ERLAUBTE_PFADE, MfaError, MfaService

log = get_logger("nextdays.auth.mfa_gate")

# Pfade, die den Riegel gar nicht erst erreichen sollen, weil sie ihn aufloesen
# wuerden: die 2FA-Einrichtung selbst und das Abmelden. Ohne diese Ausnahme
# koennte ein Pflicht-Konto ohne Faktor die geforderte 2FA nicht einrichten —
# eine Sperre ohne Ausweg.
#
# WICHTIG (Wurzel 9): Das ist eine Ausnahme fuer den ENROLLMENT-Zwang, NICHT
# fuer den Challenge-Zwang. Wer bereits einen Faktor hat, muss ihn auch hier
# loesen — sonst waere `/auth/account` mit blossem Passwort erreichbar.


def _ist_enrollment_pfad(pfad: str) -> bool:
    return any(p in pfad for p in ENROLLMENT_ERLAUBTE_PFADE)


def mfa_zugang_pruefen(request: Request, ctx: AuthContext) -> None:
    """Wirft 401, wenn dieses Token den zweiten Faktor schuldig bleibt.

    Reihenfolge ist bedeutungstragend:

    1. `aal2` → fertig. Der zweite Faktor wurde geloest, alles offen.
    2. API-Client-Token (Client-Credentials) → uebersprungen. Das ist eine
       Maschine ohne Telefon; ihr Schutz ist das Secret plus der Scope, nicht
       ein zweiter Faktor. Sie kann per Definition keinen loesen.
    3. Hat der Nutzer verifizierte Faktoren, ist `aal1` ein UMGANGENER Login
       → 401. Genau der Angriff aus Wurzel 7.
    4. Pflichtrolle ohne Faktor → 401 nach Fristablauf, sonst durch mit
       Aufforderung.
    """
    if ctx.aal == "aal2":
        return

    # Ein Entwickler-API-Token (Client-Credentials) ist kein Mensch: es gibt
    # kein Telefon, keinen Authenticator und keinen Browser fuer einen Passkey.
    # Ein Faktor-Zwang wuerde jede Server-zu-Server-Integration brechen, ohne
    # etwas zu schuetzen — der Schutz dort ist das Client-Secret und der
    # eingeschraenkte Scope (siehe api_clients).
    if ctx.api_scopes is not None:
        return

    service = MfaService(db=get_service_client())
    pfad = request.url.path

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

    if faktoren:
        # Der Nutzer HAT einen zweiten Faktor, dieses Token hat ihn aber nicht
        # geloest. Das ist entweder der direkte GoTrue-Login mit blossem
        # Passwort oder ein gestohlenes aal1-Token. Beides ist zu.
        log.warning(
            "mfa_aal1_trotz_faktor",
            user_id=ctx.user_id,
            pfad=pfad,
            faktoren=len(faktoren),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Zweiter Faktor erforderlich.",
            headers={"X-MFA-Required": "challenge"},
        )

    # Ab hier: kein Faktor vorhanden. Pflicht nur fuer admin/co_admin — und die
    # Rolle kommt aus der DB, nicht aus dem JWT (Wurzel 7: eine entzogene
    # Rolle darf nicht bis zum Token-Ablauf weitergelten).
    try:
        rolle = service.rolle_aus_db(ctx.user_id)
        pflicht = service.pflicht_pruefen(ctx.user_id, rolle=rolle)
    except MfaError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="2FA-Status nicht prüfbar.",
        ) from exc
    except (ValueError, TypeError) as exc:
        # Ein kaputter Zeitstempel in mfa_enforcement (naiv/unparsbar) darf
        # KEIN 500 werden: dieser Zweig laeuft fuer pflichtige Konten OHNE
        # Faktor — ein 500 hier traefe auch /auth/mfa/*, und das Konto koennte
        # die geforderte 2FA nicht mehr einrichten (Aussperrung durch einen
        # Datenfehler). 503 sagt ehrlich „gerade nicht pruefbar" und laesst
        # nichts durch (Wurzel 5). `_zeit` faengt den Normalfall bereits ab;
        # das hier ist der Backstop, damit ein neuer Aufrufer die Klasse nicht
        # versehentlich wieder oeffnet.
        log.error("mfa_status_unlesbar", user_id=ctx.user_id, error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="2FA-Status nicht prüfbar.",
        ) from exc

    if not pflicht.pflichtig:
        # Optional fuer alle anderen Rollen — wer keinen Faktor hat, kommt
        # durch. Wer einen hat, ist oben schon abgefangen worden.
        return

    if not pflicht.erzwingen:
        # Noch in der Einrichtungsfrist: durchlassen, aber bei JEDEM Request
        # sichtbar auffordern. Der Header ist die Anbindung fuer die
        # Oberflaeche (der parallele Frontend-Auftrag baut den Banner dagegen).
        if pflicht.grace_until is not None:
            request.state.mfa_enrollment_required = pflicht.grace_until.isoformat()
        return

    # Frist abgelaufen, kein Faktor: zu — ausser auf den Pfaden, die man
    # braucht, um die 2FA ueberhaupt einzurichten. Ohne diese Ausnahme waere
    # das Konto endgueltig unbenutzbar (Aussperr-Schutz).
    if _ist_enrollment_pfad(pfad):
        request.state.mfa_enrollment_required = "overdue"
        return

    log.warning("mfa_enrollment_erzwungen", user_id=ctx.user_id, pfad=pfad)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=(
            "Für diese Rolle ist eine Zwei-Faktor-Authentifizierung "
            "verpflichtend. Bitte richte sie jetzt ein."
        ),
        headers={"X-MFA-Required": "enroll"},
    )
