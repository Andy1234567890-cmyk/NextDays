"""Schlanke In-Memory-Nachbildung des PostgREST-Clients für Tests.

Bewusst kein echter DB-Aufbau: die Bauphase hier arbeitet ohne Test-Datenbank
(Projekt-Regel), und die Tests, die eine echte DB brauchen, prüfen ohnehin
Dinge, die diese Nachbildung nicht kann (Trigger, Sperren, Unique-Indizes).

Was sie kann: `select/insert/update/delete` mit `eq/in_/gte/lte/lt/is_/order/
limit/range/execute`, echtes SORTIEREN (inklusive NULLS-LAST bei aufsteigender
Ordnung) und die Auswertung des KEYSET-Ausdrucks aus `core/pagination.py`.
Die beiden Letzteren sind kein Luxus: ohne sie wäre jeder Cursor-Test blind — die
Nachbildung würde den Filter verschlucken und die volle Seite zurückgeben.

Was sie NICHT kann und auch nicht soll: Nebenläufigkeit, Constraints, RPCs, die
`ilike`-Suche über mehrere Spalten. Die Grenzen stehen hier, damit niemand einen
Test schreibt, dessen Aussage die Nachbildung nicht tragen kann.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any


def _sortierschluessel(wert: Any, *, absteigend: bool) -> tuple:
    """Vergleichbarer Schlüssel für eine Spalte, NULL wie Postgres einsortiert.

    Erster Platz im Tupel ist der NULL-Rang (bei asc zuletzt, bei desc zuerst —
    das `reverse` der Sortierung dreht ihn mit). Danach trennt ein Typ-Rang
    Zahlen von Text, damit ein numerischer Vergleich möglich ist, ohne bei
    gemischten Werten zu werfen.
    """
    if wert is None:
        return (-1 if absteigend else 1, 0, 0.0, "")
    if isinstance(wert, bool):
        return (0, 0, float(wert), "")
    if isinstance(wert, (int, float, Decimal)):
        return (0, 0, float(wert), "")
    text = str(wert)
    return (0, 1, 0.0, text)


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
        self._keyset: str | None = None
        self._order: list[tuple[str, bool]] = []

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

    def or_(self, ausdruck: str) -> _Tabelle:
        """PostgREST-`or=`-Ausdruck.

        Nachgebildet wird GENAU die Keyset-Form aus `core/pagination.py`
        (`feld.gt.X`, `and(feld.eq.X,id.gt.Y)`, `feld.is.null`) — sonst wäre
        jeder Cursor-Test blind: die Nachbildung würde den Filter verschlucken,
        die Seite käme unverändert zurück, und der Test wäre grün, obwohl der
        Filter nichts tut.

        Alles andere (die `ilike`-Suche über mehrere Spalten) wird bewusst NICHT
        ausgewertet und als „trifft alles" behandelt; ein Test, der die Suche
        prüfen will, gehört gegen eine echte Datenbank.
        """
        if ".gt." in ausdruck or ".lt." in ausdruck or ".is.null" in ausdruck:
            self._keyset = ausdruck
        return self

    def order(self, spalte: str, **kw: Any) -> _Tabelle:
        """Sortierung merken — die Nachbildung sortiert wirklich.

        Ohne echtes Sortieren hätte ein Cursor-Test keine Aussage: er würde
        gegen eine Reihenfolge prüfen, die die Nachbildung zufällig aus der
        Einfügereihenfolge übernimmt. NULLs kommen bei aufsteigender Ordnung
        ans Ende (wie Postgres mit dem Standard NULLS LAST).
        """
        self._order.append((spalte, bool(kw.get("desc", False))))
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

    def _sortiert(self, zeilen: list[dict]) -> list[dict]:
        """Nach den gemerkten Spalten sortieren, NULLs bei asc ans Ende.

        Zahlen werden NUMERISCH verglichen. Vorher lief der Vergleich über
        `str()`, und damit stand 30 vor 7 — eine Nachbildung, die anders
        sortiert als Postgres, lässt jeden Cursor-Test über eine Zahlenspalte
        grün werden, ohne etwas zu prüfen.
        """
        for spalte, absteigend in reversed(self._order):
            zeilen = sorted(
                zeilen,
                key=lambda z, s=spalte, d=absteigend: _sortierschluessel(
                    z.get(s), absteigend=d
                ),
                reverse=absteigend,
            )
        return zeilen

    def _keyset_passt(self, zeile: dict) -> bool:
        """Den Keyset-Ausdruck auf eine Zeile anwenden.

        Der Ausdruck ist eine ODER-Verknüpfung; ein `and(...)`-Teil ist eine
        UND-Verknüpfung darin. Genau die Form, die `pagination.keyset_ausdruck`
        erzeugt — mehr kann und soll diese Auswertung nicht.
        """
        rest = self._keyset or ""
        teile: list[str] = []
        tiefe = 0
        in_quote = False
        puffer = ""
        for zeichen in rest:
            # Ein Komma INNERHALB von Anführungszeichen ist Teil des Werts, kein
            # Trenner — genau deshalb wird gequotet.
            if zeichen == '"':
                in_quote = not in_quote
            if zeichen == "," and tiefe == 0 and not in_quote:
                teile.append(puffer)
                puffer = ""
                continue
            if not in_quote and zeichen == "(":
                tiefe += 1
            elif not in_quote and zeichen == ")":
                tiefe -= 1
            puffer += zeichen
        if puffer:
            teile.append(puffer)

        def auspacken(roh: str) -> str:
            """Gequoteten Filterwert zurück in den Klartext.

            `core/pagination._wert_fuer_filter` setzt Werte in doppelte
            Anführungszeichen (sonst zerlegt ein Komma den Ausdruck). PostgREST
            packt sie beim Parsen aus — die Nachbildung muss dasselbe tun, sonst
            vergleicht sie `"Alfa"` mit `Alfa` und findet nie etwas.
            """
            if len(roh) >= 2 and roh.startswith('"') and roh.endswith('"'):
                return roh[1:-1].replace('\\"', '"').replace("\\\\", "\\")
            return roh

        def einzeln(ausdruck: str) -> bool:
            spalte, art, *wert = ausdruck.split(".", 2)
            vorhanden = zeile.get(spalte)
            if art == "is":
                return vorhanden is None
            if art == "not":
                # `feld.not.is.null` — der Zweig, der bei absteigender Ordnung
                # nach dem NULL-Block alle Zeilen MIT Wert nachholt.
                return vorhanden is not None
            if not wert:
                return False
            gesucht = auspacken(wert[0])
            if vorhanden is None:
                return False
            if art == "eq":
                return str(vorhanden) == gesucht
            if art == "gt":
                return str(vorhanden) > gesucht
            if art == "lt":
                return str(vorhanden) < gesucht
            return False

        for teil in teile:
            if teil.startswith("and(") and teil.endswith(")"):
                inneres = teil[4:-1]
                if all(einzeln(a) for a in inneres.split(",")):
                    return True
            elif einzeln(teil):
                return True
        return False

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
        if self._keyset:
            treffer = [z for z in treffer if self._keyset_passt(z)]
        treffer = self._sortiert(treffer)

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
