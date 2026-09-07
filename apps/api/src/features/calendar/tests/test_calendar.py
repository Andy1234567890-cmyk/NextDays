"""Tests für den calendar-Slice (Herzstück: Double-Booking-Schutz)."""
from datetime import date

import pytest
from fastapi.testclient import TestClient

from src.core.dates import merge_day_ranges
from src.core.security import AuthContext
from src.features.auth.granular_permissions import Permission
from src.features.calendar.schemas import (
    AvailabilityStatus,
    BlockRequest,
    DateRange,
    PriceOverrideRequest,
    RestrictionRow,
    RestrictionRowsRequest,
    StopSellListResponse,
)
from src.features.calendar.service import CalendarError, CalendarService
from src.main import create_app

client = TestClient(create_app())


def _ctx(role: str = "admin", tenant: str | None = "t1") -> AuthContext:
    return AuthContext(user_id="u1", tenant_id=tenant, role=role)


# --- Health (Smoke) ---

def test_calendar_health() -> None:
    resp = client.get("/api/v1/calendar/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "calendar", "status": "ok"}


# --- DateRange ---

def test_daterange_rejects_inverted() -> None:
    with pytest.raises(ValueError):
        DateRange(start=date(2026, 5, 10), end=date(2026, 5, 10))


def test_daterange_nights_excludes_checkout() -> None:
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 4))
    assert rng.nights() == [date(2026, 5, 1), date(2026, 5, 2), date(2026, 5, 3)]


# --- In-Memory-Fake-DB (tabellenbewusst; deckt die genutzten Query-Ketten ab) -

class _Res:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:
    """Minimaler Supabase-Query-Stub: Filter werden ignoriert, execute liefert
    die für die Tabelle hinterlegten Zeilen (bzw. zeichnet upserts auf)."""

    def __init__(self, store: dict, name: str) -> None:
        self._store = store
        self._name = name
        self._eq: dict = {}
        self._in: tuple | None = None
        self._op = "select"
        self._payload: dict | None = None

    def select(self, *_a, **_k) -> "_Query":
        return self

    def eq(self, col, val) -> "_Query":  # noqa: ANN001
        self._eq[col] = val
        return self

    def in_(self, col, vals) -> "_Query":  # noqa: ANN001
        self._in = (col, list(vals))
        return self

    def gte(self, *_a, **_k) -> "_Query":
        return self

    def lt(self, *_a, **_k) -> "_Query":
        return self

    def lte(self, *_a, **_k) -> "_Query":
        return self

    def delete(self) -> "_Query":
        self._op = "delete"
        return self

    def order(self, *_a, **_k) -> "_Query":
        return self

    def range(self, *_a, **_k) -> "_Query":
        """`fetch_all_rows` blättert mit .range() über den 1000-Zeilen-Cap
        hinweg. Der Doppelgänger hält seine Zeilen ohnehin komplett im
        Speicher — er gibt sie in EINER Seite zurück, und weil die kleiner als
        die Seitengröße ist, endet die Schleife nach dem ersten Durchlauf."""
        return self

    def limit(self, *_a, **_k) -> "_Query":
        return self

    @property
    def not_(self) -> "_Query":
        return self

    def is_(self, *_a, **_k) -> "_Query":
        return self

    def update(self, payload) -> "_Query":  # noqa: ANN001
        self._store.setdefault("_updates", []).append((self._name, payload))
        self._op = "update"
        self._payload = payload
        return self

    def upsert(self, payload, **_k) -> "_Query":  # noqa: ANN001
        self._store.setdefault("_upserts", []).append((self._name, payload))
        # Der Upsert landet AUCH im Store, nicht nur im Protokoll: Pfade, die
        # nach dem Schreiben den Ist-Stand lesen (der Verfügbarkeits-Push
        # zählt die freien Einheiten NACH der Sperre), sähen sonst immer den
        # Zustand von vorher — der Test würde den Fehler nicht zeigen, den er
        # ausschließen soll.
        rows = self._store.setdefault(self._name, [])
        for eintrag in payload if isinstance(payload, list) else [payload]:
            treffer = [
                r
                for r in rows
                if r.get("property_id") == eintrag.get("property_id")
                and r.get("date") == eintrag.get("date")
                and r.get("unit_id") == eintrag.get("unit_id")
            ]
            if treffer:
                treffer[0].update(eintrag)
            else:
                rows.append(dict(eintrag))
        return self

    def _getroffen(self, rows: list) -> list:
        """Die Zeilen, auf die eq/in_ dieses Query zutreffen.

        Nur auf Spalten filtern, die die Zeilen überhaupt führen — die meisten
        Tests hinterlegen Kurz-Zeilen ohne tenant_id/status, ein pauschaler
        Filter machte sie alle leer.
        """
        getroffen = rows
        for col, val in self._eq.items():
            if any(col in r for r in rows):
                getroffen = [
                    r for r in getroffen if str(r.get(col)) == str(val)
                ]
        if self._in is not None:
            col, vals = self._in
            if any(col in r for r in rows):
                werte = {str(v) for v in vals}
                getroffen = [
                    r for r in getroffen if str(r.get(col)) in werte
                ]
        return getroffen

    def execute(self) -> _Res:
        if self._op == "update" and self._payload is not None:
            # Das Update wirklich ANWENDEN, nicht nur protokollieren: seit der
            # Freigabe einer Sperre auf `status='open'` updatet statt löscht,
            # beweist erst der veränderte Store den Gegenzustand (Wurzel 1).
            # Ein rein protokollierendes Update sähe die Zeile weiter als
            # 'blocked' — der Test wäre wertlos.
            rows = self._store.setdefault(self._name, [])
            for r in self._getroffen(list(rows)):
                r.update(self._payload)
            return _Res([])
        if self._op == "delete":
            self._store.setdefault("_deletes", []).append(self._name)
            # Delete-Filter (source) mitschreiben, damit Tests die Unterscheidung
            # manuell vs. auch-Portal prüfen können.
            self._store.setdefault("_delete_filters", []).append(
                (self._name, dict(self._eq))
            )
            # Und wirklich löschen — nach demselben „nur bekannte Spalten"-
            # Prinzip wie beim select. Ein Delete, der nur protokolliert,
            # könnte den Gegenzustand nicht beweisen: der Freigabe-Test sähe
            # die gelöschten Zeilen weiter im Store und wäre wertlos.
            rows = list(self._store.get(self._name, []))
            getroffen = self._getroffen(rows)
            # In-place (`[:] =`) statt neu binden: Tests halten oft eine
            # Referenz auf genau diese Liste und sähen sonst den Stand von vor
            # dem Löschen.
            uebrig = [r for r in rows if r not in getroffen]
            self._store.setdefault(self._name, [])[:] = uebrig
            return _Res([])
        rows = list(self._store.get(self._name, []))
        # Der in_-Filter greift beim SELECT auch auf Spalten, die die Zeilen
        # nicht führen (properties-Tenant-Lookup im bulk_edit erwartet das).
        if self._in is not None:
            col, vals = self._in
            rows = [r for r in rows if r.get(col) in vals]
        for col, val in self._eq.items():
            if any(col in r for r in rows):
                rows = [r for r in rows if str(r.get(col)) == str(val)]
        return _Res(rows)


class _FakeDB:
    def __init__(self, store: dict) -> None:
        self._store = store

    def table(self, name: str) -> _Query:
        return _Query(self._store, name)


# Alle feingranularen Rechte — für den Standard-Testnutzer (admin) in `users`.
# Die Preis-Maskierung liest Rolle+Rechte aus der DB (fail-closed), ein Store
# ohne `users`-Zeile maskierte daher AUCH den Admin.
_ALLE_RECHTE = [p.value for p in Permission]


def _service(**tables: list[dict]) -> tuple[CalendarService, dict]:
    store: dict = dict(tables)
    # Standard: u1 ist admin mit allen Rechten. Tests, die eine andere Rolle
    # prüfen, überschreiben `users` per Schlüsselwort.
    store.setdefault(
        "users", [{"id": "u1", "role": "admin", "permissions": _ALLE_RECHTE}]
    )
    return CalendarService(client=_FakeDB(store)), store


# --- get_availability: fehlende Tage = offen ---

def test_missing_days_are_open() -> None:
    svc, _ = _service(properties=[{"id": "p1"}])
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3))
    days = svc.get_availability(_ctx(), "p1", rng)
    assert [d.status for d in days] == [
        AvailabilityStatus.open,
        AvailabilityStatus.open,
    ]


# --- get_availability: Preis (Override > Basispreis) + Min-Stay ---

def test_availability_price_override_beats_base_price() -> None:
    svc, _ = _service(
        properties=[{"id": "p1"}],
        rate_plans=[{"base_price": 100.0, "min_stay": 2}],
        price_overrides=[{"date": "2026-05-02", "price": 150.0}],
    )
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3))
    days = svc.get_availability(_ctx(), "p1", rng)
    # Tag 1 ohne Override → Basispreis; Tag 2 mit Override.
    assert days[0].price == 100.0
    assert days[1].price == 150.0
    assert all(d.min_stay == 2 for d in days)


