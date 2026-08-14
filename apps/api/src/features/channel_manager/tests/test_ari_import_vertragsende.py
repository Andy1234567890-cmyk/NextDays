"""Der ARI-Import schreibt NIE Stop-Sells und sperrt keine Storno-Freigabe zurück.

ZWEI LIVE-FEHLER, DIE DIESE DATEI FESTHÄLT:

1. Vertragsende als Stop-Sell (12.08.2026, Feriehus Kornblomst, 0378): Das
   Vertragsende sperrt die Nächte und meldet Channex `availability = 0`.
   Channex' Readback macht daraus `stop_sell = true`, der Import schrieb 307
   Zeilen `source='channex'` — vier Sekunden nach dem eigenen Push. Der
   Kalender zeigte „Stop-Sell · alle Kanäle" statt „Vertragsende".

2. Storno-Echo-Kreis (entdeckt 14.08.2026): `GET /restrictions` liefert
   `stop_sell` als ABGELEITETEN Wert („Tag nicht verkaufbar"), nicht die
   gespeicherte Restriktion — für gebuchte Tage kam `true` zurück, obwohl wir
   nachts `false` pushen. Beim Extranet-/Airbnb-Storno las der Import das noch
   nicht verarbeitete Echo der freigegebenen Nächte, schrieb Stop-Sells, und
   der nächtliche Full-Sync pushte sie als ECHTE Stops zurück — drei aktive
   Objekte waren monatelang auf allen Portalen unverkäuflich
   (Rævehulen/Dora/Grævlinge).

Konsequenz: Der Import liest Restriktionen GAR NICHT mehr. Kein Guard, kein
Filter — der Abruf selbst ist entfernt, weil er nur unser eigenes Echo lesen
konnte (ein OTA kann Restriktionen bei Channex nicht setzen). Diese Tests
beweisen den neuen Vertrag: kein `get_restrictions`-Aufruf, keine
`stop_sell`-Schreibung, bestehende Zeilen bleiben unangetastet, und der
Ping-Pong-Schutz deckt die Storno-Freigabe ab.

Der Store filtert echt (eq/in_/gte/lt/or_): eine Attrappe, die jede Kette
durchwinkt, bestätigte auch einen kaputten Schutz — der Filter IST die Prüfung.
"""
from datetime import UTC, date, datetime
from typing import Any

from src.features.channel_manager.ari_push import AriPushMixin
from src.features.channel_manager.bookings_sync import BookingsSyncMixin


class _Sync(BookingsSyncMixin, AriPushMixin):
    """Nur die zwei Mixins, die der Import wirklich braucht.

    Der echte `ChannelManagerService` zieht ein Dutzend weitere Mixins samt
    Supabase-Client mit; für diesen Pfad zählen die Import-Logik und die
    `_is_channex_managed`-Prüfung aus dem Push-Mixin.
    """

    def __init__(self, channex: object) -> None:
        self._channex = channex

HEUTE = date(2026, 8, 12)
ENDE = date(2026, 10, 9)
TENANT = "t-1"
PROPERTY = "p-1"
CHANNEX_PROPERTY = "cx-1"


class _Result:
    def __init__(self, data: list[dict[str, Any]]) -> None:
        self.data = data


