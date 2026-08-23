"""HTTP 200 von Channex ist keine Zusage — beanstandete Werte bleiben offen.

DER BEFUND: `POST /availability` und `POST /restrictions` sind ASYNCHRON. Die
Antwort ist keine Bestätigung, sondern eine Quittung über die Aufnahme in eine
FIFO-Queue:

    {"data": [{"id": "<uuid>", "type": "task"}],
     "meta": {"message": "Success", "warnings": []}}

Der Client gab diesen Body bei `resp.is_success` einfach zurück; von den sechs
Sendewegen las genau EINER (`push_ari`, der interaktive) `meta.warnings`, und
auch nur zur Anzeige. Alle Worker-/Outbox-Pfade verwarfen die Antwort komplett
und setzten die Outbox-Zeile unmittelbar danach auf 'done'.

WARUM DAS TEUER IST: `channex_ari_shadow` FÜHRT bei uns den Ist-Stand (kein
ARI-Readback, Projektentscheidung). Ein als 'done' verbuchter, real verworfener
Wert schreibt den Schatten auf den SOLL-Wert fort. Der Reconciler vergleicht
danach Soll gegen diesen falschen Ist-Stand, sieht keine Differenz und sendet NIE
nach — der Wert fehlt dauerhaft im Portal, ohne Fehler, ohne offene Zeile, ohne
Drift.

Live belegt ist die Warnungs-Klasse 356× zwischen dem 05.08. und 13.08.2026:

    "warnings": ["Past date is not allowed.
                  `date_from` was changed from 2026-08-12 to 2026-08-13"]

Diese Tests halten fest: Warnung ⇒ NICHT 'done' (fail-closed, Wurzel 5); keine
Warnung ⇒ 'done' wie bisher (die Prüfung darf den Normalfall nicht kippen).
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from src.features.channel_manager.channex_client import (
    ChannexAriVerworfen,
    ChannexClient,
    ChannexError,
)

MORGEN = (date.today() + timedelta(days=1)).isoformat()

# Genau die live gemessene Warnung, die 356× kam.
WARNUNG = (
    "Past date is not allowed. `date_from` was changed from 2026-08-12 "
    "to 2026-08-13"
)


def _client(warnings: list[str]) -> tuple[ChannexClient, list[dict[str, Any]]]:
    """Ein Client, der eine 200-Antwort mit den gegebenen `meta.warnings` liefert
    — genau die Form, die Channex real schickt (Task-ID + meta)."""
    gesendet: list[dict[str, Any]] = []

    class _C(ChannexClient):
        def post(self, path: str, **kwargs: object) -> dict[str, Any]:  # type: ignore[override]
            gesendet.append({"path": path, "json": kwargs.get("json")})
            return {
                "data": [{"id": "task-1", "type": "task"}],
                "meta": {"message": "Success", "warnings": list(warnings)},
            }

    return _C(), gesendet


# --- Der Client wertet die Antwort überhaupt aus ----------------------------


def test_warnung_wirft_statt_erfolg_zu_melden() -> None:
    """Kern des Fixes: `meta.warnings` nicht leer ⇒ Fehler, nicht Rückgabe."""
    client, gesendet = _client([WARNUNG])
    try:
        client.update_restrictions([{"date": MORGEN, "rate": 1000}])
    except ChannexAriVerworfen as exc:
        assert exc.warnings == [WARNUNG]
        assert exc.pfad == "restrictions"
        # Die betroffenen Werte hängen am Fehler — ohne sie wäre nicht
        # nachvollziehbar, WELCHER Tag/Wert verworfen wurde (Debugging-Regel).
        assert exc.values == [{"date": MORGEN, "rate": 1000}]
    else:
        raise AssertionError(
            "update_restrictions hat eine beanstandete Nutzlast als Erfolg "
            "zurückgegeben — der Wert gilt damit als gepusht, ist es aber nicht"
        )
    assert len(gesendet) == 1, "der Call selbst muss stattgefunden haben"


def test_warnung_gilt_fuer_beide_endpunkte() -> None:
    """Availability darf nicht die Ausnahme sein — 13 der 356 Warnungen kamen von dort."""
    client, _ = _client([WARNUNG])
    try:
        client.update_availability([{"date": MORGEN, "availability": 0}])
    except ChannexAriVerworfen as exc:
        assert exc.pfad == "availability"
    else:
        raise AssertionError("update_availability wertet meta.warnings nicht aus")


def test_ohne_warnung_bleibt_alles_wie_bisher() -> None:
    """Die Gegenprobe: der Normalfall darf NICHT kippen.

    Ohne diesen Test wäre ein Fix grün, der einfach immer wirft — und damit jeden
    Push blockiert.
    """
    client, gesendet = _client([])
    antwort = client.update_restrictions([{"date": MORGEN, "rate": 1000}])
    assert antwort["data"] == [{"id": "task-1", "type": "task"}]
    assert len(gesendet) == 1


def test_fehlendes_meta_ist_keine_warnung() -> None:
    """Eine Antwort ohne `meta` (oder ohne `warnings`) ist kein Befund.

    Wichtig, weil `_ari_senden` bei rein vergangenen Werten selbst eine
    erfolgsförmige Antwort OHNE `warnings` baut — die darf nicht werfen.
    """

    class _C(ChannexClient):
        def post(self, path: str, **kwargs: object) -> dict[str, Any]:  # type: ignore[override]
            return {"data": [{"id": "t", "type": "task"}]}

    assert _C().update_availability([{"date": MORGEN, "availability": 1}])["data"]


def test_verworfen_ist_ein_channex_error() -> None:
    """Der Vererbungs-Vertrag, an dem der ganze Fix hängt.

    JEDER Push-Pfad fängt bereits `ChannexError` und lässt die Outbox-Zeile dann
    'pending' (Cron-Backstop) — der Schatten wird nicht fortgeschrieben. Nur weil
    `ChannexAriVerworfen` eine Unterklasse ist, greift die Auswertung in allen
    sechs Sendewegen, ohne dass ein Aufrufer sie einbauen (oder vergessen) kann.
    Kippt diese Vererbung, kippt die Wirkung überall — lautlos.
    """
    assert issubclass(ChannexAriVerworfen, ChannexError)
    exc = ChannexAriVerworfen("restrictions", [WARNUNG], [])
    # 502, nicht 422: die Werte sind unsere, der Verwurf ist upstream.
    assert exc.status_code == 502


# --- Die Outbox-Wirkung im echten Sendeweg ---------------------------------


class _Result:
    def __init__(self, data: list[dict[str, Any]]) -> None:
        self.data = data


class _Query:
    """Minimal-PostgREST, das Statusübergänge der Outbox mitschreibt."""

    def __init__(self, store: _Store, table: str) -> None:
        self._store = store
        self._table = table
        self._filter: list[tuple[str, Any]] = []
        self._modus = "select"
        self._payload: dict[str, Any] | None = None

    def select(self, *_a: object, **_k: object) -> _Query:
        self._modus = "select"
        return self

    def insert(self, payload: dict[str, Any], **_k: object) -> _Query:
        self._modus = "insert"
        self._payload = payload
        return self

    def update(self, payload: dict[str, Any]) -> _Query:
        self._modus = "update"
        self._payload = payload
        return self

    def eq(self, col: str, val: Any) -> _Query:
        self._filter.append((col, val))
        return self

    def limit(self, *_a: object, **_k: object) -> _Query:
        return self

    def order(self, *_a: object, **_k: object) -> _Query:
        return self

    def execute(self) -> _Result:
        rows = self._store.tabellen.setdefault(self._table, [])
        if self._modus == "insert":
            zeile = dict(self._payload or {})
            zeile.setdefault("id", f"row-{len(rows) + 1}")
            rows.append(zeile)
            return _Result([dict(zeile)])
        getroffen = [
            r for r in rows
            if all(str(r.get(c)) == str(v) for c, v in self._filter)
        ]
        if self._modus == "update":
            for r in getroffen:
                r.update(self._payload or {})
        return _Result([dict(r) for r in getroffen])


class _Store:
    def __init__(self, tabellen: dict[str, list[dict[str, Any]]]) -> None:
        self.tabellen = tabellen

    def table(self, name: str) -> _Query:
        return _Query(self, name)


def test_beanstandeter_stop_sell_bleibt_pending() -> None:
    """Der teuerste Fall, Ende zu Ende: ein verworfener VERKAUFSSTOPP.

    Würde die Zeile hier 'done', bliebe das Objekt bei den OTAs buchbar, während
    unsere Outbox „erledigt" meldet und der Reconciler nichts zu tun sieht
    (Stop-Sell sperrt überall — Projektregel).
    """
    from src.features.channel_manager.ari_push import AriPushMixin

    class _Channex:
        is_configured = True

        def update_restrictions(
            self, values: list[dict[str, Any]], **_k: object
        ) -> dict[str, Any]:
            raise ChannexAriVerworfen("restrictions", [WARNUNG], values)

    class _Svc(AriPushMixin):
        def __init__(self, db: object, channex: object) -> None:
            self._db = db
            self._channex = channex
            self._trace_ctx: dict[str, Any] | None = None

        def _trace_step(self, **_k: object) -> None:
            return

        def _is_channex_managed(self, *_a: object, **_k: object) -> bool:
            return True

        def _resolve_channex_rate_plans(
            self, *_a: object, **_k: object
        ) -> list[dict[str, str]]:
            return [{"channex_property_id": "cx-p", "channex_rate_plan_id": "cx-r"}]

    store = _Store({"ari_restriction_outbox": []})
    svc = _Svc(store, _Channex())

    morgen = date.today() + timedelta(days=1)
    fehler = svc.push_stop_sell_for_property(
        "t-1", "p-1", [(morgen, morgen + timedelta(days=3))], stop_sell=True
    )

    assert fehler is True, (
        "ein beanstandeter Stop-Sell muss dem Worker als Fehler gemeldet werden "
        "(Job-Retry), nicht als Erfolg"
    )
    zeilen = store.tabellen["ari_restriction_outbox"]
    assert len(zeilen) == 1
    assert zeilen[0]["status"] == "pending", (
        f"Outbox-Zeile steht auf {zeilen[0]['status']!r} — ein von Channex "
        "verworfener Verkaufsstopp gilt damit als erledigt und wird nie nachgezogen"
    )


def test_sauberer_stop_sell_wird_done() -> None:
    """Gegenprobe im selben Sendeweg: ohne Warnung läuft der Abschluss wie bisher."""
    from src.features.channel_manager.ari_push import AriPushMixin

    class _Channex:
        is_configured = True

        def update_restrictions(
            self, values: list[dict[str, Any]], **_k: object
        ) -> dict[str, Any]:
            return {
                "data": [{"id": "task-1", "type": "task"}],
                "meta": {"message": "Success", "warnings": []},
            }

    class _Svc(AriPushMixin):
        def __init__(self, db: object, channex: object) -> None:
            self._db = db
            self._channex = channex

        def _trace_step(self, **_k: object) -> None:
            return

        def _is_channex_managed(self, *_a: object, **_k: object) -> bool:
            return True

        def _resolve_channex_rate_plans(
            self, *_a: object, **_k: object
        ) -> list[dict[str, str]]:
            return [{"channex_property_id": "cx-p", "channex_rate_plan_id": "cx-r"}]

    store = _Store({"ari_restriction_outbox": []})
    svc = _Svc(store, _Channex())

    morgen = date.today() + timedelta(days=1)
    fehler = svc.push_stop_sell_for_property(
        "t-1", "p-1", [(morgen, morgen + timedelta(days=3))], stop_sell=True
    )

    assert fehler is False
    assert store.tabellen["ari_restriction_outbox"][0]["status"] == "done"


def test_push_ari_meldet_warnungen_statt_zu_werfen() -> None:
    """Der EINE Pfad, der Warnungen zurückgeben darf — und muss.

    `push_ari` ist interaktiv: er hakt keine Outbox-Zeile ab, sondern gibt die
    Warnungen dem Aufrufer als `AriPushResponse.warnings` zur Anzeige. Würde er
    werfen, verlöre der Nutzer die Information, die er bisher sah.
    """
    from src.features.channel_manager.channex_client import ChannexClient

    class _C(ChannexClient):
        def post(self, path: str, **kwargs: object) -> dict[str, Any]:  # type: ignore[override]
            return {
                "data": [{"id": "task-1", "type": "task"}],
                "meta": {"message": "Success", "warnings": [WARNUNG]},
            }

    antwort = _C().update_restrictions(
        [{"date": MORGEN, "rate": 1000}], warnungen_melden=True
    )
    assert antwort["meta"]["warnings"] == [WARNUNG], (
        "der interaktive Pfad muss die Warnungen weiterhin sehen können"
    )
