"""Tests für public_portal (Eigentümer-Self-Service-Portal).

Schwerpunkt: Owner-Scope (nur eigene Objekte, fail-closed) und Daten-Split
(guest_masking → Owner sieht keine Beträge). In-Memory-Fake-DB.
"""
from datetime import date

import pytest
from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.public_portal.schemas import (
    BlockRequestCreate,
    MeterReadingCreate,
)
from src.features.public_portal.service import PortalError, PublicPortalService
from src.main import create_app

client = TestClient(create_app())


def test_public_portal_health() -> None:
    resp = client.get("/api/v1/public-portal/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "public_portal", "status": "ok"}


def _ctx(user: str = "owner-1", tenant: str = "t-1") -> AuthContext:
    return AuthContext(user_id=user, tenant_id=tenant, role="owner")


class _Result:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:
    def __init__(self, db: "_DB", table: str) -> None:
        self._db = db
        self._table = table
        self._op = "select"
        self._payload: dict | None = None
        self._filters: list[tuple[str, object]] = []
        self._in: tuple[str, list] | None = None
        self._gte: tuple[str, str] | None = None
        self._gt: tuple[str, str] | None = None
        self._lt: tuple[str, str] | None = None
        self._lte: tuple[str, str] | None = None
        self._range: tuple[int, int] | None = None

    def select(self, *_a: object, **_k: object) -> "_Query":
        self._op = "select"
        return self

    def insert(self, payload: dict) -> "_Query":
        self._op = "insert"
        self._payload = payload
        return self

    def eq(self, col: str, val: object) -> "_Query":
        self._filters.append((col, val))
        return self

    def in_(self, col: str, vals: list) -> "_Query":
        self._in = (col, vals)
        return self

    def gte(self, col: str, val: str) -> "_Query":
        self._gte = (col, val)
        return self

    def gt(self, col: str, val: str) -> "_Query":
        self._gt = (col, val)
        return self

    def lt(self, col: str, val: str) -> "_Query":
        self._lt = (col, val)
        return self

    def lte(self, col: str, val: str) -> "_Query":
        self._lte = (col, val)
        return self

    def order(self, *_a: object, **_k: object) -> "_Query":
        return self

    def range(self, start: int, end: int) -> "_Query":
        self._range = (start, end)
        return self

    def limit(self, _n: int) -> "_Query":
        return self

    def _match(self, row: dict) -> bool:
        ok = all(str(row.get(c)) == str(v) for c, v in self._filters)
        if ok and self._in:
            col, vals = self._in
            ok = str(row.get(col)) in {str(v) for v in vals}
        if ok and self._gte:
            ok = str(row.get(self._gte[0])) >= self._gte[1]
        if ok and self._gt:
            ok = str(row.get(self._gt[0])) > self._gt[1]
        if ok and self._lt:
            ok = str(row.get(self._lt[0])) < self._lt[1]
        if ok and self._lte:
            ok = str(row.get(self._lte[0])) <= self._lte[1]
        return ok

    def execute(self) -> _Result:
        rows = self._db.tables.setdefault(self._table, [])
        if self._op == "insert":
            row = dict(self._payload or {})
            row.setdefault("id", f"{self._table}-{self._db.next_id()}")
            row.setdefault("created_at", "2026-06-25T00:00:00Z")
            rows.append(row)
            return _Result([row])
        selected = [r for r in rows if self._match(r)]
        if self._range is not None:
            start, end = self._range
            selected = selected[start : end + 1]  # PostgREST-range inklusiv
        return _Result(selected)


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables
        self._counter = 0

    def next_id(self) -> int:
        self._counter += 1
        return self._counter

    def table(self, name: str) -> _Query:
        return _Query(self, name)


def _tables() -> dict[str, list[dict]]:
    return {
        # owner-1 ist owner OHNE pm_booking_total → mask.amounts = False.
        "users": [{"id": "owner-1", "role": "owner", "permissions": []}],
        "tenants": [{"id": "t-1", "currency": "EUR"}],
        "owner_property_assignments": [
            {"id": "a1", "tenant_id": "t-1", "user_id": "owner-1", "property_id": "p-1"}
        ],
        "properties": [
            {"id": "p-1", "tenant_id": "t-1", "title": "Villa", "city": "Kiel", "photos": []},
            {"id": "p-2", "tenant_id": "t-1", "title": "Fremd", "city": "X", "photos": []},
        ],
        "availability": [
            {"property_id": "p-1", "date": "2026-01-05", "status": "booked"},
        ],
        "reservations": [
            {
                "id": "r-1",
                "property_id": "p-1",
                "tenant_id": "t-1",
                "guest_id": "g-1",
                "channel": "portal",
                "ota_name": "myBestDays",
                "check_in": "2026-01-05",
                "check_out": "2026-01-08",
                "status": "confirmed",
                "total_amount": 900,
                "channel_fee": 0,
                "currency": "EUR",
                "is_owner_stay": False,
            }
        ],
        "guests": [{"id": "g-1", "name": "Erika Mustermann"}],
        # 20 % Provision → 900 € Payout, 720 € netto, 3 Nächte = 240 €/Nacht.
        "owners": [
            {
                "id": "o-1",
                "tenant_id": "t-1",
                "user_id": "owner-1",
                "default_commission_pct": 20,
            }
        ],
        "owner_properties": [
            {
                "id": "op-1",
                "owner_id": "o-1",
                "property_id": "p-1",
                "commission_override_pct": None,
            }
        ],
        "owner_statements": [
            {
                "id": "s-1",
                "tenant_id": "t-1",
                "owner_id": "o-1",
                "period_from": "2026-01-01",
                "period_to": "2026-01-31",
                "status": "finalized",
                "owner_payout": 720,
                "currency": "EUR",
                "invoice_number": "INV-1",
                "created_at": "2026-02-01T00:00:00Z",
            },
            {
                "id": "s-2",
                "tenant_id": "t-1",
                "owner_id": "o-1",
                "period_from": "2026-02-01",
                "period_to": "2026-02-28",
                "status": "draft",
                "owner_payout": 100,
                "currency": "EUR",
                "created_at": "2026-03-01T00:00:00Z",
            },
        ],
        "block_requests": [],
        "meter_readings": [],
        # Ein Typ mit EINER Einheit — der Normalfall (CLAUDE.md). `tenant_id`
        # steht dran, weil der Sperrantrag die Einheit gegen Objekt UND Mandant
        # scopt (0353, Wurzel 3).
        "property_units": [
            {
                "id": "u-1", "tenant_id": "t-1", "property_id": "p-1",
                "position": 1,
            },
            # Einheit eines FREMDEN Objekts — Zielscheibe des Scope-Tests.
            {
                "id": "u-fremd", "tenant_id": "t-1", "property_id": "p-2",
                "position": 1,
            },
        ],
        "reservation_addons": [],
    }


def _svc(tables: dict[str, list[dict]] | None = None) -> PublicPortalService:
    return PublicPortalService(service_client=_DB(tables or _tables()))


# --- Scope -------------------------------------------------------------------

def test_my_properties_only_assigned() -> None:
    res = _svc().my_properties(_ctx())
    assert res.total == 1
    assert res.items[0].id == "p-1"  # p-2 (fremd) NICHT enthalten


def test_calendar_foreign_property_404() -> None:
    with pytest.raises(PortalError) as exc:
        _svc().calendar(_ctx(), "p-2", date(2026, 1, 1), date(2026, 1, 10))
    assert exc.value.status_code == 404


def test_owner_with_no_assignments_sees_nothing() -> None:
    tables = _tables()
    tables["owner_property_assignments"] = []
    res = _svc(tables).my_properties(_ctx())
    assert res.total == 0


# --- Maskierung (Daten-Split) ------------------------------------------------

def test_calendar_prices_masked_for_owner() -> None:
    # Owner ohne pm_booking_total → Preise sind None (maskiert).
    res = _svc().calendar(_ctx(), "p-1", date(2026, 1, 5), date(2026, 1, 7))
    assert len(res.days) == 2
    assert all(d.price is None for d in res.days)
    # Status kommt durch (booked am 5.).
    assert res.days[0].status == "booked"


def test_calendar_zeigt_netto_payout_je_nacht() -> None:
    """Etappe B: der Owner sieht seinen Netto-Betrag, NICHT den Gastpreis.

    900 € − 0 € Gebühr = 900 € Payout; 20 % Provision → 720 € netto auf
    3 Nächte = 240,00 € je Nacht.
    """
    res = _svc().calendar(_ctx(), "p-1", date(2026, 1, 5), date(2026, 1, 8))
    assert [d.owner_payout_per_night for d in res.days] == [240.0, 240.0, 240.0]
    assert all(d.currency == "EUR" for d in res.days)
    assert all(d.owner_payout_unknown_reason is None for d in res.days)
    # Der Gast-Gesamtpreis bleibt unsichtbar (Wurzel: §4.2).
    assert all(d.price is None for d in res.days)


def test_calendar_payout_summiert_ohne_rundungsverlust() -> None:
    """100,00 € auf 3 Nächte: 33,33 + 33,33 + 33,34 = 100,00 (kein Cent weg)."""
    tables = _tables()
    tables["reservations"][0]["total_amount"] = 125
    tables["reservations"][0]["channel_fee"] = 25  # Payout 100, Provision 0 %
    tables["owners"][0]["default_commission_pct"] = 0
    res = _svc(tables).calendar(_ctx(), "p-1", date(2026, 1, 5), date(2026, 1, 8))
    betraege = [d.owner_payout_per_night for d in res.days]
    assert betraege == [33.33, 33.33, 33.34]
    assert round(sum(betraege), 2) == 100.00


def test_calendar_ohne_provision_kein_erfundener_betrag() -> None:
    """Wurzel 4: fehlt die Provision, gibt es KEINE Zahl — nur den Grund."""
    tables = _tables()
    tables["owners"][0]["default_commission_pct"] = None
    res = _svc(tables).calendar(_ctx(), "p-1", date(2026, 1, 5), date(2026, 1, 8))
    assert all(d.owner_payout_per_night is None for d in res.days)
    assert {d.owner_payout_unknown_reason for d in res.days} == {"provision"}


def test_calendar_gast_nur_vorname_und_quelle() -> None:
    """Der Owner sieht den VORNAMEN (über die GuestMask) plus die Quelle."""
    res = _svc().calendar(_ctx(), "p-1", date(2026, 1, 5), date(2026, 1, 8))
    assert {d.guest_first_name for d in res.days} == {"Erika"}  # kein Nachname
    assert {d.booking_source for d in res.days} == {"myBestDays"}


def test_calendar_freie_nacht_ohne_payout() -> None:
    """Nächte ohne Buchung tragen keinen Betrag und keinen Gastnamen."""
    res = _svc().calendar(_ctx(), "p-1", date(2026, 1, 10), date(2026, 1, 12))
    assert all(d.owner_payout_per_night is None for d in res.days)
    assert all(d.guest_first_name is None for d in res.days)
    assert all(d.owner_payout_unknown_reason is None for d in res.days)


def test_calendar_eigentuemer_aufenthalt_ohne_payout() -> None:
    """Eigennutzung (0241) ist keine Auszahlung — sie taucht nicht auf."""
    tables = _tables()
    tables["reservations"][0]["is_owner_stay"] = True
    res = _svc(tables).calendar(_ctx(), "p-1", date(2026, 1, 5), date(2026, 1, 8))
    assert all(d.owner_payout_per_night is None for d in res.days)


def test_calendar_zaehlt_zusatzleistungen_wie_die_abrechnung() -> None:
    """BEFUND 1 — Kalender und Abrechnung müssen dieselbe Zahl zeigen.

    Der geteilte Helfer `naechte_payout_map` kennt `addon_total`; das Portal
    übergab ihn NICHT, obwohl die Abrechnung Extras ausdrücklich in den
    Owner-Split zählt (`owner_statements/service.py::_rental_rows`).

    Nachrechnung mit den Zahlen aus dem Befund: total 1000, channel_fee 150,
    Extras 200, Provision 20 %, 5 Nächte.
      Payout      = 1000 + 200 − 150 = 1050
      Owner-Netto = 1050 × 0,80      =  840,00   ← die Abrechnung
      je Nacht    = 840 / 5          =  168,00
    Ohne die Extras wären es (1000 − 150) × 0,8 = 680,00 gewesen: 160,00 zu
    wenig, und zwar für JEDEN Eigentümer, der je ein Extra verkauft.
    """
    tables = _tables()
    tables["reservations"][0].update(
        {
            "check_in": "2026-01-05",
            "check_out": "2026-01-10",  # 5 Nächte
            "total_amount": 1000,
            "channel_fee": 150,
        }
    )
    tables["reservation_addons"] = [
        {"id": "ad-1", "reservation_id": "r-1", "total": 200, "status": "confirmed"}
    ]
    res = _svc(tables).calendar(_ctx(), "p-1", date(2026, 1, 5), date(2026, 1, 10))
    betraege = [d.owner_payout_per_night for d in res.days]
    assert betraege == [168.0, 168.0, 168.0, 168.0, 168.0]
    # Die Summe der Nächte ist exakt der Owner-Payout des Statements.
    assert round(sum(betraege), 2) == 840.00


def test_calendar_stornierte_zusatzleistung_zaehlt_nicht() -> None:
    """Abgesagte Extras fließen NICHT in den Payout — wie in der Abrechnung
    (`_addon_sums` überspringt `status='cancelled'`)."""
    tables = _tables()
    tables["reservations"][0].update(
        {"check_in": "2026-01-05", "check_out": "2026-01-10",
         "total_amount": 1000, "channel_fee": 150}
    )
    tables["reservation_addons"] = [
        {"id": "ad-1", "reservation_id": "r-1", "total": 200, "status": "cancelled"}
    ]
    res = _svc(tables).calendar(_ctx(), "p-1", date(2026, 1, 5), date(2026, 1, 10))
    # (1000 − 150) × 0,8 = 680 auf 5 Nächte = 136,00
    assert [d.owner_payout_per_night for d in res.days] == [136.0] * 5


def _zwei_einheiten(tables: dict) -> dict:
    """Ein Typ mit ZWEI Einheiten und zwei überlappenden Buchungen.

    Buchung A: 1.–5. auf Einheit u-1 (4 Nächte, Payout 400 → 320 netto → 80/N)
    Buchung B: 2.–6. auf Einheit u-2 (4 Nächte, Payout 800 → 640 netto → 160/N)
    Überlappung: 2., 3., 4. — dort müssen BEIDE Beträge zusammenkommen.
    """
    tables["property_units"] = [
        {"id": "u-1", "property_id": "p-1", "position": 1},
        {"id": "u-2", "property_id": "p-1", "position": 2},
    ]
    gemeinsam = {
        "property_id": "p-1",
        "tenant_id": "t-1",
        "channel": "portal",
        "ota_name": "myBestDays",
        "status": "confirmed",
        "channel_fee": 0,
        "currency": "EUR",
        "is_owner_stay": False,
    }
    tables["reservations"] = [
        {**gemeinsam, "id": "r-a", "unit_id": "u-1", "guest_id": "g-1",
         "check_in": "2026-01-01", "check_out": "2026-01-05", "total_amount": 400},
        {**gemeinsam, "id": "r-b", "unit_id": "u-2", "guest_id": "g-2",
         "check_in": "2026-01-02", "check_out": "2026-01-06", "total_amount": 800},
    ]
    tables["guests"] = [
        {"id": "g-1", "name": "Erika Mustermann"},
        {"id": "g-2", "name": "Hans Beispiel"},
    ]
    return tables


def test_calendar_mehrere_einheiten_kein_payout_verschwindet() -> None:
    """BEFUND 2 — bei n>1 Einheiten fiel der Payout der ersten Buchung weg.

    Die Nacht-Map war `dict[datum] = EINE Zeile`: die zweite Buchung
    überschrieb die erste, und für die überlappenden Nächte sah der Eigentümer
    nur noch B. Bei fünf identischen Studios ein Fünftel seines Geldes.
    """
    res = _svc(_zwei_einheiten(_tables())).calendar(
        _ctx(), "p-1", date(2026, 1, 1), date(2026, 1, 7)
    )
    je_tag = {d.date.isoformat(): d for d in res.days}
    # 1.: nur A (80). 2.–4.: A+B (80+160=240). 5.: nur B (160). 6.: frei.
    assert je_tag["2026-01-01"].owner_payout_per_night == 80.0
    assert je_tag["2026-01-02"].owner_payout_per_night == 240.0
    assert je_tag["2026-01-03"].owner_payout_per_night == 240.0
    assert je_tag["2026-01-04"].owner_payout_per_night == 240.0
    assert je_tag["2026-01-05"].owner_payout_per_night == 160.0
    assert je_tag["2026-01-06"].owner_payout_per_night is None
    # Über den ganzen Aufenthalt geht nichts verloren: 320 (A) + 640 (B).
    summe = sum(
        d.owner_payout_per_night or 0 for d in res.days
    )
    assert round(summe, 2) == 960.00


def test_calendar_mehrere_einheiten_einzelposten_und_belegung() -> None:
    """Je Nacht steht jede belegte Einheit einzeln in `bookings`, und die
    Belegung wird als ZAHL geführt (`units_booked`/`units_total`) — passend zur
    Verfügbarkeit je Einheit (0266), nicht als 0/1 für den ganzen Typ."""
    res = _svc(_zwei_einheiten(_tables())).calendar(
        _ctx(), "p-1", date(2026, 1, 1), date(2026, 1, 7)
    )
    je_tag = {d.date.isoformat(): d for d in res.days}
    tag2 = je_tag["2026-01-02"]
    assert tag2.units_booked == 2
    assert tag2.units_total == 2
    assert {b.unit_id for b in tag2.bookings} == {"u-1", "u-2"}
    assert {b.reservation_id for b in tag2.bookings} == {"r-a", "r-b"}
    assert {b.owner_payout_per_night for b in tag2.bookings} == {80.0, 160.0}
    # Beide Gäste einzeln — jeweils NUR der Vorname (§4.2).
    assert {b.guest_first_name for b in tag2.bookings} == {"Erika", "Hans"}
    # Der 1. trägt nur eine Einheit, der Typ führt aber zwei.
    assert je_tag["2026-01-01"].units_booked == 1
    assert je_tag["2026-01-01"].units_total == 2


def test_calendar_mehrere_einheiten_keine_teilsumme() -> None:
    """Ist für EINE der Buchungen kein Betrag ausweisbar, gibt es KEINE
    Tagessumme (Wurzel 4): eine Teilsumme sähe aus wie der volle Ertrag der
    Nacht, wäre aber zu klein. Der Einzelposten der anderen bleibt sichtbar."""
    tables = _zwei_einheiten(_tables())
    tables["reservations"][1]["total_amount"] = None  # B unbestimmt
    res = _svc(tables).calendar(_ctx(), "p-1", date(2026, 1, 2), date(2026, 1, 3))
    tag = res.days[0]
    assert tag.owner_payout_per_night is None
    assert tag.owner_payout_unknown_reason == "betrag"
    assert sorted(
        b.owner_payout_per_night for b in tag.bookings if b.owner_payout_per_night
    ) == [80.0]


def test_earnings_rechnet_wie_kalender_und_abrechnung() -> None:
    """Die Einnahmen-Übersicht war eine DRITTE Zahl für dasselbe Geld.

    Sie summierte roh `total_amount − channel_fee`: also VOR Provision und
    OHNE Extras. Der Eigentümer sah dort mehr, als er je bekommt, und wieder
    etwas anderes als in Kalender und Abrechnung.

    900 € + 200 € Extra − 0 € Gebühr = 1100 Payout; 20 % Provision → 880,00.
    """
    tables = _tables()
    tables["reservation_addons"] = [
        {"id": "ad-1", "reservation_id": "r-1", "total": 200, "status": "confirmed"}
    ]
    # Beträge sichtbar machen, sonst maskiert die Antwort ohnehin. Das
    # Dach-Recht `access_pm_features` muss mit: ohne es entfernt
    # `effective_permissions` alle pm_*-Kindrechte.
    tables["users"][0]["permissions"] = ["access_pm_features", "pm_booking_total"]
    res = _svc(tables).earnings(_ctx(), date(2026, 1, 1), date(2026, 1, 31))
    item = next(i for i in res.items if i.property_id == "p-1")
    assert item.payout == 880.0
    assert res.total_payout == 880.0


def test_earnings_ohne_provision_keine_erfundene_summe() -> None:
    """Wurzel 4: fehlt die Provision, gibt es KEINE Summe — auch keine, die
    aus den übrigen Buchungen zusammengerechnet ist."""
    tables = _tables()
    tables["users"][0]["permissions"] = ["access_pm_features", "pm_booking_total"]
    tables["owners"][0]["default_commission_pct"] = None
    res = _svc(tables).earnings(_ctx(), date(2026, 1, 1), date(2026, 1, 31))
    item = next(i for i in res.items if i.property_id == "p-1")
    assert item.payout is None
    assert res.total_payout is None
    # Die Nächte bleiben sichtbar — sie sind kein Betrag.
    assert item.nights == 3


def test_earnings_payout_masked_for_owner() -> None:
    res = _svc().earnings(_ctx(), date(2026, 1, 1), date(2026, 1, 31))
    assert res.total_payout is None  # maskiert
    item = next(i for i in res.items if i.property_id == "p-1")
    assert item.payout is None
    assert item.nights == 3  # Nächte sind sichtbar (kein Betrag)
    assert item.reservations == 1


# --- Statements --------------------------------------------------------------

def test_my_statements_only_finalized_and_own() -> None:
    res = _svc().my_statements(_ctx())
    assert res.total == 1
    assert res.items[0].id == "s-1"  # nur finalized, draft (s-2) ausgeblendet


def test_my_statements_ohne_waehrung_kein_erfundenes_eur() -> None:
    """KLEINKRAM — hier stand `r.get("currency") or "EUR"`.

    Eine dänische oder polnische Abrechnung ohne Währungsfeld wäre dem
    Eigentümer als Euro-Betrag ausgewiesen worden. Fehlende Währung ist ein
    Datenfehler → 422, wie `_tenant_currency` im selben Modul (Wurzel 4).
    """
    tables = _tables()
    tables["owner_statements"][0]["currency"] = None
    with pytest.raises(PortalError) as exc:
        _svc(tables).my_statements(_ctx())
    assert exc.value.status_code == 422


# --- Block-Requests ----------------------------------------------------------

def test_request_block_on_own_property() -> None:
    svc = _svc()
    item = svc.request_block(
        _ctx(),
        BlockRequestCreate(
            property_id="p-1", start_date=date(2026, 3, 1), end_date=date(2026, 3, 5)
        ),
    )
    assert item.status == "pending"
    assert item.property_id == "p-1"


def test_request_block_foreign_property_404() -> None:
    with pytest.raises(PortalError) as exc:
        _svc().request_block(
            _ctx(),
            BlockRequestCreate(
                property_id="p-2", start_date=date(2026, 3, 1), end_date=date(2026, 3, 5)
            ),
        )
    assert exc.value.status_code == 404


def test_request_block_fuer_eine_einheit(  ) -> None:
    """0353: der Eigentümer kann EINE Einheit beantragen statt des ganzen Typs.

    Bei fünf gleichen Studios nahm der Antrag vorher zwangsläufig alle fünf aus
    dem Verkauf, obwohl er nur eines nutzen will.
    """
    tables = _tables()
    item = _svc(tables).request_block(
        _ctx(),
        BlockRequestCreate(
            property_id="p-1", unit_id="u-1",
            start_date=date(2026, 3, 1), end_date=date(2026, 3, 5),
        ),
    )
    assert item.unit_id == "u-1"
    assert tables["block_requests"][0]["unit_id"] == "u-1"


def test_request_block_ohne_einheit_meint_den_ganzen_typ() -> None:
    """Gegenprobe: ohne Angabe bleibt es beim bisherigen Verhalten."""
    tables = _tables()
    item = _svc(tables).request_block(
        _ctx(),
        BlockRequestCreate(
            property_id="p-1", start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 5),
        ),
    )
    assert item.unit_id is None
    assert tables["block_requests"][0]["unit_id"] is None


