"""Tests für den reservations-Slice (Anlegen + Double-Booking-Schutz)."""
from datetime import UTC, date, datetime, timedelta
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.reservations._base import anzeigename
from src.features.reservations.schemas import (
    CancelParty,
    DashboardFenster,
    DashboardKpiMetrik,
    DashboardListe,
    GuestContact,
    ReservationChannel,
    ReservationCreate,
    ReservationNoteCreate,
)
from src.features.reservations.service import ReservationError, ReservationsService
from src.main import create_app

client = TestClient(create_app())


# --- Health (Smoke) ---

def test_reservations_health() -> None:
    resp = client.get("/api/v1/reservations/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "reservations", "status": "ok"}


# --- Schema-Validierung ---

def test_create_rejects_inverted_dates() -> None:
    with pytest.raises(ValueError):
        ReservationCreate(
            property_id="p1",
            check_in=date(2026, 5, 10),
            check_out=date(2026, 5, 10),
        )


# --- Service: Tenant-Pflicht ---

def test_create_requires_tenant() -> None:
    service = ReservationsService(service_client=MagicMock())
    req = ReservationCreate(
        property_id="p1",
        check_in=date(2026, 5, 1),
        check_out=date(2026, 5, 3),
    )
    with pytest.raises(ReservationError) as exc:
        service.create(AuthContext(user_id="u1", tenant_id=None), req)
    assert exc.value.status_code == 400


# --- Service: Double-Booking-Schutz ---

def _service_for_create(
    *,
    property_found: bool,
    taken_days: list[dict[str, str]],
    stopped_days: list[dict[str, str]] | None = None,
    units: list[dict[str, str]] | None = None,
    owner_links: list[dict[str, str]] | None = None,
) -> ReservationsService:
    """Mockt die im create() benutzten Tabellen-Ketten.

    properties.select…limit → {data: [...]}, availability.select…lt → taken_days,
    stop_sell.select…lt → stopped_days (Stop-Sell-Guard),
    property_units.select…eq → units.

    `units` ist optional und default `None`: dann bleibt `property_units` ein
    nackter MagicMock, der leer iteriert — genau das Verhalten, gegen das alle
    Alt-Tests geschrieben sind (unbekannte Einheiten → strenger, objektweiter
    409, Wurzel 5). Nur die Multi-Unit-Tests setzen den Wert und bekommen damit
    den einheiten-genauen Pfad aus 0265/0266 zu sehen.

    `owner_links` speist `owner_properties` (0353): der Eigentümer-Aufenthalt
    prüft darüber, ob der angegebene Eigentümer DIESES Objekt besitzt. Default
    `None` = leer → jede owner_id wird abgelehnt (fail-closed).
    """
    db = MagicMock(name="supabase")

    def table(name: str) -> MagicMock:
        t = MagicMock(name=f"table:{name}")
        if name == "property_units" and units is not None:
            # `einheiten_ids` hängt noch `.order(...)` an, der create()-Vorcheck
            # nicht — beide Ketten müssen dieselbe Liste liefern.
            chain = t.select.return_value.eq.return_value
            chain.execute.return_value.data = units
            chain.eq.return_value.execute.return_value.data = units
            chain.order.return_value.execute.return_value.data = units
            chain.eq.return_value.order.return_value.execute.return_value.data = units
            # `_require_own_unit`: select.eq(id).eq(property_id).eq(tenant).limit
            scope = chain.eq.return_value.eq.return_value.limit.return_value
            scope.execute.return_value.data = units
        elif name == "owner_properties":
            chain = (
                t.select.return_value.eq.return_value.eq.return_value
                .eq.return_value.limit.return_value
            )
            chain.execute.return_value.data = owner_links or []
        elif name == "properties":
            chain = (
                t.select.return_value.eq.return_value.eq.return_value.limit.return_value
            )
            chain.execute.return_value.data = (
                [{"id": "p1"}] if property_found else []
            )
        elif name == "rate_plans":
            chain = t.select.return_value.eq.return_value.limit.return_value
            chain.execute.return_value.data = [{"currency": "EUR"}]
        elif name == "availability":
            chain = (
                t.select.return_value.eq.return_value.gte.return_value.lt.return_value
            )
            chain.execute.return_value.data = taken_days
        elif name == "stop_sell":
            chain = (
                t.select.return_value.eq.return_value.gte.return_value.lt.return_value
            )
            chain.execute.return_value.data = stopped_days or []
        return t

    db.table.side_effect = table
    return ReservationsService(service_client=db)


def test_create_rejects_when_days_taken() -> None:
    service = _service_for_create(
        property_found=True,
        taken_days=[{"date": "2026-05-01", "status": "booked"}],
    )
    req = ReservationCreate(
        property_id="p1",
        check_in=date(2026, 5, 1),
        check_out=date(2026, 5, 3),
    )
    with pytest.raises(ReservationError) as exc:
        service.create(AuthContext(user_id="u1", tenant_id="t1"), req)
    assert exc.value.status_code == 409


def test_create_rejects_stop_sell_days() -> None:
    # Ein von Mitarbeitern gesetzter Stop-Sell sperrt den Tag auf ALLEN Kanälen
    # — auch die interne Rezeptions-Buchung (409).
    service = _service_for_create(
        property_found=True,
        taken_days=[],  # availability frei
        stopped_days=[{"date": "2026-05-01"}],  # aber Stop-Sell gesetzt
    )
    req = ReservationCreate(
        property_id="p1",
        check_in=date(2026, 5, 1),
        check_out=date(2026, 5, 3),
    )
    with pytest.raises(ReservationError) as exc:
        service.create(AuthContext(user_id="u1", tenant_id="t1"), req)
    assert exc.value.status_code == 409
    assert "Stop-Sell" in exc.value.message


def test_create_allows_portal_blocked_days() -> None:
    # Kanal-Trennung: eine availability-Sperre mit source='portal' (Channex-Import)
    # betrifft nur OTAs — die Rezeptions-Buchung darf trotzdem durch (kein 409).
    service = _service_for_create(
        property_found=True,
        taken_days=[{"date": "2026-05-01", "status": "blocked", "source": "portal"}],
    )
    req = ReservationCreate(
        property_id="p1",
        check_in=date(2026, 5, 1),
        check_out=date(2026, 5, 3),
    )
    # Darf NICHT wegen der portal-Sperre den 409-„belegte/gesperrte"-Vorcheck
    # auslösen. Der Ablauf läuft danach weiter (Quote/RPC) — eine dortige
    # Mock-Exception ist ok; entscheidend ist: kein availability-409 mehr.
    try:
        service.create(AuthContext(user_id="u1", tenant_id="t1"), req)
    except ReservationError as exc:  # noqa: BLE001 — nur der Vorcheck-409 zählt
        assert not (
            exc.status_code == 409 and "belegte/gesperrte" in exc.message
        )
    except Exception:  # noqa: BLE001,S110 — Quote/RPC-Mock unvollständig, irrelevant
        pass


def test_create_still_rejects_manual_blocked_days() -> None:
    # Eine echte/manuelle Sperre (source != portal) blockt die Rezeption weiter.
    service = _service_for_create(
        property_found=True,
        taken_days=[{"date": "2026-05-01", "status": "blocked", "source": "manual"}],
    )
    req = ReservationCreate(
        property_id="p1",
        check_in=date(2026, 5, 1),
        check_out=date(2026, 5, 3),
    )
    with pytest.raises(ReservationError) as exc:
        service.create(AuthContext(user_id="u1", tenant_id="t1"), req)
    assert exc.value.status_code == 409


def test_create_allows_ota_only_stop_sell() -> None:
    # Ein Stop-Sell, der nur OTAs betrifft (scope='channels', channels=['ota:*']),
    # lässt die Rezeption durch.
    service = _service_for_create(
        property_found=True,
        taken_days=[],
        stopped_days=[{"date": "2026-05-01", "scope": "channels",
                       "channels": ["ota:*"]}],
    )
    req = ReservationCreate(
        property_id="p1",
        check_in=date(2026, 5, 1),
        check_out=date(2026, 5, 3),
    )
    try:
        service.create(AuthContext(user_id="u1", tenant_id="t1"), req)
    except ReservationError as exc:  # noqa: BLE001 — nur der Stop-Sell-Guard zählt
        assert "Stop-Sell" not in exc.message
    except Exception:  # noqa: BLE001,S110 — Quote/RPC-Mock unvollständig, irrelevant
        pass


def test_create_rejects_unknown_property() -> None:
    service = _service_for_create(property_found=False, taken_days=[])
    req = ReservationCreate(
        property_id="nope",
        check_in=date(2026, 5, 1),
        check_out=date(2026, 5, 3),
    )
    with pytest.raises(ReservationError) as exc:
        service.create(AuthContext(user_id="u1", tenant_id="t1"), req)
    assert exc.value.status_code == 404


def test_guest_contact_defaults_empty() -> None:
    c = GuestContact()
    assert c.first_name == "" and c.email == ""


def test_channel_enum_values() -> None:
    assert ReservationChannel.airbnb.value == "airbnb"


RID = "11111111-1111-4111-8111-111111111111"

# --- Service: Dashboard ---

# Volle Berechtigungen (Name, Kontakt, Quelle, Beträge sichtbar).
_FULL_PERMS = [
    # access_pm_features ist das PM-Dach: ohne es fiele pm_booking_total weg
    # (effective_permissions). In der echten App kommt es nie ohne das Dach.
    "access_pm_features",
    "view_guest_name", "view_guest_contact", "view_booking_source",
    "pm_booking_total",
]
# Maskiert (owner/staff/cleaner): keine Gast-Berechtigungen.
_NO_PERMS: list[str] = []


class _KettenQuery:
    """Query-Stub, der JEDE Filter-/Sortiermethode auf sich selbst zurückgibt.

    Bewusst kettenneutral statt fest verdrahteter `select→eq→execute`-Pfade: der
    Lesepfad hängt je nach Rolle und Parametern unterschiedlich viele Glieder an
    (`in_`, `gte`, `lte`, `order`, `limit`, `range`). Ein Stub, der nur eine
    konkrete Kette kennt, liefert bei jeder Query-Änderung still eine leere Liste
    — der Test schlägt dann fehl, ohne dass am Verhalten etwas falsch wäre.

    `range(von, bis)` bedient `fetch_all_rows`: es schneidet echt zu, damit die
    Paginierungsschleife terminiert (sonst liefe sie endlos über dieselbe Seite).
    """

    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows

    def __getattr__(self, _name: str):  # noqa: ANN204 - Stub gibt sich selbst
        return lambda *_a, **_k: self

    def range(self, von: int, bis: int) -> "_KettenQuery":
        return _KettenQuery(self._rows[von : bis + 1])

    def limit(self, n: int) -> "_KettenQuery":
        return _KettenQuery(self._rows[:n])

    def execute(self) -> MagicMock:
        res = MagicMock()
        res.data = self._rows
        # `count` wird ausdrücklich gesetzt, weil ein MagicMock hier sonst ein
        # weiteres MagicMock liefert — `int(...)` darauf wirft TypeError, und
        # der Test schlüge an einer Stelle fehl, die mit ihm nichts zu tun hat.
        # Der Stub filtert nicht, die Zahl ist also die Gesamtmenge der Tabelle;
        # was gefiltert werden MUSS, prüfen die Query-Spione weiter unten.
        res.count = len(self._rows)
        return res


def _tabellen_db(tabellen: dict[str, list[dict]]) -> MagicMock:
    """Supabase-Double: je Tabellenname eine feste Zeilenmenge, Kette beliebig."""
    db = MagicMock(name="supabase")
    db.table.side_effect = lambda name: MagicMock(
        **{"select.return_value": _KettenQuery(tabellen.get(name, []))}
    )
    return db


def _dashboard_db(
    reservations: list[dict], properties: list[dict],
    *, user_role: str = "admin", user_perms: list[str] | None = None,
    owner_pids: list[str] | None = None,
    addons: list[dict] | None = None,
) -> ReservationsService:
    """Mockt die im dashboard() benutzten Tabellen (reservations + properties +
    users + owner_property_assignments + reservation_addons)."""
    perms = _FULL_PERMS if user_perms is None else user_perms
    return ReservationsService(service_client=_tabellen_db({
        "reservations": reservations,
        "properties": properties,
        "users": [{"role": user_role, "permissions": perms}],
        "owner_property_assignments": [
            {"property_id": p} for p in (owner_pids or [])
        ],
        "reservation_addons": addons or [],
    }))


def test_dashboard_buckets_and_kpis() -> None:
    today = date.today()
    iso = lambda d: d.isoformat()  # noqa: E731
    reservations = [
        # heutiger Check-out
        {"id": RID, "property_id": "p1", "channel": "booking", "status": "confirmed",
         "check_in": iso(today - timedelta(days=3)), "check_out": iso(today),
         "total_amount": 300, "currency": "EUR", "guests": {"name": "Anna"}},
        # heutiger Check-in
        {"id": "r2", "property_id": "p1", "channel": "airbnb", "status": "confirmed",
         "check_in": iso(today), "check_out": iso(today + timedelta(days=2)),
         "total_amount": 200, "guests": {"name": "Bea"}},
        # anstehend
        {"id": "r3", "property_id": "p2", "channel": "direct", "status": "pending",
         "check_in": iso(today + timedelta(days=5)), "check_out": iso(today + timedelta(days=7)),
         "total_amount": 150, "guests": {"name": "Cem"}},
        # storniert → fällt überall raus
        {"id": "r4", "property_id": "p1", "channel": "booking", "status": "cancelled",
         "check_in": iso(today), "check_out": iso(today + timedelta(days=1)),
         "total_amount": 999, "guests": {"name": "X"}},
    ]
    properties = [
        {"id": "p1", "title": "Strandhaus", "currency": "EUR"},
        {"id": "p2", "title": "City Loft", "currency": "EUR"},
    ]
    svc = _dashboard_db(reservations, properties)
    out = svc.dashboard(AuthContext(user_id="u1", tenant_id="t1", role="admin"))

    assert [e.reservation_id for e in out.checkouts_today] == [RID]
    assert [e.reservation_id for e in out.checkins_today] == ["r2"]
    assert [e.reservation_id for e in out.upcoming] == ["r3"]
    assert out.checkouts_today[0].property_title == "Strandhaus"
    # admin (VIEW_GUEST_FULL): voller Name
    assert out.checkouts_today[0].guest_name == "Anna"
    # 3 aktive Check-ins in den letzten 30 Tagen (r1,r2 liegen drin; r3 in Zukunft)
    assert out.checkins_30d.value == 2
    assert out.revenue_30d.value == 500  # r1+r2; storno raus, zukünftiges raus
    assert out.confirmed_30d.value == 2
    # keine Vorperiode → ehrlich None statt erfundener 0 %
    assert out.checkins_30d.change_pct is None
    assert out.currency == "EUR"


def test_dashboard_zeigt_gebuchte_zusatzleistungen() -> None:
    """Badges an der Zeile: Menge und Zahlstatus, Stornos bleiben draußen.

    Der Name kommt aus dem Snapshot der Zeile (mehrsprachig), nicht aus dem
    Katalog — die Sprachwahl trifft das Frontend.
    """
    today = date.today()
    iso = today.isoformat()
    reservations = [
        {"id": RID, "property_id": "p1", "channel": "booking", "status": "confirmed",
         "check_in": iso, "check_out": (today + timedelta(days=2)).isoformat(),
         "total_amount": 300, "currency": "EUR", "guests": {"name": "Anna"}},
    ]
    # Stornierte Posten fehlen hier, weil der Ausschluss als `.neq()` in der
    # Query sitzt — der Ketten-Stub ignoriert Filter bewusst und gäbe sie sonst
    # zurück. Dass der Filter gesetzt IST, prüft der Test darunter.
    addons = [
        {"reservation_id": RID, "name": {"de": "Wäschepaket"}, "qty": 2,
         "status": "pending"},
        {"reservation_id": RID, "name": {"de": "Frühstück"}, "qty": 4,
         "status": "paid"},
    ]
    svc = _dashboard_db(
        reservations, [{"id": "p1", "title": "Strandhaus"}], addons=addons
    )
    out = svc.dashboard(AuthContext(user_id="u1", tenant_id="t1", role="admin"))

    zeile = out.checkins_today[0]
    assert [(a.name["de"], a.qty, a.paid) for a in zeile.addons] == [
        ("Wäschepaket", 2, False),
        ("Frühstück", 4, True),
    ]


def test_dashboard_addons_schliesst_stornierte_aus() -> None:
    """Der Storno-Ausschluss muss in der QUERY stehen, nicht im Nachfiltern.

    Geprüft wird die abgesetzte Kette selbst: ohne `.neq("status",
    "cancelled")` landete eine stornierte Zusatzleistung auf der
    Vorbereitungsliste des Teams.
    """
    aufrufe: list[tuple] = []

    class _Spion(_KettenQuery):
        def neq(self, feld: str, wert: str) -> "_Spion":
            aufrufe.append((feld, wert))
            return self

    db = MagicMock(name="supabase")
    db.table.side_effect = lambda name: MagicMock(
        **{"select.return_value": _Spion([]) if name == "reservation_addons"
           else _KettenQuery({"users": [{"role": "admin",
                                         "permissions": _FULL_PERMS}]}.get(name, []))}
    )
    svc = ReservationsService(service_client=db)
    svc._dashboard_addons(["r1"])  # noqa: SLF001 - gezielter Blick auf die Query

    assert ("status", "cancelled") in aufrufe


def test_dashboard_neu_eingegangen_sortiert_nach_buchungszeitpunkt() -> None:
    """„Neu eingegangen" ordnet nach BUCHUNG, nicht nach Aufenthalt.

    Die Anreisen stehen hier bewusst in umgekehrter Reihenfolge zu den
    Buchungszeitpunkten: sortierte die Karte (wie die drei Listen darüber) nach
    `check_in`, käme genau die falsche Reihenfolge heraus.
    """
    today = date.today()
    iso = lambda d: d.isoformat()  # noqa: E731
    reservations = [
        # zuerst gebucht, reist zuletzt an
        {"id": RID, "property_id": "p1", "channel": "booking", "status": "confirmed",
         "check_in": iso(today + timedelta(days=30)),
         "check_out": iso(today + timedelta(days=33)),
         "booked_at": "2026-08-10T09:00:00+00:00",
         "total_amount": 300, "currency": "EUR", "guests": {"name": "Anna"}},
        # zuletzt gebucht, reist zuerst an
        {"id": "r2", "property_id": "p1", "channel": "airbnb", "status": "confirmed",
         "check_in": iso(today + timedelta(days=2)),
         "check_out": iso(today + timedelta(days=4)),
         "booked_at": "2026-08-14T18:30:00+00:00",
         "total_amount": 200, "currency": "EUR", "guests": {"name": "Bea"}},
    ]
    svc = _dashboard_db(reservations, [{"id": "p1", "title": "Strandhaus"}])
    out = svc.dashboard(AuthContext(user_id="u1", tenant_id="t1", role="admin"))

    assert [e.reservation_id for e in out.neu_eingegangen] == ["r2", RID]
    assert out.neu_eingegangen[0].booked_at is not None
    # Die Aufenthaltslisten bleiben nach Aufenthalt sortiert (Gegenprobe).
    assert [e.reservation_id for e in out.upcoming] == ["r2", RID]


def test_dashboard_im_haus_ohne_abreisetag() -> None:
    """„Im Haus" zaehlt den Abreisetag NICHT mit.

    Wer heute auscheckt, steht bereits in `checkouts_today`. Zaehlte er hier
    mit, waere derselbe Gast in zwei Kacheln — und die Summe der Kacheln waere
    groesser als die Zahl der Gaeste.
    """
    today = date.today()
    iso = lambda d: d.isoformat()  # noqa: E731
    reservations = [
        # reist heute ab → gehoert zu checkouts_today, NICHT zu im_haus
        {"id": RID, "property_id": "p1", "channel": "booking", "status": "confirmed",
         "check_in": iso(today - timedelta(days=3)), "check_out": iso(today),
         "total_amount": 300, "currency": "EUR", "guests": {"name": "Anna"}},
        # heute angereist, bleibt → im Haus
        {"id": "r2", "property_id": "p1", "channel": "airbnb", "status": "confirmed",
         "check_in": iso(today), "check_out": iso(today + timedelta(days=2)),
         "total_amount": 200, "currency": "EUR", "guests": {"name": "Bea"}},
        # mittendrin → im Haus
        {"id": "r3", "property_id": "p1", "channel": "booking", "status": "confirmed",
         "check_in": iso(today - timedelta(days=2)),
         "check_out": iso(today + timedelta(days=1)),
         "total_amount": 150, "currency": "EUR", "guests": {"name": "Cem"}},
    ]
    svc = _dashboard_db(reservations, [{"id": "p1", "title": "Strandhaus"}])
    out = svc.dashboard(AuthContext(user_id="u1", tenant_id="t1", role="admin"))

    assert {e.reservation_id for e in out.im_haus} == {"r2", "r3"}
    assert out.im_haus_gesamt == 2
    assert [e.reservation_id for e in out.checkouts_today] == [RID]


def test_dashboard_zaehler_sind_nicht_die_listenlaenge() -> None:
    """Die Kachel zeigt die ECHTE Anzahl, nicht den Deckel der Liste.

    Live standen auf der Startseite zweimal „50", weil beide Listen am
    Limit hingen und die Kachel `len(liste)` zeigte — eine Zahl, die in
    Wahrheit das Limit war (Wurzel 4).
    """
    today = date.today()
    iso = lambda d: d.isoformat()  # noqa: E731
    # 60 kuenftige Anreisen: mehr als _DASHBOARD_UPCOMING_MAX (50).
    reservations = [
        {"id": f"r{i}", "property_id": "p1", "channel": "booking",
         "status": "confirmed",
         "check_in": iso(today + timedelta(days=i + 1)),
         "check_out": iso(today + timedelta(days=i + 3)),
         "total_amount": 100, "currency": "EUR", "guests": {"name": f"G{i}"}}
        for i in range(60)
    ]
    svc = _dashboard_db(reservations, [{"id": "p1", "title": "Strandhaus"}])
    out = svc.dashboard(AuthContext(user_id="u1", tenant_id="t1", role="admin"))

    assert len(out.upcoming) == 50  # Liste gedeckelt …
    assert out.upcoming_gesamt == 60  # … Zahl ehrlich


def test_dashboard_neu_eingegangen_filtert_auf_buchungszeitpunkt() -> None:
    """Der Zeitfilter muss in der QUERY über `booked_at` laufen.

    Zwei Fehler wären hier unsichtbar, weil beide plausibel aussehen: ein
    Filter über `created_at` (Wurzel 5b — unsere Verarbeitung statt des
    Buchungsereignisses) und ein Filter über `check_in`/`check_out` (dann
    fehlte eine gestern eingegangene Buchung für einen vergangenen Aufenthalt,
    also genau der Fall, für den die eigene Abfrage existiert). Geprüft wird
    deshalb die abgesetzte Kette, nicht das Ergebnis — der Ketten-Stub filtert
    bewusst nicht.
    """
    aufrufe: list[tuple] = []

    class _Spion(_KettenQuery):
        def gte(self, feld: str, wert: str) -> "_Spion":
            aufrufe.append((feld, wert))
            return self

    db = MagicMock(name="supabase")
    db.table.side_effect = lambda name: MagicMock(
        **{"select.return_value": _Spion([]) if name == "reservations"
           else _KettenQuery({"users": [{"role": "admin",
                                         "permissions": _FULL_PERMS}]}.get(name, []))}
    )
    svc = ReservationsService(service_client=db)
    svc._dashboard_neu_rows("t1", None)  # noqa: SLF001 - gezielter Blick auf die Query

    assert [feld for feld, _ in aufrufe] == ["booked_at"]
    # Fenster: 30 Tage zurück (das größte, das die Startseite anbietet), und
    # als Zeitpunkt, nicht als reines Datum — sonst schnitte die Karte am
    # Tagesbeginn statt vor 30×24 h.
    grenze = datetime.fromisoformat(aufrufe[0][1])
    assert grenze.tzinfo is not None
    stunden = (datetime.now(UTC) - grenze).total_seconds() / 3600
    assert 719.9 < stunden < 720.1


def test_dashboard_neu_eingegangen_owner_scope() -> None:
    """Owner-Scope (§4.2) gilt auch für die neue Liste, nicht nur für die alten.

    Ohne die `in_`-Einschränkung sähe ein Eigentümer im Eingangsbild die
    Buchungen FREMDER Objekte — dieselbe Lücke, die Wurzel 9 für Detailrouten
    beschreibt, nur auf der Startseite.
    """
    aufrufe: list[tuple] = []

    class _Spion(_KettenQuery):
        def in_(self, feld: str, werte: list) -> "_Spion":  # noqa: ANN001
            aufrufe.append((feld, list(werte)))
            return self

    db = MagicMock(name="supabase")
    db.table.side_effect = lambda name: MagicMock(
        **{"select.return_value": _Spion([]) if name == "reservations"
           else _KettenQuery([])}
    )
    svc = ReservationsService(service_client=db)
    svc._dashboard_neu_rows("t1", ["p1", "p2"])  # noqa: SLF001

    assert ("property_id", ["p1", "p2"]) in aufrufe


def test_dashboard_ohne_zusatzleistungen_leere_liste() -> None:
    """Keine gebuchte Leistung → leere Liste, nicht None (kein Badge-Block)."""
    today = date.today()
    reservations = [
        {"id": RID, "property_id": "p1", "channel": "booking", "status": "confirmed",
         "check_in": today.isoformat(),
         "check_out": (today + timedelta(days=2)).isoformat(),
         "total_amount": 300, "currency": "EUR", "guests": {"name": "Anna"}},
    ]
    svc = _dashboard_db(reservations, [{"id": "p1", "title": "Strandhaus"}])
    out = svc.dashboard(AuthContext(user_id="u1", tenant_id="t1", role="admin"))
    assert out.checkins_today[0].addons == []


def test_dashboard_mixed_currency_suppresses_revenue() -> None:
    """Objekte in mehreren Währungen: der 30-Tage-Umsatz darf NICHT zu einer
    Mischsumme mit beliebigem Label addiert werden. revenue_30d=None,
    currency='' — die Zähl-KPIs bleiben unberührt."""
    today = date.today()
    iso = lambda d: d.isoformat()  # noqa: E731
    reservations = [
        {"id": RID, "property_id": "p1", "channel": "booking", "status": "confirmed",
         "check_in": iso(today - timedelta(days=3)), "check_out": iso(today),
         "total_amount": 100, "currency": "EUR", "guests": {"name": "Anna"}},
        {"id": "r2", "property_id": "p2", "channel": "direct", "status": "confirmed",
         "check_in": iso(today - timedelta(days=1)), "check_out": iso(today + timedelta(days=2)),
         "total_amount": 100, "currency": "CHF", "guests": {"name": "Bea"}},
    ]
    properties = [
        {"id": "p1", "title": "Strandhaus", "currency": "EUR"},
        {"id": "p2", "title": "Alphütte", "currency": "CHF"},
    ]
    svc = _dashboard_db(reservations, properties)
    out = svc.dashboard(AuthContext(user_id="u1", tenant_id="t1", role="admin"))
    # Gemischte Währungen → keine (falsche) Umsatz-Mischsumme, kein Label.
    assert out.revenue_30d is None
    assert out.currency == ""
    # Zähl-KPIs bleiben korrekt.
    assert out.checkins_30d.value == 2
    assert out.confirmed_30d.value == 2


def test_dashboard_freigabe_noetig_nur_offene_und_nicht_abgelaufene() -> None:
    """„Freigabe nötig" zeigt offene Anfragen, deren Aufenthalt noch zählt.

    Zwei Abgrenzungen, die beide leicht falsch herum sind: eine bestätigte
    Buchung gehört NICHT in die Karte (sie verlangt keine Entscheidung), und
    eine offene Anfrage für einen längst vergangenen Zeitraum ebenso wenig —
    dort wäre die verlangte Handlung wirkungslos.
    """
    today = date.today()
    iso = lambda d: d.isoformat()  # noqa: E731
    reservations = [
        # offen, Aufenthalt in der Zukunft → gehört hinein
        {"id": RID, "property_id": "p1", "channel": "direct", "status": "pending",
         "check_in": iso(today + timedelta(days=4)),
         "check_out": iso(today + timedelta(days=6)),
         "total_amount": 100, "currency": "EUR", "guests": {"name": "Anna"}},
        # offen, aber abgereist → keine offene Aufgabe mehr
        {"id": "r2", "property_id": "p1", "channel": "direct", "status": "pending",
         "check_in": iso(today - timedelta(days=10)),
         "check_out": iso(today - timedelta(days=8)),
         "total_amount": 100, "currency": "EUR", "guests": {"name": "Bea"}},
        # bestätigt → verlangt keine Entscheidung
        {"id": "r3", "property_id": "p1", "channel": "direct", "status": "confirmed",
         "check_in": iso(today + timedelta(days=2)),
         "check_out": iso(today + timedelta(days=3)),
         "total_amount": 100, "currency": "EUR", "guests": {"name": "Cem"}},
    ]
    svc = _dashboard_db(reservations, [{"id": "p1", "title": "Strandhaus"}])
    out = svc.dashboard(AuthContext(user_id="u1", tenant_id="t1", role="admin"))
    assert [e.reservation_id for e in out.freigabe_noetig] == [RID]
    assert out.freigabe_gesamt == 1


def test_dashboard_umsatz_je_buchung_ohne_eigentuemer_aufenthalte() -> None:
    """Der Schnitt teilt durch die ZAHLENDEN Buchungen, nicht durch alle.

    Ein Eigentümer-Aufenthalt (0241) trägt keinen Umsatz. Zählte er im Nenner
    mit, sänke der ausgewiesene Schnitt mit jedem Eigenbeleg — eine Zahl, die
    plausibel aussieht und trotzdem falsch ist (Wurzel 4).
    """
    today = date.today()
    iso = lambda d: d.isoformat()  # noqa: E731
    reservations = [
        {"id": RID, "property_id": "p1", "channel": "booking", "status": "confirmed",
         "check_in": iso(today - timedelta(days=3)), "check_out": iso(today),
         "total_amount": 300, "currency": "EUR", "guests": {"name": "Anna"}},
        {"id": "r2", "property_id": "p1", "channel": "booking", "status": "confirmed",
         "check_in": iso(today - timedelta(days=2)),
         "check_out": iso(today + timedelta(days=1)),
         "total_amount": 100, "currency": "EUR", "guests": {"name": "Bea"}},
        # Eigentümer-Aufenthalt: kein Umsatz, also auch kein Nenner
        {"id": "r3", "property_id": "p1", "channel": "direct", "status": "confirmed",
         "check_in": iso(today - timedelta(days=1)),
         "check_out": iso(today + timedelta(days=2)),
         "total_amount": 0, "currency": "EUR", "is_owner_stay": True,
         "owners": {"name": "Eigentümer"}},
    ]
    svc = _dashboard_db(reservations, [{"id": "p1", "title": "Strandhaus"}])
    out = svc.dashboard(AuthContext(user_id="u1", tenant_id="t1", role="admin"))
    assert out.revenue_30d.value == 400
    # 400 / 2 zahlende Buchungen — nicht 400 / 3 Check-ins.
    assert out.revenue_per_booking_30d.value == 200
    assert out.checkins_30d.value == 3


def test_dashboard_umsatz_je_buchung_folgt_der_betrags_maskierung() -> None:
    """Der Schnitt ist ein Betrag und unterliegt derselben Sichtbarkeit.

    Ohne diese Kopplung wäre er das Leck, durch das ein Eigentümer ohne
    PM_BOOKING_TOTAL den maskierten Umsatz doch erführe: Schnitt × Buchungen.
    """
    today = date.today()
    iso = lambda d: d.isoformat()  # noqa: E731
    reservations = [
        {"id": RID, "property_id": "p1", "channel": "booking", "status": "confirmed",
         "check_in": iso(today - timedelta(days=3)), "check_out": iso(today),
         "total_amount": 300, "currency": "EUR", "guests": {"name": "Anna"}},
    ]
    svc = _dashboard_db(
        reservations, [{"id": "p1", "title": "Strandhaus"}],
        user_role="owner", user_perms=_NO_PERMS, owner_pids=["p1"],
    )
    out = svc.dashboard(AuthContext(user_id="u", tenant_id="t1", role="owner"))
    assert out.revenue_30d is None
    assert out.revenue_per_booking_30d is None


def test_dashboard_objekte_zaehlt_je_status_und_im_owner_scope() -> None:
    """Die Objekt-Zahlen entstehen als drei gefilterte Zählungen, nicht als
    eine Gesamtzahl, aus der die Oberfläche schätzt — und der Owner-Scope
    (§4.2) hängt an jeder von ihnen, sonst zeigte die Karte einem Eigentümer
    den Bestand des ganzen Betriebs.
    """
    status_filter: list[tuple] = []
    scopes: list[tuple] = []

    class _Spion(_KettenQuery):
        def eq(self, feld: str, wert: str) -> "_Spion":
            if feld == "status":
                status_filter.append((feld, wert))
            return self

        def in_(self, feld: str, werte: list) -> "_Spion":  # noqa: ANN001
            scopes.append((feld, list(werte)))
            return self

    db = MagicMock(name="supabase")
    db.table.side_effect = lambda name: MagicMock(
        **{"select.return_value": _Spion([]) if name == "properties"
           else _KettenQuery([])}
    )
    svc = ReservationsService(service_client=db)
    zahlen = svc._dashboard_objekte("t1", ["p1", "p2"])  # noqa: SLF001

    # Gesamt ohne Status-Filter, dazu genau die zwei Status-Zählungen.
    assert [wert for _, wert in status_filter] == ["inactive", "draft"]
    # Owner-Scope auf ALLEN drei Zählungen, nicht nur auf der ersten.
    assert scopes == [("id", ["p1", "p2"])] * 3
    assert set(zahlen) == {"objekte_gesamt", "objekte_inaktiv", "objekte_entwurf"}


def test_dashboard_kpi_gleiche_zahl_wie_die_startseite() -> None:
    """Die Kachel im Standard-Zeitraum MUSS zeigen, was die Startseite zeigt.

    Zwei Wege zu derselben Zahl sind zwei Wahrheiten, wenn sie zwei Formeln
    haben: die Kachel stünde nach dem Umschalten auf „30 Tage" auf einem
    anderen Wert als beim Laden derselben Seite — und niemand wüsste, welcher
    stimmt. Der Test hält beide Wege an dieselbe Rechnung.
    """
    today = date.today()
    iso = lambda d: d.isoformat()  # noqa: E731
    reservations = [
        {"id": RID, "property_id": "p1", "channel": "booking", "status": "confirmed",
         "check_in": iso(today - timedelta(days=3)), "check_out": iso(today),
         "total_amount": 300, "currency": "EUR", "guests": {"name": "Anna"}},
        {"id": "r2", "property_id": "p1", "channel": "airbnb", "status": "confirmed",
         "check_in": iso(today - timedelta(days=1)),
         "check_out": iso(today + timedelta(days=2)),
         "total_amount": 200, "currency": "EUR", "guests": {"name": "Bea"}},
    ]
    svc = _dashboard_db(reservations, [{"id": "p1", "title": "Strandhaus"}])
    ctx = AuthContext(user_id="u1", tenant_id="t1", role="admin")
    seite = svc.dashboard(ctx)

    for metrik, erwartet in [
        (DashboardKpiMetrik.checkins, seite.checkins_30d),
        (DashboardKpiMetrik.revenue, seite.revenue_30d),
        (DashboardKpiMetrik.revenue_per_booking, seite.revenue_per_booking_30d),
        (DashboardKpiMetrik.confirmed, seite.confirmed_30d),
    ]:
        kachel = svc.dashboard_kpi(ctx, metrik, "30d")
        assert kachel.kpi == erwartet, metrik
        assert kachel.tage == 30
        assert kachel.zeitraum == "30d"


def test_dashboard_kpi_fenster_folgt_dem_zeitraum() -> None:
    """Der gewählte Zeitraum MUSS bis in die Abfrage durchschlagen.

    Bliebe das Ladefenster bei den 60 Tagen der Startseite, zeigte „12 Monate"
    stillschweigend zwei Monate — eine Zahl, die plausibel aussieht und
    trotzdem falsch ist. Geprüft wird deshalb die abgesetzte Kette: die
    Untergrenze muss zwei volle Perioden zurückreichen (aktuelle + Vergleich).
    """
    grenzen: list[tuple] = []

    class _Spion(_KettenQuery):
        def gte(self, feld: str, wert: str) -> "_Spion":
            grenzen.append((feld, wert))
            return self

    db = MagicMock(name="supabase")
    db.table.side_effect = lambda name: MagicMock(
        **{"select.return_value": _Spion([]) if name == "reservations"
           else _KettenQuery({"users": [{"role": "admin",
                                         "permissions": _FULL_PERMS}]}.get(name, []))}
    )
    svc = ReservationsService(service_client=db)
    svc.dashboard_kpi(
        AuthContext(user_id="u1", tenant_id="t1", role="admin"),
        DashboardKpiMetrik.checkins,
        "12m",
    )

    assert [feld for feld, _ in grenzen] == ["check_in"]
    # 365 Tage aktuelle Periode + 365 Vorperiode, inklusive heute.
    assert grenzen[0][1] == (date.today() - timedelta(days=729)).isoformat()


def test_dashboard_kpi_unbekannter_zeitraum_wird_abgewiesen() -> None:
    """Ein unbekannter Zeitraum ist 422, kein stiller Rückfall auf 30 Tage —
    sonst zeigte die Kachel „12 Monate" die Zahlen eines Monats."""
    svc = _dashboard_db([], [])
    with pytest.raises(ReservationError) as exc:
        svc.dashboard_kpi(
            AuthContext(user_id="u1", tenant_id="t1", role="admin"),
            DashboardKpiMetrik.checkins,
            "42d",
        )
    assert exc.value.status_code == 422


def test_dashboard_kpi_owner_ohne_betraege_bekommt_keinen_umsatz() -> None:
    """Die Betrags-Maskierung (§4.2) gilt auf dem Nachlade-Weg genauso.

    Ohne diese Prüfung wäre der Selektor die Umgehung: die Startseite blendet
    die Umsatz-Kachel für einen Owner ohne PM_BOOKING_TOTAL aus, ein direkter
    Aufruf von `/dashboard/kpi?metrik=revenue` lieferte den Betrag trotzdem
    (Wurzel 9 — derselbe Scope auf Listen- und Einzelweg).
    """
    today = date.today()
    iso = lambda d: d.isoformat()  # noqa: E731
    reservations = [
        {"id": RID, "property_id": "p1", "channel": "booking", "status": "confirmed",
         "check_in": iso(today - timedelta(days=3)), "check_out": iso(today),
         "total_amount": 300, "currency": "EUR", "guests": {"name": "Anna"}},
    ]
    svc = _dashboard_db(
        reservations, [{"id": "p1", "title": "Strandhaus"}],
        user_role="owner", user_perms=_NO_PERMS, owner_pids=["p1"],
    )
    ctx = AuthContext(user_id="u", tenant_id="t1", role="owner")
    assert svc.dashboard_kpi(ctx, DashboardKpiMetrik.revenue, "30d").kpi is None
    assert svc.dashboard_kpi(
        ctx, DashboardKpiMetrik.revenue_per_booking, "30d"
    ).kpi is None
    # Zähl-KPIs bleiben sichtbar — maskiert sind Beträge, nicht Mengen.
    assert svc.dashboard_kpi(ctx, DashboardKpiMetrik.checkins, "30d").kpi is not None


def test_dashboard_liste_fenster_je_liste_auf_eigener_achse() -> None:
    """Jede Liste fenstert auf IHRER Datumsachse.

    Eine gemeinsame Achse wäre kürzer und falsch: „nächste 7 Tage" heißt bei
    den Abreisen abreisende Gäste (`check_out`), bei den Anreisen anreisende
    (`check_in`). Dieselbe Buchung gehört je nach Karte in ein anderes Fenster.
    """
    today = date.today()
    iso = lambda d: d.isoformat()  # noqa: E731
    reservations = [
        # reist heute an, in 20 Tagen ab → heute Check-in, nicht heute Check-out
        {"id": RID, "property_id": "p1", "channel": "booking", "status": "confirmed",
         "check_in": iso(today), "check_out": iso(today + timedelta(days=20)),
         "total_amount": 100, "currency": "EUR", "guests": {"name": "Anna"}},
        # reist in 3 Tagen ab (war vorher da) → im 7-Tage-Abreisefenster
        {"id": "r2", "property_id": "p1", "channel": "booking", "status": "confirmed",
         "check_in": iso(today - timedelta(days=2)),
         "check_out": iso(today + timedelta(days=3)),
         "total_amount": 100, "currency": "EUR", "guests": {"name": "Bea"}},
    ]
    svc = _dashboard_db(reservations, [{"id": "p1", "title": "Strandhaus"}])
    ctx = AuthContext(user_id="u1", tenant_id="t1", role="admin")

    heute_ein = svc.dashboard_liste(ctx, DashboardListe.checkins, DashboardFenster.heute)
    assert [e.reservation_id for e in heute_ein.items] == [RID]

    sieben_aus = svc.dashboard_liste(ctx, DashboardListe.checkouts, DashboardFenster.d7)
    assert [e.reservation_id for e in sieben_aus.items] == ["r2"]

    # „im Haus" heute: beide sind da, der Abreisetag zählt bei keinem mit.
    im_haus = svc.dashboard_liste(ctx, DashboardListe.im_haus, DashboardFenster.heute)
    assert {e.reservation_id for e in im_haus.items} == {RID, "r2"}
    assert im_haus.gesamt == 2


def test_dashboard_liste_owner_ohne_objekte_bekommt_nichts() -> None:
    """Fail-closed wie im Dashboard: ein Eigentümer ohne zugeordnetes Objekt
    darf über den Nachlade-Weg keine tenant-weite Liste bekommen (Wurzel 9)."""
    today = date.today()
    iso = lambda d: d.isoformat()  # noqa: E731
    reservations = [
        {"id": RID, "property_id": "p1", "channel": "booking", "status": "confirmed",
         "check_in": iso(today), "check_out": iso(today + timedelta(days=2)),
         "total_amount": 100, "currency": "EUR", "guests": {"name": "Anna"}},
    ]
    svc = _dashboard_db(
        reservations, [{"id": "p1", "title": "Strandhaus"}],
        user_role="owner", user_perms=_NO_PERMS, owner_pids=[],
    )
    antwort = svc.dashboard_liste(
        AuthContext(user_id="u", tenant_id="t1", role="owner"),
        DashboardListe.checkins,
        DashboardFenster.heute,
    )
    assert antwort.items == []
    assert antwort.gesamt == 0


def test_dashboard_owner_revenue_masked() -> None:
    """Owner ohne PM_BOOKING_TOTAL sieht laut §4.2 keinen (auch nicht aggregierten)
    Umsatz: revenue_30d=None + currency='' — die anderen KPIs bleiben sichtbar."""
    today = date.today()
    iso = lambda d: d.isoformat()  # noqa: E731
    reservations = [
        {"id": RID, "property_id": "p1", "channel": "booking", "status": "confirmed",
         "check_in": iso(today - timedelta(days=3)), "check_out": iso(today),
         "total_amount": 300, "currency": "EUR", "guests": {"name": "Anna"}},
        {"id": "r2", "property_id": "p1", "channel": "airbnb", "status": "confirmed",
         "check_in": iso(today), "check_out": iso(today + timedelta(days=2)),
         "total_amount": 200, "currency": "EUR", "guests": {"name": "Bea"}},
    ]
    properties = [{"id": "p1", "title": "Strandhaus", "currency": "EUR"}]
    svc = _dashboard_db(
        reservations, properties, user_role="owner", user_perms=_NO_PERMS,
        owner_pids=["p1"],
    )
    out = svc.dashboard(AuthContext(user_id="u", tenant_id="t1", role="owner"))
    # Umsatz maskiert (kein erfundener 0-Wert), Währung leer.
    assert out.revenue_30d is None
    assert out.currency == ""
    # Nicht-Betrags-KPIs bleiben sichtbar.
    assert out.checkins_30d.value == 2
    assert out.confirmed_30d.value == 2


# --- DSGVO-Daten-Split (§4): Maskierung je Rolle -----------------------------

def _list_db(
    reservations: list[dict], *, user_role: str = "admin",
    user_perms: list[str] | None = None,
    owner_pids: list[str] | None = None,
) -> ReservationsService:
    """Mockt die in list() benutzten Tabellen (reservations mit guests-Join +
    users + owner_property_assignments für den Owner-Scope)."""
    perms = _FULL_PERMS if user_perms is None else user_perms
    return ReservationsService(service_client=_tabellen_db({
        "reservations": reservations,
        "users": [{"role": user_role, "permissions": perms}],
        "owner_property_assignments": [
            {"property_id": p} for p in (owner_pids or [])
        ],
    }))


_GUEST_ROW = {
    "id": RID, "property_id": "p1", "guest_id": "g1", "channel": "booking",
    "check_in": "2026-07-01", "check_out": "2026-07-03", "status": "confirmed",
    "total_amount": 250, "currency": "EUR", "ota_name": "Booking.com",
    "guests": {"name": "Anna Müller"},
}


def test_list_admin_sees_full_name_and_amount() -> None:
    # admin: effective_permissions = ALLE → voller Zugriff (perms egal).
    svc = _list_db([dict(_GUEST_ROW)], user_role="admin", user_perms=_NO_PERMS)
    out = svc.list(AuthContext(user_id="u", tenant_id="t1", role="admin"))
    r = out.items[0]
    assert r.guest_name == "Anna Müller"
    assert r.total_amount == 250.0
    assert r.currency == "EUR"
    assert r.ota_name == "Booking.com"


def test_list_co_admin_with_full_perms() -> None:
    svc = _list_db([dict(_GUEST_ROW)], user_role="co_admin", user_perms=_FULL_PERMS)
    out = svc.list(AuthContext(user_id="u", tenant_id="t1", role="co_admin"))
    r = out.items[0]
    assert r.guest_name == "Anna Müller"
    assert r.total_amount == 250.0


def test_list_owner_sees_only_first_name_no_amount() -> None:
    # Owner ist p1 zugeordnet → sieht die Buchung, aber maskiert (nur Vorname).
    svc = _list_db(
        [dict(_GUEST_ROW)], user_role="owner", user_perms=_NO_PERMS,
        owner_pids=["p1"],
    )
    out = svc.list(AuthContext(user_id="u", tenant_id="t1", role="owner"))
    r = out.items[0]
    assert r.guest_name == "Anna"          # nur Vorname (kein view_guest_name)
    assert r.total_amount is None          # kein Betrag (HIDE_PRICES nicht nötig: …)
    assert r.currency == ""
    assert r.ota_name is None              # keine Quelle (kein view_booking_source)


def test_list_owner_without_assignment_sees_nothing() -> None:
    # Owner OHNE zugeordnete Objekte → leere Liste (fail-closed, §4.2).
    svc = _list_db(
        [dict(_GUEST_ROW)], user_role="owner", user_perms=_NO_PERMS,
        owner_pids=[],
    )
    out = svc.list(AuthContext(user_id="u", tenant_id="t1", role="owner"))
    assert out.total == 0 and out.items == []


def test_list_owner_foreign_property_filter_ignored() -> None:
    # Owner ist NUR p1 zugeordnet; fragt gezielt das fremde p2 an → leer,
    # der client-Filter darf den Owner-Scope nicht ausweiten.
    svc = _list_db(
        [dict(_GUEST_ROW)], user_role="owner", user_perms=_NO_PERMS,
        owner_pids=["p1"],
    )
    out = svc.list(
        AuthContext(user_id="u", tenant_id="t1", role="owner"), property_id="p2"
    )
    assert out.total == 0


def test_list_staff_with_hide_prices_overrides_total() -> None:
    # staff mit view_guest_name + pm_booking_total, aber hide_prices →
    # Name voll, Betrag trotz Betrags-Berechtigung weg (hide_prices überstimmt).
    perms = ["view_guest_name", "pm_booking_total", "hide_prices"]
    svc = _list_db([dict(_GUEST_ROW)], user_role="staff", user_perms=perms)
    out = svc.list(AuthContext(user_id="u", tenant_id="t1", role="staff"))
    r = out.items[0]
    assert r.guest_name == "Anna Müller"   # view_guest_name → voller Name
    assert r.total_amount is None          # hide_prices → kein Betrag


def test_list_unknown_role_fails_closed() -> None:
    # Unbekannte/fehlende Rolle ohne Berechtigungen → fail-closed.
    svc = _list_db([dict(_GUEST_ROW)], user_role="cleaner", user_perms=_NO_PERMS)
    out = svc.list(AuthContext(user_id="u", tenant_id="t1", role=None))
    r = out.items[0]
    assert r.guest_name == "Anna"
    assert r.total_amount is None


# --- move/resize: Verschieben + Doppelbuchungs-Schutz ------------------------

from src.features.reservations.schemas import ReservationMove  # noqa: E402


class _MoveQuery:
    """Stateful Query-Stub: Filter werden auf die Tabellenzeilen angewandt;
    upsert/update mutieren den Store (deckt die move()-Ketten ab)."""

    def __init__(self, store: dict, name: str) -> None:
        self._store = store
        self._name = name
        self._eq: dict = {}
        self._neq: dict = {}
        self._is_null: list = []
        self._not_null: list = []
        self._in: dict = {}
        self._negate_next = False
        self._gte: str | None = None
        self._lt: str | None = None

    def select(self, *_a, **_k) -> "_MoveQuery":
        return self

    def eq(self, col, val) -> "_MoveQuery":  # noqa: ANN001
        self._eq[col] = val
        return self

    def neq(self, col, val) -> "_MoveQuery":  # noqa: ANN001
        self._neq[col] = val
        return self

    def is_(self, col, val) -> "_MoveQuery":  # noqa: ANN001
        # PostgREST: is_("col", "null") — hier nur der Null-Fall (detail()-
        # Rechnungs-Query, 0092).
        if val == "null":
            if self._negate_next:
                self._not_null.append(col)
            else:
                self._is_null.append(col)
        self._negate_next = False
        return self

    @property
    def not_(self) -> "_MoveQuery":
        # PostgREST: `.not_.is_(col, "null")` — der Überbuchungs-Check in
        # accept_request fragt so nach OTA-Buchungen (source_channex_booking_id
        # NICHT null). `not_` ist dort ein Property, kein Aufruf.
        self._negate_next = True
        return self

    def in_(self, col, vals) -> "_MoveQuery":  # noqa: ANN001
        self._in[col] = list(vals)
        return self

    def gte(self, _col, val) -> "_MoveQuery":  # noqa: ANN001
        self._gte = val
        return self

    def lt(self, _col, val) -> "_MoveQuery":  # noqa: ANN001
        self._lt = val
        return self

    def lte(self, col, val) -> "_MoveQuery":  # noqa: ANN001
        # Range-Filter für _days_still_booked_by_others (check_in <= hi).
        self._lte = (col, val)
        return self

    def gt(self, col, val) -> "_MoveQuery":  # noqa: ANN001
        # Range-Filter für _days_still_booked_by_others (check_out > lo).
        self._gt = (col, val)
        return self

    def order(self, *_a, **_k) -> "_MoveQuery":
        return self

    def limit(self, *_a, **_k) -> "_MoveQuery":
        return self

    def _match(self, r: dict) -> bool:
        for c, v in self._eq.items():
            if r.get(c) != v:
                return False
        for c, v in self._neq.items():
            if r.get(c) == v:
                return False
        for c in self._is_null:
            if r.get(c) is not None:
                return False
        for c in self._not_null:
            if r.get(c) is None:
                return False
        for c, vals in self._in.items():
            if r.get(c) not in vals:
                return False
        if self._gte is not None and r.get("date", "") < self._gte:
            return False
        if self._lt is not None and r.get("date", "") >= self._lt:
            return False
        lte = getattr(self, "_lte", None)
        if lte is not None and str(r.get(lte[0], "")) > lte[1]:
            return False
        gt = getattr(self, "_gt", None)
        if gt is not None and str(r.get(gt[0], "")) <= gt[1]:
            return False
        return True

    def upsert(self, payload, **_k) -> "_MoveQuery":  # noqa: ANN001
        rows = payload if isinstance(payload, list) else [payload]
        table = self._store.setdefault(self._name, [])
        # Konfliktschlüssel wie in der DB: `AVAILABILITY_CONFLICT` ist
        # (property_id, unit_id, date). Ohne `unit_id` kollabierten die Zeilen
        # zweier Einheiten desselben Tages auf eine — ein Multi-Unit-Test wäre
        # damit nicht abbildbar (0266).
        for row in rows:
            for i, ex in enumerate(table):
                if (
                    ex.get("property_id") == row.get("property_id")
                    and ex.get("unit_id") == row.get("unit_id")
                    and ex.get("date") == row.get("date")
                ):
                    table[i] = {**ex, **row}
                    break
            else:
                table.append(dict(row))
        return self

    def update(self, payload) -> "_MoveQuery":  # noqa: ANN001
        self._pending_update = payload
        return self

    def insert(self, payload) -> "_MoveQuery":  # noqa: ANN001
        self._pending_insert = payload
        return self

    def delete(self) -> "_MoveQuery":
        self._pending_delete = True
        return self

    def execute(self) -> MagicMock:
        if getattr(self, "_pending_insert", None) is not None:
            row = dict(self._pending_insert)
            row.setdefault("id", f"{self._name}-{len(self._store.get(self._name, [])) + 1}")
            self._store.setdefault(self._name, []).append(row)
            res = MagicMock()
            res.data = [row]
            return res
        rows = [r for r in self._store.get(self._name, []) if self._match(r)]
        if getattr(self, "_pending_delete", False):
            # Wirklich aus dem Store entfernen (in-place, weil Tests eine
            # Referenz auf die Liste halten): ein nur protokollierendes Delete
            # könnte den Gegenzustand nicht beweisen — die Zeile stünde danach
            # weiter da und der Test wäre wertlos.
            uebrig = [r for r in self._store.get(self._name, []) if r not in rows]
            self._store.setdefault(self._name, [])[:] = uebrig
        if getattr(self, "_pending_update", None) is not None:
            for r in rows:
                r.update(self._pending_update)
        res = MagicMock()
        res.data = rows
        return res


def _move_db(store: dict) -> ReservationsService:
    db = MagicMock(name="supabase")
    db.table.side_effect = lambda name: _MoveQuery(store, name)
    return ReservationsService(service_client=db)


def _move_store(
    *, check_in: str, check_out: str, status: str = "confirmed",
    checked_in_at: str | None = None,
    source_channex_booking_id: str | None = None,
) -> dict:
    return {
        "users": [{"id": "u", "role": "admin", "permissions": _FULL_PERMS}],
        "properties": [
            {"id": "p1", "tenant_id": "t1", "title": "Apartment 1"},
            {"id": "p2", "tenant_id": "t1", "title": "Apartment 2"},
        ],
        "reservations": [
            {
                "id": RID, "tenant_id": "t1", "property_id": "p1", "guest_id": "g1",
                "channel": "booking", "check_in": check_in, "check_out": check_out,
                "status": status, "total_amount": 200, "currency": "EUR",
                "ota_name": "Booking.com", "guests": {"name": "Anna"},
                "checked_in_at": checked_in_at, "checked_out_at": None,
                "source_channex_booking_id": source_channex_booking_id,
            }
        ],
        "availability": [
            {"property_id": "p1", "date": "2026-07-01", "status": "booked",
             "source": "booking"},
            {"property_id": "p1", "date": "2026-07-02", "status": "booked",
             "source": "booking"},
        ],
    }


def test_move_to_other_property_and_dates() -> None:
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    out = svc.move(
        AuthContext(user_id="u", tenant_id="t1", role="admin"),
        RID,
        ReservationMove(
            property_id="p2", check_in=date(2026, 7, 10), check_out=date(2026, 7, 12)
        ),
    )
    assert out.property_id == "p2"
    assert str(out.check_in) == "2026-07-10"
    # Alte Tage freigegeben, neue belegt.
    avail = {(a["property_id"], a["date"]): a["status"] for a in store["availability"]}
    assert avail[("p1", "2026-07-01")] == "open"
    assert avail[("p2", "2026-07-10")] == "booked"


def test_move_zieht_genehmigten_sperrantrag_mit() -> None:
    """Ein Eigentümer-Aufenthalt aus genehmigtem Antrag (0353) wird verlängert:
    der Antrag MUSS den neuen Zeitraum tragen. Bliebe er auf dem alten, gäbe
    sein Widerruf die falschen Nächte frei (Wurzel 1)."""
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    store["reservations"][0].update({
        "is_owner_stay": True, "block_request_id": "ba-1", "channel": "direct",
    })
    store["block_requests"] = [{
        "id": "ba-1", "tenant_id": "t1", "property_id": "p1",
        "start_date": "2026-07-01", "end_date": "2026-07-02",
        "status": "approved",
    }]
    svc = _move_db(store)
    svc.move(
        AuthContext(user_id="u", tenant_id="t1", role="admin"),
        RID,
        ReservationMove(
            property_id="p1", check_in=date(2026, 7, 1), check_out=date(2026, 7, 6)
        ),
    )
    antrag = store["block_requests"][0]
    assert antrag["start_date"] == "2026-07-01"
    # end_date ist INKLUSIV (letzte Nacht) — check_out 06. → 05.
    assert antrag["end_date"] == "2026-07-05"


def test_move_ohne_antragsbezug_laesst_antraege_unberuehrt() -> None:
    """Gegenprobe: eine gewöhnliche Buchung ohne block_request_id fasst keinen
    Antrag an — auch nicht einen fremden im selben Zeitraum."""
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    store["block_requests"] = [{
        "id": "ba-fremd", "tenant_id": "t1", "property_id": "p1",
        "start_date": "2026-07-01", "end_date": "2026-07-02",
        "status": "approved",
    }]
    svc = _move_db(store)
    svc.move(
        AuthContext(user_id="u", tenant_id="t1", role="admin"),
        RID,
        ReservationMove(
            property_id="p1", check_in=date(2026, 7, 1), check_out=date(2026, 7, 6)
        ),
    )
    assert store["block_requests"][0]["end_date"] == "2026-07-02"


def test_move_zieht_nur_genehmigte_antraege_mit() -> None:
    """Ein abgelehnter/widerrufener Antrag (status='rejected') beschreibt keine
    gültige Sperre mehr und darf nicht nachgezogen werden."""
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    store["reservations"][0].update({
        "is_owner_stay": True, "block_request_id": "ba-1", "channel": "direct",
    })
    store["block_requests"] = [{
        "id": "ba-1", "tenant_id": "t1", "property_id": "p1",
        "start_date": "2026-07-01", "end_date": "2026-07-02",
        "status": "rejected",
    }]
    svc = _move_db(store)
    svc.move(
        AuthContext(user_id="u", tenant_id="t1", role="admin"),
        RID,
        ReservationMove(
            property_id="p1", check_in=date(2026, 7, 1), check_out=date(2026, 7, 6)
        ),
    )
    assert store["block_requests"][0]["end_date"] == "2026-07-02"


def test_resize_in_place_ignores_own_days() -> None:
    # Verlängern am selben Objekt: die eigenen belegten Tage zählen NICHT als
    # Konflikt; ein zusätzlicher freier Tag wird belegt.
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    out = svc.move(
        AuthContext(user_id="u", tenant_id="t1", role="admin"),
        RID,
        ReservationMove(
            property_id="p1", check_in=date(2026, 7, 1), check_out=date(2026, 7, 4)
        ),
    )
    assert str(out.check_out) == "2026-07-04"
    avail = {(a["property_id"], a["date"]): a["status"] for a in store["availability"]}
    assert avail[("p1", "2026-07-03")] == "booked"


def test_move_rejects_conflict_with_foreign_booking() -> None:
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    # Fremdbelegung am Zielobjekt p2.
    store["availability"].append(
        {"property_id": "p2", "date": "2026-07-10", "status": "booked",
         "source": "airbnb"}
    )
    svc = _move_db(store)
    with pytest.raises(ReservationError) as exc:
        svc.move(
            AuthContext(user_id="u", tenant_id="t1", role="admin"),
            RID,
            ReservationMove(
                property_id="p2", check_in=date(2026, 7, 10),
                check_out=date(2026, 7, 12),
            ),
        )
    assert exc.value.status_code == 409


def test_move_rejects_cancelled() -> None:
    store = _move_store(
        check_in="2026-07-01", check_out="2026-07-03", status="cancelled"
    )
    svc = _move_db(store)
    with pytest.raises(ReservationError) as exc:
        svc.move(
            AuthContext(user_id="u", tenant_id="t1", role="admin"),
            RID,
            ReservationMove(
                property_id="p1", check_in=date(2026, 7, 5), check_out=date(2026, 7, 7)
            ),
        )
    assert exc.value.status_code == 409


def test_move_rejects_checked_in_reservation() -> None:
    """Ein eingecheckter (physisch anwesender) Gast darf nicht verschoben werden —
    sonst würden die belegten Nächte freigegeben und als availability=1 an die OTAs
    gepusht, obwohl der Gast noch im Zimmer ist (Überbuchungsgefahr)."""
    store = _move_store(
        check_in="2026-07-01", check_out="2026-07-03",
        checked_in_at="2026-07-01T14:00:00+00:00",
    )
    svc = _move_db(store)
    with pytest.raises(ReservationError) as exc:
        svc.move(
            AuthContext(user_id="u", tenant_id="t1", role="admin"),
            RID,
            ReservationMove(
                property_id="p2", check_in=date(2026, 7, 10),
                check_out=date(2026, 7, 12),
            ),
        )
    assert exc.value.status_code == 409
    assert "eingecheckt" in exc.value.message
    # Alt-Objekt bleibt belegt (kein Freigabe-Push).
    avail = {(a["property_id"], a["date"]): a["status"] for a in store["availability"]}
    assert avail[("p1", "2026-07-01")] == "booked"


def test_move_rejects_ota_booking() -> None:
    """Eine OTA-importierte Buchung (source_channex_booking_id gesetzt) darf lokal
    nicht verschoben werden — der Move würde die Alt-Nächte freigeben und als
    availability=1 an das Portal pushen, obwohl der Gast dort weiter gebucht ist."""
    store = _move_store(
        check_in="2026-07-01", check_out="2026-07-03",
        source_channex_booking_id="OTA-77",
    )
    svc = _move_db(store)
    with pytest.raises(ReservationError) as exc:
        svc.move(
            AuthContext(user_id="u", tenant_id="t1", role="admin"),
            RID,
            ReservationMove(
                property_id="p2", check_in=date(2026, 7, 10),
                check_out=date(2026, 7, 12),
            ),
        )
    assert exc.value.status_code == 409
    assert "OTA" in exc.value.message
    avail = {(a["property_id"], a["date"]): a["status"] for a in store["availability"]}
    assert avail[("p1", "2026-07-01")] == "booked"


def test_move_unknown_reservation_404() -> None:
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    with pytest.raises(ReservationError) as exc:
        svc.move(
            AuthContext(user_id="u", tenant_id="t1", role="admin"),
            "does-not-exist",
            ReservationMove(
                property_id="p1", check_in=date(2026, 7, 5), check_out=date(2026, 7, 7)
            ),
        )
    assert exc.value.status_code == 404


def test_move_without_reprice_keeps_price() -> None:
    # protel-Modell: ohne reprice bleibt der vereinbarte Preis unverändert
    # (kostenloses Upgrade / bindender Preis). total_amount aus dem Store: 200.
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    svc._quote = MagicMock(name="_quote")  # darf NICHT aufgerufen werden
    out = svc.move(
        AuthContext(user_id="u", tenant_id="t1", role="admin"),
        RID,
        ReservationMove(
            property_id="p2", check_in=date(2026, 7, 10), check_out=date(2026, 7, 12)
        ),
    )
    assert out.property_id == "p2"
    svc._quote.assert_not_called()
    moved = next(r for r in store["reservations"] if r["id"] == RID)
    assert moved["total_amount"] == 200  # unverändert


def test_move_with_reprice_recomputes_price() -> None:
    # Upsell: reprice=True → Preis fürs Ziel-Objekt neu quoten. tax_rate=None
    # bleibt (Beherbergungssatz erbt später das Ziel-Objekt-Land, EU-27).
    from src.features.pricing.schemas import QuoteLine, QuoteResponse

    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    svc._quote = MagicMock(
        name="_quote",
        return_value=QuoteResponse(
            property_id="p2",
            check_in=date(2026, 7, 10),
            check_out=date(2026, 7, 12),
            nights=2,
            guests=1,
            channel="booking",
            currency="EUR",
            nightly_total=450.0,
            total=450.0,
            lines=[QuoteLine(label="Übernachtung (2 Nächte)", amount=450.0, kind=None)],
        ),
    )
    out = svc.move(
        AuthContext(user_id="u", tenant_id="t1", role="admin"),
        RID,
        ReservationMove(
            property_id="p2", check_in=date(2026, 7, 10), check_out=date(2026, 7, 12),
            reprice=True,
        ),
    )
    assert out.property_id == "p2"
    svc._quote.assert_called_once()
    moved = next(r for r in store["reservations"] if r["id"] == RID)
    assert moved["total_amount"] == 450.0
    assert moved["quote_items"][0]["tax_rate"] is None  # erbt Landessatz


# --- detail: vollständige Detailansicht + Maskierung -------------------------

def test_detail_admin_sees_full_amounts_and_quote() -> None:
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    store["reservations"][0].update({
        "total_amount": 400, "paid_amount": 100,
        "quote_items": [
            {"label": "Room rate", "amount": 300},
            {"label": "Reinigung", "amount": 100},
        ],
        "num_guests": 4, "adults": 4, "guest_email": "a@x.de",
        "checkin_time": "16:00", "checkout_time": "10:00",
    })
    svc = _move_db(store)
    d = svc.detail(AuthContext(user_id="u", tenant_id="t1", role="admin"), RID)
    assert d.nights == 2
    assert d.num_guests == 4
    assert d.total_amount == 400
    assert d.due_amount == 300  # total - paid
    assert [q.label for q in d.quote_items] == ["Room rate", "Reinigung"]
    assert d.guest_email == "a@x.de"
    assert d.checkin_time == "16:00"


def test_detail_masks_amounts_and_contact_without_permission() -> None:
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    store["users"] = [{"id": "u", "role": "cleaner", "permissions": _NO_PERMS}]
    store["reservations"][0].update({
        "total_amount": 400, "paid_amount": 100,
        "quote_items": [{"label": "Room rate", "amount": 300}],
        "guest_email": "a@x.de",
    })
    svc = _move_db(store)
    d = svc.detail(AuthContext(user_id="u", tenant_id="t1", role=None), RID)
    assert d.total_amount is None
    assert d.due_amount is None
    assert d.quote_items == []
    assert d.guest_email is None


def test_detail_unknown_404() -> None:
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    with pytest.raises(ReservationError) as exc:
        svc.detail(AuthContext(user_id="u", tenant_id="t1", role="admin"), "nope")
    assert exc.value.status_code == 404


# --- Storno (mit Pflicht-Begründung + Audit) ---------------------------------

_CANCEL_CTX = AuthContext(user_id="u", tenant_id="t1", role="admin")


def test_cancel_sets_status_frees_days_and_audits() -> None:
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    out = svc.cancel(_CANCEL_CTX, RID, "Gast hat abgesagt", partei=CancelParty.betrieb)
    assert out.status == "cancelled"
    # Reservierungs-Storno-Felder gesetzt.
    r = next(x for x in store["reservations"] if x["id"] == RID)
    assert r["status"] == "cancelled"
    assert r["cancel_reason"] == "Gast hat abgesagt"
    assert r["cancelled_by"] == "u"
    assert r["cancelled_at"]
    # Belegte Tage freigegeben.
    avail = {(a["property_id"], a["date"]): a["status"] for a in store["availability"]}
    assert avail[("p1", "2026-07-01")] == "open"
    assert avail[("p1", "2026-07-02")] == "open"
    # Audit-Zeile geschrieben (mit Kanal/OTA dokumentiert).
    log_rows = store.get("reservation_cancellation_log", [])
    assert len(log_rows) == 1
    assert log_rows[0]["reason"] == "Gast hat abgesagt"
    assert log_rows[0]["by_user_id"] == "u"
    assert log_rows[0]["channel"] == "booking"
    assert log_rows[0]["ota_name"] == "Booking.com"


def test_cancel_rejects_ota_booking() -> None:
    """Eine OTA-importierte Buchung (source_channex_booking_id) darf lokal NICHT
    storniert werden — der lokale Storno würde die vom Portal gehaltenen Nächte
    freigeben und availability=1 pushen (Überbuchung). Storno läuft übers Portal."""
    store = _move_store(
        check_in="2026-07-01", check_out="2026-07-03",
        source_channex_booking_id="OTA-99",
    )
    svc = _move_db(store)
    with pytest.raises(ReservationError) as exc:
        svc.cancel(_CANCEL_CTX, RID, "Gast hat abgesagt", partei=CancelParty.betrieb)
    assert exc.value.status_code == 409
    assert "OTA" in exc.value.message
    # Nichts freigegeben — Tage bleiben belegt.
    avail = {(a["property_id"], a["date"]): a["status"] for a in store["availability"]}
    assert avail[("p1", "2026-07-01")] == "booked"


def test_cancel_requires_reason() -> None:
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    with pytest.raises(ReservationError) as exc:
        svc.cancel(_CANCEL_CTX, RID, "   ", partei=CancelParty.betrieb)
    assert exc.value.status_code == 422
    # Nichts storniert, keine Audit-Zeile.
    assert store["reservations"][0]["status"] == "confirmed"
    assert not store.get("reservation_cancellation_log")


def test_cancel_already_cancelled_409() -> None:
    store = _move_store(
        check_in="2026-07-01", check_out="2026-07-03", status="cancelled"
    )
    svc = _move_db(store)
    with pytest.raises(ReservationError) as exc:
        svc.cancel(_CANCEL_CTX, RID, "nochmal", partei=CancelParty.betrieb)
    assert exc.value.status_code == 409


def test_cancel_unknown_404() -> None:
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    with pytest.raises(ReservationError) as exc:
        svc.cancel(_CANCEL_CTX, "nope", "Grund", partei=CancelParty.betrieb)
    assert exc.value.status_code == 404


def test_cancel_direct_booking_also_frees_days() -> None:
    # Direktbuchung (eigene Plattform/Wizard): channel=direct, kein OTA.
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    store["reservations"][0]["channel"] = "direct"
    store["reservations"][0]["ota_name"] = None
    for a in store["availability"]:
        a["source"] = "direct"
    svc = _move_db(store)
    out = svc.cancel(_CANCEL_CTX, RID, "Storno Direktbuchung", partei=CancelParty.betrieb)
    assert out.status == "cancelled"
    log_rows = store.get("reservation_cancellation_log", [])
    assert log_rows[0]["channel"] == "direct"
    assert log_rows[0]["ota_name"] is None


def test_cancel_nach_checkin_haelt_verbrauchte_naechte_belegt() -> None:
    """Abbruch mitten im Aufenthalt: der Storno gelingt, gibt aber NUR die
    künftigen Nächte frei. Verbrauchte und die laufende Nacht bleiben belegt —
    sonst verkauft das Portal die Nacht, in der der Gast noch im Zimmer liegt."""
    heute = date.today()
    store = _move_store(
        check_in=(heute - timedelta(days=3)).isoformat(),
        check_out=(heute + timedelta(days=2)).isoformat(),
        checked_in_at=(heute - timedelta(days=3)).isoformat() + "T15:00:00Z",
    )
    store["availability"] = [
        {"property_id": "p1", "unit_id": "unit-1",
         "date": (heute + off).isoformat(), "status": "booked", "source": "booking"}
        for off in (
            timedelta(days=-3), timedelta(days=-2), timedelta(days=-1),
            timedelta(0), timedelta(days=1),
        )
    ]
    store["reservations"][0]["unit_id"] = "unit-1"
    svc = _move_db(store)
    out = svc.cancel(_CANCEL_CTX, RID, "Gast bricht ab", partei=CancelParty.betrieb)
    assert out.status == "cancelled"
    avail = {a["date"]: a["status"] for a in store["availability"]}
    # Verbrauchte Nächte und die laufende bleiben belegt.
    for off in (-3, -2, -1, 0):
        tag = (heute + timedelta(days=off)).isoformat()
        assert avail[tag] == "booked", f"{tag} darf nicht freigegeben werden"
    # Erst ab morgen ist das Zimmer wieder verkäuflich.
    assert avail[(heute + timedelta(days=1)).isoformat()] == "open"


def test_cancel_ohne_einheit_bei_mehreren_einheiten_gibt_nichts_frei() -> None:
    """Fehlt `unit_id` und hat das Objekt mehrere Einheiten, darf der Storno
    NICHTS öffnen: objektweites Freigeben würde die Sperren der übrigen
    Einheiten mitreißen (fremde Buchungen verlören ihren Kalendereintrag)."""
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    store["reservations"][0]["unit_id"] = None
    store["property_units"] = [
        {"id": "unit-1", "tenant_id": "t1", "property_id": "p1"},
        {"id": "unit-2", "tenant_id": "t1", "property_id": "p1"},
    ]
    # Einheit 2 ist von einer FREMDEN Buchung belegt.
    store["availability"] = [
        {"property_id": "p1", "unit_id": "unit-1", "date": "2026-07-01",
         "status": "booked", "source": "booking"},
        {"property_id": "p1", "unit_id": "unit-2", "date": "2026-07-01",
         "status": "booked", "source": "booking"},
    ]
    svc = _move_db(store)
    out = svc.cancel(_CANCEL_CTX, RID, "Storno ohne Einheit", partei=CancelParty.betrieb)
    assert out.status == "cancelled"
    avail = {(a["unit_id"], a["date"]): a["status"] for a in store["availability"]}
    assert avail[("unit-2", "2026-07-01")] == "booked"  # fremde Sperre unberührt
    assert avail[("unit-1", "2026-07-01")] == "booked"  # fail-closed: nichts geöffnet


def test_cancel_ohne_einheit_bei_einer_einheit_gibt_frei() -> None:
    """Gegenprobe: bei genau EINER Einheit ist die Zuordnung eindeutig — der
    Storno gibt frei wie bisher (kein Rückschritt für FeWo-Bestand)."""
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    store["reservations"][0]["unit_id"] = None
    store["property_units"] = [
        {"id": "unit-1", "tenant_id": "t1", "property_id": "p1"},
    ]
    store["availability"] = [
        {"property_id": "p1", "unit_id": "unit-1", "date": "2026-07-01",
         "status": "booked", "source": "booking"},
        {"property_id": "p1", "unit_id": "unit-1", "date": "2026-07-02",
         "status": "booked", "source": "booking"},
    ]
    svc = _move_db(store)
    svc.cancel(_CANCEL_CTX, RID, "Storno FeWo", partei=CancelParty.betrieb)
    avail = {a["date"]: a["status"] for a in store["availability"]}
    assert avail["2026-07-01"] == "open"
    assert avail["2026-07-02"] == "open"


def test_cancel_owner_fremdes_objekt_404() -> None:
    """Wurzel 9: der Storno prüft denselben Owner-Scope wie der Lesepfad —
    ein Eigentümer darf eine Buchung an einem fremden Objekt nicht stornieren."""
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    store["users"] = [{"id": "own", "role": "owner", "permissions": _FULL_PERMS}]
    # Der Eigentümer hängt an p2, die Buchung liegt auf p1.
    store["owners"] = [{"id": "own-1", "tenant_id": "t1", "user_id": "own"}]
    store["owner_properties"] = [{"owner_id": "own-1", "property_id": "p2"}]
    svc = _move_db(store)
    with pytest.raises(ReservationError) as exc:
        svc.cancel(
            AuthContext(user_id="own", tenant_id="t1", role="owner"),
            RID, "Fremder Storno", partei=CancelParty.eigentuemer,
        )
    assert exc.value.status_code == 404
    assert store["reservations"][0]["status"] == "confirmed"
    avail = {(a["property_id"], a["date"]): a["status"] for a in store["availability"]}
    assert avail[("p1", "2026-07-01")] == "booked"


# --- Service: atomare Buchung (RPC 0104) --------------------------------------

def _rpc_service(monkeypatch) -> tuple[ReservationsService, MagicMock]:  # noqa: ANN001
    """create() bis zur atomaren RPC durchlaufen lassen: Pre-Checks frei
    (Property gefunden, Kalender offen, kein Stop-Sell), Gast/Quote gemockt."""
    from types import SimpleNamespace

    service = _service_for_create(property_found=True, taken_days=[], stopped_days=[])
    db = service._client  # noqa: SLF001 — Test greift auf den Mock zu
    # Jede Reservierung MUSS einen Gast tragen (Kontakt-Pflicht) — der RPC-Test
    # fokussiert die atomare Buchung, daher liefert der Gast-Mock eine feste ID.
    monkeypatch.setattr(service, "_upsert_guest", lambda *_a, **_k: "g-1")
    quote = SimpleNamespace(total=300.0, currency="CHF", lines=[])
    monkeypatch.setattr(service, "_quote", lambda *_a, **_k: quote)
    mask = MagicMock()
    mask.name.side_effect = lambda v: v or ""
    mask.amount.side_effect = lambda v: v
    mask.amounts = True
    mask.source_value.side_effect = lambda v: v
    # create() lebt im Schreibpfad (writes.py) — dort löst der Name
    # load_guest_mask auf, also dort patchen, damit die Maske greift.
    monkeypatch.setattr(
        "src.features.reservations.writes.load_guest_mask", lambda *_a: mask
    )
    return service, db


def test_create_books_atomically_via_rpc(monkeypatch) -> None:  # noqa: ANN001
    """Reservierung + Kalender + ari_outbox entstehen über create_reservation_atomic
    (eine Transaktion); die Outbox-Zeile wandert als outbox_id in den Push-Job."""
    service, db = _rpc_service(monkeypatch)
    row = {
        "id": "r-1", "property_id": "p1", "guest_id": None, "channel": "direct",
        "check_in": "2026-05-01", "check_out": "2026-05-03", "status": "confirmed",
        "total_amount": 300.0, "currency": "CHF", "ota_name": None,
        "external_ref": None,
    }
    db.rpc.return_value.execute.return_value.data = {
        "reservation": row, "outbox_id": "ob-1",
    }
    req = ReservationCreate(
        property_id="p1", check_in=date(2026, 5, 1), check_out=date(2026, 5, 3),
    )
    resp = service.create(AuthContext(user_id="u1", tenant_id="t1"), req)
    assert resp.id == "r-1"
    assert resp.currency == "CHF"

    atomic_calls = [
        c for c in db.rpc.call_args_list if c.args[0] == "create_reservation_atomic"
    ]
    assert len(atomic_calls) == 1
    params = atomic_calls[0].args[1]
    assert params["p_with_outbox"] is True
    assert params["p_reservation"]["property_id"] == "p1"
    assert params["p_reservation"]["tenant_id"] == "t1"

    # Der ARI-Push-Job trägt die atomar persistierte Outbox-Zeile.
    enqueue_calls = [c for c in db.rpc.call_args_list if c.args[0] == "enqueue_job"]
    ari = [c for c in enqueue_calls if c.args[1]["p_job_type"] == "push_ari"]
    assert ari and ari[0].args[1]["p_payload"]["outbox_id"] == "ob-1"


def test_create_maps_rpc_conflict_to_409(monkeypatch) -> None:  # noqa: ANN001
    """Verliert der Request das Buchungs-Race (RS409 aus der RPC), antwortet der
    Service mit 409 statt 500 — die Transaktion hat nichts geschrieben."""
    from postgrest.exceptions import APIError

    service, db = _rpc_service(monkeypatch)
    db.rpc.return_value.execute.side_effect = APIError({
        "message": "Zeitraum enthält bereits belegte/gesperrte Tage.",
        "code": "RS409", "hint": None, "details": None,
    })
    req = ReservationCreate(
        property_id="p1", check_in=date(2026, 5, 1), check_out=date(2026, 5, 3),
    )
    with pytest.raises(ReservationError) as exc:
        service.create(AuthContext(user_id="u1", tenant_id="t1"), req)
    assert exc.value.status_code == 409


def test_create_requires_guest_contact(monkeypatch) -> None:  # noqa: ANN001
    """Eine Reservierung OHNE jeden Kontakt (kein Name/E-Mail/Telefon) wird mit
    422 abgelehnt — jede Buchung MUSS einen Gast tragen (Branchenstandard). Zum
    Sperren ohne Gast dient der Sperrzeitraum, nicht die Reservierung."""
    service = _service_for_create(property_found=True, taken_days=[], stopped_days=[])
    # Kontakt leer → der Resolver liefert None (kein Merkmal).
    monkeypatch.setattr(service, "_upsert_guest", lambda *_a, **_k: None)
    req = ReservationCreate(
        property_id="p1", check_in=date(2026, 5, 1), check_out=date(2026, 5, 3),
    )
    with pytest.raises(ReservationError) as exc:
        service.create(AuthContext(user_id="u1", tenant_id="t1"), req)
    assert exc.value.status_code == 422
    assert "Gast" in exc.value.message


# --- Eigentümer-Aufenthalt (0241 + 0353) -------------------------------------

def _owner_stay_service(monkeypatch, **kw) -> tuple[ReservationsService, MagicMock]:  # noqa: ANN001, ANN003
    """Wie `_rpc_service`, aber ohne Gast-Mock: der Eigentümer-Aufenthalt soll
    genau OHNE Gast durchlaufen. Der Kontakt bleibt leer, der echte Resolver
    würde also None liefern — und darf gar nicht erst gefragt werden."""
    from types import SimpleNamespace

    service = _service_for_create(
        property_found=True, taken_days=[], stopped_days=[], **kw
    )
    db = service._client  # noqa: SLF001 — Test greift auf den Mock zu
    gefragt: list[bool] = []
    monkeypatch.setattr(
        service,
        "_upsert_guest",
        lambda *_a, **_k: (gefragt.append(True), None)[1],
    )
    quote = SimpleNamespace(total=300.0, currency="CHF", lines=[])
    monkeypatch.setattr(service, "_quote", lambda *_a, **_k: quote)
    mask = MagicMock()
    mask.name.side_effect = lambda v: v or ""
    mask.amount.side_effect = lambda v: v
    mask.amounts = True
    mask.source_value.side_effect = lambda v: v
    monkeypatch.setattr(
        "src.features.reservations.writes.load_guest_mask", lambda *_a: mask
    )
    service._gast_gefragt = gefragt  # type: ignore[attr-defined]  # noqa: SLF001
    return service, db


def _rpc_row(db: MagicMock) -> dict:
    row = {
        "id": "r-1", "property_id": "p1", "guest_id": None, "channel": "direct",
        "check_in": "2026-05-01", "check_out": "2026-05-03",
        "status": "confirmed", "total_amount": 0.0, "currency": "CHF",
        "ota_name": None, "external_ref": None,
    }
    db.rpc.return_value.execute.return_value.data = {
        "reservation": row, "outbox_id": None,
    }
    return row


def _atomic_params(db: MagicMock) -> dict:
    calls = [
        c for c in db.rpc.call_args_list if c.args[0] == "create_reservation_atomic"
    ]
    assert len(calls) == 1
    return calls[0].args[1]["p_reservation"]


def test_owner_stay_ohne_gast_traegt_den_eigentuemer(monkeypatch) -> None:  # noqa: ANN001
    """DER KERN VON 0353: der „Gast" eines Eigentümer-Aufenthalts ist der
    EIGENTÜMER — als `owner_id` an `owners`, nicht als Freitext in `guests`.

    Eine Gast-Zeile für den Eigentümer verfälschte Loyalty-Aggregate
    (Aufenthalte/Umsatz je Gast), Gästekartei und Marketing-Segmente. Der
    Gast-Zwang bleibt für jede gewöhnliche Buchung bestehen; hier erfüllt ihn
    der Eigentümer-Bezug.
    """
    service, db = _owner_stay_service(
        monkeypatch, owner_links=[{"owner_id": "own-1"}]
    )
    _rpc_row(db)
    req = ReservationCreate(
        property_id="p1", check_in=date(2026, 5, 1), check_out=date(2026, 5, 3),
        is_owner_stay=True, owner_id="own-1",
    )
    service.create(AuthContext(user_id="u1", tenant_id="t1"), req)
    row = _atomic_params(db)
    assert row["owner_id"] == "own-1"
    assert row["is_owner_stay"] is True
    assert row["guest_id"] is None
    assert row["total_amount"] == 0
    # Der Gast-Resolver wurde gar nicht erst gefragt — sonst entstünde neben
    # dem Eigentümer noch eine Gast-Zeile aus dem vorbefüllten Formular.
    assert service._gast_gefragt == []  # noqa: SLF001


def test_owner_stay_ohne_eigentuemer_bleibt_beim_gast_zwang(monkeypatch) -> None:  # noqa: ANN001
    """Ohne BEIDES — kein Gast, kein Eigentümer — bleibt es beim 422. Der
    Personenbezug ist nicht optional geworden, er hat nur eine zweite Form."""
    service = _service_for_create(
        property_found=True, taken_days=[], stopped_days=[]
    )
    monkeypatch.setattr(service, "_upsert_guest", lambda *_a, **_k: None)
    req = ReservationCreate(
        property_id="p1", check_in=date(2026, 5, 1), check_out=date(2026, 5, 3),
        is_owner_stay=True,
    )
    with pytest.raises(ReservationError) as exc:
        service.create(AuthContext(user_id="u1", tenant_id="t1"), req)
    assert exc.value.status_code == 422


def test_fremder_eigentuemer_wird_abgelehnt(monkeypatch) -> None:  # noqa: ANN001
    """Wurzel 3: eine `owner_id` aus dem Request ist ungeprüft nichts wert.

    Gehört der Eigentümer nicht zu DIESEM Objekt, ist die Zeile nicht bloß
    falsch — „Eigennutzung" schließt Umsatz aus (0241) und erschiene in der
    Abrechnung des Falschen. Fail-closed statt den Wert still zu verwerfen.
    """
    service, db = _owner_stay_service(monkeypatch, owner_links=[])
    _rpc_row(db)
    req = ReservationCreate(
        property_id="p1", check_in=date(2026, 5, 1), check_out=date(2026, 5, 3),
        is_owner_stay=True, owner_id="own-fremd",
    )
    with pytest.raises(ReservationError) as exc:
        service.create(AuthContext(user_id="u1", tenant_id="t1"), req)
    assert exc.value.status_code == 422
    assert "Eigentümer" in exc.value.message


def test_owner_id_ohne_owner_stay_ist_ungueltig() -> None:
    """Ein Eigentümer an einer GAST-Buchung wäre eine stille Falschaussage:
    die Zeile zählte als Umsatz UND erschiene als Eigennutzung."""
    with pytest.raises(ValueError, match="owner_id"):
        ReservationCreate(
            property_id="p1", check_in=date(2026, 5, 1),
            check_out=date(2026, 5, 3), owner_id="own-1",
        )


def test_stay_name_ohne_owner_stay_ist_ungueltig() -> None:
    """Bei einer Gastbuchung steht der Name am GAST (`contact`).

    Ein zweites Namensfeld daneben ergäbe zwei Wahrheiten über dieselbe
    Person — welche zeigt der Kalenderbalken dann?
    """
    with pytest.raises(ValueError, match="stay_name"):
        ReservationCreate(
            property_id="p1", check_in=date(2026, 5, 1),
            check_out=date(2026, 5, 3), stay_name="Tochter Lisa",
        )


def test_anzeigename_bevorzugt_die_benannte_person() -> None:
    """Eine Eigennutzung ist NICHT zwangsläufig der Eigentümer selbst.

    Er sperrt den Zeitraum genauso für seine Kinder, für Freunde oder für
    Handwerker. `owner_id` bleibt der vertragliche Bezug, `stay_name` ist die
    anwesende Person — und die gehört auf den Balken. Vorher zeigte JEDE
    Eigennutzung dasselbe „Eigentümer-Aufenthalt" (live gesehen am 10.08.2026,
    FeWo *Stjerneskud*).
    """
    zeile = {
        "is_owner_stay": True,
        "stay_name": "Tochter Lisa",
        "owners": {"name": "Andy Staudinger"},
    }
    assert anzeigename(zeile) == "Tochter Lisa"


def test_anzeigename_faellt_auf_den_eigentuemer_zurueck() -> None:
    """Ohne benannte Person ist der Eigentümer die beste bekannte Aussage.

    Der Assistent legt bei einer Eigennutzung bewusst KEINEN Gast-Kontakt an
    (das erzeugte eine Dublette in der Gästekartei), also bleibt `guests.name`
    leer — der Name muss aus `owners` kommen.
    """
    zeile = {"is_owner_stay": True, "owners": {"name": "Andy Staudinger"}}
    assert anzeigename(zeile) == "Andy Staudinger"


def test_anzeigename_erfindet_nichts() -> None:
    """Wurzel 4: ohne Person bleibt es leer, nie ein Platzhalter.

    Der Balken zeigt dann sein Status-Label („Eigentümer-Aufenthalt") — das
    ist eine Aussage über die ART, nicht über eine erfundene Person.
    """
    assert anzeigename({"is_owner_stay": True}) == ""


def test_anzeigename_laesst_die_gastbuchung_unberuehrt() -> None:
    """Die Gegenprobe: eine normale Buchung nimmt weiter den Gast — auch wenn
    zufällig ein Eigentümer am selben Objekt hängt."""
    zeile = {
        "is_owner_stay": False,
        "guests": {"name": "Marian van Sloten"},
        "owners": {"name": "Andy Staudinger"},
    }
    assert anzeigename(zeile) == "Marian van Sloten"


def test_block_request_id_landet_an_der_reservierung(monkeypatch) -> None:  # noqa: ANN001
    """Wurzel 1: der Anker, an dem der Widerruf der Genehmigung GENAU diese
    Belegung wiederfindet — statt über (Objekt, Zeitraum) zu raten und eine
    zweite Eigennutzung mitzustornieren."""
    service, db = _owner_stay_service(
        monkeypatch, owner_links=[{"owner_id": "own-1"}]
    )
    _rpc_row(db)
    req = ReservationCreate(
        property_id="p1", check_in=date(2026, 5, 1), check_out=date(2026, 5, 3),
        is_owner_stay=True, owner_id="own-1",
    )
    service.create(
        AuthContext(user_id="u1", tenant_id="t1"), req, block_request_id="ba-1"
    )
    assert _atomic_params(db)["block_request_id"] == "ba-1"


def test_vorgegebene_einheit_geht_an_die_rpc(monkeypatch) -> None:  # noqa: ANN001
    """Stufe 3: die im Antrag benannte Einheit muss bis zur RPC durchkommen —
    sonst wählt sie irgendeine freie und der Eigentümer bekommt ein anderes
    Studio als beantragt."""
    service, db = _owner_stay_service(
        monkeypatch,
        owner_links=[{"owner_id": "own-1"}],
        units=[{"id": "u2"}],
    )
    _rpc_row(db)
    req = ReservationCreate(
        property_id="p1", check_in=date(2026, 5, 1), check_out=date(2026, 5, 3),
        is_owner_stay=True, owner_id="own-1", unit_id="u2",
    )
    service.create(AuthContext(user_id="u1", tenant_id="t1"), req)
    assert _atomic_params(db)["unit_id"] == "u2"


def test_fremde_einheit_wird_abgelehnt(monkeypatch) -> None:  # noqa: ANN001
    """Wurzel 3, zweite Achse: eine `unit_id`, die nicht zu Objekt+Mandant
    gehört, würde sonst eine fremde Einheit belegen."""
    service, db = _owner_stay_service(
        monkeypatch, owner_links=[{"owner_id": "own-1"}], units=[]
    )
    _rpc_row(db)
    req = ReservationCreate(
        property_id="p1", check_in=date(2026, 5, 1), check_out=date(2026, 5, 3),
        is_owner_stay=True, owner_id="own-1", unit_id="u-fremd",
    )
    with pytest.raises(ReservationError) as exc:
        service.create(AuthContext(user_id="u1", tenant_id="t1"), req)
    assert exc.value.status_code == 422
    assert "Einheit" in exc.value.message


def test_map_booking_conflict_codes() -> None:
    """RS409 (RPC-Konflikt) und 23P01 (EXCLUDE-Backstop) → 409; Rest unverändert."""
    from postgrest.exceptions import APIError

    from src.features.reservations.service import _map_booking_conflict

    rs = _map_booking_conflict(APIError({
        "message": "belegt", "code": "RS409", "hint": None, "details": None,
    }))
    assert isinstance(rs, ReservationError)
    assert rs.status_code == 409

    excl = _map_booking_conflict(APIError({
        "message": "conflicting key value", "code": "23P01",
        "hint": None, "details": None,
    }))
    assert isinstance(excl, ReservationError)
    assert excl.status_code == 409

    other = APIError({
        "message": "kaputt", "code": "42P01", "hint": None, "details": None,
    })
    assert _map_booking_conflict(other) is other


def test_cancel_keeps_days_still_booked_by_ota() -> None:
    """Storniert man eine lokale Buchung, die sich mit einer OTA-Buchung
    überlappt, dürfen die überlappenden Tage NICHT freigegeben werden (sonst
    würde ein real belegter Tag an Channex als frei zurückgemeldet)."""
    store = {
        "users": [{"id": "u", "role": "admin", "permissions": _FULL_PERMS}],
        "properties": [{"id": "p1", "tenant_id": "t1", "title": "A1"}],
        "reservations": [
            # lokale Buchung (wird storniert), 01.-03.
            {"id": "22222222-2222-4222-8222-222222222222", "tenant_id": "t1",
             "property_id": "p1",
             "channel": "direct", "check_in": "2026-07-01", "check_out": "2026-07-03",
             "status": "confirmed", "total_amount": 100, "currency": "EUR"},
            # OTA-Buchung überlappt am 02., bleibt aktiv
            {"id": "33333333-3333-4333-8333-333333333333", "tenant_id": "t1",
             "property_id": "p1",
             "channel": "booking", "source_channex_booking_id": "OTA-1",
             "check_in": "2026-07-02", "check_out": "2026-07-04",
             "status": "confirmed", "total_amount": 100, "currency": "EUR"},
        ],
        "availability": [
            {"property_id": "p1", "date": "2026-07-01", "status": "booked", "source": "direct"},
            {"property_id": "p1", "date": "2026-07-02", "status": "booked", "source": "booking"},
        ],
    }
    svc = _move_db(store)
    svc.cancel(
        AuthContext(user_id="u", tenant_id="t1", role="admin"),
        "22222222-2222-4222-8222-222222222222",
        "Testgrund",
        partei=CancelParty.betrieb,
    )
    avail = {r["date"]: r["status"] for r in store["availability"]}
    # 01. wird frei (nur lokal belegt), 02. bleibt booked (OTA belegt ihn noch).
    assert avail["2026-07-01"] == "open"
    assert avail["2026-07-02"] == "booked"


# --- Zeitleiste (Ereignis-Log + synthetische Basis-Events) -------------------

def test_timeline_synthesizes_base_events_for_old_booking() -> None:
    """Altbuchung ohne echte reservation_events: die Zeitleiste leitet Basis-
    Events (created/checked_in) aus den vorhandenen Zeitstempeln ab und hängt
    Aufgaben als task_created an. Neueste zuerst."""
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    store["reservations"][0].update({
        "created_at": "2026-06-20T09:00:00+00:00",
        "checked_in_at": "2026-07-01T16:00:00+00:00",
    })
    store["tasks"] = [
        {"id": "task-1", "tenant_id": "t1", "reservation_id": RID,
         "title": "Reinigung", "created_at": "2026-06-25T08:00:00+00:00"},
    ]
    svc = _move_db(store)
    tl = svc.timeline(AuthContext(user_id="u", tenant_id="t1", role="admin"), RID)
    kinds = [e.kind for e in tl.items]
    assert "created" in kinds
    assert "checked_in" in kinds
    assert "task_created" in kinds
    # Alle synthetisch (kein echtes Event vorhanden).
    assert all(e.synthetic for e in tl.items)
    # Neueste zuerst: checked_in (Juli) vor created (Juni).
    assert tl.items[0].at > tl.items[-1].at


def test_timeline_zeigt_den_portal_chat() -> None:
    """Der Gast-Host-Verlauf steht in `portal_messages`, nicht in `messages`.

    DER VORFALL (16.08.2026): Bei einer Booking.com-Buchung zeigte die
    Zeitleiste ausschliesslich „Buchung erstellt", obwohl der Portal-Chat fuenf
    Nachrichten hatte — darunter die Anreise-Info, die morgens um 06:00:38
    nachweislich rausging. Grund: `_flow_events` las `messages` ueber
    `reservation_id`. Diese Tabelle ist live LEER (0 Zeilen); der ganze Verlauf
    liegt in `portal_messages`, verknuepft ueber `booking_ref` mit der
    CHANNEX-Buchung. Wer nach `reservation_id` filtert, filtert ins Leere.

    Geprueft wird ausserdem die Einordnung ueber `sent_at` (Wurzel 5b): eine im
    Juni im Portal geschriebene Nachricht, die erst im August bei uns eintraf,
    gehoert an ihren Juni-Platz — nicht an den Feed-Eingang.
    """
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    store["reservations"][0].update({
        "created_at": "2026-06-01T09:00:00+00:00",
        "source_channex_booking_id": "cb-1",
        "channel": "booking",
    })
    store["portal_messages"] = [
        {"id": "pm-1", "booking_ref": "cb-1", "sender": "property",
         "body": "Dear Pia, thank you for your booking",
         "sent_at": "2026-06-08T13:58:13+00:00",
         "created_at": "2026-08-15T06:47:35+00:00"},
        {"id": "pm-2", "booking_ref": "cb-1", "sender": "guest",
         "body": "I'd like to request check-in at 16:00 - 17:00. Is this ok?",
         "sent_at": "2026-06-08T13:58:52+00:00",
         "created_at": "2026-08-15T06:47:35+00:00"},
        # Fremde Buchung — darf NICHT in dieser Zeitleiste auftauchen.
        {"id": "pm-3", "booking_ref": "cb-fremd", "sender": "guest",
         "body": "gehoert woanders hin",
         "sent_at": "2026-06-09T10:00:00+00:00",
         "created_at": "2026-06-09T10:00:00+00:00"},
    ]
    svc = _move_db(store)
    tl = svc.timeline(AuthContext(user_id="u", tenant_id="t1", role="admin"), RID)
    nachrichten = [e for e in tl.items if e.kind == "message"]
    assert len(nachrichten) == 2
    absender = {e.detail.get("sender") for e in nachrichten}
    assert absender == {"property", "guest"}
    # Einordnung ueber sent_at (Juni), nicht ueber created_at (August).
    assert all(e.at.startswith("2026-06-08") for e in nachrichten)
    # DER KANAL KOMMT AUS DER BUCHUNG, nie aus einer Annahme (Wurzel 4).
    # Hier stand einmal hart "portal" — das Frontend uebersetzt das zu
    # „myBestDays", also unserem EIGENEN Marktplatz, und eine Booking.com-
    # Nachricht erschien als myBestDays (live 16.08.2026). Das ist zugleich ein
    # Bruch der Marken-Grenze: myBestDays ist der Marktplatz, Booking.com ein
    # fremdes Portal.
    assert {e.detail.get("channel") for e in nachrichten} == {"booking"}


def test_timeline_ohne_channex_buchung_keine_fremden_nachrichten() -> None:
    """Eine Direktbuchung hat keine `source_channex_booking_id`.

    Ohne den Leerlauf-Riegel wuerde der Filter auf einen leeren `booking_ref`
    laufen — im schlimmsten Fall mit fremden Zeilen als Treffer. Hier darf
    schlicht nichts kommen.
    """
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    store["portal_messages"] = [
        {"id": "pm-1", "booking_ref": "cb-fremd", "sender": "guest",
         "body": "fremd", "sent_at": "2026-06-08T13:58:13+00:00",
         "created_at": "2026-06-08T13:58:13+00:00"},
    ]
    svc = _move_db(store)
    tl = svc.timeline(AuthContext(user_id="u", tenant_id="t1", role="admin"), RID)
    assert [e for e in tl.items if e.kind == "message"] == []


def test_timeline_real_event_wins_over_synthetic() -> None:
    """Existiert ein echtes 'created'-Event, wird das synthetische NICHT zusätzlich
    erzeugt (echt gewinnt) — sonst stünde 'Buchung erstellt' doppelt."""
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    store["reservations"][0]["created_at"] = "2026-06-20T09:00:00+00:00"
    store["reservation_events"] = [
        {"id": "ev-1", "tenant_id": "t1", "reservation_id": RID, "kind": "created",
         "by_user_id": "u", "detail": {"channel": "booking"},
         "created_at": "2026-06-20T09:00:05+00:00"},
    ]
    svc = _move_db(store)
    tl = svc.timeline(AuthContext(user_id="u", tenant_id="t1", role="admin"), RID)
    created = [e for e in tl.items if e.kind == "created"]
    assert len(created) == 1
    assert created[0].synthetic is False


def test_timeline_masks_amount_detail_without_permission() -> None:
    """Ohne Betragsfreigabe darf ein repriced-Event keinen Betrag zeigen."""
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    store["users"] = [{"id": "u", "role": "cleaner", "permissions": _NO_PERMS}]
    store["reservation_events"] = [
        {"id": "ev-1", "tenant_id": "t1", "reservation_id": RID, "kind": "repriced",
         "by_user_id": "u", "detail": {"total_amount": 450.0, "currency": "EUR"},
         "created_at": "2026-06-21T09:00:00+00:00"},
    ]
    svc = _move_db(store)
    tl = svc.timeline(AuthContext(user_id="u", tenant_id="t1", role=None), RID)
    repriced = next(e for e in tl.items if e.kind == "repriced")
    assert repriced.detail["total_amount"] is None


def test_timeline_unknown_404() -> None:
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    svc = _move_db(store)
    with pytest.raises(ReservationError) as exc:
        svc.timeline(AuthContext(user_id="u", tenant_id="t1", role="admin"), "nope")
    assert exc.value.status_code == 404


def test_timeline_includes_full_flow_messages_payments_addons() -> None:
    """Die Zeitleiste zeigt den KOMPLETTEN Flow: Nachrichten, Zahlungen und
    Zusatzleistungen — nicht nur den Reservierungs-Lifecycle."""
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    store["reservations"][0]["created_at"] = "2026-06-20T09:00:00+00:00"
    store["messages"] = [
        {"id": "m1", "tenant_id": "t1", "reservation_id": RID, "sender": "guest",
         "body": "Wann ist Check-in?", "channel": "booking",
         "created_at": "2026-06-21T10:00:00+00:00"},
    ]
    store["payments"] = [
        {"id": "pay1", "tenant_id": "t1", "reservation_id": RID, "amount": 200,
         "currency": "EUR", "type": "charge", "status": "paid",
         "created_at": "2026-06-22T10:00:00+00:00"},
    ]
    store["reservation_addons"] = [
        {"id": "ad1", "tenant_id": "t1", "reservation_id": RID,
         "name": {"de": "Frühstück"}, "price": 30, "status": "paid",
         "created_at": "2026-06-23T10:00:00+00:00"},
    ]
    svc = _move_db(store)
    tl = svc.timeline(AuthContext(user_id="u", tenant_id="t1", role="admin"), RID)
    kinds = {e.kind for e in tl.items}
    assert {"message", "payment", "addon"} <= kinds
    pay = next(e for e in tl.items if e.kind == "payment")
    assert pay.detail["amount"] == 200  # Betrag sichtbar (admin)


def test_timeline_masks_flow_amounts_and_message_for_cleaner() -> None:
    """Personal/Cleaner ohne Finanz-/Kontakt-Einblick (§4.3): Zahlungsbetrag und
    Nachrichtentext werden maskiert, das Ereignis selbst bleibt sichtbar."""
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    store["users"] = [{"id": "u", "role": "cleaner", "permissions": _NO_PERMS}]
    store["messages"] = [
        {"id": "m1", "tenant_id": "t1", "reservation_id": RID, "sender": "guest",
         "body": "Geheime Nachricht", "channel": "booking",
         "created_at": "2026-06-21T10:00:00+00:00"},
    ]
    store["payments"] = [
        {"id": "pay1", "tenant_id": "t1", "reservation_id": RID, "amount": 200,
         "currency": "EUR", "type": "charge", "status": "paid",
         "created_at": "2026-06-22T10:00:00+00:00"},
    ]
    svc = _move_db(store)
    tl = svc.timeline(AuthContext(user_id="u", tenant_id="t1", role=None), RID)
    pay = next(e for e in tl.items if e.kind == "payment")
    assert pay.detail["amount"] is None
    msg = next(e for e in tl.items if e.kind == "message")
    assert msg.detail["preview"] is None  # Nachrichtentext maskiert


# --- Notiz-Verlauf je Buchung (0384) -----------------------------------------

def _notiz_store(rolle: str = "admin", perms: list[str] | None = None) -> dict:
    store = _move_store(check_in="2026-07-01", check_out="2026-07-03")
    store["users"] = [
        {"id": "u", "role": rolle,
         "permissions": _FULL_PERMS if perms is None else perms}
    ]
    return store


def test_notiz_anlegen_und_lesen() -> None:
    """Jede Notiz ist ein eigener Eintrag — anlegen überschreibt nichts."""
    svc = _move_db(_notiz_store())
    ctx = AuthContext(user_id="u", tenant_id="t1", role="admin")
    svc.add_note(ctx, RID, ReservationNoteCreate(body="Späte Anreise"))
    svc.add_note(ctx, RID, ReservationNoteCreate(body="Hund dabei", category="gast"))
    out = svc.list_notes(ctx, RID)
    assert out.total == 2
    assert {i.body for i in out.items} == {"Späte Anreise", "Hund dabei"}
    assert {i.category for i in out.items} == {None, "gast"}


def test_notiz_ohne_pm_view_notes_leer() -> None:
    """Interner Freitext über einen Gast ist nicht für jede Rolle mit
    Kalenderzugriff bestimmt: ohne PM_VIEW_NOTES bleibt die Liste leer,
    die Buchung selbst aber sichtbar."""
    store = _notiz_store(rolle="cleaner", perms=_NO_PERMS)
    store["reservation_notes"] = [
        {"id": "n1", "tenant_id": "t1", "reservation_id": RID,
         "author_id": "u", "body": "Intern", "category": None,
         "created_at": "2026-06-20T10:00:00+00:00"},
    ]
    svc = _move_db(store)
    ctx = AuthContext(user_id="u", tenant_id="t1", role=None)
    assert svc.list_notes(ctx, RID).total == 0


def test_notiz_fremde_buchung_404() -> None:
    """Wurzel 9: die Sub-Ressource prüft denselben Scope wie der List-Pfad."""
    svc = _move_db(_notiz_store())
    ctx = AuthContext(user_id="u", tenant_id="t1", role="admin")
    with pytest.raises(ReservationError) as exc:
        svc.list_notes(ctx, "11111111-1111-1111-1111-111111111111")
    assert exc.value.status_code == 404


def test_notiz_owner_scope() -> None:
    """Eigentümer erreicht über die Notiz-Route keine fremden Objekte (§4.2)."""
    store = _notiz_store(rolle="owner", perms=_NO_PERMS)
    store["reservations"][0]["property_id"] = "p2"   # nicht zugeordnet
    store["owner_property_assignments"] = [
        {"tenant_id": "t1", "user_id": "u", "property_id": "p1"}
    ]
    svc = _move_db(store)
    ctx = AuthContext(user_id="u", tenant_id="t1", role="owner")
    with pytest.raises(ReservationError) as exc:
        svc.list_notes(ctx, RID)
    assert exc.value.status_code == 404


def test_notiz_loeschen() -> None:
    # Echte UUID als Notiz-ID: `delete_note` prüft die Form (_require_uuid),
    # damit eine geratene ID einen 404 statt eines DB-500 erzeugt.
    nid = "22222222-2222-2222-2222-222222222222"
    store = _notiz_store()
    store["reservation_notes"] = [
        {"id": nid, "tenant_id": "t1", "reservation_id": RID, "author_id": "u",
         "body": "Weg damit", "category": None,
         "created_at": "2026-06-20T10:00:00+00:00"},
    ]
    svc = _move_db(store)
    ctx = AuthContext(user_id="u", tenant_id="t1", role="admin")
    assert svc.list_notes(ctx, RID).total == 1
    svc.delete_note(ctx, RID, nid)
    assert svc.list_notes(ctx, RID).total == 0


def test_notiz_loeschen_unbekannt_404() -> None:
    svc = _move_db(_notiz_store())
    ctx = AuthContext(user_id="u", tenant_id="t1", role="admin")
    with pytest.raises(ReservationError) as exc:
        svc.delete_note(ctx, RID, "33333333-3333-3333-3333-333333333333")
    assert exc.value.status_code == 404
