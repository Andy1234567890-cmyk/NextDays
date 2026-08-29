"""Webhook-Seite der kostenlosen Testphase (0488).

Was hier geschuetzt wird, ist die Halfte, die im Betrieb NIE jemand ansieht:
Stripe schickt die Ereignisse, unser Code muss sie richtig deuten. Faellt eine
davon aus, merkt es niemand — es passiert einfach nichts, und das sieht von
aussen aus wie „laeuft".

Drei Dinge muessen stimmen:
  * Der Stempel `trial_used_at` entsteht, sonst ist die Testphase beliebig oft
    wiederholbar (Wurzel 2).
  * Er traegt Stripes Zeitpunkt, nicht unseren (Wurzel 5b).
  * `trial_will_end` erreicht die Benachrichtigung, sonst wird der Betrieb
    ohne Vorwarnung belastet — genau daraus werden Rueckbuchungen.
"""
from __future__ import annotations

from typing import Any

from src.features.payments import webhook as wh


class _Q:
    """Minimaler Query-Stub: merkt sich den letzten upsert je Tabelle."""

    def __init__(self, store: dict, name: str) -> None:
        self._store = store
        self._name = name
        self._eq: dict[str, Any] = {}

    def select(self, *_a: object, **_k: object) -> _Q:
        return self

    def upsert(self, payload: dict, **_k: object) -> _Q:
        self._store.setdefault("__upserts__", []).append((self._name, payload))
        return self

    def update(self, payload: dict) -> _Q:
        self._store.setdefault("__updates__", []).append((self._name, payload))
        return self

    def eq(self, spalte: str, wert: object) -> _Q:
        self._eq[spalte] = wert
        return self

    def limit(self, *_a: object, **_k: object) -> _Q:
        return self

    def in_(self, *_a: object, **_k: object) -> _Q:
        return self

    def execute(self) -> Any:
        zeilen = [
            z
            for z in self._store.get(self._name, [])
            if all(z.get(k) == v for k, v in self._eq.items())
        ]

        class _R:
            data = zeilen

        return _R()


class _DB:
    def __init__(self, store: dict | None = None) -> None:
        self.store: dict = store or {}

    def table(self, name: str) -> _Q:
        return _Q(self.store, name)


def _db_mit_abo() -> _DB:
    return _DB(
        {
            "tenant_subscription": [
                {"tenant_id": "t1", "stripe_subscription_id": "sub_1"}
            ]
        }
    )


def _upsert_payload(db: _DB) -> dict:
    treffer = [
        p for name, p in db.store.get("__upserts__", []) if name == "tenant_subscription"
    ]
    assert treffer, "kein upsert auf tenant_subscription"
    return treffer[-1]


# --- Stempel -----------------------------------------------------------------


def test_trialing_stempelt_die_testphase() -> None:
    """Ohne Stempel waere die Testphase beliebig oft wiederholbar."""
    db = _db_mit_abo()
    wh._handle_subscription_event(  # noqa: SLF001
        db,
        {
            "id": "sub_1",
            "status": "trialing",
            # 2026-08-18T10:00:00Z
            "trial_start": 1787047200,
            "metadata": {"tenant_id": "t1"},
        },
    )
    payload = _upsert_payload(db)
    assert payload["trial_used_at"].startswith("2026-08-18T10:00:00")


def test_stempel_kommt_aus_stripe_nicht_von_unserer_uhr() -> None:
    """Wurzel 5b: der Zeitpunkt eines fremden Ereignisses stammt aus der
    fremden Quelle. Ein Wert von heute waere hier eine Falschaussage."""
    db = _db_mit_abo()
    wh._handle_subscription_event(  # noqa: SLF001
        db,
        {
            "id": "sub_1",
            "status": "trialing",
            "trial_start": 1787047200,
            "metadata": {"tenant_id": "t1"},
        },
    )
    assert _upsert_payload(db)["trial_used_at"].startswith("2026-08-18")


def test_stempel_faellt_nie_leer_aus() -> None:
    """Fehlt `trial_start`, wird trotzdem gestempelt: ein LEERER Stempel
    gaebe die Testphase erneut frei (fail-open waere hier der Fehler)."""
    db = _db_mit_abo()
    wh._handle_subscription_event(  # noqa: SLF001
        db,
        {"id": "sub_1", "status": "trialing", "metadata": {"tenant_id": "t1"}},
    )
    assert _upsert_payload(db)["trial_used_at"]


def test_aktives_abo_stempelt_nicht() -> None:
    """Nur `trialing` setzt den Stempel — ein normaler Abschluss ohne
    Testphase darf sie nicht verbrauchen."""
    db = _db_mit_abo()
    wh._handle_subscription_event(  # noqa: SLF001
        db,
        {"id": "sub_1", "status": "active", "metadata": {"tenant_id": "t1"}},
    )
    assert "trial_used_at" not in _upsert_payload(db)


# --- Erinnerung --------------------------------------------------------------


def test_trial_will_end_meldet_mit_datum(monkeypatch) -> None:  # noqa: ANN001
    """Drei Tage vor Ablauf muss die Meldung raus — sonst wird der Betrieb
    ohne Vorwarnung belastet."""
    gerufen: list[dict] = []
    monkeypatch.setattr(
        wh,
        "melde_testphase_endet",
        lambda db, **kw: gerufen.append(kw),  # noqa: ARG005
    )
    wh._handle_trial_will_end(  # noqa: SLF001
        _db_mit_abo(),
        {"id": "sub_1", "trial_end": 1787047200, "metadata": {"tenant_id": "t1"}},
    )
    assert len(gerufen) == 1
    assert gerufen[0]["tenant_id"] == "t1"
    assert gerufen[0]["endet_am"].startswith("2026-08-18")


def test_trial_will_end_ohne_datum_meldet_trotzdem(monkeypatch) -> None:  # noqa: ANN001
    """Fehlt `trial_end`, geht die Meldung OHNE Datum raus statt mit einem
    gerechneten (Wurzel 4). Die Aufforderung stimmt auch ohne Tag."""
    gerufen: list[dict] = []
    monkeypatch.setattr(
        wh,
        "melde_testphase_endet",
        lambda db, **kw: gerufen.append(kw),  # noqa: ARG005
    )
    wh._handle_trial_will_end(  # noqa: SLF001
        _db_mit_abo(), {"id": "sub_1", "metadata": {"tenant_id": "t1"}}
    )
    assert len(gerufen) == 1
    assert gerufen[0]["endet_am"] is None


def test_trial_will_end_ohne_tenant_meldet_nicht(monkeypatch) -> None:  # noqa: ANN001
    """Unbekannte Subscription: lieber nichts melden als an den falschen
    Betrieb (Wurzel 3 — der Scope wird nicht geraten)."""
    gerufen: list[dict] = []
    monkeypatch.setattr(
        wh,
        "melde_testphase_endet",
        lambda db, **kw: gerufen.append(kw),  # noqa: ARG005
    )
    wh._handle_trial_will_end(_DB(), {"id": "sub_unbekannt"})  # noqa: SLF001
    assert gerufen == []