class _Query:
    """Minimal-PostgREST mit echter Filterwirkung."""

    def __init__(self, store: "_Store", table: str) -> None:
        self._store = store
        self._table = table
        self._filter: list[tuple[str, str, Any]] = []
        self._modus = "select"
        self._payload: dict[str, Any] | list[dict[str, Any]] | None = None

    def select(self, *_a: object, **_k: object) -> "_Query":
        self._modus = "select"
        return self

    def upsert(self, payload: dict[str, Any], **_k: object) -> "_Query":
        self._modus = "upsert"
        self._payload = payload
        return self

    def insert(self, payload: dict[str, Any], **_k: object) -> "_Query":
        self._modus = "insert"
        self._payload = payload
        return self

    def update(self, payload: dict[str, Any]) -> "_Query":
        self._modus = "update"
        self._payload = payload
        return self

    def delete(self) -> "_Query":
        self._modus = "delete"
        return self

    def eq(self, col: str, val: Any) -> "_Query":
        self._filter.append((col, "eq", val))
        return self

    def neq(self, col: str, val: Any) -> "_Query":
        self._filter.append((col, "neq", val))
        return self

    def in_(self, col: str, werte: list[Any]) -> "_Query":
        self._filter.append((col, "in", [str(w) for w in werte]))
        return self

    def gte(self, col: str, val: Any) -> "_Query":
        self._filter.append((col, "gte", val))
        return self

    def lte(self, col: str, val: Any) -> "_Query":
        self._filter.append((col, "lte", val))
        return self

    def lt(self, col: str, val: Any) -> "_Query":
        self._filter.append((col, "lt", val))
        return self

    def is_(self, col: str, val: Any) -> "_Query":
        self._filter.append(
            (col, "isnull" if str(val) == "null" else "is", val)
        )
        return self

    def or_(self, ausdruck: str) -> "_Query":
        """PostgREST-`or_` als ODER-Gruppe — echt auswertend.

        Der Ping-Pong-Schutz sucht damit frische/offene Push-Absichten
        (`created_at.gte.<cutoff>,status.eq.pending,status.eq.failed`). Würde die
        Attrappe das durchwinken, gälte JEDER Tag als „gerade selbst gepusht",
        der Import überspränge alles, und die Storno-Prüfung unten wäre grün,
        ohne das Fenster je zu berühren.
        """
        gruppe: list[tuple[str, str, str]] = []
        for teil in ausdruck.split(","):
            spalte, op, wert = teil.split(".", 2)
            gruppe.append((spalte, op, wert))
        self._filter.append(("__or__", "or", gruppe))
        return self

    def order(self, *_a: object, **_k: object) -> "_Query":
        return self

    def limit(self, *_a: object, **_k: object) -> "_Query":
        return self

    def _passt(self, row: dict[str, Any]) -> bool:
        for col, op, val in self._filter:
            if op == "or":
                if not any(
                    self._einzel(row, s, o, w) for s, o, w in val
                ):
                    return False
                continue
            ist = row.get(col)
            if op == "eq" and str(ist) != str(val):
                return False
            if op == "neq" and str(ist) == str(val):
                return False
            if op == "in" and str(ist) not in val:
                return False
            if op == "gte" and not (ist is not None and str(ist) >= str(val)):
                return False
            if op == "lte" and not (ist is not None and str(ist) <= str(val)):
                return False
            if op == "lt" and not (ist is not None and str(ist) < str(val)):
                return False
            if op == "isnull" and ist is not None:
                return False
        return True

    @staticmethod
    def _einzel(row: dict[str, Any], spalte: str, op: str, wert: str) -> bool:
        """Ein Glied einer `or_`-Gruppe."""
        ist = row.get(spalte)
        if op == "eq":
            return str(ist) == wert
        if op == "gte":
            return ist is not None and str(ist) >= wert
        if op == "lt":
            return ist is not None and str(ist) < wert
        raise AssertionError(f"unbekannter or_-Operator: {op}")

    def execute(self) -> _Result:
        rows = self._store.tabellen.setdefault(self._table, [])
        if self._modus in {"upsert", "insert"}:
            # Der Import schreibt availability als LISTE (Tages-Batch) — auch
            # Einzel-Dicts müssen ankommen.
            neu = (
                self._payload
                if isinstance(self._payload, list)
                else [self._payload or {}]
            )
            for zeile in neu:
                rows.append(dict(zeile))
                self._store.geschrieben.append((self._table, dict(zeile)))
            return _Result([dict(z) for z in neu])
        getroffen = [r for r in rows if self._passt(r)]
        if self._modus == "update":
            assert isinstance(self._payload, dict)
            for r in getroffen:
                r.update(self._payload)
            return _Result([dict(r) for r in getroffen])
        if self._modus == "delete":
            self._store.tabellen[self._table] = [
                r for r in rows if not self._passt(r)
            ]
            return _Result([dict(r) for r in getroffen])
        return _Result([dict(r) for r in getroffen])


class _Store:
    def __init__(self, tabellen: dict[str, list[dict[str, Any]]]) -> None:
        self.tabellen = tabellen
        self.geschrieben: list[tuple[str, dict[str, Any]]] = []

    def table(self, name: str) -> _Query:
        return _Query(self, name)


