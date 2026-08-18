"""Der Nur-Lese-Riegel für den öffentlichen Demo-Mandanten (0407).

Aufgerufen zentral aus `core.security.get_current_user` — auf JEDEM geschützten
Endpunkt und unabhängig davon, welche Rolle das Token trägt.

WOZU ES DIESEN RIEGEL BRAUCHT:
Die Marketing-Seite führt Besucher mit „Demo ansehen" in die ECHTE Anwendung
statt in einen eingefrorenen Schnappschuss (Begründung und Anbietervergleich in
`docs/ANALYSE-storylane-technik.md`). Der Zugang dafür ist öffentlich — das
Passwort steht praktisch jedem zur Verfügung, der die Seite besucht. Er darf
deshalb nichts verändern können.

WARUM METHODE UND NICHT ROLLE:
Der naheliegende Weg wäre eine sechste Rolle `demo` mit leeren
Schreib-Capabilities. Gemessen am Bestand wäre das eine Lücke: von 536
schreibenden Routen tragen 201 einen Capability-Guard und 168 einen granularen,
aber **76 haben nur `get_current_user`** — gar keine Rollenprüfung. Darunter
`PATCH /auth/account/password` und `DELETE /auth/account/users/{id}`. Ein
Besucher hätte damit das Passwort des Demo-Kontos ändern und die Demo für alle
anderen sperren können.

Dieser Riegel prüft stattdessen die HTTP-Methode. Das erfasst alle 536 Routen
auf einen Schlag — und jede, die künftig ohne Guard dazukommt, ist automatisch
mitgeschützt. Der Unterschied ist der zwischen einer Liste, die gepflegt werden
muss, und einer Regel, die gilt.

WAS DIESER RIEGEL NICHT LEISTET:
Er schützt den FastAPI-Layer. Der PostgREST-Direktpfad (`/rest/v1` mit gültigem
JWT und öffentlichem anon-Key) läuft nicht durch FastAPI — dort wirkt die RLS.
Das ist hier vertretbar, weil über alle 408 Migrationen KEIN einziges
`grant insert/update/delete` an `authenticated` besteht (251 Tabellen tragen
einen expliziten `revoke`, dazu ein `alter default privileges`-Backstop aus
0229). Die eine Ausnahme war `storybook_chat` — deren Policies schließen den
Demo-Mandanten seit 0407 aus.

WARUM 405 UND NICHT 403:
403 heißt „dir fehlt ein Recht" und lädt dazu ein, es zu erwerben. 405 („Method
Not Allowed") sagt, was zutrifft: dieser Zugang kennt schreibende Methoden
nicht. Die Oberfläche kann daraus einen ehrlichen Hinweis bauen („In der Demo
sind Änderungen abgeschaltet") statt einer Fehlermeldung, die nach einem Defekt
aussieht.

Bewusst in einem eigenen Modul (wie `mfa_gate` und `aktiv_gate`):
`core.security` darf `features.auth` nicht auf Modulebene importieren (Zirkel),
und der Riegel soll für sich testbar sein.
"""
from __future__ import annotations

from fastapi import HTTPException, status

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import get_service_client

log = get_logger("nextdays.auth.demo_gate")

# Lesende Methoden. HEAD und OPTIONS gehören dazu: das eine ist ein GET ohne
# Körper, das andere der CORS-Vorflug — beide verändern nichts, und ein
# blockierter Vorflug würde die Oberfläche im Browser lahmlegen, ohne etwas zu
# schützen.
LESENDE_METHODEN = frozenset({"GET", "HEAD", "OPTIONS"})

_ABGELEHNT = (
    "In der Vorführung sind Änderungen abgeschaltet. "
    "Alles lässt sich ansehen, nichts speichern."
)


def demo_schreibzugriff_pruefen(methode: str, ctx: AuthContext) -> None:
    """Wirft 405, wenn ein Demo-Mandant etwas zu ändern versucht.

    Die Prüfung kostet eine DB-Runde je SCHREIBENDER Anfrage — lesende gehen
    ohne Abfrage durch, und das ist der überwiegende Teil. Der Index aus 0407
    ist partiell auf `is_demo`, die Abfrage trifft also nur die eine Zeile.

    Ein Lesefehler ist KEIN „darf schreiben": bei einem Datenbankausfall wäre
    fail-open genau die falsche Richtung — dann könnte ein Besucher schreiben,
    weil die Prüfung nicht antwortet. Fail-CLOSED heißt hier 503 für den
    Schreibversuch (Wurzel 5); Lesen bleibt unberührt, die Demo funktioniert
    also weiter.

    Ein API-Client-Token (Client-Credentials) wird übersprungen: dahinter steht
    kein Demo-Besucher, sondern eine Integration mit eigenem Secret und
    eigenen Scopes.
    """
    if methode.upper() in LESENDE_METHODEN:
        return
    if ctx.api_scopes is not None:
        return
    if not ctx.tenant_id:
        return
    try:
        res = (
            get_service_client()
            .table("tenants")
            .select("is_demo")
            .eq("id", ctx.tenant_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001 — fail-closed, aber sichtbar
        log.warning(
            "demo_gate_lesefehler",
            tenant_id=ctx.tenant_id,
            error=str(exc)[:200],
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Zugang konnte nicht geprüft werden.",
        ) from exc
    rows = res.data or []
    if rows and rows[0].get("is_demo"):
        log.info(
            "demo_gate_abgewiesen",
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            methode=methode.upper(),
        )
        raise HTTPException(
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
            detail=_ABGELEHNT,
        )
