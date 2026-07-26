"""Request-ID und Fehlerursachen für die Support-Diagnose.

PROBLEM: Der Client sieht bei einem Serverfehler ausschließlich
``{"detail": "internal_error"}`` — das ist Absicht (Wurzel 5: kein
Stacktrace-Leak). Für den Support war der Fehler damit aber eine Blackbox: Er
sah im Backoffice „500" und musste sich von Hand durchs Server-Log wühlen, um
die Ursache zu finden.

LÖSUNG: Jeder Request bekommt eine kurze ID. Sie steht

  * im Server-Log (strukturiert, bei jedem Fehler),
  * im ``X-Request-Id``-Header der Antwort,
  * im gemeldeten Diagnose-Ereignis des Clients.

Damit lässt sich ein Fehler im Backoffice der konkreten Backend-Ursache
zuordnen, ohne dass der Browser je interne Details zu sehen bekommt.

GRENZE — und der Grund für den knappen Zwischenspeicher: Die Ursache wird NUR
als Exception-Typ und Herkunftsmodul festgehalten (``KeyError`` in
``reservations/service.py:212``), nie als Exception-Nachricht. Nachrichten
enthalten regelmäßig Kundendaten oder Secrets (``KeyError: 'stripe_secret'``,
Constraint-Verletzungen mit Klartextwerten). Der Typ plus die Stelle genügen
zur Diagnose und sind unbedenklich.
"""
from __future__ import annotations

import uuid
from collections import OrderedDict
from threading import Lock
from types import TracebackType

# Wie viele Ursachen vorgehalten werden. Der Speicher ist ein kurzlebiger
# Puffer, kein Log: Der Client meldet seinen Fehler innerhalb von Sekunden,
# danach ist der Eintrag wertlos. Die Obergrenze verhindert, dass ein
# Fehlersturm den Prozess vollschreibt (Wurzel 8).
_MAX_URSACHEN = 500

# Prozess-lokal und bewusst nicht in Redis/DB: Die Zuordnung muss nur den
# Moment zwischen Serverfehler und der Meldung des Clients überbrücken. Bei
# mehreren Workern kann eine Ursache deshalb fehlen — dann steht im Backoffice
# nur die Request-ID, mit der sich das Server-Log durchsuchen lässt. Das ist
# der bewusst gewählte einfache Weg statt zusätzlicher Infrastruktur.
_ursachen: OrderedDict[str, dict[str, str | int | None]] = OrderedDict()
_lock = Lock()


def neue_request_id() -> str:
    """Kurze, eindeutige ID für einen Request."""
    return uuid.uuid4().hex[:12]


def _herkunft(tb: TracebackType | None) -> tuple[str | None, int | None]:
    """Innerster Frame im Projektcode — dort liegt die eigentliche Ursache.

    Der letzte Frame zeigt sonst oft in eine Bibliothek (supabase, httpx); für
    die Diagnose ist die letzte EIGENE Zeile die interessante.
    """
    datei: str | None = None
    zeile: int | None = None
    while tb is not None:
        name = tb.tb_frame.f_code.co_filename
        if "/src/" in name and "/site-packages/" not in name:
            datei = name.split("/src/", 1)[1]
            zeile = tb.tb_lineno
        tb = tb.tb_next
    return datei, zeile


def merke_ursache(request_id: str | None, exc: BaseException) -> None:
    """Ursache eines Serverfehlers hinterlegen (Typ + Stelle, nie die Nachricht)."""
    if not request_id:
        return
    datei, zeile = _herkunft(exc.__traceback__)
    with _lock:
        _ursachen[request_id] = {
            "typ": type(exc).__name__,
            "datei": datei,
            "zeile": zeile,
        }
        while len(_ursachen) > _MAX_URSACHEN:
            _ursachen.popitem(last=False)


def hole_ursache(request_id: str) -> dict[str, str | int | None] | None:
    """Hinterlegte Ursache abrufen. Fehlt sie, gibt es nur die ID."""
    with _lock:
        return _ursachen.get(request_id)