def test_availability_no_rate_plan_keeps_price_none() -> None:
    svc, _ = _service(properties=[{"id": "p1"}])  # kein Rate-Plan → kein erfundener Preis
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2))
    days = svc.get_availability(_ctx(), "p1", rng)
    assert days[0].price is None
    assert days[0].min_stay is None


# --- get_availability: fremdes Objekt → 404 (Tenant-Scope) ---

def test_availability_rejects_foreign_property() -> None:
    svc, _ = _service()  # keine eigene property im Store → Gate wirft 404
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2))
    with pytest.raises(CalendarError) as exc:
        svc.get_availability(_ctx(), "p-fremd", rng)
    assert exc.value.status_code == 404


# --- check_availability: Double-Booking erkannt ---

def test_check_detects_conflict() -> None:
    svc, _ = _service(
        properties=[{"id": "p1"}],
        availability=[{"date": "2026-05-02", "status": "booked", "source": "booking"}],
    )
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3))
    res = svc.check_availability(_ctx(), "p1", rng)
    assert res.available is False
    assert res.conflicting_days == [date(2026, 5, 2)]


def test_check_all_open_is_available() -> None:
    svc, _ = _service(properties=[{"id": "p1"}])
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 5))
    res = svc.check_availability(_ctx(), "p1", rng)
    assert res.available is True
    assert res.conflicting_days == []


# --- block: gebuchte Tage NICHT überschreiben ---

def test_block_rejects_when_booked() -> None:
    svc, _ = _service(
        properties=[{"id": "p1"}],
        availability=[{"date": "2026-05-02", "status": "booked", "source": "airbnb"}],
    )
    req = BlockRequest(
        property_id="p1",
        range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3)),
    )
    with pytest.raises(CalendarError) as exc:
        svc.block("t1", req)
    assert exc.value.status_code == 409


def test_block_open_days_upserts() -> None:
    # Ein Objekt OHNE Preisplan hat keinen Ort für den Mindestaufenthalt —
    # der Service weist das seit dem 06.09.2026 mit 422 ab (Wurzel 5).
    svc, store = _service(
        properties=[{"id": "p1"}],
        rate_plans=[{"id": "rp1", "property_id": "p1", "min_stay": 1}],
    )
    req = BlockRequest(
        property_id="p1",
        range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 4)),
    )
    count = svc.block("t1", req)
    assert count == 3
    upserts = [u for u in store.get("_upserts", []) if u[0] == "availability"]
    assert len(upserts) == 1
    payload = upserts[0][1]
    assert len(payload) == 3
    assert all(p["status"] == "blocked" for p in payload)


# --- Verfügbarkeits-Push: die ECHTE Stückzahl, nie eine feste 0/1 (0353) ---

def _ari_jobs(monkeypatch) -> list[dict]:  # noqa: ANN001
    """`try_enqueue_ari` abfangen und die gemeldeten Werte einsammeln."""
    from src.features.calendar import service as cal_service

    jobs: list[dict] = []
    monkeypatch.setattr(
        cal_service, "try_enqueue_ari",
        lambda _db, _tenant, _pid, kind, fields: jobs.append(
            {"kind": kind, **fields}
        ),
    )
    return jobs


def _mehrfamilien_store() -> dict:
    """Ein Objekt-TYP mit DREI identischen Einheiten (0265) und leerem Kalender."""
    return {
        "properties": [{"id": "p1", "tenant_id": "t1"}],
        "property_units": [
            {"id": "u1", "property_id": "p1", "tenant_id": "t1", "position": 0},
            {"id": "u2", "property_id": "p1", "tenant_id": "t1", "position": 1},
            {"id": "u3", "property_id": "p1", "tenant_id": "t1", "position": 2},
        ],
        "availability": [],
    }


def test_unblock_meldet_alle_freien_einheiten_nicht_pauschal_eins(
    monkeypatch,  # noqa: ANN001
) -> None:
    """DER BUG AUS STUFE 1: `_unblock` pushte je offener Spanne ein festes `1`.

    Bei einem Typ mit drei Einheiten blieben damit zwei bei den Portalen
    unverkäuflich — der Kalender führte sie offen, Booking/Airbnb sahen
    „1 verfügbar". Gemeldet werden MUSS die Stückzahl (SiteMinder
    `BookingLimit`, Booking.com „rooms available to sell").
    """
    jobs = _ari_jobs(monkeypatch)
    svc, _ = _service(**_mehrfamilien_store())
    svc.unblock(
        "t1", "p1", DateRange(start=date(2026, 5, 1), end=date(2026, 5, 4))
    )
    verfuegbar = [j for j in jobs if j["kind"] == "availability"]
    assert verfuegbar and all(j["availability"] == 3 for j in verfuegbar)


def test_unblock_meldet_belegten_tag_als_null_statt_ihn_auszusparen(
    monkeypatch,  # noqa: ANN001
) -> None:
    """Der Gegenzustand bleibt gewahrt: ein weiterhin belegter Tag darf NICHT
    als frei gemeldet werden.

    Vorher wurde er aus dem Push ausgespart (Spannen-Trick), jetzt trägt er
    schlicht die Zahl 0 — dieselbe Aussage, aber ohne die Sonderbehandlung, und
    mit der Fähigkeit, „eine von drei Einheiten belegt" als 2 zu melden statt
    den ganzen Tag zuzumachen.
    """
    jobs = _ari_jobs(monkeypatch)
    store = _mehrfamilien_store()
    store["availability"] = [
        # Alle drei Einheiten am 2.5. gebucht → dieser Tag ist wirklich zu.
        {"property_id": "p1", "unit_id": u, "date": "2026-05-02",
         "status": "booked", "source": "airbnb"}
        for u in ("u1", "u2", "u3")
    ]
    svc, _ = _service(**store)
    svc.unblock(
        "t1", "p1", DateRange(start=date(2026, 5, 1), end=date(2026, 5, 4))
    )
    werte = {
        (j["date_from"], j["date_to"]): j["availability"]
        for j in jobs
        if j["kind"] == "availability"
    }
    assert werte[("2026-05-02", "2026-05-02")] == 0
    assert werte[("2026-05-01", "2026-05-01")] == 3
    assert werte[("2026-05-03", "2026-05-03")] == 3


def test_unblock_meldet_teilbelegten_tag_mit_der_restzahl(
    monkeypatch,  # noqa: ANN001
) -> None:
    """Der zweite Teil desselben Fehlers: ein Tag, an dem EINE von drei
    Einheiten belegt ist, wurde komplett aus dem Push genommen. Die übrigen
    zwei blieben unverkäuflich, obwohl sie frei sind."""
    jobs = _ari_jobs(monkeypatch)
    store = _mehrfamilien_store()
    store["availability"] = [
        {"property_id": "p1", "unit_id": "u1", "date": "2026-05-02",
         "status": "booked", "source": "airbnb"},
    ]
    svc, _ = _service(**store)
    svc.unblock(
        "t1", "p1", DateRange(start=date(2026, 5, 1), end=date(2026, 5, 4))
    )
    werte = {
        (j["date_from"], j["date_to"]): j["availability"]
        for j in jobs
        if j["kind"] == "availability"
    }
    assert werte[("2026-05-02", "2026-05-02")] == 2


def test_block_einer_einheit_meldet_die_uebrigen_als_frei(
    monkeypatch,  # noqa: ANN001
) -> None:
    """Stufe 3 + der Gegen-Fehler zu Stufe 1: `block` pushte ein festes `0`.

    Solange eine Sperre IMMER alle Einheiten traf, stimmte das. Sperrt sie nur
    eine von drei (Eigennutzung eines Studios), nähme die feste 0 dem ganzen
    Typ die Verfügbarkeit — zwei verkäufliche Einheiten wären bei den Portalen
    tot.
    """
    jobs = _ari_jobs(monkeypatch)
    svc, store = _service(**_mehrfamilien_store())
    req = BlockRequest(
        property_id="p1",
        range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3)),
        unit_id="u2",
    )
    assert svc.block("t1", req) == 2
    # Nur die eine Einheit bekommt Sperr-Zeilen.
    payload = [u[1] for u in store["_upserts"] if u[0] == "availability"][0]
    assert {p["unit_id"] for p in payload} == {"u2"}
    verfuegbar = [j for j in jobs if j["kind"] == "availability"]
    assert verfuegbar and all(j["availability"] == 2 for j in verfuegbar)


