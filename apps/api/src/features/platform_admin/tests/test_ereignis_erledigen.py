"""Fehler-Ereignisse müssen abhakbar sein — sonst verkommt die Warnung zur Tapete.

DER BEFUND (13.08.2026): `channex_webhook_event.resolved` gab es seit 0378, aber
NIEMAND setzte es — bei allen 603 Ereignissen stand `false`. Die Konsole zeigte
deshalb 18 Fehler dauerhaft als „Eingriff nötig", darunter vier
`deactivate_channel` vom Vortag, während live geprüft ALLE Booking-Kanäle wieder
`is_active: true` waren.

Stehen achtzehn erledigte Einträge dauerhaft rot, übersieht man den einen, der
heute zählt. Genau dagegen sind diese Tests gebaut.
"""

from __future__ import annotations

from typing import Any

import pytest

from src.core.security import AuthContext
from src.features.platform_admin import ereignis_erledigen as dienst


class _Query:
    """Nur die Kette, die `ereignis_erledigen` wirklich benutzt."""

    def __init__(self, db: _DB) -> None:
        self._db = db
        self._update: dict[str, Any] | None = None
        self._filter: dict[str, Any] = {}

    def select(self, *_a: object) -> _Query:
        """Lesepfad — die Filter entscheiden, was zurückkommt."""
        return self

    def update(self, payload: dict[str, Any]) -> _Query:
        """Schreibpfad; ausgeführt wird erst bei `execute()`."""
        self._update = payload
        return self

    def eq(self, spalte: str, wert: Any) -> _Query:
        """Filter sammeln — auch `resolved=False` als Nebenläufigkeits-Schutz."""
        self._filter[spalte] = wert
        return self

    def limit(self, _n: int) -> _Query:
        """Ohne Wirkung im Fake; die Zeilen sind eindeutig über die id."""
        return self

    def _passt(self, row: dict[str, Any]) -> bool:
        return all(row.get(k) == v for k, v in self._filter.items())

    def execute(self) -> Any:
        treffer = [r for r in self._db.rows if self._passt(r)]
        if self._update is not None:
            for r in treffer:
                r.update(self._update)
        return type("R", (), {"data": treffer})()


class _DB:  # pylint: disable=too-few-public-methods
    """Fake-Client über einer Liste von Zeilen."""

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def table(self, _name: str) -> _Query:
        """Beide Monitore fassen je genau eine Tabelle an."""
        return _Query(self)


def _ctx(user: str = "admin-1") -> AuthContext:
    return AuthContext(user_id=user, tenant_id=None, role="platform_admin")


def _zeile(**over: Any) -> dict[str, Any]:
    """Eine offene Fehler-Zeile; `over` überschreibt einzelne Felder."""
    basis = {
        "id": "ev-1",
        "severity": "error",
        "resolved": False,
        "resolved_at": None,
        "resolved_by": None,
        "resolution": None,
    }
    basis.update(over)
    return basis


# --------------------------------------------------------------------------
# Abhaken
# --------------------------------------------------------------------------


def test_erledigen_setzt_zustand_und_notiz() -> None:
    """Abhaken vermerkt Zustand, Bearbeiter, Zeitpunkt und Notiz."""
    db = _DB([_zeile()])
    ergebnis = dienst.erledigen(
        db, _ctx(), dienst.WEBHOOK, "ev-1", notiz="Kanal wieder verbunden"
    )
    assert ergebnis["resolved"] is True
    assert ergebnis["notiz"] == "Kanal wieder verbunden"
    assert ergebnis["resolved_by"] == "admin-1"
    assert ergebnis["resolved_at"] is not None


def test_erledigen_ohne_notiz_speichert_kein_leeres_objekt() -> None:
    """`{}` sähe aus wie eine Notiz, die verloren ging (Wurzel 4)."""
    db = _DB([_zeile()])
    ergebnis = dienst.erledigen(db, _ctx(), dienst.WEBHOOK, "ev-1")
    assert ergebnis["resolved"] is True
    assert ergebnis["notiz"] is None
    assert db.rows[0]["resolution"] is None


def test_nur_leerzeichen_gilt_als_keine_notiz() -> None:
    """Weissraum ist keine Notiz — sonst stünde „„"" unter dem Eintrag."""
    db = _DB([_zeile()])
    assert dienst.erledigen(
        db, _ctx(), dienst.WEBHOOK, "ev-1", notiz="   "
    )["notiz"] is None


