"""Zustandsbehaftetes DB-Doppel für die Personal-Tests.

Jeder Filter filtert ECHT (eq, neq, in_, is_, not_.is_, lt, lte, gt, gte) —
eine Attrappe, die einen Filter durchwinkt, beweist das Gegenteil von dem, was
der Test behauptet (Lehre aus tasks/owners: `is_` musste nachgerüstet werden,
damit der Bestandsfilter überhaupt geprüft wurde).
"""

from __future__ import annotations

import base64
from datetime import UTC, datetime
from typing import Any

from pydantic import SecretStr

from src.core.security import AuthContext

# 32 Byte, base64 — nur für Tests.
TEST_KEY = base64.b64encode(b"0123456789abcdef0123456789abcdef").decode()


class _Settings:
    personal_akte_key = SecretStr(TEST_KEY)


def settings() -> _Settings:
    return _Settings()


def ctx(user: str = "admin-1", rolle: str = "admin", tenant: str | None = "t-1") -> AuthContext:
    return AuthContext(user_id=user, tenant_id=tenant, role=rolle)


class _Result:
    def __init__(self, data: list[dict], count: int | None = None) -> None:
        self.data = data
        self.count = count


class _Not:
    def __init__(self, q: _Query) -> None:
        self._q = q

    def is_(self, col: str, val: object) -> _Query:
        self._q._filters.append((col, ("__isnot__", val)))
        return self._q


class _Query:
    def __init__(self, db: FakeDB, table: str) -> None:
        self._db = db
        self._table = table
        self._filters: list[tuple[str, object]] = []
        self._op = "select"
        self._payload: dict | list[dict] | None = None
        self._conflict: str | None = None
        self._order: tuple[str, bool] | None = None
        self._limit: int | None = None

    # --- Aufbau ------------------------------------------------------------
    def select(self, *_a: object, **_k: object) -> _Query:
        return self

    def insert(self, payload: dict | list[dict]) -> _Query:
        self._op, self._payload = "insert", payload
        return self

    def upsert(
        self, payload: dict | list[dict], on_conflict: str | None = None, **_k: object
    ) -> _Query:
        self._op, self._payload, self._conflict = "upsert", payload, on_conflict
        return self

    def update(self, payload: dict) -> _Query:
        self._op, self._payload = "update", payload
        return self

    def delete(self) -> _Query:
        self._op = "delete"
        return self

    def eq(self, col: str, val: object) -> _Query:
        self._filters.append((col, ("__eq__", val)))
        return self

    def neq(self, col: str, val: object) -> _Query:
        self._filters.append((col, ("__neq__", val)))
        return self

    def in_(self, col: str, vals: list) -> _Query:
        self._filters.append((col, ("__in__", tuple(str(v) for v in vals))))
        return self

    def is_(self, col: str, val: object) -> _Query:
        self._filters.append((col, ("__is__", val)))
        return self

    @property
    def not_(self) -> _Not:
        return _Not(self)

    def lt(self, col: str, val: object) -> _Query:
        self._filters.append((col, ("__lt__", val)))
        return self

    def lte(self, col: str, val: object) -> _Query:
        self._filters.append((col, ("__lte__", val)))
        return self

    def gt(self, col: str, val: object) -> _Query:
        self._filters.append((col, ("__gt__", val)))
        return self

    def gte(self, col: str, val: object) -> _Query:
        self._filters.append((col, ("__gte__", val)))
        return self

    def order(self, col: str, desc: bool = False, **_k: object) -> _Query:
        self._order = (col, desc)
        return self

    def limit(self, n: int) -> _Query:
        self._limit = n
        return self

    # --- Auswertung --------------------------------------------------------
    @staticmethod
    def _norm(v: object) -> str:
        if isinstance(v, datetime):
            return v.astimezone(UTC).isoformat()
        s = str(v)
        return s.replace("Z", "+00:00") if s.endswith("Z") else s

    def _passt(self, row: dict) -> bool:  # noqa: PLR0911, PLR0912
        for col, (op, val) in self._filters:
            wert = row.get(col)
            if op == "__eq__":
                if self._norm(wert) != self._norm(val):
                    return False
            elif op == "__neq__":
                if self._norm(wert) == self._norm(val):
                    return False
            elif op == "__in__":
                if str(wert) not in val:
                    return False
            elif op == "__is__":
                if (wert is None) != (val in ("null", None)):
                    return False
            elif op == "__isnot__":
                if (wert is None) == (val in ("null", None)):
                    return False
            elif wert is None:
                return False
            elif op == "__lt__" and not self._norm(wert) < self._norm(val):
                return False
            elif op == "__lte__" and not self._norm(wert) <= self._norm(val):
                return False
            elif op == "__gt__" and not self._norm(wert) > self._norm(val):
                return False
            elif op == "__gte__" and not self._norm(wert) >= self._norm(val):
                return False
        return True

    def execute(self) -> _Result:  # noqa: PLR0912
        rows = self._db.tables.setdefault(self._table, [])
        if self._op == "insert":
            neu = self._payload if isinstance(self._payload, list) else [self._payload]
            created = []
            for p in neu:
                row = dict(p)
                row.setdefault("id", f"{self._table}-{self._db.next_id()}")
                row.setdefault("created_at", "2026-09-01T00:00:00+00:00")
                row.setdefault("updated_at", "2026-09-01T00:00:00+00:00")
                self._db.unique_pruefen(self._table, row, rows)
                rows.append(row)
                created.append(dict(row))
            return _Result(created)
        if self._op == "upsert":
            neu = self._payload if isinstance(self._payload, list) else [self._payload]
            keys = [k.strip() for k in (self._conflict or "id").split(",")]
            out = []
            for p in neu:
                treffer = next(
                    (r for r in rows if all(str(r.get(k)) == str(p.get(k)) for k in keys)), None
                )
                if treffer is not None:
                    treffer.update(p)
                    out.append(dict(treffer))
                else:
                    row = dict(p)
                    row.setdefault("id", f"{self._table}-{self._db.next_id()}")
                    rows.append(row)
                    out.append(dict(row))
            return _Result(out)
        treffer = [r for r in rows if self._passt(r)]
        if self._op == "update":
            for r in treffer:
                r.update(self._payload)  # type: ignore[arg-type]
            return _Result([dict(r) for r in treffer])
        if self._op == "delete":
            self._db.tables[self._table] = [r for r in rows if not self._passt(r)]
            return _Result([dict(r) for r in treffer])
        if self._order:
            col, desc = self._order
            treffer = sorted(treffer, key=lambda r: str(r.get(col) or ""), reverse=desc)
        if self._limit is not None:
            treffer = treffer[: self._limit]
        return _Result([dict(r) for r in treffer], count=len(treffer))