def test_block_ohne_einheit_sperrt_weiterhin_den_ganzen_typ(
    monkeypatch,  # noqa: ANN001
) -> None:
    """Gegenprobe: ohne `unit_id` bleibt es beim bisherigen Verhalten — alle
    Einheiten zu, Verfügbarkeit 0. Der Fix darf den Normalfall nicht ändern."""
    jobs = _ari_jobs(monkeypatch)
    svc, store = _service(**_mehrfamilien_store())
    req = BlockRequest(
        property_id="p1",
        range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3)),
    )
    svc.block("t1", req)
    payload = [u[1] for u in store["_upserts"] if u[0] == "availability"][0]
    assert {p["unit_id"] for p in payload} == {"u1", "u2", "u3"}
    verfuegbar = [j for j in jobs if j["kind"] == "availability"]
    assert verfuegbar and all(j["availability"] == 0 for j in verfuegbar)


# --- Einheiten-Scope (Wurzel 3): unit_id aus dem Request ist ungeprüft nichts ---

def test_block_lehnt_fremde_einheit_ab() -> None:
    """Eine `unit_id`, die zu einem ANDEREN Objekt gehört, wanderte ungeprüft
    in die availability-Zeile — damit ließe sich über eine geratene UUID die
    Einheit eines fremden Objekts sperren."""
    store = _mehrfamilien_store()
    store["property_units"].append(
        {"id": "u-fremd", "property_id": "p9", "tenant_id": "t1", "position": 0}
    )
    svc, _ = _service(**store)
    req = BlockRequest(
        property_id="p1",
        range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3)),
        unit_id="u-fremd",
    )
    with pytest.raises(CalendarError) as exc:
        svc.block("t1", req)
    assert exc.value.status_code == 422


def test_block_lehnt_einheit_eines_fremden_mandanten_ab() -> None:
    """Zweite Achse desselben Scopes: dieselbe property_id, aber die Einheit
    hängt an einem fremden Mandanten (Datenfehler oder Angriff)."""
    store = _mehrfamilien_store()
    store["property_units"].append(
        {"id": "u-t9", "property_id": "p1", "tenant_id": "t9", "position": 9}
    )
    svc, _ = _service(**store)
    req = BlockRequest(
        property_id="p1",
        range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3)),
        unit_id="u-t9",
    )
    with pytest.raises(CalendarError) as exc:
        svc.block("t1", req)
    assert exc.value.status_code == 422


def test_block_einer_freien_einheit_trotz_buchung_auf_der_schwestereinheit(
) -> None:
    """Eine Buchung auf Studio 1 darf die Eigennutzung von Studio 2 nicht
    verhindern — vorher prüfte `block` objektweit und wies mit 409 ab."""
    store = _mehrfamilien_store()
    store["availability"] = [
        {"property_id": "p1", "unit_id": "u1", "date": "2026-05-01",
         "status": "booked", "source": "airbnb"},
    ]
    svc, _ = _service(**store)
    req = BlockRequest(
        property_id="p1",
        range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3)),
        unit_id="u2",
    )
    assert svc.block("t1", req) == 2


def test_unblock_einer_einheit_laesst_die_anderen_gesperrt() -> None:
    """Wurzel 1 — der Gegenzustand hat denselben Zuschnitt wie die Aktion.

    Wurde nur Studio 2 gesperrt, darf das Aufheben auch nur Studio 2 öffnen.
    Ohne den Einheiten-Filter riss ein Aufheben die Sperren der Schwester-
    einheiten mit auf, und drei Studios wären wieder verkäuflich, obwohl nur
    eines freigegeben wurde.
    """
    store = _mehrfamilien_store()
    store["availability"] = [
        {"property_id": "p1", "unit_id": u, "date": "2026-05-01",
         "status": "blocked", "source": "manual"}
        for u in ("u1", "u2", "u3")
    ]
    svc, _ = _service(**store)
    svc.unblock(
        "t1", "p1", DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2)),
        unit_id="u2",
    )
    verbleibend = {
        r["unit_id"]
        for r in store["availability"]
        if r["status"] == "blocked"
    }
    assert verbleibend == {"u1", "u3"}


def test_unblock_setzt_auf_open_statt_zu_loeschen() -> None:
    """Wurzel 1 — der Gegenzustand einer Sperre ist der OFFENE Tag, nicht die
    Abwesenheit einer Aussage.

    Das Aufheben LÖSCHTE die Zeile. Für die Portale ist ein Tag ohne Zeile
    offen, im Belegungsplan aber ein Loch, das einen durchgehenden Sperrbalken
    in zwei zerreißt — und der nächste Channex-Import legte den Tag als
    `source='portal'` neu an, womit die eigene Sperre für die Rezeption
    unsichtbar und für den Nutzer unlöschbar wurde.

    Live gefunden am 10.08.2026 (Rævehulen, Sperre 14.–19.08.): der 15.08.
    hatte weder eine `availability`- noch eine `stop_sell`-Zeile und war
    mitten in der Sperre auf allen Portalen buchbar.
    """
    store = _mehrfamilien_store()
    store["availability"] = [
        {"property_id": "p1", "unit_id": "u1", "date": "2026-05-01",
         "status": "blocked", "source": "manual", "block_request_id": "b1"}
    ]
    svc, _ = _service(**store)
    svc.unblock(
        "t1", "p1", DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2)),
        unit_id="u1",
    )
    # Die Zeile ist NOCH DA und sagt jetzt „offen" — das ist der Unterschied,
    # den ein reines Zählen der gesperrten Zeilen nicht sehen würde.
    assert len(store["availability"]) == 1
    zeile = store["availability"][0]
    assert zeile["status"] == "open"
    assert zeile["block_request_id"] is None


def test_unblock_hebt_auch_eine_zurueckgespiegelte_sperre_auf() -> None:
    """Eine Sperre mit `source='portal'` ist UNSERE Sperre, keine fremde.

    Die Zeile entsteht, wenn der Channex-Import unsere eigene Vorgabe
    zurückspiegelt (availability=0 → status='blocked', source='portal').
    Unsere Plattform gibt die Vorgabe, Channex reicht sie nur an die OTAs
    weiter. Solange nur `manual` aufhebbar war, wurde eine Sperre unlöschbar,
    sobald ein Sync-Lauf sie einmal zurückgeholt hatte.
    """
    store = _mehrfamilien_store()
    store["availability"] = [
        {"property_id": "p1", "unit_id": "u1", "date": "2026-05-01",
         "status": "blocked", "source": "portal"}
    ]
    svc, _ = _service(**store)
    svc.unblock(
        "t1", "p1", DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2)),
        unit_id="u1",
    )
    assert store["availability"][0]["status"] == "open"


def test_unblock_laesst_ical_sperre_stehen() -> None:
    """Die Gegenprobe: `ical` gehört einem abonnierten Fremdkalender.

    Sie hier zu öffnen wäre ein Scheinerfolg — der nächste Feed-Lauf schriebe
    sie zurück, während der Nutzer glaubt, der Zeitraum sei frei. Der Weg
    dorthin führt über das Abo, nicht über den Balken.
    """
    store = _mehrfamilien_store()
    store["availability"] = [
        {"property_id": "p1", "unit_id": "u1", "date": "2026-05-01",
         "status": "blocked", "source": "ical"}
    ]
    svc, _ = _service(**store)
    svc.unblock(
        "t1", "p1", DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2)),
        unit_id="u1",
    )
    assert store["availability"][0]["status"] == "blocked"


def test_unblock_laesst_die_vertragssperre_stehen() -> None:
    """Die schwerste Gegenprobe (0355): eine Sperre wegen Vertragsende darf
    ein Klick auf dem Balken NICHT aufheben.

    Täte er es, wäre das Objekt bei Booking/Airbnb sofort wieder verkäuflich —
    für einen Zeitraum, für den es keinen Vermarktungsvertrag mehr gibt. Der
    Weg zurück führt ausschließlich über das Enddatum in der Objektkartei
    (Wurzel 1: derselbe Schalter setzt und hebt auf).
    """
    store = _mehrfamilien_store()
    store["availability"] = [
        {"property_id": "p1", "unit_id": "u1", "date": "2027-01-02",
         "status": "blocked", "source": "contract_end"}
    ]
    svc, _ = _service(**store)
    svc.unblock(
        "t1", "p1", DateRange(start=date(2027, 1, 2), end=date(2027, 1, 3)),
        unit_id="u1",
    )
    assert store["availability"][0]["status"] == "blocked"
    assert store["availability"][0]["source"] == "contract_end"


def test_unblock_lehnt_fremde_einheit_ab() -> None:
    """Wurzel 3 auch auf dem Freigabe-Weg: eine ungeprüfte `unit_id` gäbe die
    Einheit eines fremden Objekts frei."""
    store = _mehrfamilien_store()
    store["property_units"].append(
        {"id": "u-fremd", "property_id": "p9", "tenant_id": "t1", "position": 0}
    )
    svc, _ = _service(**store)
    with pytest.raises(CalendarError) as exc:
        svc.unblock(
            "t1", "p1",
            DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2)),
            unit_id="u-fremd",
        )
    assert exc.value.status_code == 422


