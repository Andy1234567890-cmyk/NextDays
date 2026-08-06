"""Coolify-Deploy-Zustand nach `public.deploy_spiegel` schreiben.

WARUM ES DAS GIBT:
Das Backoffice soll den Deploy live sehen, ohne zu pollen (Hausregel: alles
Realtime). Ein Supabase-Abo braucht eine Tabelle in UNSERER DB — die Deploys
liegen aber in Coolifys eigener Postgres. Also fragt EIN Prozess (der Worker)
Coolify und schreibt Änderungen hierher; das Backoffice abonniert nur noch die
Tabelle. Aus „jeder Browser pollt" wird „ein Worker fragt, alle bekommen Push".

Quelle der Wahrheit bleibt Coolify. Diese Tabelle ist der Übertragungsweg,
kein eigener Zustand — deshalb wird sie fortgeschrieben, nicht angesammelt.
"""
from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client

from src.core.config import get_settings
from src.core.logging import get_logger

from . import coolify
from .deploy_service import DeployService

log = get_logger(__name__)

_TABELLE = "deploy_spiegel"
# Status, bei denen eng nachgesehen werden muss (es tut sich gerade etwas).
_AKTIV = frozenset({"queued", "in_progress"})


def _zeit_text(wert: datetime | None) -> str | None:
    return wert.isoformat() if wert else None


def spiegel_aktualisieren(db: Client) -> bool:
    """Einmal Coolify lesen und den Spiegel fortschreiben.

    Rückgabe: True, wenn gerade etwas baut — der Worker taktet dann enger.
    Ohne Coolify-Zugang passiert nichts (kein Fehler, keine erfundenen Zeilen).
    """
    if not get_settings().coolify_configured:
        return False

    uebersicht = DeployService().uebersicht()
    jetzt = datetime.now(UTC).isoformat()
    zeilen: list[dict] = []
    for app in uebersicht.apps:
        letzter = app.letzter
        zeilen.append(
            {
                "anwendung_uuid": app.uuid,
                "name": app.name,
                # Ohne bekannten Deploy NICHT "erfolgreich" raten (Wurzel 4).
                "status": letzter.status if letzter else "unbekannt",
                "deployment_uuid": letzter.deployment_uuid if letzter else None,
                "commit": letzter.commit if letzter else None,
                "commit_nachricht": letzter.commit_nachricht if letzter else None,
                "gestartet_at": _zeit_text(letzter.gestartet_at) if letzter else None,
                "beendet_at": _zeit_text(letzter.beendet_at) if letzter else None,
                "geprueft_at": jetzt,
                "aktualisiert_at": jetzt,
            }
        )

    if not zeilen:
        return False

    # Ein upsert je Lauf: die Anwendungs-UUID ist der Primärschlüssel, jede
    # Zeile wird fortgeschrieben. Realtime liefert die Änderung an alle
    # offenen Backoffice-Seiten.
    db.table(_TABELLE).upsert(zeilen, on_conflict="anwendung_uuid").execute()

    aktiv = uebersicht.aktiv or any(z["status"] in _AKTIV for z in zeilen)
    log.debug("deploy_spiegel_geschrieben", zeilen=len(zeilen), aktiv=aktiv)
    return aktiv


def log_zeilen_holen(deployment_uuid: str) -> list[dict]:
    """Build-Log für einen Deploy (nur Weiterreichung, kein Spiegel).

    Logs werden bewusst NICHT gespiegelt: sie sind groß (50 KB und mehr je
    Deploy) und werden selten gebraucht — sie live zu holen ist billiger, als
    sie dauerhaft zu halten.
    """
    _, roh = coolify.build_log(deployment_uuid)
    return roh
