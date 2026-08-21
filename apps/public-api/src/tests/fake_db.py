"""Schlanke In-Memory-Nachbildung des PostgREST-Clients für Tests.

Bewusst kein echter DB-Aufbau: die Bauphase hier arbeitet ohne Test-Datenbank
(Projekt-Regel), und die Tests, die eine echte DB brauchen, prüfen ohnehin
Dinge, die diese Nachbildung nicht kann (Trigger, Sperren, Unique-Indizes).

Was sie kann: `select/insert/update/delete` mit `eq/in_/gte/lte/lt/is_/order/
limit/range/execute`. Was sie NICHT kann und auch nicht soll: Nebenläufigkeit,
Constraints, RPCs. Die Grenzen stehen hier, damit niemand einen Test schreibt,
dessen Aussage die Nachbildung nicht tragen kann.
"""
from __future__ import annotations

from typing import Any


class _Antwort:
    def __init__(self, data: Any, count: int | None = None) -> None:
        self.data = data
        self.count = count


class _Tabelle:
    def __init__(
        self,
        speicher: dict[str, list[dict]],
        name: str,
        insert_fehler: dict[str, Exception] | None = None,
    ) -> None:
        self._s = speicher
        self._n = name
        self._insert_fehler = insert_fehler or {}
        self._filter: list[tuple[str, str, Any]] = []
        self._op: tuple[str, Any] | None = None
        self._bereich: tuple[int, int] | None = None
        self._limit: int | None = None
        self._count: str | None = None

    # -- Aufbau -----------------------------------------------------------
    def _zeilen(self) -> list[dict]:
        return self._s.setdefault(self._n, [])

    def select(self, *_a: Any, count: str | None = None, **_k: Any) -> _Tabelle:
        self._op = ("select", None)
        self._count = count
        return self

    def insert(self, nutzlast: Any) -> _Tabelle:
        self._op = ("insert", nutzlast)
        return self

    def upsert(self, nutzlast: Any, **_k: Any) -> _Tabelle:
        self._op = ("upsert", nutzlast)
        return self

    def update(self, nutzlast: dict) -> _Tabelle:
        self._op = ("update", nutzlast)
        return self

    def delete(self) -> _Tabelle:
        self._op = ("delete", None)
        return self

    # -- Filter -----------------------------------------------------------
    def eq(self, spalte: str, wert: Any) -> _Tabelle:
        self._filter.append((spalte, "eq", wert))
        return self

    def in_(self, spalte: str, werte: list[Any]) -> _Tabelle:
        self._filter.append((spalte, "in", [str(w) for w in werte]))
        return self

    def gte(self, spalte: str, wert: Any) -> _Tabelle:
        self._filter.append((spalte, "gte", wert))
        return self

    def lte(self, spalte: str, wert: Any) -> _Tabelle:
        self._filter.append((spalte, "lte", wert))
        return self

    def lt(self, spalte: str, wert: Any) -> _Tabelle:
        self._filter.append((spalte, "lt", wert))
        return self

    def is_(self, spalte: str, _wert: str) -> _Tabelle:
        self._filter.append((spalte, "is_null", None))
        return self

    def or_(self, _ausdruck: str) -> _Tabelle:
        # Volltextsuche wird nicht nachgebildet — ein Test, der sie braucht,
        # gehört gegen eine echte DB.
        return self

    def order(self, *_a: Any, **_k: Any) -> _Tabelle:
        return self

    def limit(self, n: int) -> _Tabelle:
        self._limit = n
        return self

    def range(self, von: int, bis: int) -> _Tabelle:
        self._bereich = (von, bis)
        return self

    # -- Ausführung -------------------------------------------------------
    def _passt(self, zeile: dict) -> bool:
        for spalte, art, wert in self._filter:
            vorhanden = zeile.get(spalte)
            if art == "eq" and str(vorhanden) != str(wert):
                return False
            if art == "in" and str(vorhanden) not in wert:
                return False
            if art == "is_null" and vorhanden is not None:
                return False
            if art == "gte" and (vorhanden is None or str(vorhanden) < str(wert)):
                return False
            if art == "lte" and (vorhanden is None or str(vorhanden) > str(wert)):
                return False
            if art == "lt" and (vorhanden is None or str(vorhanden) >= str(wert)):
                return False
        return True

    def execute(self) -> _Antwort:
        art, nutzlast = self._op or ("select", None)
        zeilen = self._zeilen()

        if art in {"insert", "upsert"}:
            # Nachgestellter DB-Fehler (z. B. Unique-Verletzung), damit Tests den
            # Kontroll-Signal-Pfad prüfen können, den die Nachbildung sonst nicht
            # hat.
            fehler = self._insert_fehler.get(self._n)
            if fehler is not None:
                raise fehler
            neu = nutzlast if isinstance(nutzlast, list) else [nutzlast]
            angelegt = []
            for z in neu:
                zeile = {"id": z.get("id") or f"{self._n}-{len(zeilen) + 1}", **z}
                zeile.setdefault("created_at", "2026-08-21T10:00:00+00:00")
                zeile.setdefault("updated_at", "2026-08-21T10:00:00+00:00")
                zeilen.append(zeile)
                angelegt.append(zeile)
            return _Antwort(angelegt)

        treffer = [z for z in zeilen if self._passt(z)]

        if art == "update":
            for z in treffer:
                z.update(nutzlast or {})
            return _Antwort(treffer)
        if art == "delete":
            for z in treffer:
                zeilen.remove(z)
            return _Antwort(treffer)

        if self._count == "exact":
            return _Antwort(treffer[: self._limit or len(treffer)], count=len(treffer))
        if self._bereich:
            von, bis = self._bereich
            treffer = treffer[von : bis + 1]
        if self._limit:
            treffer = treffer[: self._limit]
        return _Antwort(treffer)


class FakeDB:
    """Ersatz für den Supabase-Client."""

    def __init__(self, speicher: dict[str, list[dict]] | None = None) -> None:
        self.speicher: dict[str, list[dict]] = speicher or {}
        self.rpc_aufrufe: list[tuple[str, dict]] = []
        self.rpc_antwort: Any = None
        self.rpc_fehler: Exception | None = None
        # Tabellenname → Fehler, der beim insert geworfen wird. Damit lässt sich
        # eine Unique-Verletzung nachstellen; die Nachbildung kennt keine
        # Constraints.
        self.insert_fehler: dict[str, Exception] = {}

    def table(self, name: str) -> _Tabelle:
        return _Tabelle(self.speicher, name, self.insert_fehler)

    def rpc(self, name: str, parameter: dict) -> Any:
        self.rpc_aufrufe.append((name, parameter))
        if self.rpc_fehler is not None:
            raise self.rpc_fehler
        antwort = self.rpc_antwort

        class _R:
            data = antwort

            def execute(self) -> Any:  # noqa: ANN401
                return self

        return _R()