def test_block_der_gebuchten_einheit_bleibt_409() -> None:
    """Die Gegenprobe: GENAU diese Einheit ist belegt → weiterhin 409, kein
    Überschreiben einer Buchung."""
    store = _mehrfamilien_store()
    store["availability"] = [
        {"property_id": "p1", "unit_id": "u2", "date": "2026-05-01",
         "status": "booked", "source": "airbnb"},
    ]
    svc, _ = _service(**store)
    req = BlockRequest(
        property_id="p1",
        range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3)),
        unit_id="u2",
    )
    with pytest.raises(CalendarError) as exc:
        svc.block("t1", req)
    assert exc.value.status_code == 409


# --- price override: setzen und zurücknehmen ---

def test_price_override_set_and_clear() -> None:
    svc, store = _service(properties=[{"id": "p1"}])
    svc.set_price_override(
        "t1", PriceOverrideRequest(property_id="p1", date=date(2026, 5, 1), price=120)
    )
    svc.set_price_override(
        "t1", PriceOverrideRequest(property_id="p1", date=date(2026, 5, 1), price=None)
    )
    overrides = [u for u in store.get("_upserts", []) if u[0] == "price_overrides"]
    assert len(overrides) == 2


# --- price override über einen BEREICH (Bulk-Dialog „zurücksetzen") ---

def test_price_override_range_clears_every_day(monkeypatch) -> None:  # noqa: ANN001
    """Ein Aufruf mit `end` nimmt den Override für JEDEN Tag des Bereichs zurück
    und meldet den wieder geltenden Preis als Spannen, nicht je Tag."""
    jobs = _ari_jobs(monkeypatch)
    svc, store = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}],
        rate_plans=[{"base_price": 100.0}],
    )
    svc.set_price_override(
        "t1",
        PriceOverrideRequest(
            property_id="p1", date=date(2026, 5, 1), end=date(2026, 5, 4), price=None
        ),
    )
    zeilen = store.get("price_overrides", [])
    assert sorted(z["date"] for z in zeilen) == ["2026-05-01", "2026-05-02", "2026-05-03"]
    assert all(z["price"] is None for z in zeilen)
    # Drei Tage gleicher Basispreis → EIN Rate-Job über den Bereich.
    rate_jobs = [j for j in jobs if j["kind"] == "rate"]
    assert len(rate_jobs) == 1
    assert rate_jobs[0]["date_from"] == "2026-05-01"
    assert rate_jobs[0]["date_to"] == "2026-05-03"
    assert rate_jobs[0]["rate_cents"] == 10000


def test_price_override_range_ueber_366_tage_ist_422() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        PriceOverrideRequest(
            property_id="p1", date=date(2026, 1, 1), end=date(2027, 1, 3), price=None
        )
    # Genau 366 Tage sind erlaubt (Schaltjahr-Kalenderjahr).
    ok = PriceOverrideRequest(
        property_id="p1", date=date(2028, 1, 1), end=date(2029, 1, 1), price=None
    )
    assert len(ok.tage()) == 366


def test_price_override_end_vor_date_ist_422() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        PriceOverrideRequest(
            property_id="p1", date=date(2026, 5, 4), end=date(2026, 5, 4), price=None
        )


def test_preis_spannen_fasst_gleiche_preise_zusammen() -> None:
    from src.features.calendar.service import _preis_spannen
    from src.features.pricing.schemas import EffectivePriceDay

    tage = [
        EffectivePriceDay(date=date(2026, 5, 1), price=100.0),
        EffectivePriceDay(date=date(2026, 5, 2), price=100.0),
        EffectivePriceDay(date=date(2026, 5, 3), price=None),
        EffectivePriceDay(date=date(2026, 5, 4), price=120.0),
        EffectivePriceDay(date=date(2026, 5, 5), price=100.0),
    ]
    assert _preis_spannen(tage) == [
        (date(2026, 5, 1), date(2026, 5, 3), 10000),
        (date(2026, 5, 4), date(2026, 5, 5), 12000),
        (date(2026, 5, 5), date(2026, 5, 6), 10000),
    ]


# --- bulk_edit: mehrere Objekte × Zeitraum ---

def test_bulk_edit_applies_price_and_block_across_properties() -> None:
    from src.features.calendar.schemas import BulkEditRequest

    svc, store = _service(
        properties=[{"id": "p1"}, {"id": "p2"}],
    )
    res = svc.bulk_edit(
        "t1",
        BulkEditRequest(
            property_ids=["p1", "p2"],
            range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 4)),
            price=99.0,
            block=True,
        ),
    )
    assert res.properties == 2
    assert res.days == 3
    assert set(res.applied) == {"price", "block"}
    # price_overrides + availability-Upserts wurden je Objekt geschrieben.
    upsert_tables = [u[0] for u in store.get("_upserts", [])]
    assert upsert_tables.count("availability") == 2  # block je Objekt
    assert upsert_tables.count("price_overrides") == 2


def test_bulk_edit_min_stay_updates_rate_plans() -> None:
    from src.features.calendar.schemas import BulkEditRequest

    # Mit Preisplan — ohne ihn weist der Service seit dem 06.09.2026 ab (422),
    # weil `rate_plans.min_stay` sonst ins Leere liefe (Wurzel 5).
    svc, store = _service(
        properties=[{"id": "p1"}],
        rate_plans=[{"id": "rp1", "property_id": "p1", "min_stay": 1}],
    )
    svc.bulk_edit(
        "t1",
        BulkEditRequest(
            property_ids=["p1"],
            range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3)),
            min_stay=3,
        ),
    )
    updates = [u for u in store.get("_updates", []) if u[0] == "rate_plans"]
    assert updates and updates[0][1] == {"min_stay": 3}


def test_bulk_edit_combined_action_is_single_channex_push(monkeypatch) -> None:
    # Zertifizierung Test 8: Preis + Min-Stay + CTA/CTD in EINER Bulk-Aktion
    # ergeben EINEN kombinierten ARI-Job (kind=restrictions, alle Felder).
    from src.features.calendar import service as cal_service
    from src.features.calendar.schemas import BulkEditRequest

    calls: list[tuple[str, dict]] = []
    monkeypatch.setattr(
        cal_service, "try_enqueue_ari",
        lambda _db, _tenant, _pid, kind, fields: calls.append((kind, fields)),
    )
    svc, _ = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}],
        rate_plans=[{"id": "rp1", "property_id": "p1", "min_stay": 1}],
    )
    svc.bulk_edit(
        "t1",
        BulkEditRequest(
            property_ids=["p1"],
            range=DateRange(start=date(2026, 12, 1), end=date(2027, 5, 1)),
            price=432.0, min_stay=2,
            closed_to_arrival=False, closed_to_departure=False,
        ),
    )
    assert len(calls) == 1
    kind, fields = calls[0]
    assert kind == "restrictions"
    assert fields["rate_cents"] == 43200
    assert fields["min_stay"] == 2
    assert fields["closed_to_arrival"] is False
    assert fields["closed_to_departure"] is False


def test_bulk_edit_price_plus_minstay_without_ctactd_single_push(
    monkeypatch,
) -> None:
    # Test 8, Zeile 2: nur Preis + Min-Stay → EIN Rate-Push mit beiden Feldern.
    from src.features.calendar import service as cal_service
    from src.features.calendar.schemas import BulkEditRequest

    calls: list[tuple[str, dict]] = []
    monkeypatch.setattr(
        cal_service, "try_enqueue_ari",
        lambda _db, _tenant, _pid, kind, fields: calls.append((kind, fields)),
    )
    svc, _ = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}],
        rate_plans=[{"id": "rp1", "property_id": "p1", "min_stay": 1}],
    )
    svc.bulk_edit(
        "t1",
        BulkEditRequest(
            property_ids=["p1"],
            range=DateRange(start=date(2026, 12, 1), end=date(2027, 5, 1)),
            price=342.0, min_stay=3,
        ),
    )
    assert len(calls) == 1
    kind, fields = calls[0]
    assert kind == "rate"
    assert fields["rate_cents"] == 34200
    assert fields["min_stay"] == 3


def test_bulk_edit_rejects_foreign_property() -> None:
    from src.features.calendar.schemas import BulkEditRequest

    svc, _ = _service(properties=[{"id": "p1"}])  # p2 gehört nicht dem Tenant
    with pytest.raises(CalendarError) as exc:
        svc.bulk_edit(
            "t1",
            BulkEditRequest(
                property_ids=["p1", "p2"],
                range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2)),
                price=50.0,
            ),
        )
    assert exc.value.status_code == 404


def test_bulk_edit_requires_a_change() -> None:
    from src.features.calendar.schemas import BulkEditRequest

    with pytest.raises(ValueError):
        BulkEditRequest(
            property_ids=["p1"],
            range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2)),
        )