def test_zweiter_klick_ueberschreibt_den_ersten_nicht() -> None:
    """Wurzel 2: Wer zuerst abgehakt hat, bleibt vermerkt."""
    db = _DB([_zeile()])
    dienst.erledigen(db, _ctx("admin-1"), dienst.WEBHOOK, "ev-1", notiz="erste")
    zuerst = db.rows[0]["resolved_at"]

    zweites = dienst.erledigen(
        db, _ctx("admin-2"), dienst.WEBHOOK, "ev-1", notiz="zweite"
    )
    assert zweites["resolved_by"] == "admin-1"
    assert zweites["notiz"] == "erste"
    assert db.rows[0]["resolved_at"] == zuerst


def test_zu_lange_notiz_wird_abgelehnt() -> None:
    """Ein Freitextfeld ohne Grenze ist ein offener Speicher (Wurzel 8)."""
    db = _DB([_zeile()])
    with pytest.raises(dienst.ErledigenFehler) as exc:
        dienst.erledigen(
            db, _ctx(), dienst.WEBHOOK, "ev-1", notiz="x" * (dienst.NOTIZ_MAX + 1)
        )
    assert exc.value.status_code == 422
    # Nichts geschrieben — die Zeile bleibt offen.
    assert db.rows[0]["resolved"] is False


def test_unbekanntes_ereignis_404() -> None:
    """Eine ID, die es nicht gibt, ist ein 404 — kein stiller Erfolg."""
    with pytest.raises(dienst.ErledigenFehler) as exc:
        dienst.erledigen(_DB([]), _ctx(), dienst.WEBHOOK, "gibt-es-nicht")
    assert exc.value.status_code == 404


# --------------------------------------------------------------------------
# Der Rückweg
# --------------------------------------------------------------------------


def test_wieder_oeffnen_stellt_offen_und_behaelt_die_notiz() -> None:
    """Ohne Rückweg liesse ein Fehlklick ein echtes Problem verschwinden.

    Die Notiz bleibt: Sie sagt, was jemand damals dachte, und das bleibt auch
    nach dem Wiederöffnen wahr.
    """
    db = _DB([_zeile()])
    dienst.erledigen(db, _ctx(), dienst.WEBHOOK, "ev-1", notiz="war ein Irrtum")
    ergebnis = dienst.wieder_oeffnen(db, _ctx(), dienst.WEBHOOK, "ev-1")
    assert ergebnis["resolved"] is False
    assert ergebnis["resolved_at"] is None
    assert ergebnis["resolved_by"] is None
    assert db.rows[0]["resolution"] == {"note": "war ein Irrtum"}


def test_wieder_oeffnen_eines_offenen_ist_ein_noop() -> None:
    """Wurzel 2: zweimal öffnen ändert nichts und wirft nicht."""
    db = _DB([_zeile()])
    assert (
        dienst.wieder_oeffnen(db, _ctx(), dienst.WEBHOOK, "ev-1")["resolved"]
        is False
    )


# --------------------------------------------------------------------------
# Beide Monitore, dieselbe Geste
# --------------------------------------------------------------------------


def test_worker_ereignis_laeuft_ueber_denselben_weg() -> None:
    """Ein fehlgeschlagener Job bleibt sonst für immer als Fehler stehen —
    auch wenn der nächste Lauf längst durchlief."""
    db = _DB([_zeile(ergebnis="fehler", severity=None)])
    ergebnis = dienst.erledigen(
        db, _ctx(), dienst.WORKER, "ev-1", notiz="Redis-Alias behoben"
    )
    assert ergebnis["resolved"] is True
    assert ergebnis["notiz"] == "Redis-Alias behoben"


def test_beide_quellen_zeigen_auf_verschiedene_tabellen() -> None:
    """Der EINZIGE Unterschied zwischen den Monitoren ist die Konfiguration —
    keine zweite Implementierung, die auseinanderlaufen könnte."""
    assert dienst.WEBHOOK.tabelle == "channex_webhook_event"
    assert dienst.WORKER.tabelle == "worker_ereignis"
    assert dienst.WEBHOOK.fehler_spalte == "severity"
    assert dienst.WORKER.fehler_spalte == "ergebnis"
