"""Coolify-Deploy-Zustand nach `public.deploy_spiegel` schreiben.

WARUM ES DAS GIBT:
Das Backoffice soll den Deploy live sehen, ohne zu pollen (Hausregel: alles
Realtime). Ein Supabase-Abo braucht eine Tabelle in UNSERER DB — die Deploys
liegen aber in Coolifys eigener Postgres. Also fragt EIN Prozess (der Worker)
Coolify und schreibt Änderungen hierher; das Backoffice abonniert nur noch die
Tabelle. Aus „jeder Browser pollt" wird „ein Worker fragt, alle bekommen Push".

Quelle der Wahrheit bleibt Coolify. Diese Tabelle ist der Übertragungsweg,
kein eigener Zustand — deshalb wird sie fortgeschrieben, nicht angesammelt.

ZWEI DINGE, DIE HIER LEICHT SCHIEFGEHEN — und deshalb ausdrücklich geregelt:

1. **Nicht bei jedem Tick schreiben.** Ein `upsert` ist immer ein UPDATE, auch
   wenn sich fachlich nichts geändert hat — und JEDES UPDATE erzeugt ein
   Realtime-Event. Bei 5 s Takt während eines Baus wäre das Dauerfeuer aus
   Ereignissen ohne Informationsgehalt, und jedes davon lässt das Backoffice
   neu laden. Deshalb wird der fachliche Teil der Zeile mit dem Ist-Stand
   VERGLICHEN und nur bei echter Abweichung geschrieben (`_FACHLICH`).
2. **`geprueft_at` trotzdem sichtbar halten.** „Wann haben wir zuletzt
   geschaut" muss weiterlaufen, sonst sieht ein hängender Worker aus wie
   „alles ruhig". Es läuft deshalb in einem eigenen, langsamen Takt mit
   (`GEPRUEFT_HEARTBEAT_SECONDS`) — ein Event alle paar Minuten statt alle
   5 s. Fachliche Änderungen schreiben es ohnehin mit.

Der GitHub-Rückstand (`deploy_rueckstand`) wird hier MITGESPIEGELT. Er stand
früher im Request-Pfad und war dessen teuerster Teil (ein `/compare` je
ausgerolltem Commit, 20 s Timeout). Im Worker kostet er einmal je Tick.
"""
from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

from supabase import Client

from src.core.config import get_settings
from src.core.logging import get_logger

from . import coolify
from .deploy_service import DeployService
from .schemas import DeployApp

log = get_logger(__name__)

_TABELLE = "deploy_spiegel"
# Status, bei denen eng nachgesehen werden muss (es tut sich gerade etwas).
_AKTIV = frozenset({"queued", "in_progress"})

# Spalten, die den FACHLICHEN Zustand ausmachen. Nur wenn sich hier etwas
# ändert, wird die Zeile geschrieben (und damit ein Realtime-Event ausgelöst).
# `geprueft_at`/`aktualisiert_at` stehen bewusst NICHT drin — sie beschreiben
# unsere Verarbeitung, nicht den Deploy (Wurzel 5b).
_FACHLICH = (
    "name",
    "status",
    "deployment_uuid",
    "commit",
    "commit_nachricht",
    "gestartet_at",
    "beendet_at",
    "deploy_id",
    "anwendung",
    "log_url",
    "laeuft",
    "rueckstand",
    "main_sha",
)

# So oft läuft `geprueft_at` auch ohne fachliche Änderung mit. Lang genug, dass
# es kein Event-Dauerfeuer ist; kurz genug, dass die Oberfläche einen stehen
# gebliebenen Worker binnen Minuten erkennt.
GEPRUEFT_HEARTBEAT_SECONDS = 5 * 60


def _zeit_text(wert: datetime | None) -> str | None:
    return wert.isoformat() if wert else None


def _vergleichbar(wert: object) -> object:
    """Einen Spaltenwert auf eine Form bringen, die sich stabil vergleichen lässt.

    Nötig, weil dieselbe Information aus der DB anders zurückkommt als wir sie
    hinschreiben: Zeitstempel als `+00:00` statt `Z`, JSONB mit anderer
    Schlüsselreihenfolge. Ohne Normalisierung würde JEDER Tick eine Änderung
    sehen, wo keine ist — genau das Dauerfeuer, das hier vermieden werden soll.
    """
    if isinstance(wert, str):
        # Zeitstempel-artig? Dann über datetime vergleichen, nicht als Text.
        try:
            return datetime.fromisoformat(wert.replace("Z", "+00:00"))
        except ValueError:
            return wert
    if isinstance(wert, (dict, list)):
        return json.dumps(wert, sort_keys=True, default=str)
    return wert


def _hat_sich_geaendert(neu: dict, alt: dict | None) -> bool:
    """Unterscheidet sich der fachliche Teil vom Ist-Stand in der DB?"""
    if alt is None:
        return True
    return any(
        _vergleichbar(neu.get(spalte)) != _vergleichbar(alt.get(spalte))
        for spalte in _FACHLICH
    )


def _geprueft_faellig(alt: dict | None, jetzt: datetime) -> bool:
    """Ist der Heartbeat von `geprueft_at` wieder dran?"""
    if alt is None:
        return True
    roh = alt.get("geprueft_at")
    if not isinstance(roh, str):
        return True
    try:
        zuletzt = datetime.fromisoformat(roh.replace("Z", "+00:00"))
    except ValueError:
        return True
    return jetzt - zuletzt >= timedelta(seconds=GEPRUEFT_HEARTBEAT_SECONDS)


