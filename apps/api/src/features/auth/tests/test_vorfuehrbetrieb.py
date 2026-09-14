"""`tenants.ist_vorfuehrbetrieb` (0630) — der Betrieb ohne Vorfuehr-Riegel.

An diesem einen Betrieb wird Skattestyrelsen der DAC7-Meldeweg gezeigt.
Dafuer muessen BEIDE Riegel aus `demo_gate` ihn durchlassen: der
Bereichsriegel (403, auch lesend) und der Schreibriegel (405).

Die drei Flags bedeuten drei verschiedene Dinge und wurden schon zweimal
verwechselt — 0505 musste `is_internal` gegen `is_demo` abgrenzen, 0529
musste `is_demo` wiederherstellen, nachdem ein Seed-Lauf es verlor. Diese
Tests halten die Grenze fest, damit sie nicht ein drittes Mal verrutscht.
"""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from src.core.security import AuthContext
from src.features.auth import demo_gate


class _Antwort:
    def __init__(self, zeilen: list[dict]) -> None:
        self.data = zeilen


class _Tabelle:
    """Minimaler Supabase-Ersatz: gibt immer dieselbe Zeile zurueck."""

    def __init__(self, zeile: dict | None) -> None:
        self._zeile = zeile

    def select(self, *_a: str, **_k: object) -> _Tabelle:
        return self

    def eq(self, *_a: object, **_k: object) -> _Tabelle:
        return self

    def limit(self, *_a: int, **_k: object) -> _Tabelle:
        return self

    def execute(self) -> _Antwort:
        return _Antwort([self._zeile] if self._zeile else [])


class _Client:
    def __init__(self, zeile: dict | None) -> None:
        self._zeile = zeile

    def table(self, _name: str) -> _Tabelle:
        return _Tabelle(self._zeile)


@pytest.fixture
def ctx() -> AuthContext:
    return AuthContext(user_id="u1", tenant_id="t1", role="admin")


def _mandant(monkeypatch: pytest.MonkeyPatch, zeile: dict | None) -> None:
    monkeypatch.setattr(
        demo_gate, "get_service_client", lambda: _Client(zeile)
    )


# -- Schreibriegel ---------------------------------------------------------

def test_vorfuehrbetrieb_darf_schreiben(
    monkeypatch: pytest.MonkeyPatch, ctx: AuthContext
) -> None:
    """Ohne das wuerde schon das Erzeugen eines Meldelaufs mit 405 enden."""
    _mandant(monkeypatch, {"is_demo": True, "ist_vorfuehrbetrieb": True})
    demo_gate.demo_schreibzugriff_pruefen("POST", ctx, "/taxpayer/dac7/erzeugen")


def test_demo_ohne_vorfuehrflag_darf_weiterhin_nicht_schreiben(
    monkeypatch: pytest.MonkeyPatch, ctx: AuthContext
) -> None:
    """Die oeffentliche Schaufenster-Vorfuehrung bleibt schreibgeschuetzt.

    Der eigentliche Zweck der Trennung: `Nordlys` traegt `is_demo` und ist
    der oeffentliche Live-Vorschau-Zugang. Faellt dort die Schreibsperre,
    kann jeder Besucher der Marketing-Seite Daten aendern.
    """
    _mandant(monkeypatch, {"is_demo": True, "ist_vorfuehrbetrieb": False})
    with pytest.raises(HTTPException) as fehler:
        demo_gate.demo_schreibzugriff_pruefen("POST", ctx, "/objekte")
    assert fehler.value.status_code == 405


# -- Bereichsriegel --------------------------------------------------------

def test_vorfuehrbetrieb_sieht_gesperrte_bereiche(
    monkeypatch: pytest.MonkeyPatch, ctx: AuthContext
) -> None:
    """`/taxpayer` ist gesperrt — fuer den Vorfuehrbetrieb aber nicht.

    Das war der sichtbare Fehler: Die DAC7-Seite meldete „Die Meldungen
    konnten nicht geladen werden", weil der lesende Abruf 403 bekam.
    """
    _mandant(monkeypatch, {"is_demo": True, "ist_vorfuehrbetrieb": True})
    demo_gate.demo_bereich_pruefen("/api/v1/taxpayer/dac7/laeufe", ctx)


def test_demo_ohne_vorfuehrflag_bleibt_ausgesperrt(
    monkeypatch: pytest.MonkeyPatch, ctx: AuthContext
) -> None:
    _mandant(monkeypatch, {"is_demo": True, "ist_vorfuehrbetrieb": False})
    with pytest.raises(HTTPException) as fehler:
        demo_gate.demo_bereich_pruefen("/api/v1/taxpayer/dac7/laeufe", ctx)
    assert fehler.value.status_code == 403


# -- Fail-Richtung ---------------------------------------------------------

def test_lesefehler_hebt_den_riegel_nicht_auf(
    monkeypatch: pytest.MonkeyPatch, ctx: AuthContext
) -> None:
    """Faellt die Abfrage aus, bleibt gesperrt — nie fail-open (Wurzel 5).

    Eine nicht vorfuehrbare Demo ist das kleinere Uebel als eine, die bei
    einem DB-Aussetzer jedem Besucher die Steuerseite oeffnet.
    """

    class _Kaputt:
        def table(self, _n: str) -> object:
            raise RuntimeError("DB weg")

    monkeypatch.setattr(demo_gate, "get_service_client", _Kaputt)
    assert demo_gate._ist_vorfuehrbetrieb(ctx) is False
