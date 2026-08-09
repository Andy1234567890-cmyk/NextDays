"""Deploy-Monitor: Coolify-Rohdaten in die Sicht des Backoffice übersetzen.

ZWEI WEGE, EINE ÜBERSETZUNG:

* `uebersicht_von_coolify()` fragt Coolify (und GitHub) live. Das ist teuer —
  ein Aufruf für die laufenden Deploys, einer JE nicht laufender App für den
  letzten Stand, dazu `watch_paths` und der GitHub-`/compare` je ausgerolltem
  Commit. Diesen Weg geht nur noch der WORKER, einmal je Tick.
* `uebersicht_aus_spiegel(db)` liest denselben Zustand aus
  `public.deploy_spiegel` — ein Query, Millisekunden. Diesen Weg geht der
  Request-Pfad des Backoffice.

WARUM DIE TRENNUNG: Das Backoffice abonniert `deploy_spiegel` per Realtime und
lädt bei jedem Event neu. Solange der Lesepfad live Coolify fragte, löste jedes
Event eine mehrsekündige serielle HTTP-Kette aus — während eines Baus schreibt
der Worker alle 5 s, also Dauerfeuer mit Sekunden-Roundtrip. Genau das war das
„ruckelt / hängt hinterher". Seit dem Umbau sind Ereignis-Quelle und
Daten-Quelle DIESELBE Tabelle.

Quelle der Wahrheit bleibt Coolify; der Spiegel ist der Übertragungsweg.

Welche Anwendungen überwacht werden, steht in `coolify_apps.txt` NEBEN diesem
Modul. Die führende Quelle bleibt `scripts/ci/coolify-apps.txt` (dort stehen
zusätzlich die watch_paths für CI-Build und CI-Deploy) — die liegt aber im
Repo-Root und damit außerhalb des Docker-Build-Kontexts von `apps/api`: im
Container existiert sie nicht (live geprüft 06.08.2026, der Import stürzte mit
IndexError ab). Deshalb die Kopie im Slice; `scripts/ci/apps-liste-pruefen.sh`
hält beide in der CI deckungsgleich.
"""
from __future__ import annotations

from datetime import datetime
from functools import lru_cache
from pathlib import Path

from pydantic import ValidationError
from supabase import Client

from src.core.logging import get_logger

from . import coolify, deploy_rueckstand
from .schemas import (
    DeployApp,
    DeployEintrag,
    DeployLog,
    DeployLogZeile,
    DeployRueckstand,
    DeployUebersicht,
    DeployVerlauf,
)

log = get_logger(__name__)

# Neben diesem Modul — geht mit ins Image, anders als der Repo-Root.
_APPS_DATEI = Path(__file__).resolve().parent / "coolify_apps.txt"

# Status, die Coolify für „läuft gerade" verwendet.
_AKTIV = frozenset({"queued", "in_progress"})

# Der Spiegel (Migration 0294/0345) — die Lesequelle des Request-Pfads.
_TABELLE = "deploy_spiegel"


@lru_cache(maxsize=1)
def ueberwachte_apps() -> tuple[tuple[str, str], ...]:
    """(uuid, name) je Anwendung, aus der geteilten CI-Liste.

    Format je Zeile: `uuid|name|pfad-präfixe`. Kommentare beginnen mit `#`.
    Fehlt die Datei, ist das ein Auslieferungsfehler → leere Liste, und der
    Monitor sagt das sichtbar, statt Anwendungen zu erfinden (Wurzel 4).
    """
    if not _APPS_DATEI.is_file():
        log.warning("coolify-apps.txt nicht gefunden: %s", _APPS_DATEI)
        return ()
    apps: list[tuple[str, str]] = []
    for zeile in _APPS_DATEI.read_text(encoding="utf-8").splitlines():
        zeile = zeile.strip()
        if not zeile or zeile.startswith("#"):
            continue
        teile = zeile.split("|")
        if len(teile) < 2:
            continue
        uuid, name = teile[0].strip(), teile[1].strip()
        if uuid and name:
            apps.append((uuid, name))
    return tuple(apps)