class _Bucket:
    def __init__(self, db: FakeDB) -> None:
        self._db = db

    def upload(self, pfad: str, content: bytes, _opts: dict) -> None:
        self._db.dateien[pfad] = content

    def create_signed_url(self, pfad: str, _ttl: int) -> dict:
        return {"signedURL": f"https://storage.test/{pfad}?signed"}

    def remove(self, pfade: list[str]) -> None:
        for p in pfade:
            self._db.dateien.pop(p, None)


class _Storage:
    def __init__(self, db: FakeDB) -> None:
        self._db = db

    def from_(self, _bucket: str) -> _Bucket:
        return _Bucket(self._db)


class UniqueVerletzung(Exception):
    code = "23505"


class FakeDB:
    # UNIQUE-Indizes der Migration 0541, die die Dienste als Backstop nutzen.
    UNIQUE: dict[str, list[tuple[str, ...]]] = {
        "personal_schichten": [("tenant_id", "task_id")],
        "personal_zeiterfassung": [("tenant_id", "idempotenz_key")],
        "personal_akten": [("user_id",), ("tenant_id", "employee_number")],
        "personal_monatsabschluesse": [("tenant_id", "user_id", "jahr", "monat")],
        "personal_lesebestaetigungen": [("veroeffentlichung_id", "user_id")],
        "personal_schicht_bewerbungen": [("schicht_id", "user_id")],
    }

    def __init__(self, tables: dict[str, list[dict]] | None = None) -> None:
        self.tables: dict[str, list[dict]] = tables or {}
        self.dateien: dict[str, bytes] = {}
        self.storage = _Storage(self)
        self._seq = 0

    def next_id(self) -> int:
        self._seq += 1
        return self._seq

    def table(self, name: str) -> _Query:
        return _Query(self, name)

    def unique_pruefen(self, table: str, row: dict, rows: list[dict]) -> None:
        for spalten in self.UNIQUE.get(table, []):
            werte = tuple(row.get(s) for s in spalten)
            if any(w is None for w in werte):
                continue
            if "end_at" in spalten:
                continue
            for r in rows:
                if tuple(r.get(s) for s in spalten) == werte:
                    raise UniqueVerletzung()
        if table == "personal_zeiterfassung" and row.get("end_at") is None:
            for r in rows:
                if (
                    r.get("tenant_id") == row.get("tenant_id")
                    and r.get("user_id") == row.get("user_id")
                    and r.get("end_at") is None
                ):
                    raise UniqueVerletzung()


