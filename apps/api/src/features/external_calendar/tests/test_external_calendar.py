"""Tests für externe iCal-Kalender (Belegungs-Sync).

Parser gegen ECHTE externe iCal-Daten (kein erfundenes Format). Sync-Logik mit
In-Memory-Fake-DB: Idempotenz (Wurzel 2), Gegenzustand (Wurzel 1), SSRF-Schutz
(Wurzel 5).
"""
from __future__ import annotations

from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.external_calendar.ical import ExportEvent, build_ical, parse_ical
from src.features.external_calendar.service import (
    ExternalCalendarError,
    ExternalCalendarService,
    _assert_public_url,
    _merge_ranges,
)
from src.main import create_app

client = TestClient(create_app())
_CTX = AuthContext(user_id="u", tenant_id="t1")

# Echte externe iCal (aus einer availability.ics, gekürzt + 1 Closed Period).
REAL_ICAL = """BEGIN:VCALENDAR
PRODID://Channel Manager//EN
VERSION:2.0
BEGIN:VEVENT
DTEND;VALUE=DATE:20260103
DTSTART;VALUE=DATE:20260101
SUMMARY:S***** m*****
UID:bc19ffa1-cc0a-4798-b1ce-b26b37483fd5
END:VEVENT
BEGIN:VEVENT
DTEND;VALUE=DATE:20260202
DTSTART;VALUE=DATE:20260129
SUMMARY:C****** A****
UID:9a822006-f490-4317-88d2-7e61f0f3ceb6
END:VEVENT
BEGIN:VEVENT
DTEND;VALUE=DATE:20260412
DTSTART;VALUE=DATE:20260325
SUMMARY:Closed Period
UID:5606e19a-2c4a-4ac0-ac18-17683cfce773
END:VEVENT
END:VCALENDAR
"""


# --- Parser ---------------------------------------------------------------
def test_parse_real_external_ical() -> None:
    events = parse_ical(REAL_ICAL)
    assert len(events) == 3
    by_uid = {e.uid[:8]: e for e in events}
    first = by_uid["bc19ffa1"]
    # DTEND ist EXKLUSIV: 01.–03. → 2 Nächte (01., 02.), 03. frei.
    assert first.nights() == [date(2026, 1, 1), date(2026, 1, 2)]
    assert by_uid["5606e19a"].summary == "Closed Period"
    assert len(by_uid["5606e19a"].nights()) == 18  # 25.03.–12.04. exkl.


def test_parse_skips_broken_events() -> None:
    broken = """BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260101
UID:no-end
END:VEVENT
BEGIN:VEVENT
DTEND;VALUE=DATE:20260101
DTSTART;VALUE=DATE:20260103
UID:end-before-start
END:VEVENT
END:VCALENDAR"""
    # Beide defekt (fehlendes DTEND / start>=end) → 0 Events, kein Raten.
    assert parse_ical(broken) == []


def test_parse_deduplicates_uid() -> None:
    dup = REAL_ICAL.replace("END:VCALENDAR", "") + """BEGIN:VEVENT
DTEND;VALUE=DATE:20260103
DTSTART;VALUE=DATE:20260101
UID:bc19ffa1-cc0a-4798-b1ce-b26b37483fd5
END:VEVENT
END:VCALENDAR"""
    events = parse_ical(dup)
    uids = [e.uid for e in events]
    assert len(uids) == len(set(uids))  # keine Doppel-UID


def test_line_unfolding() -> None:
    folded = (
        "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\n"
        "DTSTART;VALUE=DATE:20260101\r\nDTEND;VALUE=DATE:20260102\r\n"
        "SUMMARY:Very long na\r\n me\r\nUID:x\r\nEND:VEVENT\r\nEND:VCALENDAR"
    )
    events = parse_ical(folded)
    assert events[0].summary == "Very long name"


# --- SSRF-Schutz ----------------------------------------------------------
@pytest.mark.parametrize("bad", [
    "http://localhost/cal.ics",
    "http://127.0.0.1/cal.ics",
    "http://169.254.169.254/latest/meta-data",  # Cloud-Metadaten
    "ftp://example.com/cal.ics",
    "file:///etc/passwd",
])
def test_ssrf_blocks_non_public(bad: str) -> None:
    with pytest.raises(ExternalCalendarError):
        _assert_public_url(bad)