def _fachliche_zeile(app: DeployApp) -> dict:
    """Eine `DeployApp` in die Spalten des Spiegels übersetzen."""
    letzter = app.letzter
    rueckstand = app.rueckstand
    return {
        "anwendung_uuid": app.uuid,
        "name": app.name,
        # Ohne bekannten Deploy NICHT "erfolgreich" raten (Wurzel 4).
        "status": letzter.status if letzter else "unbekannt",
        "deployment_uuid": letzter.deployment_uuid if letzter else None,
        "commit": letzter.commit if letzter else None,
        "commit_nachricht": letzter.commit_nachricht if letzter else None,
        "gestartet_at": _zeit_text(letzter.gestartet_at) if letzter else None,
        "beendet_at": _zeit_text(letzter.beendet_at) if letzter else None,
        "deploy_id": letzter.id if letzter else None,
        "anwendung": letzter.anwendung if letzter else None,
        "log_url": letzter.log_url if letzter else None,
        "laeuft": app.laeuft,
        # Der teure GitHub-Teil, einmal je Tick statt einmal je Seitenaufbau.
        # None (nicht {}) heißt „nicht ermittelt" — kein „nichts offen".
        "rueckstand": rueckstand.model_dump(mode="json") if rueckstand else None,
        "main_sha": None,  # wird unten aus der Übersicht gesetzt
    }


def _ist_stand(db: Client) -> dict[str, dict]:
    """Aktueller Inhalt des Spiegels, nach Anwendungs-UUID."""
    antwort = db.table(_TABELLE).select("*").execute()
    return {
        zeile["anwendung_uuid"]: zeile
        for zeile in (antwort.data or [])
        if isinstance(zeile.get("anwendung_uuid"), str)
    }


def spiegel_aktualisieren(db: Client) -> bool:
    """Einmal Coolify lesen und den Spiegel fortschreiben.

    Rückgabe: True, wenn gerade etwas baut — der Worker taktet dann enger.
    Ohne Coolify-Zugang passiert nichts (kein Fehler, keine erfundenen Zeilen)
    — das wird aber PROTOKOLLIERT, siehe unten.
    """
    if not get_settings().coolify_configured:
        # Wurzel 5: nicht stumm aussteigen. Genau dieses stille `return False`
        # hat einen leeren Spiegel stundenlang unbemerkt gelassen. `warning`,
        # weil ein Backoffice mit totem Deploy-Monitor ein Betriebsmangel ist —
        # und nicht im Sekundentakt, weil der Worker hier sofort zurückkommt
        # und der Ruhetakt (60 s) gilt.
        log.warning(
            "deploy_spiegel_uebersprungen",
            grund="COOLIFY_API_URL/COOLIFY_TOKEN nicht gesetzt",
        )
        return False

    uebersicht = DeployService().uebersicht_von_coolify()
    jetzt = datetime.now(UTC)
    jetzt_text = jetzt.isoformat()
    alt_je_uuid = _ist_stand(db)

    zu_schreiben: list[dict] = []
    geaendert = 0
    for app in uebersicht.apps:
        zeile = _fachliche_zeile(app)
        zeile["main_sha"] = uebersicht.main_sha
        alt = alt_je_uuid.get(app.uuid)
        fachlich_neu = _hat_sich_geaendert(zeile, alt)
        if not fachlich_neu and not _geprueft_faellig(alt, jetzt):
            # Nichts passiert und der Heartbeat ist noch nicht dran: NICHT
            # schreiben. Jedes UPDATE wäre ein Realtime-Event ohne Inhalt.
            continue
        zeile["geprueft_at"] = jetzt_text
        # `aktualisiert_at` nur bei echter fachlicher Änderung fortschreiben —
        # sonst behält die Zeile ihren alten Wert. Genau dieser Unterschied
        # macht „läuft, aber es tut sich nichts" sichtbar.
        zeile["aktualisiert_at"] = (
            jetzt_text if fachlich_neu else (alt or {}).get("aktualisiert_at")
        )
        if fachlich_neu:
            geaendert += 1
        zu_schreiben.append(zeile)

    aktiv = uebersicht.aktiv or any(
        (a.letzter.status if a.letzter else "") in _AKTIV for a in uebersicht.apps
    )

    if not zu_schreiben:
        # Der Normalfall im Ruhezustand — auf debug, sonst wäre das Log voll.
        log.debug("deploy_spiegel_unveraendert", apps=len(uebersicht.apps))
        return aktiv

    # Ein upsert je Lauf: die Anwendungs-UUID ist der Primärschlüssel, jede
    # Zeile wird fortgeschrieben. Realtime liefert die Änderung an alle
    # offenen Backoffice-Seiten.
    db.table(_TABELLE).upsert(zu_schreiben, on_conflict="anwendung_uuid").execute()

    # Auf INFO sichtbar, aber nur wenn wirklich geschrieben wurde: so sieht man
    # im Betrieb, dass der Job arbeitet, ohne dass er das Log zuspammt.
    log.info(
        "deploy_spiegel_geschrieben",
        zeilen=len(zu_schreiben),
        fachlich_geaendert=geaendert,
        aktiv=aktiv,
    )
    return aktiv


def log_zeilen_holen(deployment_uuid: str) -> list[dict]:
    """Build-Log für einen Deploy (nur Weiterreichung, kein Spiegel).

    Logs werden bewusst NICHT gespiegelt: sie sind groß (50 KB und mehr je
    Deploy) und werden selten gebraucht — sie live zu holen ist billiger, als
    sie dauerhaft zu halten.
    """
    _, roh = coolify.build_log(deployment_uuid)
    return roh