# --- Teil A: Bulk-Preisanpassung in Prozent ---

def test_bulk_edit_price_pct_increase_writes_overrides() -> None:
    from src.features.calendar.schemas import BulkEditRequest

    # Basispreis 100 → +10 % = 110.0 je Tag, als Override geschrieben.
    svc, store = _service(
        properties=[{"id": "p1"}],
        rate_plans=[{"base_price": 100.0, "min_stay": 1}],
    )
    res = svc.bulk_edit(
        "t1",
        BulkEditRequest(
            property_ids=["p1"],
            range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3)),
            price_adjust_pct=10,
        ),
    )
    assert res.applied == ["price_pct"]
    overrides = [u for u in store["_upserts"] if u[0] == "price_overrides"]
    assert overrides, "Overrides müssen geschrieben werden"
    prices = {row["date"]: row["price"] for row in overrides[0][1]}
    assert prices == {"2026-05-01": 110.0, "2026-05-02": 110.0}


def test_bulk_edit_price_pct_decrease_rounds() -> None:
    from src.features.calendar.schemas import BulkEditRequest

    # Basispreis 100 → -15 % = 85.0.
    svc, store = _service(
        properties=[{"id": "p1"}],
        rate_plans=[{"base_price": 100.0, "min_stay": 1}],
    )
    svc.bulk_edit(
        "t1",
        BulkEditRequest(
            property_ids=["p1"],
            range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2)),
            price_adjust_pct=-15,
        ),
    )
    overrides = [u for u in store["_upserts"] if u[0] == "price_overrides"]
    assert overrides[0][1][0]["price"] == 85.0


def test_bulk_edit_price_pct_skips_days_without_price() -> None:
    from src.features.calendar.schemas import BulkEditRequest

    # Kein Rate-Plan → kein auflösbarer Preis → keine Overrides (kein Crash).
    svc, store = _service(properties=[{"id": "p1"}])
    res = svc.bulk_edit(
        "t1",
        BulkEditRequest(
            property_ids=["p1"],
            range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3)),
            price_adjust_pct=10,
        ),
    )
    assert res.applied == ["price_pct"]
    assert not [u for u in store.get("_upserts", []) if u[0] == "price_overrides"]


def test_bulk_edit_fixed_and_pct_mutually_exclusive() -> None:
    from src.features.calendar.schemas import BulkEditRequest

    with pytest.raises(ValueError):
        BulkEditRequest(
            property_ids=["p1"],
            range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2)),
            price=99.0,
            price_adjust_pct=10,
        )


# --- Teil B: CTA/CTD-Restriktionen ---

def test_set_restrictions_upserts_cta_ctd() -> None:
    svc, store = _service(properties=[{"id": "p1"}])
    days = svc.set_restrictions(
        "t1", "p1",
        DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3)),
        cta=True, ctd=False,
    )
    assert days == 2
    upserts = [u for u in store["_upserts"] if u[0] == "availability"]
    assert upserts, "availability-Upsert erwartet"
    row = upserts[0][1][0]
    assert row["closed_to_arrival"] is True
    assert row["closed_to_departure"] is False


def test_set_restrictions_only_sets_given_field() -> None:
    svc, store = _service(properties=[{"id": "p1"}])
    svc.set_restrictions(
        "t1", "p1",
        DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2)),
        cta=True,  # ctd None → bleibt unverändert (Feld nicht im Payload)
    )
    row = [u for u in store["_upserts"] if u[0] == "availability"][0][1][0]
    assert row["closed_to_arrival"] is True
    assert "closed_to_departure" not in row


def test_set_restrictions_noop_when_both_none() -> None:
    svc, store = _service(properties=[{"id": "p1"}])
    days = svc.set_restrictions(
        "t1", "p1", DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2)),
    )
    assert days == 0
    assert not [u for u in store.get("_upserts", []) if u[0] == "availability"]


def test_set_restrictions_rejects_foreign_property() -> None:
    svc, _ = _service()  # keine eigene property
    with pytest.raises(CalendarError) as exc:
        svc.set_restrictions(
            "t1", "p-fremd",
            DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2)),
            cta=True,
        )
    assert exc.value.status_code == 404


def test_get_availability_returns_cta_ctd_flags() -> None:
    svc, _ = _service(
        properties=[{"id": "p1"}],
        availability=[{
            "date": "2026-05-01", "status": "open", "source": "manual",
            "closed_to_arrival": True, "closed_to_departure": False,
        }],
    )
    days = svc.get_availability(
        _ctx(), "p1", DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3)),
    )
    # Tag 1 hat die Flags; Tag 2 (keine Zeile) → Default false.
    assert days[0].closed_to_arrival is True
    assert days[0].closed_to_departure is False
    assert days[1].closed_to_arrival is False


def test_bulk_edit_sets_cta_ctd() -> None:
    from src.features.calendar.schemas import BulkEditRequest

    svc, store = _service(properties=[{"id": "p1"}])
    res = svc.bulk_edit(
        "t1",
        BulkEditRequest(
            property_ids=["p1"],
            range=DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3)),
            closed_to_arrival=True,
            closed_to_departure=False,
        ),
    )
    assert "cta_on" in res.applied and "ctd_off" in res.applied
    assert [u for u in store["_upserts"] if u[0] == "availability"]


# --- ohne Client: sauberer Fehler statt Crash ---

def test_db_unavailable_raises_clean_error() -> None:
    svc = CalendarService(client=None)
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2))
    with pytest.raises(CalendarError) as exc:
        svc.get_availability(_ctx(), "p1", rng)
    assert exc.value.status_code == 500


# --- Stop-Sell: Wochentags-Maske, Spannen-Kompression, Schema-Validierung ---

def test_stop_sell_weekday_mask_limits_days() -> None:
    svc, store = _service(properties=[{"id": "p1"}])
    # 1.–14. Juni 2027 (1.6. = Dienstag): nur Sa (5) + So (6) sperren.
    rng = DateRange(start=date(2027, 6, 1), end=date(2027, 6, 15))
    res = svc.set_stop_sell("t1", "p1", rng, None, [5, 6])
    (_table, payload) = store["_upserts"][0]
    assert res["stopped_days"] == 4
    assert [row["date"] for row in payload] == [
        "2027-06-05", "2027-06-06", "2027-06-12", "2027-06-13",
    ]
    assert all(row["source"] == "manual" for row in payload)


def test_stop_sell_weekday_mask_without_match_is_noop() -> None:
    svc, store = _service(properties=[{"id": "p1"}])
    rng = DateRange(start=date(2027, 6, 5), end=date(2027, 6, 7))  # Sa + So
    res = svc.set_stop_sell("t1", "p1", rng, None, [2])  # nur Mittwoch
    assert res["stopped_days"] == 0
    assert "_upserts" not in store  # kein Upsert für leere Auswahl


def test_stop_sell_without_mask_covers_all_nights() -> None:
    svc, store = _service(properties=[{"id": "p1"}])
    rng = DateRange(start=date(2027, 6, 1), end=date(2027, 6, 4))
    res = svc.set_stop_sell("t1", "p1", rng, "Wartung", None)
    (_table, payload) = store["_upserts"][0]
    assert res["stopped_days"] == 3
    assert all(row["reason"] == "Wartung" for row in payload)


def test_stop_sell_skips_booked_days() -> None:
    # Gebuchte Tage dürfen NIE gestoppt werden (der Tag ist verkauft). Sie
    # werden übersprungen und als skipped_booked gemeldet (UI-Hinweis).
    svc, store = _service(
        properties=[{"id": "p1"}],
        availability=[
            {"date": "2027-06-02", "status": "booked", "source": "direct"},
        ],
    )
    rng = DateRange(start=date(2027, 6, 1), end=date(2027, 6, 4))
    res = svc.set_stop_sell("t1", "p1", rng, "Wartung", None)
    (_table, payload) = store["_upserts"][0]
    assert res["stopped_days"] == 2
    assert res["skipped_booked"] == 1
    # Der gebuchte 2.6. ist NICHT im Upsert.
    assert [row["date"] for row in payload] == ["2027-06-01", "2027-06-03"]


def test_stop_sell_all_booked_writes_nothing() -> None:
    svc, store = _service(
        properties=[{"id": "p1"}],
        availability=[
            {"date": "2027-06-01", "status": "booked", "source": "direct"},
            {"date": "2027-06-02", "status": "booked", "source": "direct"},
            {"date": "2027-06-03", "status": "booked", "source": "direct"},
        ],
    )
    rng = DateRange(start=date(2027, 6, 1), end=date(2027, 6, 4))
    res = svc.set_stop_sell("t1", "p1", rng, None, None)
    assert res["stopped_days"] == 0
    assert res["skipped_booked"] == 3
    assert "_upserts" not in store