def test_fetch_revalidates_redirect_target(monkeypatch: pytest.MonkeyPatch) -> None:
    """DNS-Rebinding/Redirect-SSRF: ein harmloser Feed leitet per 302 auf eine
    interne Adresse um → der Fetch MUSS die Zwischenstation erneut auflösen,
    prüfen und ablehnen (Wurzel 5, fail-closed)."""
    import httpx

    def _handler(_req: httpx.Request) -> httpx.Response:
        # Erster Hop (auf die gepinnte öffentliche IP) → 302 auf internen Host.
        return httpx.Response(302, headers={"location": "http://internal.test/i"})

    orig_client_init = httpx.Client.__init__

    def _init(self: httpx.Client, **kwargs: Any) -> None:  # noqa: ANN401
        kwargs["transport"] = httpx.MockTransport(_handler)
        orig_client_init(self, **kwargs)

    monkeypatch.setattr(httpx.Client, "__init__", _init)
    # feed.example.com → öffentlich (Fetch erreicht Redirect-Logik),
    # internal.test → intern (muss abgelehnt werden).
    monkeypatch.setattr(
        "src.features.external_calendar.service.socket.getaddrinfo",
        lambda host, *_a, **_k: (
            [(2, 1, 6, "", ("93.184.216.34", 0))]
            if host == "feed.example.com"
            else [(2, 1, 6, "", ("127.0.0.1", 0))]
        ),
    )
    svc = ExternalCalendarService()
    with pytest.raises(ExternalCalendarError):
        svc._fetch("http://feed.example.com/cal.ics")  # noqa: SLF001


# --- Fake-DB für Sync-Tests -----------------------------------------------
class _Tbl:
    def __init__(self, store: dict, name: str) -> None:
        self.s, self.n = store, name
        self._f: list[tuple[str, Any]] = []
        self._op: tuple | None = None

    def _rows(self) -> list[dict]:
        return self.s.setdefault(self.n, [])

    def select(self, *_a: Any, **_k: Any) -> _Tbl:
        self._op = ("select",)
        return self

    def upsert(self, payload: dict, *, on_conflict: str = "", **_k: Any) -> _Tbl:
        self._op = ("upsert", payload, on_conflict)
        return self

    def update(self, payload: dict) -> _Tbl:
        self._op = ("update", payload)
        return self

    def delete(self) -> _Tbl:
        self._op = ("delete",)
        return self

    def eq(self, c: str, v: Any) -> _Tbl:
        self._f.append((c, v))
        return self

    def is_(self, c: str, _v: str) -> _Tbl:
        self._f.append((c, None))
        return self

    def lt(self, c: str, v: Any) -> _Tbl:
        self._f.append(("__lt__" + c, v))
        return self

    def order(self, *_a: Any, **_k: Any) -> _Tbl:
        return self

    def limit(self, _n: int) -> _Tbl:
        return self

    def _match(self, r: dict) -> bool:
        for c, v in self._f:
            if c.startswith("__lt__"):
                col = c[6:]
                if not (r.get(col) is not None and r[col] < v):
                    return False
            elif r.get(c) != v:
                return False
        return True

    def execute(self) -> Any:
        op = self._op
        rows = self._rows()
        data: list[dict] = []
        if op[0] == "select":
            data = [r for r in rows if self._match(r)]
        elif op[0] == "upsert":
            _, payload, oc = op
            keys = [k.strip() for k in oc.split(",")] if oc else []
            hit = None
            for r in rows:
                if keys and all(r.get(k) == payload.get(k) for k in keys):
                    hit = r
                    break
            if hit is not None:
                hit.update(payload)
                data = [hit]
            else:
                nr = dict(payload)
                nr.setdefault("id", f"{self.n}_{len(rows)+1}")
                rows.append(nr)
                data = [nr]
        elif op[0] == "update":
            for r in rows:
                if self._match(r):
                    r.update(op[1])
                    data.append(r)
        elif op[0] == "delete":
            keep = [r for r in rows if not self._match(r)]
            data = [r for r in rows if self._match(r)]
            self.s[self.n] = keep
        self._f, self._op = [], None

        class _R:
            def __init__(self, d: list[dict]) -> None:
                self.data = d
        return _R(data)


class _DB:
    def __init__(self) -> None:
        self.store: dict[str, list[dict]] = {
            "properties": [{"id": "p1", "tenant_id": "t1"}],
            "external_calendar": [],
            "availability": [],
        }

    def table(self, name: str) -> _Tbl:
        return _Tbl(self.store, name)


