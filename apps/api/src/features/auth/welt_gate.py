"""Der Riegel zwischen den Auth-Welten: gehört dieses Konto überhaupt ins PMS?

Es gibt EINE Supabase-Auth (`auth.users`) für vier Welten, die fachlich
nichts miteinander zu tun haben: den Betrieb (Tenant, `app_metadata.tenant_id`),
das Backoffice des Betreibers (`platform_backoffice`), das Partnerprogramm
(`affiliate`, ADR-0020) und den Marktplatz-Gast (`portal_guest`). GoTrue prüft
nur E-Mail und Passwort; welche Welt ein Konto betreten darf, muss der Server
selbst entscheiden.

WAS PASSIERT IST (12.09.2026): Eine frisch freigegebene Partnerin meldete sich
statt unter partner.mynextdays.com im PMS an. `/auth/login` gab ihr eine
Session, `get_current_user` setzte `tenant_id`/`role` auf `None` statt
abzuweisen, `/auth/me` lieferte eine Rolle `None`, das Frontend zeichnete
daraus das Mitarbeiter-Layout, und jeder Rechte-Guard antwortete 403
„Unzureichende Berechtigung." Kein Datenleck (die Guards hielten), aber ein
falscher Zustand mit einer Fehlermeldung, die niemandem sagt, was los ist.

Die Partner-Welt war nur in EINE Richtung getrennt: `get_current_affiliate`
verlangt ausdrücklich `affiliate = true`; der Betriebs-Pfad verlangte nichts.

ZWEI STELLEN, EIN RIEGEL (Wurzel 7): geprüft wird beim Login (klare Meldung,
Weg zur richtigen Welt) UND am Token in `get_current_user`, weil der direkte
GoTrue-Login (`/auth/v1/token` mit anon-Key) den App-Login umgeht. Beide lesen
dieselbe Funktion, damit es nur eine Auslegung davon gibt, wer hineindarf.

Bewusst in einem eigenen Modul (wie `aktiv_gate`/`mfa_gate`): `core.security`
darf `features.auth` nicht auf Modulebene importieren (Zirkel).
"""
from __future__ import annotations

from typing import Literal

from fastapi import HTTPException, status

from src.core.config import Settings, get_settings
from src.core.logging import get_logger

log = get_logger("nextdays.auth.welt_gate")

Welt = Literal["betrieb", "backoffice", "partner", "gast", "unbekannt"]


def welt_bestimmen(app_meta: object) -> Welt:
    """Welche Welt kennzeichnet dieses `app_metadata`?

    Der Betrieb gewinnt: ein Konto kann zusätzlich Partner sein (ein
    Eigentümer mit Bewerbung, `login_konto.py`), es bleibt dann im PMS ein
    Betriebskonto. Das Backoffice ebenso. Alles ohne diese beiden Kennungen
    gehört nicht ins PMS — auch ein leeres `app_metadata` nicht (Wurzel 5:
    fail-closed, nie „im Zweifel Betrieb").
    """
    if not isinstance(app_meta, dict):
        return "unbekannt"
    if isinstance(app_meta.get("tenant_id"), str) and app_meta.get("tenant_id"):
        return "betrieb"
    if app_meta.get("platform_backoffice") is True:
        return "backoffice"
    if app_meta.get("affiliate") is True:
        return "partner"
    if app_meta.get("portal_guest") is True:
        return "gast"
    return "unbekannt"


def pms_abweisung(app_meta: object, settings: Settings | None = None) -> str | None:
    """`None`, wenn das Konto ins PMS darf — sonst die Meldung für den Nutzer.

    Die Meldung nennt den richtigen Weg, wenn er konfiguriert ist
    (`PARTNER_BASE_URL`). Fehlt die Adresse, bleibt die Aussage wahr, nur ohne
    Link — kein erfundener Wert (Wurzel 4). Der Mangel wird laut geloggt.
    """
    welt = welt_bestimmen(app_meta)
    if welt in ("betrieb", "backoffice"):
        return None
    if welt == "partner":
        basis = ((settings or get_settings()).partner_base_url or "").strip().rstrip("/")
        if not basis:
            log.error(
                "partner_base_url_fehlt",
                hinweis="PARTNER_BASE_URL setzen — die Abweisung nennt sonst keinen Weg.",
            )
            return (
                "Das ist ein Partner-Konto. Bitte im Partner-Dashboard anmelden, "
                "nicht in der Verwaltung."
            )
        return f"Das ist ein Partner-Konto. Bitte im Partner-Dashboard anmelden: {basis}/"
    if welt == "gast":
        return (
            "Das ist ein Gäste-Konto von myBestDays. Bitte auf dem Marktplatz "
            "anmelden, nicht in der Verwaltung."
        )
    return "Dieses Konto gehört zu keinem Betrieb."


def pms_zugang_pruefen(user_id: str, app_meta: object) -> None:
    """Wirft 403, wenn das Token nicht in die Betriebs-/Backoffice-Welt gehört.

    Aufgerufen zentral aus `core.security.get_current_user`, VOR allen Riegeln,
    die die DB brauchen: der Befund steht im Token, kostet nichts und macht
    jede weitere Prüfung eines fremden Kontos überflüssig.
    """
    meldung = pms_abweisung(app_meta)
    if meldung is None:
        return
    log.warning(
        "welt_gate_abgewiesen",
        user_id=user_id,
        welt=welt_bestimmen(app_meta),
    )
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=meldung)
