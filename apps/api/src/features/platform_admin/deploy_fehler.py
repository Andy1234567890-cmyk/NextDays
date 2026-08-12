"""Die Ursache eines fehlgeschlagenen Deploys aus dem Coolify-Build-Log lesen.

WARUM ES DAS BRAUCHT:
Coolify liefert an der Deployment-Zeile KEIN Fehlerfeld. Live gegen die
Coolify-Postgres geprüft (12.08.2026): `application_deployment_queues` trägt
status/commit/logs, aber nichts, was den Grund benennt. Wer im Backoffice
wissen will, WARUM ein Deploy fehlschlug, hat genau eine Quelle — das
Build-Log. Dieses Modul liest es und holt die Ursache heraus.

WAS DABEI LEICHT SCHIEFGEHT — und deshalb hier ausdrücklich geregelt:

* **Nicht raten.** Findet sich kein bekanntes Muster, ist das Ergebnis
  `quelle="unbekannt"` und `text=None`. Eine plausible letzte Zeile als
  „Fehlermeldung" auszugeben wäre eine Falschaussage, die niemand als Bug
  erkennt — sie sieht ja richtig aus (Wurzel 4).
* **Erfolgsmeldungen sind keine Fehler.** „Rolling update completed" steht in
  90 von 200 Logs, auch bei erfolgreichen Deploys (live gemessen). Als
  Fehlersignal wäre es wertlos. Nur die Kombination mit „not healthy" zählt.
* **`hidden`-Zeilen ignorieren.** Coolify blendet sie in der eigenen Oberfläche
  aus; es sind Laravel-Stacktraces des Deploy-Jobs, nicht die Ursache. Der
  echte Grund steht in den SICHTBAREN Zeilen.

ZWEI FEHLERKLASSEN, an 60 echten Fehlschlägen gemessen (12.08.2026):

1. `deployment_failed` — 55 von 60. Coolify schreibt selbst eine Zeile
   „Deployment failed: <Grund>" bzw. „Deployment failed. Removing the new
   version of your application."
2. `healthcheck` — 3 von 60. Kein „Deployment failed", stattdessen „New
   container is not healthy, rolling back to the old container." Das ist die
   Klasse, die man ohne eigenes Muster stillschweigend verlöre.

Die restlichen 2 hatten gar kein Log (`logs IS NULL`) → `kein_log`.
"""
from __future__ import annotations

from dataclasses import dataclass

# Wurzel 8: harte Obergrenzen. Ein Build-Log ist 50 KB und mehr; weder die
# Meldung noch der Beleg dürfen die Ereignis-Zeile sprengen.
MAX_TEXT = 500
MAX_KONTEXT = 4_000
# So viele sichtbare Zeilen werden als Beleg mitgegeben.
KONTEXT_ZEILEN = 12

# Coolifys eigene Fehlerzeile. Beide Schreibweisen kommen real vor:
# „Deployment failed: <Grund>" und „Deployment failed. Removing …".
_MARKER_FAILED = "deployment failed"
# Fehlgeschlagener Healthcheck mit Rollback. NUR zusammen mit „not healthy" —
# „Rolling update completed" allein steht auch in erfolgreichen Logs.
_MARKER_HEALTH = "not healthy"


@dataclass(frozen=True)
class Fehlerbefund:
    """Was aus dem Log über die Ursache herauszuholen war.

    `text` ist None, wenn nichts Belastbares gefunden wurde — dann sagt
    `quelle`, woran es lag (kein Log vs. Log ohne erkennbares Muster).
    """

    text: str | None
    quelle: str
    kontext: str | None


def _kuerzen(wert: str, grenze: int) -> str:
    """Auf die Grenze kürzen und die Kürzung sichtbar machen."""
    wert = wert.strip()
    if len(wert) <= grenze:
        return wert
    return wert[: grenze - 1].rstrip() + "…"