def test_apply_nights_idempotent_and_counterstate() -> None:
    db = _DB()
    svc = ExternalCalendarService(service_client=db)
    # Erst 2 Nächte sperren.
    svc._apply_nights(db, "p1", "cal1", {date(2026, 1, 1), date(2026, 1, 2)})  # noqa: SLF001
    avail = db.store["availability"]
    assert len(avail) == 2
    assert all(a["status"] == "blocked" and a["source"] == "ical" for a in avail)
    # Zweiter Lauf mit denselben Nächten → keine Doppelzeilen (Idempotenz, Wurzel 2).
    svc._apply_nights(db, "p1", "cal1", {date(2026, 1, 1), date(2026, 1, 2)})  # noqa: SLF001
    assert len(db.store["availability"]) == 2
    # Feed liefert jetzt nur noch die 1. Nacht → 2. muss freigegeben werden (Wurzel 1).
    svc._apply_nights(db, "p1", "cal1", {date(2026, 1, 1)})  # noqa: SLF001
    dates = {a["date"] for a in db.store["availability"]}
    assert dates == {"2026-01-01"}


def test_sync_does_not_touch_foreign_blocks() -> None:
    """Der ical-Sync räumt NUR seine eigenen Zeilen (external_calendar_id) — eine
    fremde OTA-Sperre bleibt unangetastet (Wurzel 1)."""
    db = _DB()
    db.store["availability"].append(
        {"id": "x", "property_id": "p1", "date": "2026-01-05",
         "status": "booked", "source": "booking", "external_calendar_id": None}
    )
    svc = ExternalCalendarService(service_client=db)
    svc._apply_nights(db, "p1", "cal1", {date(2026, 1, 1)})  # noqa: SLF001
    # Fremde Buchung noch da.
    assert any(a["id"] == "x" for a in db.store["availability"])


def test_ical_does_not_overwrite_real_booking_on_same_day() -> None:
    """Kritisch (Wurzel 1): liegt der iCal-Tag auf einer ECHTEN Buchung, darf der
    Sync sie NICHT mit blocked/ical überschreiben (sonst Datenverlust)."""
    db = _DB()
    db.store["availability"].append(
        {"id": "b1", "property_id": "p1", "date": "2026-01-01",
         "status": "booked", "source": "direct", "external_calendar_id": None}
    )
    svc = ExternalCalendarService(service_client=db)
    # iCal liefert denselben Tag → darf die echte Buchung NICHT überschreiben.
    svc._apply_nights(db, "p1", "cal1", {date(2026, 1, 1)})  # noqa: SLF001
    row = next(a for a in db.store["availability"] if a["date"] == "2026-01-01")
    assert row["status"] == "booked" and row["source"] == "direct"
    # Und keine zweite Zeile für denselben Tag.
    assert sum(1 for a in db.store["availability"] if a["date"] == "2026-01-01") == 1


def test_merge_ranges_groups_consecutive_days() -> None:
    days = [
        date(2026, 1, 1), date(2026, 1, 2), date(2026, 1, 3),
        date(2026, 1, 5),
    ]
    # 1.–3. zusammenhängend (DTEND exklusiv = 4.), 5. einzeln (DTEND = 6.).
    assert _merge_ranges(days) == [
        (date(2026, 1, 1), date(2026, 1, 4)),
        (date(2026, 1, 5), date(2026, 1, 6)),
    ]
    assert _merge_ranges([]) == []


def test_build_ical_roundtrips_through_parser() -> None:
    events = [
        ExportEvent(
            uid="u1@x", start=date(2026, 6, 1), end=date(2026, 6, 4),
            summary="Nicht verfügbar",
        ),
    ]
    text = build_ical(
        prod_id="myNextDays", cal_name="Objekt",
        events=events, dtstamp="20260101T000000Z",
    )
    assert text.startswith("BEGIN:VCALENDAR")
    assert "END:VCALENDAR" in text
    # Der eigene Parser liest den erzeugten Feed korrekt zurück (Nächte 1.–3.).
    parsed = parse_ical(text)
    assert len(parsed) == 1
    assert parsed[0].start == date(2026, 6, 1)
    assert parsed[0].end == date(2026, 6, 4)
    assert parsed[0].nights() == [date(2026, 6, 1), date(2026, 6, 2), date(2026, 6, 3)]