def test_clear_stop_sell_with_weekdays_runs_delete() -> None:
    svc, store = _service(
        properties=[{"id": "p1"}],
        stop_sell=[{"date": "2027-06-06"}],  # bleibt (z. B. source=channex)
    )
    rng = DateRange(start=date(2027, 6, 1), end=date(2027, 6, 15))
    svc.clear_stop_sell("t1", "p1", rng, [5, 6])
    assert "stop_sell" in store.get("_deletes", [])


def test_clear_stop_sell_default_only_manual() -> None:
    # Standard: nur manuelle Stops löschen → delete filtert auf source=manual,
    # Portal-/Channex-Stops bleiben unangetastet.
    svc, store = _service(properties=[{"id": "p1"}], stop_sell=[])
    rng = DateRange(start=date(2027, 6, 1), end=date(2027, 6, 15))
    svc.clear_stop_sell("t1", "p1", rng)
    filters = [f for (n, f) in store.get("_delete_filters", []) if n == "stop_sell"]
    assert filters and all(f.get("source") == "manual" for f in filters)


def test_clear_stop_sell_include_portal_removes_channex() -> None:
    # include_portal=True: KEIN source-Filter → auch Portal-/Channex-Stops werden
    # gelöscht (für versehentlich gesetzte Stops).
    svc, store = _service(properties=[{"id": "p1"}], stop_sell=[])
    rng = DateRange(start=date(2027, 6, 1), end=date(2027, 6, 15))
    svc.clear_stop_sell("t1", "p1", rng, include_portal=True)
    filters = [f for (n, f) in store.get("_delete_filters", []) if n == "stop_sell"]
    assert filters and all("source" not in f for f in filters)


def test_clear_stop_sell_pusht_trotz_plan_genauem_reststopp() -> None:
    """Wurzel 1 — eine verbliebene Zeile ANDERER Ebene darf den Push nicht
    unterdrücken.

    `remaining` fragte ohne `rate_plan_id`-Filter: ein plan-genauer Stopp am
    selben Tag zählte als „bleibt gesperrt", `open_days` wurde leer, und es
    ging KEIN `stop_sell=false` an Channex. Lokal war der Stopp weg, bei
    Channex stand er weiter — der nächste Import holte ihn als
    `source='channex'` zurück, und das in Endlosschleife.

    Live gefunden am 10.08.2026 (FeWo *Stjerneskud*): 13 Zeilen kamen in einer
    Sekunde als `channex` zurück, obwohl der Nutzer sie gelöscht hatte. Es sah
    aus, als setze das Portal ununterbrochen neue Stop-Sells — in Wahrheit
    hallte die eigene, nie zugestellte Löschung nach.
    """
    svc, store = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}],
        # Ein plan-genauer Stopp eines ANDEREN Objekts: er überlebt den DELETE
        # (der filtert auf property_id) und steht damit noch da, wenn
        # `remaining` fragt. Genau das ist der Live-Fall — dort war es ein
        # Stopp am selben Objekt, der über `bulk_restrictions` an einem
        # Rate-Plan hing und den der Objekt-DELETE nicht traf.
        # Eine plan-genaue Zeile, die der Objekt-DELETE stehen lässt
        # (`include_rate_plans` ist an, aber der Doppelgänger filtert `is_`
        # nicht) — im Live-Fall war es genau so: der Stopp hing über
        # `bulk_restrictions` an einem Rate-Plan und überlebte.
        stop_sell=[
            {"date": "2027-06-02", "property_id": "p1", "rate_plan_id": "rp-1"},
        ],
    )
    rng = DateRange(start=date(2027, 6, 1), end=date(2027, 6, 5))
    gepusht: list[dict] = []
    svc._push_channex_stop_sell = (  # noqa: SLF001 — Doppelgänger im Test
        lambda pid, spans, *, stop_sell, days=None: gepusht.append(
            {"spans": spans, "stop_sell": stop_sell}
        )
    )
    svc.clear_stop_sell(
        "t1", "p1", rng, include_portal=True, include_rate_plans=True,
    )
    # Der Push MUSS ALLE vier Nächte öffnen — auch den 02.06., an dem die
    # plan-genaue Zeile hängt. Vorher zerfiel die Spanne dort, der 02.06. blieb
    # bei Channex gesperrt, und der nächste Import holte ihn zurück.
    assert gepusht, "kein stop_sell=false an Channex gemeldet"
    assert gepusht[0]["stop_sell"] is False
    assert gepusht[0]["spans"] == [(date(2027, 6, 1), date(2027, 6, 4))]


def test_reset_all_stop_sell_single_property_deletes_all_sources() -> None:
    # Reset eines Objekts: löscht ALLE zukünftigen Stops (auch Portal). 2099er
    # Datum, damit es sicher in der Zukunft liegt (date.today()-Filter).
    svc, store = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}],
        stop_sell=[
            {"date": "2099-06-01", "property_id": "p1", "source": "channex"},
            {"date": "2099-06-02", "property_id": "p1", "source": "manual"},
        ],
    )
    res = svc.reset_all_stop_sell("t1", "p1")
    assert res["properties"] == 1
    assert res["days"] == 2
    assert "stop_sell" in store.get("_deletes", [])
    # KEIN source-Filter → auch der Channex-/Portal-Stop wird gelöscht.
    filters = [f for (n, f) in store.get("_delete_filters", []) if n == "stop_sell"]
    assert filters and all("source" not in f for f in filters)


def test_reset_all_stop_sell_without_stops_is_noop() -> None:
    # Objekt ohne (zukünftige) Stops → nichts löschen, days=0.
    svc, store = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}],
        stop_sell=[],
    )
    res = svc.reset_all_stop_sell("t1", "p1")
    assert res["days"] == 0
    assert "stop_sell" not in store.get("_deletes", [])


def test_reset_all_stop_sell_rejects_missing_tenant() -> None:
    svc, _ = _service(properties=[{"id": "p1", "tenant_id": "t1"}])
    try:
        svc.reset_all_stop_sell("", "p1")
        raise AssertionError("expected CalendarError")
    except CalendarError as exc:
        assert exc.status_code == 400


def test_date_spans_compresses_consecutive_days() -> None:
    # Früher CalendarService._date_spans — jetzt die zentrale Funktion mit der
    # inklusiven Channex-Konvention (core.dates). Erwartung unverändert.
    spans = merge_day_ranges(
        [date(2027, 6, 5), date(2027, 6, 6), date(2027, 6, 8)], end_exclusive=False
    )
    assert spans == [
        (date(2027, 6, 5), date(2027, 6, 6)),
        (date(2027, 6, 8), date(2027, 6, 8)),
    ]


def test_stop_sell_request_rejects_invalid_weekday() -> None:
    from src.features.calendar.schemas import StopSellRequest

    with pytest.raises(ValueError):
        StopSellRequest(
            property_id="p1",
            range=DateRange(start=date(2027, 6, 1), end=date(2027, 6, 2)),
            weekdays=[7],
        )


def test_stop_sell_rejects_foreign_agency() -> None:
    # Cross-Tenant-Referenz: fremde agency_id → 404 (Review-Befund P1).
    # Der Fake ignoriert eq-Filter; ein leerer Store simuliert den
    # tenant-gescopten Lookup ohne Treffer.
    svc, _ = _service(properties=[{"id": "p1"}], travel_agencies=[])
    rng = DateRange(start=date(2027, 6, 1), end=date(2027, 6, 3))
    with pytest.raises(CalendarError) as exc:
        svc.set_stop_sell("t1", "p1", rng, None, None, "a-fremd")
    assert exc.value.status_code == 404


def test_stop_sell_never_overwrites_channex_days() -> None:
    # Upsert darf source=channex nicht auf manual kippen (Review-Befund P2).
    svc, store = _service(
        properties=[{"id": "p1"}],
        stop_sell=[{"date": "2027-06-02", "source": "channex"}],
    )
    rng = DateRange(start=date(2027, 6, 1), end=date(2027, 6, 4))
    res = svc.set_stop_sell("t1", "p1", rng, None, None)
    (_table, payload) = store["_upserts"][0]
    dates = [row["date"] for row in payload]
    assert "2027-06-02" not in dates  # Channex-Tag ausgespart
    assert res["stopped_days"] == 2


def test_stop_sell_response_keeps_agency_name() -> None:
    """Der Reisebüro-Name (travel_agencies-Join) muss durch das Response-Modell
    überleben — sonst zeigt der Kalender-Balken nur „Gesperrt" ohne Adressat."""
    item = {
        "id": "ss1",
        "property_id": "p1",
        "date": "2027-06-02",
        "reason": "Renovierung",
        "source": "manual",
        "agency_id": "ag1",
        "agency_name": "TUI",
    }
    dumped = StopSellListResponse(items=[item], total=1).items[0].model_dump()
    assert dumped["agency_name"] == "TUI"


# --- Owner-Scope (§4.2): Eigentümer sieht nur zugeordnete Objekte, keine Preise --

