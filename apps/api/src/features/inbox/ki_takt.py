"""Der Takt, in dem wartende KI-Antworten hinausgehen.

OHNE IHN WIRD GEPLANT UND NIE GESENDET. `autoantwort_planen` legt eine Zeile in
die Warteschlange mit einem `send_at`; `dispatch_ki_autoantworten` holt die
fälligen ab. Zwischen beidem muss jemand ticken — sonst liegt die Antwort für
immer da, und der Betrieb sieht nur, dass die KI „nicht funktioniert".

WARUM EIN EIGENER LOOP und nicht der Timer-Weg des Nachrichten-Schedulers: Der
setzt je Nachricht einen asyncio-Timer auf die Sekunde genau. Das ist dort
richtig (eine Anreise-Mail soll um 15:36:04 gehen), hier aber falsch — die
Wartezeit vor einer KI-Antwort ist bewusst ungenau, sie soll ja menschlich
wirken. Ein Poll im Minutentakt ist der einfachere Weg mit demselben Ergebnis,
und er übersteht einen Neustart ohne Wiederherstellungslogik.

DER INTERNE ENDPUNKT BLEIBT. Er ist das Sicherheitsnetz für den Fall, dass
dieser Loop stirbt, und der Weg für einen externen Cron — dieselbe Rolle wie
beim Nachrichten-Scheduler.
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