def basis_tabellen() -> dict[str, list[dict]]:
    """Ein Betrieb in DK mit Leitung, Schichtleitung, zwei Kräften, einem Objekt."""
    return {
        "tenants": [{"id": "t-1", "country": "DK", "currency": "DKK", "default_language": "da"}],
        "users": [
            {
                "id": "admin-1",
                "tenant_id": "t-1",
                "role": "admin",
                "full_name": "Anna Admin",
                "email": "a@x.dk",
            },
            {
                "id": "lead-1",
                "tenant_id": "t-1",
                "role": "shift_lead",
                "full_name": "Lars Leitung",
                "email": "l@x.dk",
            },
            {
                "id": "staff-1",
                "tenant_id": "t-1",
                "role": "cleaner",
                "full_name": "Mette Rein",
                "email": "m@x.dk",
            },
            {
                "id": "staff-2",
                "tenant_id": "t-1",
                "role": "staff",
                "full_name": "Ole Haus",
                "email": "o@x.dk",
            },
            {
                "id": "owner-1",
                "tenant_id": "t-1",
                "role": "owner",
                "full_name": "Eigen Tümer",
                "email": "e@x.dk",
            },
            {
                "id": "fremd-1",
                "tenant_id": "t-2",
                "role": "staff",
                "full_name": "Fremd",
                "email": "f@y.de",
            },
        ],
        "properties": [
            {
                "id": "p-1",
                "tenant_id": "t-1",
                "title": "Feriehus Nord",
                "timezone": "Europe/Copenhagen",
                "archived_at": None,
                "building_id": None,
            },
            {
                "id": "p-2",
                "tenant_id": "t-1",
                "title": "Feriehus Syd",
                "timezone": "Europe/Copenhagen",
                "archived_at": None,
                "building_id": None,
            },
        ],
        "staff_property_assignments": [
            {"id": "spa-1", "tenant_id": "t-1", "user_id": "lead-1", "property_id": "p-1"},
            {"id": "spa-2", "tenant_id": "t-1", "user_id": "staff-1", "property_id": "p-1"},
            {"id": "spa-3", "tenant_id": "t-1", "user_id": "staff-2", "property_id": "p-2"},
        ],
        "personal_regeln": [
            {
                "tenant_id": "t-1",
                "land": "DK",
                "feiertage_region": None,
                "zeitzone": "Europe/Copenhagen",
                "ruhezeit_stunden": 11,
                "max_tagesstunden": 10,
                "max_wochenstunden": 48,
                "nacht_von": "23:00:00",
                "nacht_bis": "06:00:00",
                "zuschlag_nacht_pct": 25,
                "zuschlag_sonntag_pct": 50,
                "zuschlag_feiertag_pct": 100,
                "zuschlag_ueberstunden_pct": 25,
                "urlaubsjahr_start_monat": 1,
                "uebertrag_verfall_monat": 3,
                "uebertrag_max_tage": None,
                "mindest_vorlauf_urlaub_tage": 0,
                "datev_berater_nr": None,
                "datev_mandanten_nr": None,
                "lohnarten": {},
                "bestaetigt_am": "2026-08-01T00:00:00+00:00",
                "bestaetigt_von": "admin-1",
            }
        ],
        "feiertage": [
            {
                "id": "f-1",
                "land": "DK",
                "region": None,
                "datum": "2026-12-25",
                "name": "Juledag",
                "quelle": "test",
            },
            {
                "id": "f-2",
                "land": "DK",
                "region": None,
                "datum": "2026-09-01",
                "name": "Testtag",
                "quelle": "test",
            },
        ],
        "personal_akten": [
            {
                "id": "ak-1",
                "tenant_id": "t-1",
                "user_id": "staff-1",
                "beschaeftigungsart": "teilzeit",
                "wochenstunden": 20,
                "arbeitstage_je_woche": 5,
                "stundenlohn_minor": 18000,
                "currency": "DKK",
                "urlaubsanspruch_tage": 25,
                "employee_number": "1001",
                "eintritt": "2026-01-01",
            },
        ],
    }


def stumm(monkeypatch: Any) -> list[tuple[str, dict]]:
    """Benachrichtigungen abfangen: statt Dispatcher ein Protokoll."""
    from src.features.personal import abwesenheiten, schichten

    protokoll: list[tuple[str, dict]] = []

    def _f(name: str) -> Any:
        def inner(_db: object, **kw: object) -> None:
            protokoll.append((name, kw))

        return inner

    monkeypatch.setattr(schichten, "melde_dienstplan", _f("dienstplan"))
    monkeypatch.setattr(schichten, "melde_schicht_offen", _f("schicht_offen"))
    monkeypatch.setattr(abwesenheiten, "melde_dienstplan", _f("dienstplan"))
    monkeypatch.setattr(abwesenheiten, "melde_abwesenheit_antrag", _f("antrag"))
    monkeypatch.setattr(abwesenheiten, "melde_abwesenheit_entschieden", _f("entscheidung"))
    return protokoll
