"""Personalkosten-Formel der Auswertung (`_kosten_einer_person`).

Herausgezogen am 10.09.2026 aus `AuswertungService.auswerten` (CC 48): die
Formel stand mitten in einer 88-Zeilen-Schleife, die zugleich Zuschlaege
summierte, Abwesenheiten aggregierte und die Antwortzeile baute.
"""
from __future__ import annotations


def test_kosten_ohne_satz_sind_None_nicht_null() -> None:
    """Wurzel 4: eine Person ohne Lohnsatz kostet nicht 0, sondern unbekannt.

    Eine 0 hiesse „diese Person kostet nichts" und summierte sich
    stillschweigend in die Gesamtkosten — der Fehler waere niemandem
    aufgefallen. Der Aufrufer benennt die Person stattdessen im Hinweis
    (`ohne_lohn`).
    """
    from datetime import time

    from src.features.personal import regelwerk as rw
    from src.features.personal.auswertung import _kosten_einer_person

    # Zuschlaege auf 0: geprueft wird die Grundformel, nicht die Aufschlaege.
    regeln = rw.Regeln(
        zeitzone="Europe/Copenhagen",
        ruhezeit_stunden=11,
        max_tagesstunden=10,
        max_wochenstunden=48,
        nacht_von=time(23, 0),
        nacht_bis=time(6, 0),
        zuschlag_nacht_pct=0,
        zuschlag_sonntag_pct=0,
        zuschlag_feiertag_pct=0,
        zuschlag_ueberstunden_pct=0,
        urlaubsjahr_start_monat=1,
        uebertrag_verfall_monat=None,
        uebertrag_max_tage=None,
        mindest_vorlauf_urlaub_tage=0,
    )
    args = {"ist": 600, "nacht": 0, "sonntag": 0, "feiertag": 0, "ueber": 0}

    assert _kosten_einer_person(None, regeln, **args) is None
    # Auch ohne Betriebsregeln bleibt es unbestimmt — die Zuschlagssaetze
    # stehen dort, ohne sie waere jede Summe geraten.
    assert _kosten_einer_person(2000, None, **args) is None

    # Mit beidem: 10 Stunden zu 20,00 = 200,00 (in Minor).
    assert _kosten_einer_person(2000, regeln, **args) == 20000
