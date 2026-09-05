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


def test_freigabe_fenster_endet_am_push_horizont() -> None:
    """Gezaehlt wird nur, was auch gesendet werden KANN.

    Live am 04.09.2026 stand „540 Tage nicht gesendet" an einem Kalender, der
    30 Tage zeigt. Der Recompute schreibt 540 Tage voraus
    (`recompute.DEFAULT_HORIZON_DAYS`), der Push bedient 365
    (`settings_service._UMSCHALT_HORIZONT_TAGE`). Die Zaehlung nahm alles ab
    heute — die 174 Tage dazwischen konnten nie gesendet werden und warteten
    deshalb fuer immer auf eine Freigabe, die ihnen nichts nuetzt.
    """
    from datetime import date, timedelta

    from src.features.pricing.freigabe import (
        FREIGABE_HORIZONT_TAGE,
        freigabe_fenster,
    )
    from src.features.pricing.recompute import DEFAULT_HORIZON_DAYS

    heute = date(2026, 9, 4)
    von, bis = freigabe_fenster(heute)
    assert von == "2026-09-04"
    assert bis == (heute + timedelta(days=FREIGABE_HORIZONT_TAGE)).isoformat()
    assert FREIGABE_HORIZONT_TAGE < DEFAULT_HORIZON_DAYS, (
        "Der Rechen-Horizont ist laenger als der Push-Horizont — genau deshalb "
        "braucht die Zaehlung eine obere Grenze."
    )


def test_zaehlstellen_begrenzen_den_horizont() -> None:
    """Jede Stelle, die offene Tage zaehlt oder freigibt, MUSS das Fenster
    nutzen. Eine Stelle ohne obere Grenze bringt die 540 zurueck."""
    import re
    from pathlib import Path

    slice_dir = Path(__file__).resolve().parents[1]
    fehlend = []
    for name in ("tagesmodus_service.py", "settings_service.py"):
        text = (slice_dir / name).read_text(encoding="utf-8")
        for treffer in re.finditer(r'\.is_\(\s*"gesendet_am",\s*"null"\s*\)', text):
            umfeld = text[max(0, treffer.start() - 400) : treffer.start() + 400]
            if ".lte(" not in umfeld and "bis" not in umfeld:
                zeile = text[: treffer.start()].count("\n") + 1
                fehlend.append(f"{name}:{zeile}")
    assert not fehlend, (
        f"Zaehlung ohne oberen Horizont in: {fehlend}. "
        "freigabe_fenster() liefert beide Grenzen."
    )


def test_freigabe_schalter_pflegt_beide_richtungen() -> None:
    """Der Schalter hat einen Gegenzustand in BEIDE Richtungen (Wurzel 1).

    Einschalten: der bereits gesendete Bestand behaelt seinen Stempel, sonst
    erfindet der Klick einen Rueckstau aus der Vergangenheit.
    Ausschalten: der aufgestaute Rueckstand geht sofort raus — sonst
    verkaufen die Portale weiter zum alten Preis, und niemand sieht es.
    Live am 04.09.2026 standen so 435 von 540 Tagen falsch bei Channex.
    """
    import inspect

    from src.features.pricing.settings_service import DpSettingsService

    quelle = inspect.getsource(DpSettingsService.update)
    assert "_bestand_als_gesendet_stempeln" in quelle, (
        "Einschalten pflegt seinen Gegenzustand nicht"
    )
    assert "_preise_neu_verteilen" in quelle, (
        "Ausschalten schickt den Rueckstand nicht raus"
    )
    assert "freigabe_vorher" in quelle


def test_stempel_hat_genau_einen_weg() -> None:
    """Zwei Sende-Wege, ein Stempel (05.09.2026).

    Der Umschalt-Push (`_preise_neu_verteilen`) schickte dieselben Preise wie
    der Recompute hinaus, stempelte aber nicht: 1000 von 1000 Schatten-Zeilen
    stimmten, die Seite zeigte „366 Tage nicht gesendet". Beide Wege stempeln
    jetzt über `freigabe.gesendet_stempeln`; eine zweite Fassung des Updates
    darf es nirgends geben.
    """
    import inspect

    from src.features.pricing.recompute import DynamicPricingRecompute
    from src.features.pricing.settings_service import DpSettingsService

    assert "gesendet_stempeln(" in inspect.getsource(DpSettingsService._preise_neu_verteilen)
    assert "gesendet_stempeln(" in inspect.getsource(DynamicPricingRecompute._gesendet_stempeln)
    treffer = []
    for pfad in _SLICE.rglob("*.py"):
        if pfad.name in ("freigabe.py",) or pfad.parent.name == "tests":
            continue
        text = pfad.read_text(encoding="utf-8")
        if '"gesendet_am": datetime.now' in text:
            treffer.append(str(pfad.relative_to(_SLICE)))
    # Erlaubt sind genau die zwei FREIGABE-Bereichsupdates (Bestand beim
    # Einschalten, Klick „freigeben") — sie stempeln Zeiträume als Willensakt
    # des Betriebs, nicht als Beleg eines Pushs. Jeder Push-Beleg läuft über
    # den Helfer.
    assert sorted(treffer) == [
        "pricing/settings_service.py",
        "pricing/tagesmodus_service.py",
    ], f"Stempel-Update an unerwarteter Stelle: {treffer}"


def test_umschalt_push_stempelt_nur_dynamische_tage() -> None:
    """Beim Umlegen auf „Sofort" gehen dynamische Tage raus UND werden gestempelt;
    manuelle Tage (Tagesmodus fest) tragen keine dynamic_prices-Zeile und
    bekommen keinen Stempel."""
    from datetime import date
    from types import SimpleNamespace

    from src.features.pricing import settings_service as modul

    gestempelt: list[list[str]] = []
    svc = modul.DpSettingsService.__new__(modul.DpSettingsService)
    svc._db = lambda: object()  # type: ignore[method-assign]
    tage = [
        SimpleNamespace(date=date(2026, 9, 5), source="dynamic", price=692.61),
        SimpleNamespace(date=date(2026, 9, 6), source="override", price=577.5),
        SimpleNamespace(date=date(2026, 9, 7), source="dynamic", price=586.56),
    ]
    svc._resolver = lambda: SimpleNamespace(  # type: ignore[method-assign]
        effective_prices=lambda *_a, **_k: tage
    )

    class _Kalender:
        def __init__(self, **_k: object) -> None: ...

        def preisbloecke(self, _tage: object) -> list:
            return [(date(2026, 9, 5), date(2026, 9, 8), 60000)]

        def push_channex_rate(self, *_a: object) -> None: ...

    import src.features.calendar.service as kal

    original = kal.CalendarService
    kal.CalendarService = _Kalender  # type: ignore[misc, assignment]
    alt = modul.gesendet_stempeln
    modul.gesendet_stempeln = lambda _db, _pid, t: gestempelt.append(t)  # type: ignore[assignment]
    try:
        svc._preise_neu_verteilen("p1", eingeschaltet=True)
        svc._preise_neu_verteilen("p1", eingeschaltet=False)
    finally:
        modul.gesendet_stempeln = alt
        kal.CalendarService = original  # type: ignore[misc]
    assert gestempelt == [["2026-09-05", "2026-09-07"]], (
        "Einschalten stempelt genau die dynamischen Tage; Abschalten stempelt nichts"
    )
