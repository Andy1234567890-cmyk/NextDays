"""Ein archiviertes Objekt taucht in KEINER Kanal-Zuordnungsliste auf (0416).

DER FEHLER, DEN DIESER TEST FESTNAGELT: Nach dem Archivieren verschwand das
Objekt aus `/objekte` — aber NICHT aus der Zuordnungsliste der Portale. Live zu
sehen: `Fewo-Mosbjerg-Sindal` war archiviert, seine Channex-Property gelöscht,
und die Seite bot bei Booking.com UND Airbnb weiter einen „Verbinden"-Knopf an.
Ein Klick darauf hätte es bei Channex neu angelegt — samt neuer Kosten.

Die Ursache war nicht die Logik, sondern die Verteilung: der Archiv-Filter stand
in EINER Abfrage (der Objektliste), während der Code 219 Leseabfragen auf
`properties` hat. Der Riegel dagegen liegt jetzt in der Datenbank (Migration
0417, restriktive Policy) — dieser Test sichert die Server-Wege, die als
service_role laufen und den Riegel deshalb NICHT sehen.
"""
from __future__ import annotations

import re
from pathlib import Path

_CHANNELS = Path(__file__).resolve().parents[1] / "channels.py"


def _abfrage_bloecke(quelle: str) -> list[str]:
    """Jede `db.table("properties")`-Kette bis zum `.execute()` als Textblock."""
    bloecke: list[str] = []
    for treffer in re.finditer(r'db\.table\("properties"\)', quelle):
        rest = quelle[treffer.start() : treffer.start() + 900]
        ende = rest.find(".execute()")
        bloecke.append(rest[: ende if ende > 0 else len(rest)])
    return bloecke


def test_listen_abfragen_filtern_das_archiv() -> None:
    """Jede LESENDE properties-Abfrage in channels.py blendet das Archiv aus.

    Geprueft wird der Quelltext, nicht ein Aufruf: der Fehler war eine
    VERGESSENE Stelle, und genau das faellt in einem Verhaltenstest nicht auf —
    der prueft ja nur die Stelle, an die man gedacht hat.

    Schreibpfade (insert/update/delete) sind ausgenommen: dort ist der Filter
    sinnlos oder falsch (ein archiviertes Objekt muss aktualisierbar bleiben,
    etwa beim Zurueckholen).
    """
    quelle = _CHANNELS.read_text(encoding="utf-8")
    ohne_filter: list[str] = []
    for blk in _abfrage_bloecke(quelle):
        if any(w in blk for w in (".insert(", ".update(", ".delete(")):
            continue
        # Nur Abfragen, die den BESTAND aufziehen. Ausgenommen sind gezielte
        # Zugriffe auf bekannte IDs:
        #
        #   .eq("id", …)  — Detailseite/Archiv-Sicht muessen ein archiviertes
        #                   Objekt finden koennen.
        #   .in_("id", …) — holt Zusatzfelder zu einer Liste, die WEITER OBEN
        #                   schon gefiltert wurde. Ein zweiter Filter waere
        #                   wirkungslos (die Menge ist bereits eingeschraenkt)
        #                   und verdeckte, wo die Filterung wirklich sitzt.
        if '.eq("id"' in blk or '.in_("id"' in blk:
            continue
        if 'is_("archived_at", "null")' not in blk:
            ohne_filter.append(" ".join(blk.split())[:150])
    assert not ohne_filter, (
        "properties-Listenabfrage ohne Archiv-Filter in channels.py:\n  "
        + "\n  ".join(ohne_filter)
    )
