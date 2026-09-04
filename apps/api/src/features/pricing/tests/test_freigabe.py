"""Freigabe-Sperre: gilt sie an ALLEN Push-Wegen, und nirgends sonst?

Zwei Fragen, die schon zweimal falsch beantwortet wurden:

1. Sperrt sie WIRKLICH jeden Weg nach draussen? Der frühere "Autopilot"-Modus
   hatte sein Gate nur im Recompute — Reconcile und Full-Sync schickten
   munter weiter. Es gibt drei Wege, alle müssen fragen.

2. Sperrt sie NUR den Weg nach draussen? Der erste Anlauf sass im Resolver,
   der eine Preis-Wahrheit für alles ist. Folge live am 04.09.2026: der
   Kalender zeigte 550 DKK Saisonpreis, während 540 berechnete Tage zwischen
   440 und 801 DKK auf Freigabe warteten — und ein Gast auf der eigenen
   Plattform hätte den falschen Preis BEZAHLT.
"""
from __future__ import annotations

import inspect
from pathlib import Path

# Die drei Wege nach draussen. Wer einen vierten baut, muss ihn hier eintragen
# — und merkt beim Lesen, dass er die Freigabe fragen muss.
_PUSH_WEGE = (
    ("pricing/recompute.py", "_push_to_channex"),
    ("channel_manager/ari_push.py", "_load_desired_rate_plan_prices"),
    ("channel_manager/full_sync.py", None),  # ganze Datei
)

_SLICE = Path(__file__).resolve().parents[2]


def _quelle(datei: str) -> str:
    return (_SLICE / datei).read_text(encoding="utf-8")


def test_alle_push_wege_fragen_die_freigabe() -> None:
    """Jeder Weg nach draussen muss `gesperrte_tage` aufrufen."""
    for datei, _ in _PUSH_WEGE:
        quelle = _quelle(datei)
        assert "gesperrte_tage" in quelle, (
            f"{datei} pusht Preise an die Portale, fragt aber die Freigabe "
            "nicht. Ein Gate an nur einem Weg ist eine Attrappe — genau daran "
            "scheiterte der frühere Autopilot-Modus."
        )


def test_resolver_kennt_die_freigabe_nicht() -> None:
    """Der Resolver ist die EINE Preis-Wahrheit — Kalender, Angebot, eigene
    Buchungsstrecke lesen daraus. Eine Freigabe-Sperre dort verändert nicht
    die Portal-Sichtbarkeit, sondern den gültigen Verkaufspreis."""
    quelle = _quelle("pricing/resolver.py")
    assert "freigabe" not in quelle.lower(), (
        "Der Resolver darf die Freigabe NICHT kennen: sie gehört an den "
        "Portal-Push, nicht an die Preis-Wahrheit. Sonst zeigt der Kalender "
        "einen anderen Preis als die Engine gerechnet hat (live 04.09.2026: "
        "550 statt 440 DKK), und Gäste zahlen ihn auch."
    )


def test_freigabe_faellt_offen_aus() -> None:
    """Ein Lesefehler darf Preise nicht stillschweigend zurückhalten.

    Anders als bei Rechte-Prüfungen ist fail-OPEN hier richtig: ein
    stehengebliebener Preis fällt niemandem auf, bis ein Gast zu ihm bucht.
    """
    from unittest.mock import MagicMock

    from src.features.pricing.freigabe import freigabe_noetig, gesperrte_tage

    db = MagicMock()
    db.table.side_effect = RuntimeError("DB weg")
    assert freigabe_noetig(db, "p1") is False

    from datetime import date

    assert gesperrte_tage(db, "p1", date(2026, 6, 1), date(2026, 7, 1)) == set()


def test_freigabe_ohne_pflicht_sperrt_nichts() -> None:
    """Ohne gesetzten Schalter darf nie ein Tag zurückgehalten werden."""
    from datetime import date
    from unittest.mock import MagicMock

    from src.features.pricing.freigabe import gesperrte_tage

    class _T:
        def select(self, *_a: object, **_k: object) -> _T:
            return self

        def eq(self, *_a: object) -> _T:
            return self

        def limit(self, *_a: object) -> _T:
            return self

        def execute(self) -> MagicMock:
            return MagicMock(data=[{"freigabe_noetig": False}])

    db = MagicMock()
    db.table.return_value = _T()
    assert gesperrte_tage(db, "p1", date(2026, 6, 1), date(2026, 7, 1)) == set()


def test_freigabe_helfer_hat_keine_zweitfassung() -> None:
    """Die Frage „wartet dieses Objekt?" darf es nur EINMAL im Code geben.

    Zwei Fassungen driften auseinander, und dann sperrt ein Weg, während ein
    anderer sendet.
    """
    treffer = []
    for pfad in _SLICE.rglob("*.py"):
        if pfad.name in ("freigabe.py", "test_freigabe.py"):
            continue
        text = pfad.read_text(encoding="utf-8")
        if "def _freigabe_noetig" in text or "def freigabe_noetig" in text:
            treffer.append(str(pfad.relative_to(_SLICE)))
    assert not treffer, (
        f"Zweite Fassung der Freigabe-Prüfung in: {treffer}. Es gibt genau "
        "eine, in pricing/freigabe.py."
    )


def test_gesperrte_tage_signatur_stabil() -> None:
    """Drei Aufrufer verlassen sich auf (db, property_id, von, bis)."""
    from src.features.pricing.freigabe import gesperrte_tage

    params = list(inspect.signature(gesperrte_tage).parameters)
    assert params == ["db", "property_id", "von", "bis"]
