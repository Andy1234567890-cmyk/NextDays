"""Jede Meldung mit `dedup_key` entscheidet bewusst ueber `einmalig`.

DER BEFUND, DEN DIESER TEST FUER DIE ZUKUNFT SCHLIESST (live 09.09.2026,
gemeldet als „hier kommen immer alte benachrichtungen in den notfcaichon und
die e-mails gehen auch doppelt raus"):

Der Riegel gegen Doppelmeldungen war bis 0617 ausschliesslich
`notifications_dedup_offen_uq` — partiell auf `gelesen_am is null`. Fuer
ZUSTANDS-Meldungen ist das richtig und gewollt („Balkon hat kein Foto" darf
nach dem Lesen erneut melden). Fuer EREIGNIS-Meldungen war es falsch: sobald
der Nutzer die Meldung gelesen oder „Alle gelesen" gedrueckt hatte, war der
Riegel weg. Ein weiterer Import-/Abgleichslauf legte dann eine zweite
Glockenzeile an — und weil `dispatcher.sende()` den MAILVERSAND an genau
diesem 23505 entdoppelt (`_glocke_entdoppelt`), ging mit der zweiten
Glockenzeile auch die zweite Mail hinaus. Ein Fehler, zwei Symptome.

Gemessen wurde das gegen die Produktions-DB (30 Tage, 09.09.2026):

    betrieb_buchung            476 Meldungen /  218 Ereignisse (258 zu viel)
    nachricht                  198 /  43 (155)
    buchung                    386 / 237 (149)
    block_request               21 /  11  (10)
    eigchat                      8 /   4   (4)
    block_request_aufhebung      2 /   1   (1)
    aufgabe_zugewiesen (746), block_decision (13), aufgabe_entzogen (12),
    airbnb_foto_fehlt (1)                        — KEIN Ueberschuss

Von 75 Mehrfach-Faellen bei Buchungen waren fast alle Zeilen GELESEN
(22/26, 30/30, 16/16). Das ist der Beweis, dass der Lesestand der Ausloeser
war und nicht ein doppelter Aufruf.

WARUM DIESER TEST UND NICHT EINE PRAEFIX-LISTE: `einmalig=True` stand nach der
Behebung an genau EINER Stelle (`melde_buchungs_ereignis`), waehrend es in
`src/features` rund dreissig `sende()`-Aufrufe mit `dedup_key` gibt. Mehrere
davon beschrieben nach ihrem EIGENEN Kommentar ein Einzelereignis („Ein
Abschluss je Auftrag", „dieselbe Nachricht darf bei einem Retry nicht zweimal
melden") und waren trotzdem ungeschuetzt. Eine Liste bekannter Praefixe im
Test haette genau die Stellen geprueft, an die man gedacht hat.

Dieser Test geht darum wie sein Vorbild
(`channel_manager/tests/test_bestandsimport.py`,
`test_jeder_aufrufer_der_projektion_entscheidet_bewusst`) per AST ueber ALLE
Slices und verlangt an jeder Aufrufstelle eine EXPLIZITE Angabe — auch
`einmalig=False`. Nur so ist „bewusst wiederholbar" von „vergessen"
unterscheidbar; eine weggelassene Vorgabe sieht sonst genauso aus wie eine
Entscheidung.

WARUM `einmalig=False` NICHT ALS RAUSCHEN GILT: Es ist eine Zeile plus ein
Grund an der Stelle, an der die Meldung entsteht — dieselbe Bauform, die
`bestandsimport` seit dem 09.09.2026 traegt. Die Alternative (Allowlist im
Test) verschiebt die Begruendung aus dem Slice in die Testdatei, also weg von
dem, der die naechste Meldung schreibt.
"""
from __future__ import annotations

import ast
from pathlib import Path

_FEATURES = Path(__file__).resolve().parent.parent.parent