def test_owner_sees_only_assigned_property() -> None:
    # Owner u1 ist NUR p1 zugeordnet; p2 gehört demselben Tenant, aber Owner B.
    svc, _ = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}, {"id": "p2", "tenant_id": "t1"}],
        owner_property_assignments=[
            {"tenant_id": "t1", "user_id": "u1", "property_id": "p1"}
        ],
    )
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2))
    # Eigenes Objekt: ok.
    svc.get_availability(_ctx(role="owner"), "p1", rng)
    # Fremdes Objekt desselben Tenants: 404 (keine Existenz verraten).
    with pytest.raises(CalendarError) as exc:
        svc.get_availability(_ctx(role="owner"), "p2", rng)
    assert exc.value.status_code == 404


def _preis_store(rolle: str, rechte: list[str]) -> tuple[CalendarService, dict]:
    """Objekt p1 mit Basispreis + Override, Nutzer u1 in der gegebenen Rolle."""
    return _service(
        properties=[{"id": "p1", "tenant_id": "t1"}],
        rate_plans=[{"base_price": 100.0, "min_stay": 2}],
        price_overrides=[{"date": "2026-05-01", "price": 150.0}],
        owner_property_assignments=[
            {"tenant_id": "t1", "user_id": "u1", "property_id": "p1"}
        ],
        users=[{"id": "u1", "role": rolle, "permissions": rechte}],
    )


def test_owner_prices_stripped() -> None:
    svc, _ = _preis_store("owner", [])
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3))
    owner_days = svc.get_availability(_ctx(role="owner"), "p1", rng)
    # Kein Preis-Recht (§4.2) → keine Geldwerte, aber min_stay bleibt sichtbar.
    assert all(d.price is None and d.price_source == "none" for d in owner_days)
    assert all(d.min_stay == 2 for d in owner_days)


def test_admin_sieht_preise() -> None:
    svc, _ = _preis_store("admin", _ALLE_RECHTE)
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3))
    assert svc.get_availability(_ctx(), "p1", rng)[0].price == 150.0


@pytest.mark.parametrize("rolle", ["staff", "cleaner"])
def test_staff_und_cleaner_sehen_keine_preise(rolle: str) -> None:
    """§4.3: kein Finanz-/Vertriebseinblick.

    Die Maskierung hing früher allein an `is_owner(ctx)` — staff und cleaner
    bekamen deshalb die vollen Tagespreise, obwohl ihnen das Betrags-Recht
    (PM_BOOKING_TOTAL) fehlt. Ohne diesen Test fällt das nicht auf: die Rolle
    darf den Kalender ja sehen, nur eben ohne Geldwerte.
    """
    svc, _ = _preis_store(rolle, [])
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3))
    tage = svc.get_availability(_ctx(role=rolle), "p1", rng)
    assert all(d.price is None and d.price_source == "none" for d in tage)
    assert all(d.min_stay == 2 for d in tage)
    # Saisonpreise bestehen NUR aus Preisen → leer statt maskiert.
    assert svc.list_season_prices(_ctx(role=rolle), "p1", rng) == []


def test_staff_board_ohne_preis_und_waehrung() -> None:
    """Ohne Betrags-Recht darf auch kein Währungslabel übrig bleiben."""
    svc, _ = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}],
        rate_plans=[{"property_id": "p1", "base_price": 100.0, "currency": "EUR"}],
        users=[{"id": "u1", "role": "staff", "permissions": []}],
    )
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2))
    board = svc.get_board(_ctx(role="staff"), ["p1"], rng)
    assert board.items[0].currency is None
    assert all(d.price is None for d in board.items[0].days)


# --- Freie Einheiten als ZAHL (0265) -----------------------------------------

def test_freie_einheiten_zaehlt_je_einheit() -> None:
    """Drei Einheiten, eine davon an einem Tag gebucht → 2 frei, nicht 0."""
    svc, _ = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}],
        property_units=[
            {"id": "e1", "tenant_id": "t1", "property_id": "p1", "position": 1},
            {"id": "e2", "tenant_id": "t1", "property_id": "p1", "position": 2},
            {"id": "e3", "tenant_id": "t1", "property_id": "p1", "position": 3},
        ],
        availability=[
            {"property_id": "p1", "unit_id": "e1", "date": "2026-05-02",
             "status": "booked"},
        ],
    )
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 4))
    out = svc.freie_einheiten(_ctx(), "p1", rng)
    assert out.gesamt == 3
    # 01.: 3 frei | 02.: 2 frei | 03.: 3 frei → drei Spannen.
    assert [(s.von, s.bis, s.frei) for s in out.spannen] == [
        (date(2026, 5, 1), date(2026, 5, 1), 3),
        (date(2026, 5, 2), date(2026, 5, 2), 2),
        (date(2026, 5, 3), date(2026, 5, 3), 3),
    ]


def test_freie_einheiten_stop_sell_setzt_auf_null() -> None:
    """Stop-Sell lebt in einer eigenen Tabelle und fehlt in `availability`.

    Ohne ihn meldete der Reader freie Einheiten an einem Tag, der überall
    gesperrt ist — und der ARI-Push machte daraus eine verkäufliche Nacht.
    """
    svc, _ = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}],
        property_units=[
            {"id": "e1", "tenant_id": "t1", "property_id": "p1", "position": 1},
            {"id": "e2", "tenant_id": "t1", "property_id": "p1", "position": 2},
        ],
        stop_sell=[{"property_id": "p1", "date": "2026-05-02", "rate_plan_id": None}],
    )
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 4))
    out = svc.freie_einheiten(_ctx(), "p1", rng)
    frei_je_tag = {s.von: s.frei for s in out.spannen}
    assert frei_je_tag[date(2026, 5, 2)] == 0
    # Nachbartage bleiben verkäuflich.
    assert frei_je_tag[date(2026, 5, 1)] == 2


def test_freie_einheiten_ohne_einheiten_zeile_faellt_auf_eins() -> None:
    """Objekt ohne `property_units`-Zeile ist ein Datenfehler — er darf das
    Objekt aber nicht kontolos aus dem Verkauf nehmen (Stückzahl 1)."""
    svc, _ = _service(properties=[{"id": "p1", "tenant_id": "t1"}])
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3))
    out = svc.freie_einheiten(_ctx(), "p1", rng)
    assert out.gesamt == 1
    assert all(s.frei == 1 for s in out.spannen)


def test_freie_einheiten_fremdes_objekt_404() -> None:
    """Wurzel 3: die Kernfunktion prüft keinen Scope — diese Methode schon."""
    svc, _ = _service(properties=[{"id": "p1", "tenant_id": "t1"}])
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3))
    with pytest.raises(CalendarError) as exc:
        svc.freie_einheiten(_ctx(), "fremd", rng)
    assert exc.value.status_code == 404


def test_freie_einheiten_owner_scope() -> None:
    """Owner sieht nur zugeordnete Objekte (§4.2) — auch hier."""
    svc, _ = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}, {"id": "p2", "tenant_id": "t1"}],
        owner_property_assignments=[
            {"tenant_id": "t1", "user_id": "u1", "property_id": "p1"}
        ],
        users=[{"id": "u1", "role": "owner", "permissions": []}],
    )
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 3))
    svc.freie_einheiten(_ctx(role="owner"), "p1", rng)
    with pytest.raises(CalendarError) as exc:
        svc.freie_einheiten(_ctx(role="owner"), "p2", rng)
    assert exc.value.status_code == 404


def test_owner_board_filters_and_strips() -> None:
    svc, _ = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}, {"id": "p2", "tenant_id": "t1"}],
        rate_plans=[{"property_id": "p1", "base_price": 100.0, "min_stay": 1}],
        price_overrides=[{"property_id": "p1", "date": "2026-05-01", "price": 90.0}],
        owner_property_assignments=[
            {"tenant_id": "t1", "user_id": "u1", "property_id": "p1"}
        ],
        users=[{"id": "u1", "role": "owner", "permissions": []}],
    )
    rng = DateRange(start=date(2026, 5, 1), end=date(2026, 5, 2))
    board = svc.get_board(_ctx(role="owner"), ["p1", "p2"], rng)
    # Nur das zugeordnete p1, ohne Preise.
    assert [i.property_id for i in board.items] == ["p1"]
    assert all(d.price is None for d in board.items[0].days)


# --- bulk_restrictions: lokaler stop_sell-Spiegel (Wurzel 1) -----------------

def _row_req(**kw) -> RestrictionRowsRequest:
    rng = DateRange(start=date(2026, 11, 14), end=date(2026, 11, 15))
    return RestrictionRowsRequest(
        property_id="p1", rows=[RestrictionRow(range=rng, **kw)]
    )


