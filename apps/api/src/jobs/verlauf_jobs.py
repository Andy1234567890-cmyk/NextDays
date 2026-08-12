"""Job-Ergebnisse für den Verlauf beschreiben (0381).

WOZU: `sync_bookings_feed · ok · 92.501 ms` sagt nicht, ob 12 Buchungen ankamen
oder null. Die Zahlen lagen vor — die Dienste geben `dict[str, int]` bzw. ein
`BookingSyncResponse` zurück —, aber die Handler in `worker.py` schrieben sie ins
Log und gaben `None` zurück. Der Verlauf sah sie nie.

Hier wird aus so einem Ergebnis der Satz für die Tabelle:

    12 Revisionen geholt · 3 gespeichert · 12 bestätigt · 9 fremder Mandant

WARUM DIE SCHLÜSSELNAMEN HIER STEHEN UND NICHT IM HANDLER: Jeder Dienst benennt
seine Zähler anders (`saved`/`done`/`neu`/`created`). Stünde die Übersetzung im
jeweiligen Handler, müsste man 20 Stellen anfassen, um die Anzeige zu ändern — und
die erste, die vergessen wird, zeigt still nichts an.

TEILFEHLER SIND TEIL DES SATZES: Ein Lauf, der 3 Buchungen speichert und bei 2
scheitert, ist kein Erfolg. `sync_bookings_all` isoliert Revisionsfehler in
`errors[]`, der Job gilt trotzdem als `done` — ohne den Hinweis im Text sähe die
Zeile aus wie ein glatter Durchlauf, während zwei Revisionen im Feed hängen und
nach 30 Minuten endgültig herausfallen (Wurzel 5).
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class _MitModelDump(Protocol):
    """Ein Pydantic-Ergebnis (z. B. `BookingSyncResponse`).

    Als Protocol statt `Any`, damit die Absicht im Typ steht: hier kommt ein
    Zähler-dict ODER ein Pydantic-Modell an, nichts Beliebiges.
    """

    def model_dump(self) -> dict[str, Any]: ...


# Was ein Job-Handler berichten darf. `None` heisst „nichts zu berichten".
JobErgebnis = dict[str, Any] | _MitModelDump | None

# Zähler-Schlüssel → Wort in der Anzeige. Bewusst je Dienst-Vokabular ergänzt und
# nicht generisch geraten: `saved` heisst „gespeichert", `skipped` heisst hier
# „fremder Mandant" (Mandantentrennung), nicht „übersprungen" — das ist der
# fachliche Grund, aus dem der Zähler existiert.
_WORTE = {
    "fetched": "geholt",
    "saved": "gespeichert",
    "acknowledged": "bestätigt",
    # `skipped` heisst NICHT überall dasselbe: im Feed sind es Revisionen
    # fremder Mandanten (Mandantentrennung), beim Reconcile unveränderte
    # Objekte. Das entscheidet `_wort_fuer` am Ergebnis, nicht dieser Eintrag —
    # hier steht der neutrale Fall.
    "skipped": "übersprungen",
    "neu": "neue Ereignisse",
    "bekannt": "bereits bekannt",
    "gesetzt": "gesetzt",
    "processed": "verarbeitet",
    "done": "abgeschlossen",
    "failed": "fehlgeschlagen",
    "created": "angelegt",
    "updated": "aktualisiert",
    "soft_deleted": "entfernt",
    "geprueft": "geprüft",
    "gepusht": "gepusht",
    # Nachpflege im Booking-Feed (0291/0295/0297): was der Lauf an unvollständigen
    # Zeilen nachgezogen hat. Ausgeschrieben, weil „4 buchungszeitpunkte" allein
    # nicht sagt, dass hier ein FEHLENDER Wert gefüllt wurde.
    "buchungszeitpunkte": "Buchungszeitpunkte nachgezogen",
    "profilbilder": "Profilbilder nachgezogen",
    "anreisezeiten": "Anreisezeiten nachgezogen",
    "lesestaende": "Lesestände aktualisiert",
}

# Reihenfolge in der Anzeige: erst was hereinkam, dann was daraus wurde, dann
# was schieflief. Nicht-gelistete Schlüssel folgen alphabetisch dahinter.
_REIHENFOLGE = [
    "fetched", "neu", "processed", "geprueft",
    "saved", "created", "updated", "gesetzt", "gepusht", "done",
    "acknowledged", "bekannt", "soft_deleted", "skipped", "failed",
]


def _wort_fuer(schluessel: str, ergebnis: dict[str, Any]) -> str:
    """Das Wort für einen Zähler — abhängig davon, WER berichtet.

    Nötig, weil derselbe Schlüssel je Dienst etwas anderes meint. `skipped` sind
    im Booking-Feed Revisionen FREMDER Mandanten (das ist die Mandantentrennung,
    und dass sie >0 sein können, ohne dass etwas durchsickert, ist die Aussage) —
    beim Reconcile dagegen unveränderte Objekte. Ein pauschales Wort wäre an
    einer der beiden Stellen schlicht falsch.

    Erkannt am Begleit-Schlüssel, nicht am Job-Typ: dieses Modul kennt den
    Job-Typ nicht, und das Ergebnis-Vokabular gehört zum Dienst.
    """
    if schluessel == "skipped":
        if "acknowledged" in ergebnis:  # Booking-Feed
            return "fremder Mandant"
        if "soft_deleted" in ergebnis:  # Reconcile
            return "unverändert"
    return _WORTE.get(schluessel, schluessel)


def _datum(wert: object) -> str:
    """ISO-Datum deutsch anzeigen — oder unverändert lassen.

    Kein Parsen mit Fallback: was nicht wie ein ISO-Datum aussieht, wird
    rohgezeigt. Ein stillschweigend „korrigiertes" Datum wäre schlimmer als ein
    unschönes (Wurzel 4).
    """
    text = str(wert)
    teile = text.split("-")
    if len(teile) == 3 and all(t.isdigit() for t in teile):
        return f"{teile[2]}.{teile[1]}.{teile[0]}"
    return text


def _kopf(ergebnis: dict[str, Any]) -> str:
    """Die Art des Vorgangs plus Zeitraum, wenn er einen trägt.

    Für Vorgänge, die nichts ZÄHLEN, aber etwas TUN: ein ARI-Push meldet
    `{art: "availability", von: …, bis: …}` — daraus wird
    „availability · 13.08.2026–12.08.2027".
    """
    art = ergebnis.get("art")
    if not art:
        return ""
    von, bis = ergebnis.get("von"), ergebnis.get("bis")
    if von and bis:
        return f"{art} · {_datum(von)}–{_datum(bis)}"
    return str(art)


def _zahlen(ergebnis: dict[str, Any]) -> dict[str, int]:
    """Nur die Zähler herausziehen — Listen und Texte gehören nicht dazu."""
    return {
        k: int(v)
        for k, v in ergebnis.items()
        if isinstance(v, bool) is False and isinstance(v, int)
    }


def beschreiben(
    ergebnis: JobErgebnis,
) -> tuple[str | None, dict[str, Any] | None]:
    """`(Satz, Kennzahlen)` aus einem Handler-Ergebnis.

    Gibt `(None, None)` zurück, wenn der Vorgang nichts berichtet hat. Ein
    Handler ohne Rückgabe ist kein Fehler — dann bleibt die Spalte leer, statt
    eine Tätigkeit zu behaupten (Wurzel 4).

    Ein Ergebnis, in dem ALLE Zähler 0 sind, wird ausdrücklich als „nichts zu
    tun" ausgeschrieben. Das ist eine Aussage: der Lauf war erfolgreich UND hat
    nichts gefunden — ein leeres Feld liesse offen, ob gemessen wurde.
    """
    if ergebnis is None:
        return None, None

    # Pydantic-Antworten (BookingSyncResponse) wie ein dict behandeln.
    if hasattr(ergebnis, "model_dump"):
        ergebnis = ergebnis.model_dump()
    if not isinstance(ergebnis, dict):
        return None, None

    zahlen = _zahlen(ergebnis)
    fehler = ergebnis.get("errors")
    fehler_anzahl = len(fehler) if isinstance(fehler, list) else 0

    # Nicht jeder Vorgang zählt etwas: ein ARI-Push berichtet, WAS er über
    # WELCHEN Zeitraum gesendet hat (`art`/`von`/`bis`). Das steht vor den
    # Zählern, weil es die Art des Vorgangs benennt.
    kopf = _kopf(ergebnis)

    if not zahlen and not fehler_anzahl:
        return (kopf or None), (dict(ergebnis) if kopf else None)

    def sortierung(schluessel: str) -> tuple[int, str]:
        if schluessel in _REIHENFOLGE:
            return _REIHENFOLGE.index(schluessel), ""
        return len(_REIHENFOLGE), schluessel

    # Nullzähler werden weggelassen — „0 fehlgeschlagen" ist Rauschen. Sind ALLE
    # null, sagt der Satz das ausdrücklich (siehe Docstring).
    teile = [
        f"{zahlen[k]} {_wort_fuer(k, ergebnis)}"
        for k in sorted(zahlen, key=sortierung)
        if zahlen[k]
    ]
    if not teile:
        teile = ["nichts zu tun"]
    if fehler_anzahl:
        # Der erste Fehlertext steht mit im Satz: bei einem einzelnen Teilfehler
        # ist das bereits die ganze Diagnose, ohne Aufklappen.
        erster = str(fehler[0])[:160] if isinstance(fehler, list) else ""
        teile.append(
            f"{fehler_anzahl} Revision(en) mit Fehler"
            + (f": {erster}" if erster else "")
        )

    kennzahlen: dict[str, Any] = dict(zahlen)
    if fehler_anzahl:
        kennzahlen["errors"] = fehler_anzahl
    return " · ".join(([kopf] if kopf else []) + teile), kennzahlen