def _zeit(wert: object) -> datetime | None:
    """Coolify liefert ISO-Strings; unlesbare Werte werden None, nicht 'jetzt'."""
    if not isinstance(wert, str) or not wert.strip():
        return None
    try:
        return datetime.fromisoformat(wert.replace("Z", "+00:00"))
    except ValueError:
        return None


def _eintrag(roh: dict, *, name_fallback: str = "") -> DeployEintrag:
    """Eine Coolify-Zeile in unser Schema übersetzen."""
    roh_id = roh.get("id")
    return DeployEintrag(
        id=roh_id if isinstance(roh_id, int) else None,
        deployment_uuid=roh.get("deployment_uuid") or None,
        anwendung=roh.get("application_name") or name_fallback or "unbekannt",
        anwendung_uuid=roh.get("application_uuid") or None,
        status=roh.get("status") or "unbekannt",
        commit=roh.get("commit") or None,
        commit_nachricht=roh.get("commit_message") or None,
        gestartet_at=_zeit(roh.get("created_at")),
        beendet_at=_zeit(roh.get("finished_at")),
        log_url=roh.get("deployment_url") or None,
    )


def _spiegel_eintrag(zeile: dict, *, name_fallback: str) -> DeployEintrag | None:
    """Eine `deploy_spiegel`-Zeile zurück in einen DeployEintrag.

    None, wenn die Zeile gar keinen Deploy beschreibt: `status='unbekannt'`
    ohne `deployment_uuid` heißt „diese App hat bei Coolify keinen Deploy" —
    dafür ist im Schema `letzter=None` vorgesehen, kein leerer Eintrag.
    """
    status_wert = zeile.get("status")
    if not isinstance(status_wert, str) or not status_wert:
        return None
    if status_wert == "unbekannt" and not zeile.get("deployment_uuid"):
        return None
    roh_id = zeile.get("deploy_id")
    anwendung = zeile.get("anwendung")
    return DeployEintrag(
        id=roh_id if isinstance(roh_id, int) else None,
        deployment_uuid=zeile.get("deployment_uuid") or None,
        anwendung=anwendung or name_fallback or "unbekannt",
        anwendung_uuid=zeile.get("anwendung_uuid") or None,
        status=status_wert,
        commit=zeile.get("commit") or None,
        commit_nachricht=zeile.get("commit_nachricht") or None,
        gestartet_at=_zeit(zeile.get("gestartet_at")),
        beendet_at=_zeit(zeile.get("beendet_at")),
        log_url=zeile.get("log_url") or None,
    )


def _spiegel_rueckstand(roh: object) -> DeployRueckstand | None:
    """Das JSONB `rueckstand` zurück ins Schema.

    Fehlt es oder ist es unlesbar, wird NICHTS geraten (Wurzel 4): None heißt
    „der Worker hat den Rückstand (noch) nicht ermittelt". Eine leere
    `DeployRueckstand()` hieße dagegen „nichts offen" — eine Aussage, die wir
    ohne GitHub-Abruf nicht treffen dürfen.
    """
    if not isinstance(roh, dict) or not roh:
        return None
    try:
        return DeployRueckstand.model_validate(roh)
    except ValidationError as exc:
        # Wurzel 5: nicht still verschlucken. Der Spiegel trägt dann etwas,
        # das unser Schema nicht kennt — das ist ein Fehler, kein Normalfall.
        log.warning("deploy_spiegel_rueckstand_unlesbar", error=str(exc)[:200])
        return None