class _Channex:
    """Channex, das liefert, was es live liefert: `availability`-Zahlen — und
    das bei einem Restriktions-Abruf SOFORT auffliegt.

    `get_restrictions` existiert absichtlich als Falle: Der Import darf
    Restriktionen nie wieder lesen, weil der Readback dort nur unser eigenes
    Echo ist (stop_sell=true für jeden unverfügbaren Tag).
    """

    def __init__(self, avail_null_tage: list[date]) -> None:
        self._tage = avail_null_tage

    def get_availability(self, *_a: object, **_k: object) -> dict[str, Any]:
        return {
            "data": {
                "rt-1": {t.isoformat(): 0 for t in self._tage},
            }
        }

    def get_restrictions(self, *_a: object, **_k: object) -> dict[str, Any]:
        raise AssertionError(
            "Der ARI-Import darf get_restrictions nicht aufrufen — der "
            "Readback ist unser eigenes Echo, kein Portal-Zustand."
        )


def _tage(von: date, anzahl: int) -> list[date]:
    return [date.fromordinal(von.toordinal() + i) for i in range(anzahl)]


def _store(
    vertragsende_tage: list[date],
    stop_zeilen: list[dict[str, Any]] | None = None,
    outbox_extra: list[dict[str, Any]] | None = None,
    offene_tage: list[date] | None = None,
) -> _Store:
    """Ein Objekt, das bei Channex gemanaged ist, Push-Historie hat und dessen
    Vertragsende-Nächte im Kalender stehen.

    Beides ist nötig, damit der Import überhaupt schreibt: ohne
    `channex_property_map` bricht er als „nicht gemanaged" ab, ohne
    `ari_outbox`-`done` greift der Warm-up-Guard.
    """
    return _Store(
        {
            "channex_property_map": [
                {
                    "tenant_id": TENANT,
                    "property_id": PROPERTY,
                    "channex_property_id": CHANNEX_PROPERTY,
                    "sync_enabled": True,
                }
            ],
            "ari_outbox": [
                {
                    "id": "ob-1",
                    "property_id": PROPERTY,
                    "status": "done",
                    "created_at": "2025-01-01T00:00:00+00:00",
                    "payload": {},
                },
                *(outbox_extra or []),
            ],
            "availability": [
                {
                    "property_id": PROPERTY,
                    "unit_id": "u-1",
                    "date": t.isoformat(),
                    "status": "blocked",
                    "source": "contract_end",
                }
                for t in vertragsende_tage
            ]
            + [
                {
                    "property_id": PROPERTY,
                    "unit_id": "u-1",
                    "date": t.isoformat(),
                    "status": "open",
                    "source": "manual",
                }
                for t in (offene_tage or [])
            ],
            "stop_sell": list(stop_zeilen or []),
            "property_units": [
                {"id": "u-1", "property_id": PROPERTY, "tenant_id": TENANT}
            ],
            "rate_plans": [],
            "properties": [
                {
                    "id": PROPERTY,
                    "tenant_id": TENANT,
                    "contract_end_date": ENDE.isoformat(),
                }
            ],
        }
    )


def _geschriebene_stops(store: _Store) -> list[str]:
    return sorted(
        str(z["date"]) for tab, z in store.geschrieben if tab == "stop_sell"
    )


def _importieren(
    store: _Store, avail_null_tage: list[date], *, heute: date = ENDE
) -> dict[str, int]:
    svc = _Sync(_Channex(avail_null_tage))
    return svc._import_ari_single(  # noqa: SLF001
        store,
        TENANT,
        CHANNEX_PROPERTY,
        PROPERTY,
        {"rt-1"},
        days_ahead=30,
        today=heute,
    )