# Aufrufstellen, die HEUTE noch keine Entscheidung tragen, weil sie in fremder,
# unfertiger Arbeit im Working Tree liegen (calendar-Sperrantraege, Owner-Chat)
# und in diesem Zug nicht angefasst werden durften.
#
# Sie stehen hier NICHT als „geklaert", sondern als offene Schuld — alle drei
# Praefixe hatten im Live-Bestand messbaren Ueberschuss (block_request 10,
# block_request_aufhebung 1, eigchat 4) und beschreiben nach ihrem eigenen
# Kommentar ein Einzelereignis. Wer diese Dateien anfasst, entscheidet die
# Zeile mit und streicht den Eintrag hier.
_OFFEN = frozenset({
    "calendar/sperrantraege.py",
    "calendar/sperrantrag_meldung.py",
    "owner_chat/melden.py",
})


def _eltern_verketten(baum: ast.AST) -> None:
    for eltern in ast.walk(baum):
        for kind in ast.iter_child_nodes(eltern):
            kind.parent = eltern  # type: ignore[attr-defined]


def _umgebende_funktion(knoten: ast.AST) -> str:
    """Name der Funktion, in der dieser Knoten steht (oder '?')."""
    aktuell = getattr(knoten, "parent", None)
    while aktuell is not None:
        if isinstance(aktuell, ast.FunctionDef | ast.AsyncFunctionDef):
            return aktuell.name
        aktuell = getattr(aktuell, "parent", None)
    return "?"


def _aufrufstellen() -> list[tuple[str, int, str, bool]]:
    """Alle `sende(...)`-Aufrufe mit `dedup_key` in `src/features`.

    Rueckgabe je Treffer: (Pfad relativ zu features, Zeile, Funktion,
    entscheidet-ueber-einmalig).

    Gesucht wird nach dem NAMEN `sende` samt `dedup_key`, nicht nach dem Typ
    des Empfaengers: der Dispatcher wird an den meisten Stellen lokal geholt
    (`dispatcher = NotificationDispatcher(db)`, teils in einem
    `noqa: PLC0415`-Import), und eine Typ-Analyse waere hier ratend. Die
    Kombination `sende(` + `dedup_key=` ist im Repo eindeutig diese Schicht —
    der Job-Queue-`dedup_key` laeuft ueber `enqueue()`, nicht `sende()`.
    """
    treffer: list[tuple[str, int, str, bool]] = []
    for pfad in sorted(_FEATURES.rglob("*.py")):
        if "tests" in pfad.parts:
            # Tests rufen den Dispatcher absichtlich direkt auf und pruefen
            # dabei gerade das Verhalten OHNE Kennzeichen.
            continue
        baum = ast.parse(pfad.read_text(encoding="utf-8"))
        _eltern_verketten(baum)
        for knoten in ast.walk(baum):
            if not isinstance(knoten, ast.Call):
                continue
            ziel = knoten.func
            name = (
                ziel.attr
                if isinstance(ziel, ast.Attribute)
                else ziel.id
                if isinstance(ziel, ast.Name)
                else None
            )
            if name != "sende":
                continue
            argumente = {k.arg for k in knoten.keywords if k.arg}
            if "dedup_key" not in argumente:
                continue
            treffer.append((
                str(pfad.relative_to(_FEATURES)),
                knoten.lineno,
                _umgebende_funktion(knoten),
                "einmalig" in argumente,
            ))
    return treffer


def test_der_dispatcher_kennt_das_kennzeichen() -> None:
    """`sende()` nimmt `einmalig` als benanntes Argument, Vorgabe `False`.

    Vorgabe `False` heisst: das bisherige Verhalten (Riegel nur bis zum Lesen).
    Eine Vorgabe `True` waere schlimmer als das Problem — sie machte jede
    Zustandsmeldung nach dem ersten Lesen fuer immer stumm.
    """
    import inspect  # noqa: PLC0415 — nur dieser Test braucht die Signatur

    from src.features.notification_settings.dispatcher import (  # noqa: PLC0415
        NotificationDispatcher,
    )

    for methode in (NotificationDispatcher.sende, NotificationDispatcher._glocke):  # noqa: SLF001
        p = inspect.signature(methode).parameters.get("einmalig")
        assert p is not None, f"Parameter `einmalig` fehlt in {methode.__name__}"
        assert p.default is False, (
            f"{methode.__name__}: Vorgabe MUSS False sein — sonst verstummt "
            "jede Zustandsmeldung ('Balkon hat kein Foto') nach dem ersten "
            "Lesen fuer immer."
        )


