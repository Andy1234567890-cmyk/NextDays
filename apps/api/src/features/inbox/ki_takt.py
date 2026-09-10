"""AUSSER BETRIEB (09.09.2026) — der Takt läuft im Worker, nicht mehr hier.

DIESES MODUL HAT KEINEN AUFRUFER MEHR. Wer `start()` wieder anwirft, stellt
einen behobenen Fehler wieder her — bitte NICHT tun, ohne das Folgende gelesen
zu haben.

WAS PASSIERT IST: `start()` wurde im FastAPI-Lifespan (`main.py`) gerufen, und
der Lifespan läuft JE UVICORN-WORKER. Bei `UVICORN_WORKERS=4` (Compose-Vorgabe)
liefen vier unabhängige Loops im Minutentakt auf derselben Warteschlange. Der
Überlappungs-Guard unten (`if _task and not _task.done()`) ist ein
Modul-Global und damit prozesslokal — er sieht die drei anderen Prozesse nicht.
Zusammen mit dem damals fehlenden Claim in `dispatch_ki_autoantworten` gingen
KI-Antworten mehrfach hinaus; gemeldet wurde es als „die e-mails gehen auch
doppelt raus".

WO DER TAKT JETZT LIEGT: `src/worker.py`, `_ki_autoantwort_tick`
(`KI_AUTOANTWORT_TICK_SECONDS`). Der Worker ist ein EINZELNER Prozess
(`command: python -m src.worker`) — derselbe Grund, aus dem die Automails dort
liegen und nicht in der API. Zusätzlich claimt der Versand seit 0617 atomar,
sodass auch ein zweiter Aufrufer (interner Cron-Endpunkt) nichts doppelt
sendet.

Die Datei bleibt vorerst stehen, weil zwei Kommentare (`worker.py`,
`ki_autoantwort.py`) auf sie als Beleg verweisen. Sie ist Dokumentation eines
Fehlers, kein Bauteil.

DIE ENTSCHEIDUNG STEHT IN
`docs/decisions/0030-takte-im-worker-nicht-in-der-api.md` — welcher Prozess
welche Takte ausfuehrt, die gemessenen Belege (vier uvicorn-Kindprozesse, vier
`ki_takt_gestartet`-Zeilen in derselben Sekunde) und die Absicherung fuer den
Fall, dass der Worker doch mehrfach laeuft. Ein Kommentar in einer Datei, die
niemand mehr oeffnet, war der falsche Ort fuer eine Architektur-Entscheidung.

ZUR URSPRÜNGLICHEN BEGRÜNDUNG DES LOOPS (weiterhin fachlich richtig, nur am
falschen Ort ausgeführt):

WARUM EIN EIGENER LOOP und nicht der Timer-Weg des Nachrichten-Schedulers: Der
setzt je Nachricht einen asyncio-Timer auf die Sekunde genau. Das ist dort
richtig (eine Anreise-Mail soll um 15:36:04 gehen), hier aber falsch — die
Wartezeit vor einer KI-Antwort ist bewusst ungenau, sie soll ja menschlich
wirken. Ein Poll im Minutentakt ist der einfachere Weg mit demselben Ergebnis,
und er übersteht einen Neustart ohne Wiederherstellungslogik.

DER INTERNE ENDPUNKT BLEIBT. Er ist der Weg für einen externen Cron und das
Sicherheitsnetz, falls der Worker-Tick ausfällt — dieselbe Rolle wie beim
Nachrichten-Scheduler. Er ist gegen Doppelversand abgesichert, seit der Versand
atomar claimt; vorher war er ein zusätzlicher Mitspieler im Rennen.
"""
from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

from src.core.logging import get_logger
from src.core.supabase import get_service_client

if TYPE_CHECKING:
    from .service import InboxService

log = get_logger("nextdays.inbox.ki_takt")

# Jede Minute. Häufiger bringt nichts: die kürzeste einstellbare Wartezeit ist
# „keine", und die ist damit im Mittel 30 Sekunden verzögert — bei einer
# Funktion, deren Sinn gerade eine Verzögerung ist.
TAKT_SEKUNDEN = 60

# Nach einem Fehlschlag länger warten. Ist die DB weg, hilft ein Versuch je
# Sekunde niemandem — er füllt nur das Log.
FEHLER_TAKT_SEKUNDEN = 300

_task: asyncio.Task | None = None


def _dienst() -> InboxService:
    """Den Dienst selbst bauen, nicht über den Router.

    `router.get_inbox_service` wäre der naheliegende Weg, zöge aber das ganze
    FastAPI-Modul samt seiner Importe in einen Hintergrund-Loop, der davon
    nichts braucht — und der Import liefe zirkulär zurück auf `main`.
    """
    from .service import InboxService  # lokal: Zirkelimport vermeiden

    return InboxService(service_client=get_service_client())


async def _schleife() -> None:
    while True:
        try:
            ergebnis = await asyncio.to_thread(
                _dienst().dispatch_ki_autoantworten
            )
            if ergebnis.get("gesendet") or ergebnis.get("abgebrochen"):
                log.info("ki_takt_lauf", **ergebnis)
        # KEIN eigener `except asyncio.CancelledError`: der erbt seit Python
        # 3.8 von BaseException, wird von `except Exception` also gar nicht
        # gefangen und kommt beim App-Stop von selbst durch.
        except Exception as exc:  # noqa: BLE001 — der Takt darf nie sterben
            # LAUT, aber weiterlaufen: ein Loop, der beim ersten Fehler
            # aussteigt, hinterlässt eine Warteschlange, die niemand abräumt —
            # und niemand merkt es, weil die Anwendung weiterläuft (Wurzel 5).
            log.error("ki_takt_fehlgeschlagen", error=str(exc)[:300])
            await asyncio.sleep(FEHLER_TAKT_SEKUNDEN)
            continue
        await asyncio.sleep(TAKT_SEKUNDEN)


async def start() -> None:
    """Beim App-Start den Takt anwerfen."""
    global _task  # pylint: disable=global-statement
    if _task and not _task.done():
        return
    _task = asyncio.create_task(_schleife())
    log.info("ki_takt_gestartet", takt_sekunden=TAKT_SEKUNDEN)


async def stop() -> None:
    """Beim App-Stop den Takt beenden."""
    global _task  # pylint: disable=global-statement
    if _task:
        _task.cancel()
        _task = None
