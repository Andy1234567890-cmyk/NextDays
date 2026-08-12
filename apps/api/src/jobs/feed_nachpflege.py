"""Die Lücken schliessen, die der Booking-Feed hinterlässt.

WARUM DIESE SCHRITTE AM FEED HÄNGEN UND NICHT AN EIGENEN TICKS:
Genau hier entstehen die unvollständigen Zeilen. Eine Einmal-Reparatur würde den
Bestand füllen und ab der nächsten Buchung dieselbe Lücke wieder aufmachen — der
Fehler kam bei jedem der vier Fälle live zurück, nachdem er „behoben" war.

Was fehlt, wenn diese Schritte nicht laufen:

  buchungszeitpunkte  Der Feed liefert nur SEINEN Eingang, nicht den Zeitpunkt
                      beim Portal. Ohne diesen Schritt zeigte der Posteingang
                      eine Buchung vom März dauerhaft als „heute" — und alle 22
                      trugen dieselbe Sekunde, weil der Feed sie in einem Rutsch
                      holte (0291/0292, Wurzel 5b).
  profilbilder        Der Feed legt die Gäste an, kennt aber die Nutzer-Ressource
                      des Portals nicht → jeder neue Gast käme ohne Bild herein
                      (0295).
  anreisezeiten       Channex reicht Airbnbs `check_in_datetime` nicht durch →
                      `reservations.checkin_time` blieb leer und jede
                      Anreise-Vorlage meldete „Feld ohne Wert: checkin_time".
  lesestaende         Füllt keine Lücke, sondern hält einen Wert AKTUELL. Ein
                      Häkchen, das einmal gesetzt und nie wieder geprüft wird,
                      ist schlimmer als keins (0297).

WARUM BEST EFFORT: Die Buchungen sind das Wichtigere. Eine unerreichbare
Portal-API darf den Feed nicht kippen — der Rest kommt beim nächsten Lauf. Jeder
Schritt ist deshalb einzeln gefangen; fällt einer aus, laufen die anderen weiter.
"""

from __future__ import annotations

from typing import Any, Protocol

from src.core.logging import get_logger

log = get_logger("nextdays.jobs.feed_nachpflege")


class _Dienst(Protocol):
    """Die vier Nachpflege-Methoden des Channel-Manager-Dienstes.

    Als Protocol, damit dieses Modul nicht den ganzen Service importieren muss
    (der zieht ein Dutzend Mixins mit) — und damit im Test ein schlanker Ersatz
    genügt.
    """

    def buchungszeitpunkte_heilen(self) -> dict[str, Any]: ...
    def profilbilder_heilen(self) -> dict[str, Any]: ...
    def anreisezeiten_heilen(self) -> dict[str, Any]: ...
    def lesestaende_aktualisieren(self) -> dict[str, Any]: ...


def ausfuehren(dienst: _Dienst) -> dict[str, int]:
    """Alle vier Schritte laufen lassen; zurück kommt, was gesetzt wurde.

    Nur Schritte MIT Wirkung stehen im Ergebnis: ein `{"gesetzt": 0}` wäre im
    Verlauf Rauschen („0 Profilbilder nachgezogen" sagt nichts). Ein
    fehlgeschlagener Schritt fehlt ebenfalls — er hat nichts gesetzt, und die
    Warnung steht im Log.
    """
    gesetzt: dict[str, int] = {}
    for name, schritt in (
        ("buchungszeitpunkte", dienst.buchungszeitpunkte_heilen),
        ("profilbilder", dienst.profilbilder_heilen),
        ("anreisezeiten", dienst.anreisezeiten_heilen),
        ("lesestaende", dienst.lesestaende_aktualisieren),
    ):
        try:
            ergebnis = schritt()
        except Exception as exc:  # noqa: BLE001 — Nebenpfad, kippt den Feed nie
            log.warning(f"{name}_nachpflege_fehlgeschlagen", error=str(exc)[:200])
            continue
        if ergebnis.get("gesetzt"):
            log.info(f"{name}_nachgezogen", **ergebnis)
            gesetzt[name] = int(ergebnis["gesetzt"])
    return gesetzt
