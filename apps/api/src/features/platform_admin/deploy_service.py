"""Deploy-Monitor: Coolify-Rohdaten in die Sicht des Backoffice übersetzen.

Eigenes Modul statt Anbau an service.py: der Deploy-Monitor spricht KEINE
Datenbank, sondern ausschließlich Coolify. Die Trennung hält service.py bei
seinem Thema (mandantenübergreifende DB-Sichten).

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

from src.core.logging import get_logger

from . import coolify, deploy_rueckstand
from .schemas import (
    DeployApp,
    DeployEintrag,
    DeployLog,
    DeployLogZeile,
    DeployUebersicht,
    DeployVerlauf,
)

log = get_logger(__name__)

# Neben diesem Modul — geht mit ins Image, anders als der Repo-Root.
_APPS_DATEI = Path(__file__).resolve().parent / "coolify_apps.txt"

# Status, die Coolify für „läuft gerade" verwendet.
_AKTIV = frozenset({"queued", "in_progress"})


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


class DeployService:
    """Liest den Deploy-Zustand aus Coolify. Kein Datenbankzugriff."""

    def uebersicht(self) -> DeployUebersicht:
        """Je überwachter Anwendung der letzte bzw. laufende Deploy — und was
        seither auf `main` dazugekommen ist, das GENAU DIESE App betrifft."""
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
