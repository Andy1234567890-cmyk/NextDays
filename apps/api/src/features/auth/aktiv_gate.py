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