def _sichtbare_zeilen(roh: list[dict]) -> list[tuple[str, str]]:
    """(art, text) je sichtbarer Log-Zeile, leere übersprungen.

    `hidden` filtert Coolify auch in der eigenen Oberfläche aus — das sind
    interne Schritte und Laravel-Stacktraces, nicht die Ursache.
    """
    zeilen: list[tuple[str, str]] = []
    for eintrag in roh:
        if not isinstance(eintrag, dict) or eintrag.get("hidden"):
            continue
        text = eintrag.get("output")
        if not isinstance(text, str) or not text.strip():
            continue
        art = eintrag.get("type")
        zeilen.append((art if art in ("stdout", "stderr") else "stdout", text.strip()))
    return zeilen


def _kontext(zeilen: list[tuple[str, str]]) -> str | None:
    """Die letzten sichtbaren Zeilen als Beleg — damit der Grund im Backoffice
    nachvollziehbar ist, ohne das ganze Log nachzuladen."""
    if not zeilen:
        return None
    schwanz = zeilen[-KONTEXT_ZEILEN:]
    return _kuerzen("\n".join(text for _art, text in schwanz), MAX_KONTEXT) or None


def _trennlinie(text: str) -> bool:
    """Coolify rahmt seine Fehlerzeile in „====="-Linien — kein Inhalt."""
    blank = text.replace("=", "").replace("-", "").strip()
    return not blank


def ursache_aus_log(roh: list[dict] | None) -> Fehlerbefund:
    """Die Fehlerursache aus den rohen Log-Zeilen eines Deploys lesen.

    `roh` ist die Liste, die `coolify.build_log` liefert (Zeilen der Form
    `{command, output, type, timestamp, hidden, batch}`).

    Reihenfolge der Prüfung ist Absicht: Coolifys eigene „Deployment failed"-
    Zeile ist die genaueste Aussage und gewinnt. Erst wenn sie fehlt, wird auf
    den Healthcheck-Rollback geprüft, dann auf die letzte stderr-Ausgabe.
    Bleibt alles ohne Treffer, wird NICHTS behauptet.
    """
    if not roh:
        # Kein Log heißt nicht „kein Fehler" — es heißt, wir wissen es nicht.
        return Fehlerbefund(text=None, quelle="kein_log", kontext=None)

    zeilen = _sichtbare_zeilen(roh)
    if not zeilen:
        return Fehlerbefund(text=None, quelle="kein_log", kontext=None)

    beleg = _kontext(zeilen)

    # 1) Coolifys eigene Fehlerzeile — die genaueste Aussage. Von hinten
    #    suchen: bei mehreren Versuchen im selben Log zählt der letzte.
    for _art, text in reversed(zeilen):
        if _MARKER_FAILED in text.lower() and not _trennlinie(text):
            return Fehlerbefund(
                text=_kuerzen(text, MAX_TEXT),
                quelle="deployment_failed",
                kontext=beleg,
            )

    # 2) Healthcheck-Rollback: der neue Container wurde nie gesund. Coolify
    #    schreibt hier KEIN „Deployment failed" — ohne dieses Muster ginge die
    #    Klasse stillschweigend verloren (3 von 60 real).
    for _art, text in reversed(zeilen):
        if _MARKER_HEALTH in text.lower():
            return Fehlerbefund(
                text=_kuerzen(text, MAX_TEXT), quelle="healthcheck", kontext=beleg
            )

    # 3) Letzte echte Fehlerausgabe. Schwächer als 1) und 2), aber immer noch
    #    eine ECHTE Zeile aus dem Log — nichts Erfundenes.
    for art, text in reversed(zeilen):
        if art == "stderr" and not _trennlinie(text):
            return Fehlerbefund(
                text=_kuerzen(text, MAX_TEXT), quelle="stderr", kontext=beleg
            )

    # 4) Nichts Belastbares. Der Beleg wird trotzdem mitgegeben — daraus kann
    #    ein Mensch lesen, was passiert ist, ohne dass wir etwas behaupten.
    return Fehlerbefund(text=None, quelle="unbekannt", kontext=beleg)