def test_import_liest_keine_restrictions_und_schreibt_keine_stops() -> None:
    """DER Vertrag nach dem 14.08.2026: kein Restriktions-Abruf, kein Stop-Sell.

    Channex würde für die Vertragsende-Tage `stop_sell = true` melden — das ist
    das Echo unseres eigenen `availability = 0`, nicht der Wille eines Portals.
    `_Channex.get_restrictions` wirft deshalb: Schon der AUFRUF ist der Fehler.
    """
    tage = _tage(ENDE, 10)
    store = _store(vertragsende_tage=tage)

    ergebnis = _importieren(store, tage)

    assert _geschriebene_stops(store) == [], (
        "Der Import darf NIE eine stop_sell-Zeile anlegen — jede solche Zeile "
        "wird vom Full-Sync als echter Stop zurückgepusht (Echo-Kreis)."
    )
    assert store.tabellen["stop_sell"] == []
    assert "stop_sell" not in ergebnis, (
        "Der Import hat keinen stop_sell-Zähler mehr — gäbe es ihn, "
        "existierte auch wieder ein Schreibpfad."
    )


def test_bestehende_stop_zeilen_bleiben_unangetastet() -> None:
    """Der Import hebt auch nichts mehr auf — die Aufheben-Richtung ist mit
    der Setzen-Richtung entfernt.

    Ein manueller Stop des Betriebs (source='manual') und eine noch nicht
    bereinigte Alt-Zeile (source='channex', räumt Migration 0394) müssen den
    Import unverändert überleben: Löschen dürfen nur clear_stop_sell bzw. die
    Migration, nie ein Readback, der ohnehin nur Echos sieht.
    """
    manuell = {
        "id": "s-1",
        "property_id": PROPERTY,
        "date": "2026-10-20",
        "source": "manual",
        "rate_plan_id": None,
    }
    alt_import = {
        "id": "s-2",
        "property_id": PROPERTY,
        "date": "2026-10-21",
        "source": "channex",
        "rate_plan_id": None,
    }
    store = _store(vertragsende_tage=[], stop_zeilen=[manuell, alt_import])

    _importieren(store, [])

    assert store.tabellen["stop_sell"] == [manuell, alt_import]
    assert _geschriebene_stops(store) == []


def test_storno_freigabe_wird_nicht_zurueckgesperrt() -> None:
    """Der Wettlauf beim Extranet-/Airbnb-Storno, Availability-Seite.

    Der Storno gibt die Nächte lokal frei und legt die `availability=1`-Absicht
    in die ari_outbox. Channex meldet für diese Tage noch `0` (unser altes
    Echo, asynchron verarbeitet). Der Ping-Pong-Schutz
    (`_eigene_availability_push_tage`) muss die frisch gepushten Tage vom
    Import ausnehmen — sonst macht der Import die eben freigegebenen Nächte
    wieder `blocked`, und der nächste Full-Sync zementiert die 0.
    """
    frei = _tage(date(2026, 10, 20), 3)
    outbox = {
        "id": "ob-storno",
        "property_id": PROPERTY,
        "status": "done",
        "date_from": frei[0].isoformat(),
        "date_to": frei[-1].isoformat(),
        # Frisch: eben erst enqueued — muss im 30-Minuten-Fenster liegen.
        "created_at": datetime.now(UTC).isoformat(),
        "payload": {},
    }
    store = _store(
        vertragsende_tage=[],
        outbox_extra=[outbox],
        offene_tage=frei,
    )

    _importieren(store, frei, heute=frei[0])

    zurueckgesperrt = [
        z
        for tab, z in store.geschrieben
        if tab == "availability" and z.get("status") == "blocked"
    ]
    assert zurueckgesperrt == [], (
        "Frisch freigegebene Storno-Nächte dürfen nicht aus dem Channex-Echo "
        "wieder gesperrt werden."
    )


def test_veraltete_echo_null_ohne_push_fenster_wird_uebernommen() -> None:
    """Die Umkehrprobe zum Ping-Pong-Schutz: OHNE frische eigene Push-Absicht
    ist eine Channex-0 ein echter externer Zustand und muss einlaufen.

    Ohne diesen Test wäre ein Schutz, der ALLE Tage überspringt, genauso grün —
    und ein echtes externes Schließen käme nie mehr bei uns an.
    """
    tage = _tage(date(2026, 11, 5), 2)
    store = _store(vertragsende_tage=[], offene_tage=tage)

    ergebnis = _importieren(store, tage, heute=tage[0])

    gesperrt = sorted(
        str(z["date"])
        for tab, z in store.geschrieben
        if tab == "availability" and z.get("status") == "blocked"
    )
    assert gesperrt == [t.isoformat() for t in tage]
    assert ergebnis["availability"] == len(tage)