class DeployService:
    """Übersetzt den Deploy-Zustand für das Backoffice.

    Zwei Quellen, bewusst getrennt (siehe Modul-Docstring): `…_von_coolify`
    für den Worker-Tick, `…_aus_spiegel` für den Request-Pfad.
    """

    def uebersicht_von_coolify(self) -> DeployUebersicht:
        """Je überwachter Anwendung der letzte bzw. laufende Deploy — und was
        seither auf `main` dazugekommen ist, das GENAU DIESE App betrifft.

        TEUER (viele serielle HTTP-Aufrufe gegen Coolify und GitHub). Nur für
        den Worker-Tick gedacht; der Request-Pfad nimmt `uebersicht_aus_spiegel`.
        """
        apps = ueberwachte_apps()
        # Ein Aufruf für ALLE laufenden Deploys statt einer je App.
        laufend_je_uuid: dict[str, dict] = {}
        for roh in coolify.laufende_deploys():
            uuid = roh.get("application_uuid")
            if isinstance(uuid, str) and uuid not in laufend_je_uuid:
                laufend_je_uuid[uuid] = roh

        watch_je_uuid = self._watch_paths()
        sammler = deploy_rueckstand.Sammler()

        ergebnis: list[DeployApp] = []
        aktiv = False
        for uuid, name in apps:
            laufend = laufend_je_uuid.get(uuid)
            if laufend is not None:
                eintrag = _eintrag(laufend, name_fallback=name)
                laeuft = True
            else:
                verlauf = coolify.verlauf(uuid, limit=1)
                eintrag = _eintrag(verlauf[0], name_fallback=name) if verlauf else None
                laeuft = bool(eintrag and eintrag.status in _AKTIV)
            aktiv = aktiv or laeuft
            ergebnis.append(
                DeployApp(
                    uuid=uuid,
                    name=name,
                    laeuft=laeuft,
                    letzter=eintrag,
                    rueckstand=sammler.fuer(
                        eintrag.commit if eintrag else None, watch_je_uuid.get(uuid)
                    ),
                )
            )
        kopf = deploy_rueckstand.main_sha() if sammler.einsatzbereit else None
        return DeployUebersicht(
            apps=ergebnis,
            aktiv=aktiv,
            main_sha=kopf,
            main_kurz_sha=kopf[:8] if kopf else None,
        )

    @staticmethod
    def uebersicht_aus_spiegel(db: Client) -> DeployUebersicht:
        """Denselben Zustand aus `public.deploy_spiegel` — ein Query.

        Der Request-Pfad des Backoffice. Weil das Frontend genau diese Tabelle
        abonniert, ist damit die Ereignis-Quelle auch die Daten-Quelle: ein
        Realtime-Event löst ein Neuladen aus, das Millisekunden dauert statt
        Sekunden.

        Die geführte App-Liste bleibt die Reihenfolge und die Vollständigkeit:
        eine Anwendung, die wir führen, für die der Worker aber noch keine
        Zeile geschrieben hat, erscheint mit `letzter=None` und
        `geprueft_at=None` — sichtbar leer, statt stillschweigend zu fehlen
        (Wurzel 4).
        """
        antwort = db.table(_TABELLE).select("*").execute()
        je_uuid: dict[str, dict] = {}
        for zeile in antwort.data or []:
            uuid = zeile.get("anwendung_uuid")
            if isinstance(uuid, str):
                je_uuid[uuid] = zeile

        apps: list[DeployApp] = []
        aktiv = False
        kopf: str | None = None
        for uuid, name in ueberwachte_apps():
            zeile = je_uuid.get(uuid)
            if zeile is None:
                apps.append(DeployApp(uuid=uuid, name=name))
                continue
            laeuft = bool(zeile.get("laeuft"))
            aktiv = aktiv or laeuft
            # main_sha ist je Zeile gespiegelt, gilt aber für den ganzen
            # Vergleich — der erste vorhandene Wert genügt.
            if kopf is None and isinstance(zeile.get("main_sha"), str):
                kopf = zeile["main_sha"]
            apps.append(
                DeployApp(
                    uuid=uuid,
                    name=zeile.get("name") or name,
                    laeuft=laeuft,
                    letzter=_spiegel_eintrag(zeile, name_fallback=name),
                    rueckstand=_spiegel_rueckstand(zeile.get("rueckstand")),
                    geprueft_at=_zeit(zeile.get("geprueft_at")),
                    aktualisiert_at=_zeit(zeile.get("aktualisiert_at")),
                )
            )
        return DeployUebersicht(
            apps=apps,
            aktiv=aktiv,
            main_sha=kopf,
            main_kurz_sha=kopf[:8] if kopf else None,
            # Der älteste Blick über alle Zeilen: steht DER still, ist der
            # Spiegel veraltet. Der jüngste würde eine einzelne fortgeschriebene
            # Zeile als „alles frisch" ausgeben.
            spiegel_geprueft_at=min(
                (a.geprueft_at for a in apps if a.geprueft_at is not None),
                default=None,
            ),
        )

    @staticmethod
    def _watch_paths() -> dict[str, str]:
        """uuid → watch_paths, in EINEM Aufruf für alle Anwendungen.

        Fällt der Abruf aus, bleibt die Zuordnung leer: dann gilt für jede App
        „keine Pfade" und damit „kein Commit betrifft mich". Das ist die sichere
        Richtung — es zeigt keinen Rückstand an, statt einen zu behaupten, der
        auf geratenen Pfaden beruht (Wurzel 4).
        """
        try:
            roh = coolify.anwendungen()
        except Exception as exc:  # noqa: BLE001 — Übersicht darf nicht kippen
            log.warning("coolify_anwendungen_fehlgeschlagen: %s", str(exc)[:200])
            return {}
        treffer: dict[str, str] = {}
        for a in roh:
            if not isinstance(a, dict):
                continue
            uuid, pfade = a.get("uuid"), a.get("watch_paths")
            if isinstance(uuid, str) and isinstance(pfade, str):
                treffer[uuid] = pfade
        return treffer

    def verlauf(self, anwendung_uuid: str, limit: int = 20) -> DeployVerlauf:
        """Die letzten Deploys einer Anwendung, neueste zuerst."""
        name = dict(ueberwachte_apps()).get(anwendung_uuid, "")
        roh = coolify.verlauf(anwendung_uuid, limit=limit)
        return DeployVerlauf(items=[_eintrag(r, name_fallback=name) for r in roh])

    def build_log(self, deployment_uuid: str) -> DeployLog:
        """Das Build-Log eines Deploys, aufbereitet fürs Backoffice.

        `hidden`-Zeilen filtert Coolify auch in der eigenen Oberfläche aus —
        das sind interne Schritte, kein Bau-Fortschritt.
        """
        status_wert, roh = coolify.build_log(deployment_uuid)
        zeilen: list[DeployLogZeile] = []
        for eintrag in roh:
            if not isinstance(eintrag, dict) or eintrag.get("hidden"):
                continue
            text = eintrag.get("output")
            if not isinstance(text, str) or not text.strip():
                continue
            art = eintrag.get("type")
            zeilen.append(
                DeployLogZeile(
                    text=text.rstrip(),
                    art=art if art in ("stdout", "stderr") else "stdout",
                    zeit=_zeit(eintrag.get("timestamp")),
                )
            )
        return DeployLog(
            deployment_uuid=deployment_uuid, status=status_wert, zeilen=zeilen
        )

    def ausloesen(self, anwendung_uuid: str) -> dict:
        """Deploy anstoßen. Nur für in der Liste geführte Anwendungen."""
        if anwendung_uuid not in dict(ueberwachte_apps()):
            # Fail-closed: kein Deploy auf eine UUID, die wir nicht führen.
            raise _unbekannte_app()
        return coolify.deploy_ausloesen(anwendung_uuid)


def _unbekannte_app() -> Exception:
    from fastapi import HTTPException, status  # lokal: hält das Modul schlank

    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Diese Anwendung wird vom Deploy-Monitor nicht geführt.",
    )
