"""Objektsuche in beiden Monitoren — Freitext auf den Objektnamen.

WOZU: Bei 612 Webhook-Eingängen und 2.376 Worker-Ereignissen (live, 14.08.2026)
ist Blättern kein Weg, ein bestimmtes Ferienhaus zu finden. Eine Auswahlliste
wäre bei den heutigen 43 Objekten bequem und bei den erwarteten 100+ selbst das
Problem — deshalb Freitext.

DIE GEFÄHRLICHE STELLE, gegen die die Hälfte dieser Tests steht: Findet die
Suche kein Objekt, DARF der Filter nicht stillschweigend entfallen. Täte er es,
zeigte eine Suche ohne Treffer die volle ungefilterte Liste — und die sähe aus,
als hätte das gesuchte Objekt jedes dieser Ereignisse ausgelöst.
"""

from __future__ import annotations

from typing import Any

from src.features.platform_admin import objekt_suche
from src.features.platform_admin import webhook_verlauf as webhook
from src.features.platform_admin import worker_verlauf as worker


class _Query:
    """Nur die Kette, die die Listen-Funktionen wirklich benutzen."""

    def __init__(self, db: _DB, tabelle: str) -> None:
        self._db = db
        self._tabelle = tabelle
        self._ilike: tuple[str, str] | None = None
        self._in: tuple[str, list[str]] | None = None
        self._eq: dict[str, Any] = {}
        self._limit: int | None = None

    def select(self, *_a: object, **_k: object) -> _Query:
        return self

    def ilike(self, spalte: str, muster: str) -> _Query:
        self._ilike = (spalte, muster)
        return self

    def in_(self, spalte: str, werte: list[str]) -> _Query:
        self._in = (spalte, list(werte))
        # Für die Prüfung: WELCHE IDs sind in die EREIGNIS-Abfrage gegangen?
        # Nur `property_id` zählt — `properties`/`tenants` werden ebenfalls per
        # `in_("id", …)` nachgeladen, um die Namen zu holen, und das ist kein
        # Filter auf die Ereignisse.
        if spalte == "property_id":
            self._db.in_filter = (spalte, list(werte))
        return self

    def eq(self, spalte: str, wert: Any) -> _Query:
        self._eq[spalte] = wert
        return self

    def gte(self, *_a: object) -> _Query:
        return self

    def limit(self, n: int) -> _Query:
        self._limit = n
        return self

    def order(self, *_a: object, **_k: object) -> _Query:
        return self

    def range(self, *_a: object) -> _Query:
        return self

    def _passt(self, row: dict[str, Any]) -> bool:
        if self._ilike:
            spalte, muster = self._ilike
            kern = muster.strip("%").lower()
            if kern not in str(row.get(spalte) or "").lower():
                return False
        if self._in:
            spalte, werte = self._in
            if str(row.get(spalte)) not in werte:
                return False
        return all(row.get(k) == v for k, v in self._eq.items())

    def execute(self) -> Any:
        rows = [r for r in self._db.tabellen.get(self._tabelle, []) if self._passt(r)]
        if self._limit is not None:
            rows = rows[: self._limit]
        return type("R", (), {"data": rows, "count": len(rows)})()


class _DB:  # pylint: disable=too-few-public-methods
    """Fake-Client über mehreren Tabellen."""

    def __init__(self, tabellen: dict[str, list[dict[str, Any]]]) -> None:
        self.tabellen = tabellen
        #: Womit die EREIGNIS-Abfrage gefiltert wurde (None = gar nicht).
        self.in_filter: tuple[str, list[str]] | None = None

    def table(self, name: str) -> _Query:
        return _Query(self, name)


_OBJEKTE = [
    {"id": "p-1", "title": "Feriehus Kornblomst"},
    {"id": "p-2", "title": "FeWo *Stjerneskud*"},
    {"id": "p-3", "title": "Rævlingehuset"},
]


def _webhook_db() -> _DB:
    return _DB(
        {
            "properties": list(_OBJEKTE),
            "tenants": [{"id": "t-1", "name": "AirSmil"}],
            "channex_webhook_event": [
                {
                    "id": f"ev-{i}",
                    "event": "message",
                    "severity": "info",
                    "resolved": False,
                    "property_id": pid,
                    "tenant_id": "t-1",
                    "payload": {},
                    "created_at": "2026-08-14T10:00:00Z",
                }
                for i, pid in enumerate(["p-1", "p-2", "p-3", "p-1"])
            ],
        }
    )


def _worker_db() -> _DB:
    return _DB(
        {
            "properties": list(_OBJEKTE),
            "worker_ereignis": [
                # Zwei mit Objekt …
                {
                    "id": "w-1",
                    "richtung": "gesendet",
                    "vorgang": "ari_property",
                    "ergebnis": "ok",
                    "property_id": "p-1",
                    "erfasst_at": "2026-08-14T10:00:00Z",
                },
                {
                    "id": "w-2",
                    "richtung": "gesendet",
                    "vorgang": "ari_property",
                    "ergebnis": "ok",
                    "property_id": "p-2",
                    "erfasst_at": "2026-08-14T10:01:00Z",
                },
                # … und eines OHNE (Tick/Feed-Lauf) — live die Mehrheit.
                {
                    "id": "w-3",
                    "richtung": "job",
                    "vorgang": "sync_bookings_feed",
                    "ergebnis": "ok",
                    "property_id": None,
                    "erfasst_at": "2026-08-14T10:02:00Z",
                },
            ],
        }
    )