def test_der_test_findet_ueberhaupt_aufrufstellen() -> None:
    """Selbstpruefung: eine leere Trefferliste waere ein gruener Blindtest.

    Ohne diese Zusicherung wuerde der Test unten auch dann bestehen, wenn der
    AST-Griff daneben liegt (umbenanntes `sende`, verschobener Slice) — genau
    die Art stiller Ausfall, die Wurzel 5 verbietet.
    """
    treffer = _aufrufstellen()
    assert len(treffer) >= 20, (
        f"Nur {len(treffer)} Aufrufstellen gefunden — der AST-Griff greift "
        "nicht mehr. Erwartet werden die rund 30 `sende(..., dedup_key=...)` "
        "aus src/features."
    )


def test_jede_meldung_entscheidet_bewusst_ueber_einmalig() -> None:
    """Jeder `sende()`-Aufruf mit `dedup_key` gibt `einmalig` explizit an.

    MASSSTAB fuer die Entscheidung: Kann derselbe Sachverhalt spaeter erneut
    zutreffen? „Balkon hat kein Foto" — ja, wiederholbar (`False`). „Buchung X
    wurde angelegt", „Antrag 42 ist genehmigt" — nein, einmalig (`True`).
    """
    fehlend = [
        f"{pfad}:{zeile} (in {funktion})"
        for pfad, zeile, funktion, entscheidet in _aufrufstellen()
        if not entscheidet and pfad not in _OFFEN
    ]
    assert not fehlend, (
        "Diese Meldungen tragen einen `dedup_key`, entscheiden aber nicht "
        "ueber `einmalig`. Damit haengt ihr Riegel am LESESTAND: nach "
        "'Alle gelesen' meldet dasselbe Ereignis erneut, und weil der "
        "Mailversand "
        "an diesem Index-Konflikt entdoppelt, geht die Mail mit hinaus "
        "(live 09.09.2026). Bitte je Stelle entscheiden — `einmalig=True` "
        "fuer ein Einzelereignis, `einmalig=False` mit einer Zeile Grund fuer "
        "eine Zustandsmeldung:\n  " + "\n  ".join(fehlend)
    )


def test_die_offenen_stellen_sind_noch_offen() -> None:
    """Die Allowlist beschreibt die Wirklichkeit, nicht einen alten Stand.

    Sobald jemand `calendar`/`owner_chat` mit entscheidet, MUSS der Eintrag
    hier verschwinden — sonst waechst eine Ausnahmeliste, die niemand mehr
    zurueckbaut, und die naechste vergessene Stelle verschwindet darin.
    """
    # Eine Datei ist erst dann aus der Liste zu nehmen, wenn KEINE ihrer
    # Aufrufstellen mehr offen ist. Ueber „hat irgendwo ein `einmalig`" zu
    # gehen waere zu grob: eine Datei mit zwei Meldungen (wie
    # `sperrantrag_meldung.py`) faellt sonst schon nach der ersten aus der
    # Liste, und die zweite ist wieder unbeobachtet.
    noch_offen = {
        pfad
        for pfad, _zeile, _funktion, entscheidet in _aufrufstellen()
        if not entscheidet
    }
    unnoetig = sorted(_OFFEN - noch_offen)
    assert not unnoetig, (
        "Diese Dateien stehen in `_OFFEN`, entscheiden aber inzwischen ueber "
        "`einmalig` — Eintrag streichen:\n  " + "\n  ".join(unnoetig)
    )
    verschwunden = sorted(
        p for p in _OFFEN
        if not (_FEATURES / p).exists()
    )
    assert not verschwunden, (
        "Diese Dateien aus `_OFFEN` gibt es nicht mehr — Eintrag streichen:\n  "
        + "\n  ".join(verschwunden)
    )
