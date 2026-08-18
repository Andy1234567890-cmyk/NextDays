"""Der Riegel für deaktivierte Zugänge: gilt ein Token noch, wenn der Zugang aus ist?

Aufgerufen zentral aus `core.security.get_current_user` — auf JEDEM geschützten
Endpunkt und unabhängig davon, wie das Token entstanden ist.

WARUM ES DIESEN RIEGEL BRAUCHT (Wurzel 7):
Beim Deaktivieren setzt `AccountService` zwei Dinge: `users.deactivated_at` und
einen GoTrue-`ban_duration`. Der Bann verhindert NEUE Anmeldungen und das
Erneuern des Refresh-Tokens — aber ein Access-Token, das die Person eine Minute
vorher geholt hat, bleibt bis zu seiner Restlaufzeit kryptografisch gültig.
Ohne diesen Riegel hätte ein gerade gesperrter Mitarbeiter also noch eine
Stunde vollen Zugriff. Genau in dieser Stunde will man ihn aber sperren.

Geprüft wird deshalb — wie beim AAL2-Riegel — das TOKEN und nicht der
Login-Vorgang: jeder geschützte Endpunkt bekommt sein `ctx` von
`get_current_user`, also kommt niemand hier vorbei.

WAS DIESER RIEGEL NICHT LEISTET:
Er schützt den FastAPI-Layer. Der PostgREST-/Realtime-Direktpfad
(`/rest/v1/...` mit gültigem JWT + anon-Key) läuft nicht durch FastAPI — dort
wirkt die RLS. Deshalb ist der GoTrue-Bann nicht optional, sondern der Teil, der
diesen Weg schließt: er entzieht dem Refresh-Token die Verlängerung, sodass das
Zeitfenster mit dem alten Access-Token abläuft und sich kein neues holen lässt.

ZWEI EBENEN, EIN RIEGEL (0405):
Geprüft wird der ZUGANG (`users.deactivated_at`, 0356) UND der BETRIEB
(`tenants.deactivated_at`, 0405). Ein gesperrter Betrieb sperrt damit alle
seine Nutzer auf einmal — auch solche, die er nach der Sperre noch anlegen
würde. Die Betriebs-Sperre kommt zuerst, weil sie die umfassendere Aussage ist.

Bewusst in einem eigenen Modul (wie `mfa_gate`): `core.security` darf
`features.auth` nicht auf Modulebene importieren (Zirkel), und der Riegel soll
für sich testbar sein.
"""
from __future__ import annotations

from fastapi import HTTPException, status

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import get_service_client

from .account_service import AccountService

log = get_logger("nextdays.auth.aktiv_gate")


def aktiv_zugang_pruefen(ctx: AuthContext) -> None:
    """Wirft 401, wenn der Zugang dieses Tokens deaktiviert ist.

    Ein API-Client-Token (Client-Credentials) wird übersprungen: dahinter steht
    kein `users`-Zugang, den man deaktivieren könnte — seine Sperre ist das
    Widerrufen des Secrets bzw. des Clients selbst.

    Ein Lesefehler der DB ist KEIN „gesperrt": das würde bei einem
    Datenbankausfall jeden Nutzer aussperren und die Ursache als Kontosperre
    ausgeben. Er wird als Störung gemeldet (503) — restriktiv, aber wahr
    (Wurzel 4/5).
    """
    if ctx.api_scopes is not None:
        return
    _betrieb_pruefen(ctx)
    dienst = AccountService(
        anon_client=get_service_client(), service_client=get_service_client()
    )
    try:
        gesperrt = dienst.ist_gesperrt(ctx.user_id)
    except Exception as exc:  # noqa: BLE001 — Störung ≠ Sperre, sichtbar melden
        log.warning(
            "aktiv_gate_lesefehler", user_id=ctx.user_id, error=str(exc)[:200]
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Konto konnte nicht geprüft werden.",
        ) from exc
    if gesperrt:
        log.info("aktiv_gate_abgewiesen", user_id=ctx.user_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Dieser Zugang ist deaktiviert.",
        )


def _betrieb_pruefen(ctx: AuthContext) -> None:
    """Wirft 401, wenn der BETRIEB dieses Tokens gesperrt ist (0405).

    Trägt das Token keinen Betrieb (Plattform-Zugänge), gibt es nichts zu
    prüfen. Der Lesefehler wird wie beim Zugang behandelt: Störung (503), nicht
    Sperre (401) — ein Datenbankausfall darf nicht als Kontosperre erscheinen
    (Wurzel 4/5).

    Der Grund der Sperre steht bewusst NICHT in der Antwort: er ist für das
    Backoffice erfasst, nicht für den Gesperrten (0405).
    """
    if not ctx.tenant_id:
        return
    try:
        res = (
            get_service_client()
            .table("tenants")
            .select("deactivated_at")
            .eq("id", ctx.tenant_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001 — Störung ≠ Sperre, sichtbar melden
        log.warning(
            "aktiv_gate_betrieb_lesefehler",
            tenant_id=ctx.tenant_id,
            error=str(exc)[:200],
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Betrieb konnte nicht geprüft werden.",
        ) from exc
    rows = res.data or []
    if rows and rows[0].get("deactivated_at"):
        log.info(
            "aktiv_gate_betrieb_abgewiesen",
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Dieser Betrieb ist gesperrt.",
        )