# --------------------------------------------------------------------------
# Der Kern: IDs finden
# --------------------------------------------------------------------------


def test_suche_findet_teiltreffer_unabhaengig_von_gross_klein() -> None:
    """Wer „kornblomst" tippt, meint „Feriehus Kornblomst"."""
    db = _webhook_db()
    assert objekt_suche.property_ids_zu_suche(db, "kornblomst") == ["p-1"]
    assert objekt_suche.property_ids_zu_suche(db, "KORNBLOMST") == ["p-1"]


def test_leere_suche_gibt_nichts_zurueck() -> None:
    """Ein leerer Begriff ist keine Suche — der Aufrufer filtert dann gar nicht."""
    db = _webhook_db()
    assert objekt_suche.property_ids_zu_suche(db, "") == []
    assert objekt_suche.property_ids_zu_suche(db, "   ") == []


def test_suche_ist_auf_treffer_begrenzt() -> None:
    """Die IDs landen in der Request-URL — ein unscharfer Begriff darf sie nicht
    unbegrenzt wachsen lassen (Wurzel 8)."""
    viele = [{"id": f"p-{i}", "title": f"Haus {i}"} for i in range(500)]
    db = _DB({"properties": viele})
    assert len(objekt_suche.property_ids_zu_suche(db, "Haus")) == (
        objekt_suche.MAX_TREFFER
    )


# --------------------------------------------------------------------------
# Webhook-Monitor
# --------------------------------------------------------------------------


def test_webhook_suche_filtert_auf_das_objekt() -> None:
    """Die Liste zeigt nur noch die Eingänge des gesuchten Objekts."""
    db = _webhook_db()
    ergebnis = webhook.liste(db, suche="Kornblomst")
    assert ergebnis.gesamt == 2
    assert {e.property_id for e in ergebnis.items} == {"p-1"}


def test_webhook_suche_ohne_treffer_zeigt_NICHTS() -> None:
    """Der gefährliche Fall: Ohne Treffer darf der Filter NICHT entfallen.

    Täte er es, käme die volle ungefilterte Liste zurück und sähe aus, als
    hätte das gesuchte Objekt jedes dieser Ereignisse ausgelöst (Wurzel 4).
    """
    db = _webhook_db()
    ergebnis = webhook.liste(db, suche="Gibt-es-nicht")
    assert ergebnis.gesamt == 0
    assert ergebnis.items == []


def test_webhook_ohne_suche_filtert_gar_nicht() -> None:
    """Ohne Suchbegriff bleibt die Liste vollständig."""
    db = _webhook_db()
    assert webhook.liste(db).gesamt == 4
    assert db.in_filter is None


def test_webhook_suche_kombiniert_mit_event_filter() -> None:
    """Suche ersetzt die übrigen Filter nicht, sie ergänzt sie."""
    db = _webhook_db()
    ergebnis = webhook.liste(db, suche="Kornblomst", event="review")
    assert ergebnis.gesamt == 0


# --------------------------------------------------------------------------
# Worker-Monitor
# --------------------------------------------------------------------------


def test_worker_suche_filtert_auf_das_objekt() -> None:
    """Dieselbe Geste wie im Webhook-Monitor."""
    db = _worker_db()
    ergebnis = worker.liste(db, suche="Kornblomst")
    assert ergebnis.gesamt == 1
    assert ergebnis.items[0].property_id == "p-1"


def test_worker_suche_ohne_treffer_zeigt_NICHTS() -> None:
    """Auch hier: kein stilles Weglassen des Filters."""
    db = _worker_db()
    assert worker.liste(db, suche="Gibt-es-nicht").gesamt == 0


def test_worker_suche_blendet_ereignisse_ohne_objekt_aus() -> None:
    """Ticks und Feed-Läufe gelten keinem Objekt — live 1.483 von 2.376.

    Sie MÜSSEN bei einer Objektsuche verschwinden; die Oberfläche benennt das,
    damit die geschrumpfte Liste nicht wie ein Defekt aussieht.
    """
    db = _worker_db()
    ergebnis = worker.liste(db, suche="Feriehus")
    assert "w-3" not in {e.id for e in ergebnis.items}


def test_worker_ohne_suche_zeigt_auch_ereignisse_ohne_objekt() -> None:
    """Ohne Suche bleibt der Verlauf vollständig — inklusive der Ticks."""
    db = _worker_db()
    ergebnis = worker.liste(db)
    assert ergebnis.gesamt == 3
    assert "w-3" in {e.id for e in ergebnis.items}