def test_add_calendar_rejects_private_url() -> None:
    db = _DB()
    svc = ExternalCalendarService(service_client=db)
    with pytest.raises(ExternalCalendarError) as exc:
        svc.add_calendar(_CTX, property_id="p1", name="X", ical_url="http://localhost/c.ics")
    assert exc.value.status_code == 422


def test_add_calendar_foreign_property_404() -> None:
    db = _DB()
    svc = ExternalCalendarService(service_client=db)
    with pytest.raises(ExternalCalendarError) as exc:
        svc.add_calendar(
            AuthContext(user_id="u", tenant_id="OTHER"),
            property_id="p1", name="X", ical_url="https://example.com/c.ics",
        )
    assert exc.value.status_code == 404


def test_overview_groups_feeds_per_property() -> None:
    """Der Umzugs-Tab liefert ALLE Objekte des Tenants + ihre Feeds gebündelt,
    tenant-gescoped (Wurzel 3)."""
    db = _DB()
    db.store["properties"] = [
        {"id": "p1", "tenant_id": "t1", "title": "Apartment A", "status": "active"},
        {"id": "p2", "tenant_id": "t1", "title": "Haus B", "status": "active"},
        {"id": "p9", "tenant_id": "OTHER", "title": "Fremd", "status": "active"},
    ]
    db.store["external_calendar"] = [
        {"id": "c1", "tenant_id": "t1", "property_id": "p1", "name": "Externer Kalender",
         "ical_url": "https://x/a.ics", "is_active": True,
         "last_status": "ok", "last_event_count": 3},
        {"id": "c9", "tenant_id": "OTHER", "property_id": "p9", "name": "X",
         "ical_url": "https://x/z.ics", "is_active": True, "last_status": "ok"},
    ]
    svc = ExternalCalendarService(service_client=db)
    rows = svc.overview(_CTX)
    # Nur die beiden eigenen Objekte, das fremde NICHT.
    assert {r["property_id"] for r in rows} == {"p1", "p2"}
    by_id = {r["property_id"]: r for r in rows}
    assert by_id["p1"]["title"] == "Apartment A"
    assert len(by_id["p1"]["calendars"]) == 1
    assert by_id["p1"]["calendars"][0]["id"] == "c1"
    # Objekt ohne Feed → leere Liste, nicht fehlend.
    assert by_id["p2"]["calendars"] == []


def test_health() -> None:
    r = client.get("/api/v1/external-calendar/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_docs_disabled_in_prod(monkeypatch: pytest.MonkeyPatch) -> None:
    """A8: /docs, /redoc, /openapi.json dürfen in Prod (app_env != local) NICHT
    erreichbar sein — nur lokal."""
    from src.core.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "production")
    # In Prod bindet die TrustedHostMiddleware — der TestClient sendet Host
    # "testserver", der sonst mit 400 abgewiesen würde. Explizit erlauben, damit
    # dieser Test die docs-Deaktivierung (404) prüft, nicht den Host-Check.
    monkeypatch.setenv("TRUSTED_HOSTS", "testserver")
    prod_app = create_app()
    prod_client = TestClient(prod_app)
    assert prod_client.get("/openapi.json").status_code == 404
    assert prod_client.get("/docs").status_code == 404
    get_settings.cache_clear()


def test_security_headers_present(monkeypatch: pytest.MonkeyPatch) -> None:
    """Jede Antwort trägt die API-Security-Header (nosniff, DENY, CSP)."""
    from src.core.config import get_settings

    get_settings.cache_clear()
    client = TestClient(create_app())
    resp = client.get("/health")
    assert resp.headers["X-Content-Type-Options"] == "nosniff"
    assert resp.headers["X-Frame-Options"] == "DENY"
    assert "default-src 'none'" in resp.headers["Content-Security-Policy"]
    get_settings.cache_clear()


def test_trusted_host_rejects_foreign_host(monkeypatch: pytest.MonkeyPatch) -> None:
    """In Prod weist die TrustedHostMiddleware einen fremden Host-Header ab (400)."""
    from src.core.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("TRUSTED_HOSTS", "api.mynextdays.com")
    client = TestClient(create_app())
    # Erlaubter Host → 200, fremder Host → 400 (vor jeder Route).
    assert client.get("/health", headers={"host": "api.mynextdays.com"}).status_code == 200
    assert client.get("/health", headers={"host": "evil.example.com"}).status_code == 400
    get_settings.cache_clear()