def test_request_block_fremde_einheit_422() -> None:
    """Wurzel 3: eine `unit_id` aus dem Request ist ungeprüft nichts wert —
    sonst ließe sich über eine geratene UUID die Einheit eines fremden Objekts
    beantragen und bei der Genehmigung belegen."""
    with pytest.raises(PortalError) as exc:
        _svc().request_block(
            _ctx(),
            BlockRequestCreate(
                property_id="p-1", unit_id="u-fremd",
                start_date=date(2026, 3, 1), end_date=date(2026, 3, 5),
            ),
        )
    assert exc.value.status_code == 422


# --- Zählerstände ------------------------------------------------------------

def test_add_meter_reading_on_own_property() -> None:
    svc = _svc()
    item = svc.add_meter_reading(
        _ctx(),
        MeterReadingCreate(
            property_id="p-1", meter_kind="strom", value=1234.5, read_at=date(2026, 1, 31)
        ),
    )
    assert item.meter_kind == "strom"
    assert item.value == 1234.5


def test_add_meter_reading_foreign_property_404() -> None:
    with pytest.raises(PortalError) as exc:
        _svc().add_meter_reading(
            _ctx(),
            MeterReadingCreate(
                property_id="p-2", meter_kind="strom", value=1, read_at=date(2026, 1, 31)
            ),
        )
    assert exc.value.status_code == 404