def test_bulk_restrictions_plan_stop_sell_mirrors_locally() -> None:
    # Hotel-Stopp (Zert Test 6): die Zeile spiegelt in stop_sell MIT
    # rate_plan_id — sonst blieben eigene Plattform/Rezeption offen.
    svc, store = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}],
        rate_plans=[{"id": "rp-a", "property_id": "p1"}],
        stop_sell=[],
    )
    n = svc.bulk_restrictions("t1", _row_req(rate_plan_id="rp-a", stop_sell=True))
    assert n == 1
    mirrored = [p for t, p in store.get("_upserts", []) if t == "stop_sell"]
    assert mirrored and mirrored[0][0]["rate_plan_id"] == "rp-a"
    assert mirrored[0][0]["source"] == "manual"
    assert mirrored[0][0]["date"] == "2026-11-14"


def test_bulk_restrictions_plan_stop_sell_false_deletes_plan_rows() -> None:
    # Aufheben trifft NUR den Plan (eq rate_plan_id) und nur manuelle Stops.
    svc, store = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}],
        rate_plans=[{"id": "rp-a", "property_id": "p1"}],
        stop_sell=[],
    )
    svc.bulk_restrictions("t1", _row_req(rate_plan_id="rp-a", stop_sell=False))
    filters = [
        f for t, f in store.get("_delete_filters", []) if t == "stop_sell"
    ]
    assert filters == [
        {"property_id": "p1", "source": "manual", "rate_plan_id": "rp-a"}
    ]


def test_bulk_restrictions_rejects_foreign_rate_plan() -> None:
    # Fremde/erfundene Plan-ID → 422, KEIN stiller Fallback auf alle Pläne.
    svc, store = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}],
        rate_plans=[],  # kein eigener Plan
        stop_sell=[],
    )
    with pytest.raises(CalendarError) as exc:
        svc.bulk_restrictions("t1", _row_req(rate_plan_id="rp-x", stop_sell=True))
    assert exc.value.status_code == 422
    assert not store.get("_upserts")


def test_bulk_restrictions_plan_cta_max_go_to_override_table() -> None:
    # Hotel-Zeile mit CTA/CTD/Max-Stay landet plan-genau in
    # rate_plan_restriction_overrides (0153), NICHT objekt-weit in availability.
    svc, store = _service(
        properties=[{"id": "p1", "tenant_id": "t1"}],
        rate_plans=[{"id": "rp-a", "property_id": "p1"}],
    )
    from src.features.calendar.schemas import RestrictionRow, RestrictionRowsRequest
    rng = DateRange(start=date(2026, 11, 1), end=date(2026, 11, 3))
    svc.bulk_restrictions("t1", RestrictionRowsRequest(
        property_id="p1",
        rows=[RestrictionRow(range=rng, rate_plan_id="rp-a",
                             closed_to_arrival=True, max_stay=4)],
    ))
    upserts = {t: p for t, p in store.get("_upserts", [])}
    assert "rate_plan_restriction_overrides" in upserts
    assert upserts["rate_plan_restriction_overrides"][0]["rate_plan_id"] == "rp-a"
    assert upserts["rate_plan_restriction_overrides"][0]["max_stay"] == 4
    # NICHT objekt-weit in availability gespiegelt.
    assert "availability" not in upserts


def test_bulk_edit_min_stay_ohne_preisplan_ist_422() -> None:
    """Ohne Preisplan hat der Mindestaufenthalt keinen Ort — das MUSS auffallen.

    Vorher lief das `update` auf `rate_plans` ins Leere und der Kalender meldete
    „Gespeichert", während nichts gespeichert war (live am 06.09.2026 an einem
    Entwurfs-Objekt). Ein stiller No-Op ist derselbe Fehler wie ein
    verschluckter Exception (Wurzel 5).
    """
    from src.features.calendar.schemas import BulkEditRequest

    svc, _ = _service(properties=[{"id": "p1", "tenant_id": "t1"}])
    with pytest.raises(CalendarError) as exc:
        svc.bulk_edit(
            "t1",
            BulkEditRequest(
                property_ids=["p1"],
                range=DateRange(start=date(2026, 9, 8), end=date(2026, 9, 10)),
                min_stay=3,
            ),
        )
    assert exc.value.status_code == 422


# --- Regelsatz (0572): Aufenthaltsregeln je Tag ----------------------------

def test_regelsatz_materialisiert_wochentage_je_tag() -> None:
    """Die Wochentag-Sperre wird zum TAG ausgerechnet, nicht als Wochentag abgelegt.

    Der Regelsatz sagt „montags keine Anreise"; in der Tageszeile steht
    `closed_to_arrival` genau an den Montagen. Ohne diese Umrechnung müsste
    jeder Leser (Kalender, Channex-Push, Buchungsstrecke) sie selbst machen —
    dreimal dieselbe Regel, dreimal eine Gelegenheit, sie anders zu machen.
    """
    svc, store = _service(properties=[{"id": "p1", "tenant_id": "t1"}])
    saison = {
        "id": "s1", "property_id": "p1", "min_stay": 7, "max_stay": 21,
        "closed_arrival_weekdays": [0], "closed_departure_weekdays": [6],
    }
    svc._materialize_regeln(  # noqa: SLF001 — Materialisierung ist der Prüfpunkt
        saison, date(2026, 10, 5), date(2026, 10, 12)
    )
    zeilen = store.get("availability", [])
    assert zeilen, "es wurden keine Tageszeilen geschrieben"
    je_datum = {z["date"]: z for z in zeilen}
    # 5.10.2026 ist ein Montag, 11.10. ein Sonntag.
    assert je_datum["2026-10-05"]["closed_to_arrival"] is True
    assert je_datum["2026-10-06"]["closed_to_arrival"] is False
    assert je_datum["2026-10-11"]["closed_to_departure"] is True
    assert je_datum["2026-10-05"]["min_stay"] == 7
    assert je_datum["2026-10-05"]["max_stay"] == 21


def test_regelsatz_min_stay_je_anreisetag() -> None:
    """Der Wochentagswert schlägt den allgemeinen Mindestaufenthalt (0576).

    Ein Haus verlangt samstags sieben Nächte und sonst drei. Ohne die Regel je
    Anreisetag musste einer der beiden Werte für alle Tage gelten — und die
    Portale bekamen für fünf Tage der Woche eine Zahl, die der Betrieb nie
    gesetzt hat (Wurzel 4).
    """
    svc, store = _service(properties=[{"id": "p1", "tenant_id": "t1"}])
    saison = {
        "id": "s1", "property_id": "p1", "min_stay": 3, "max_stay": None,
        "closed_arrival_weekdays": [], "closed_departure_weekdays": [],
        # Schlüssel kommen aus jsonb als Zeichenketten — genau so wie hier.
        "min_stay_by_weekday": {"5": 7},
    }
    svc._materialize_regeln(  # noqa: SLF001 — Materialisierung ist der Prüfpunkt
        saison, date(2026, 10, 5), date(2026, 10, 12)
    )
    je_datum = {z["date"]: z for z in store.get("availability", [])}
    # 10.10.2026 ist ein Samstag.
    assert je_datum["2026-10-10"]["min_stay"] == 7
    # Alle anderen Tage behalten den allgemeinen Wert — nicht 0, nicht None.
    assert je_datum["2026-10-05"]["min_stay"] == 3
    assert je_datum["2026-10-11"]["min_stay"] == 3


def test_regelsatz_ohne_wochentagsregel_bleibt_beim_allgemeinen_wert() -> None:
    """Ein leeres `min_stay_by_weekday` ändert nichts (Bestand aus 0572)."""
    svc, store = _service(properties=[{"id": "p1", "tenant_id": "t1"}])
    svc._materialize_regeln(  # noqa: SLF001 — Materialisierung ist der Prüfpunkt
        {
            "id": "s1", "property_id": "p1", "min_stay": 4, "max_stay": None,
            "closed_arrival_weekdays": [], "closed_departure_weekdays": [],
        },
        date(2026, 10, 5), date(2026, 10, 8),
    )
    assert all(
        z["min_stay"] == 4 for z in store.get("availability", [])
    )


def test_tagesregel_schlaegt_objektregel() -> None:
    """Der Mindestaufenthalt der Nacht gewinnt gegen den des Rate-Plans.

    Ohne diesen Vorrang wäre die Saison-Regel unsichtbar: der Kalender zeigte
    weiter den objektweiten Wert und behauptete damit etwas anderes, als für
    die Buchung gilt.
    """
    tage = CalendarService._build_days(  # noqa: SLF001 — reine Abbildung
        DateRange(start=date(2026, 10, 5), end=date(2026, 10, 7)),
        [
            {"date": "2026-10-05", "status": "open", "source": "manual",
             "min_stay": 7, "max_stay": 21,
             "closed_to_arrival": False, "closed_to_departure": False},
        ],
        {},
        2,
    )
    assert tage[0].min_stay == 7   # Tageswert
    assert tage[0].max_stay == 21
    assert tage[1].min_stay == 2   # ohne Tageszeile der Objektwert
