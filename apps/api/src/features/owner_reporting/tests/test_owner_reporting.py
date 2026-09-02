"""Tests für owner_reporting — Bericht · Zahlung · Plan · Statistik.

Geprüft wird, was fachlich tragen muss und NICHT schon von der DB erzwungen
wird:

* die Perioden-/Lauftag-Rechnung der geplanten Berichte (reine Datumsmathematik,
  inklusive Jahres- und Quartalswechsel — dort ging bisher jede naive Variante
  schief),
* der Mandanten-Scope auf dem Item-Pfad (die Service-Role umgeht RLS, Wurzel 3),
* die Idempotenz beim Erzeugen einer Zahlung (Wurzel 2),
* der Gegenzustand beim Löschen einer Teilzahlung (Wurzel 1),
* dass ein fehlender Vertrag die Zahlung FEHLSCHLAGEN lässt, statt Buchungen
  stillschweigend wegzulassen (Wurzel 4/5),
* und dass „bezahlter Prozentsatz" bei Betrag 0 nicht 100 behauptet.

Die In-Memory-Attrappe bildet nur die Operatoren nach, die der Service wirklich
benutzt. Alles, was als CHECK/EXCLUDE/UNIQUE in der Migration steht, wird hier
NICHT nachgebaut — ein Test dagegen wäre ein Test der Attrappe.
"""
import fnmatch
from datetime import date

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.core.security import AuthContext
from src.features.owner_reporting import perioden
from src.features.owner_reporting.fehler import ReportingError
from src.features.owner_reporting.schemas import (
    Abschnitt,
    PaymentCreate,
    PaymentPartCreate,
    RecurringItemCreate,
    ReportCreate,
    ScheduleCreate,
)
from src.features.owner_reporting.service import OwnerReportingService
from src.main import create_app

client = TestClient(create_app())


def _ctx(tenant: str | None = "t-1") -> AuthContext:
    return AuthContext(user_id="u-1", tenant_id=tenant, role="admin")


# ----------------------------------------------------------------------
# In-Memory-Attrappe
# ----------------------------------------------------------------------


class _Result:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:  # pylint: disable=too-many-instance-attributes
    """Nachbau der PostgREST-Kette — nur die benutzten Operatoren."""

    def __init__(self, db: "_DB", table: str) -> None:
        self._db = db
        self._table = table
        self._op = "select"
        self._payload: dict | list | None = None
        self._eq: list[tuple[str, object]] = []
        self._in: list[tuple[str, list]] = []
        self._gte: list[tuple[str, str]] = []
        self._lte: list[tuple[str, str]] = []
        self._lt: list[tuple[str, str]] = []
        self._order: list[str] = []

    def select(self, *_a: object, **_k: object) -> "_Query":
        self._op = "select"
        return self

    def insert(self, payload: dict | list) -> "_Query":
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload: dict) -> "_Query":
        self._op = "update"
        self._payload = payload
        return self

    def delete(self) -> "_Query":
        self._op = "delete"
        return self

    def eq(self, col: str, val: object) -> "_Query":
        self._eq.append((col, val))
        return self

    def in_(self, col: str, vals: list) -> "_Query":
        self._in.append((col, [str(v) for v in vals]))
        return self

    def gte(self, col: str, val: str) -> "_Query":
        self._gte.append((col, val))
        return self

    def lte(self, col: str, val: str) -> "_Query":
        self._lte.append((col, val))
        return self

    def lt(self, col: str, val: str) -> "_Query":
        self._lt.append((col, val))
        return self

    def order(self, col: str, **_k: object) -> "_Query":
        self._order.append(col)
        return self

    def limit(self, _n: int) -> "_Query":
        return self

    def range(self, _a: int, _b: int) -> "_Query":
        return self

    def like(self, col: str, pattern: str) -> "_Query":
        # PostgREST `like` mit `%`-Platzhalter — hier als Muster-Filter.
        self._like = (col, pattern)
        return self

    def _match(self, row: dict) -> bool:
        muster = getattr(self, "_like", None)
        if muster is not None:
            like_col, like_pat = muster
            if not fnmatch.fnmatchcase(
                str(row.get(like_col) or ""), like_pat.replace("%", "*")
            ):
                return False
        if not all(str(row.get(c)) == str(v) for c, v in self._eq):
            return False
        if not all(str(row.get(c)) in vals for c, vals in self._in):
            return False
        if not all(str(row.get(c) or "") >= v for c, v in self._gte):
            return False
        if not all(str(row.get(c) or "") <= v for c, v in self._lte):
            return False
        return all(str(row.get(c) or "") < v for c, v in self._lt)

    def execute(self) -> _Result:
        rows = self._db.tables.setdefault(self._table, [])
        if self._op == "insert":
            payload = self._payload
            neu = payload if isinstance(payload, list) else [payload]
            angelegt = []
            for eintrag in neu:
                row = dict(eintrag or {})
                row.setdefault("id", f"{self._table}-{self._db.next_id()}")
                row.setdefault("created_at", "2026-08-11T00:00:00Z")
                row.setdefault("updated_at", "2026-08-11T00:00:00Z")
                rows.append(row)
                angelegt.append(row)
            return _Result(angelegt)
        treffer = [r for r in rows if self._match(r)]
        if self._op == "update":
            for r in treffer:
                r.update(self._payload or {})
            return _Result(treffer)
        if self._op == "delete":
            self._db.tables[self._table] = [
                r for r in rows if not self._match(r)
            ]
            return _Result(treffer)
        for col in reversed(self._order):
            treffer = sorted(treffer, key=lambda r, c=col: str(r.get(c) or ""))
        return _Result(treffer)


class _DB:
    def __init__(self, tables: dict[str, list[dict]] | None = None) -> None:
        self.tables: dict[str, list[dict]] = tables or {}
        self._counter = 0

    def next_id(self) -> int:
        self._counter += 1
        return self._counter

    def table(self, name: str) -> _Query:
        return _Query(self, name)


def _svc(tables: dict[str, list[dict]] | None = None) -> OwnerReportingService:
    base: dict[str, list[dict]] = {
        "owners": [
            {
                "id": "o-1",
                "tenant_id": "t-1",
                "name": "Hansen",
                "email": "h@example.dk",
            },
            {"id": "o-2", "tenant_id": "t-2", "name": "Fremd"},
        ],
        "owner_properties": [{"owner_id": "o-1", "property_id": "p-1"}],
        "properties": [
            {"id": "p-1", "tenant_id": "t-1", "title": "Villa", "type_attributes": {}},
            {"id": "p-9", "tenant_id": "t-2", "title": "Fremd"},
        ],
        "reservations": [],
        "channex_booking": [],
        "reservation_addons": [],
        "guests": [],
        "fee_classification": [],
        "owner_billing_terms": [],
        "portal_abzugssaetze": [],
        "owner_expenses": [],
        "owner_recurring_items": [],
        "owner_reports": [],
        "owner_report_properties": [],
        "owner_report_payments": [],
        "owner_report_payment_items": [],
        "owner_report_payment_parts": [],
        "owner_report_schedules": [],
        "owner_report_schedule_properties": [],
        "owner_report_schedule_recipients": [],
        "fx_rates": [],
    }
    if tables:
        base.update(tables)
    return OwnerReportingService(service_client=_DB(base))  # type: ignore[arg-type]


def _report(svc: OwnerReportingService, **kw: object) -> str:
    req = ReportCreate(
        name=str(kw.get("name", "Juli 2026")),
        currency="DKK",
        period_from=date(2026, 7, 1),
        period_to=date(2026, 7, 31),
        property_ids=["p-1"],
    )
    return svc.create_report(_ctx(), req).id


# ----------------------------------------------------------------------
# Mount
# ----------------------------------------------------------------------


def test_health_ist_gemountet() -> None:
    res = client.get("/api/v1/owner-reporting/health")
    assert res.status_code == 200
    assert res.json()["slice"] == "owner_reporting"


# ----------------------------------------------------------------------
# Perioden — reine Datumsmathematik
# ----------------------------------------------------------------------


@pytest.mark.parametrize(
    ("rhythmus", "zeitraum", "heute", "erwartet"),
    [
        ("monat", "vergangener", date(2026, 8, 1), (date(2026, 7, 1), date(2026, 7, 31))),
        ("monat", "laufender", date(2026, 8, 11), (date(2026, 8, 1), date(2026, 8, 31))),
        # Februar: der Monatsletzte ist gerechnet, nicht angenommen.
        ("monat", "vergangener", date(2026, 3, 1), (date(2026, 2, 1), date(2026, 2, 28))),
        # Jahreswechsel im Quartal — hier scheitert jede naive Monatsrechnung.
        ("quartal", "vergangener", date(2026, 1, 1), (date(2025, 10, 1), date(2025, 12, 31))),
        ("quartal", "laufender", date(2026, 8, 11), (date(2026, 7, 1), date(2026, 9, 30))),
        ("woche", "vergangener", date(2026, 8, 11), (date(2026, 8, 3), date(2026, 8, 9))),
        ("jahr", "vergangener", date(2026, 8, 11), (date(2025, 1, 1), date(2025, 12, 31))),
    ],
)
def test_periode(
    rhythmus: str, zeitraum: str, heute: date, erwartet: tuple[date, date]
) -> None:
    assert perioden.periode(rhythmus, zeitraum, heute) == erwartet


def test_unbekannter_rhythmus_faellt_nicht_auf_monat_zurueck() -> None:
    """Ein Rückfall wäre eine Abrechnung über die falschen Wochen (Wurzel 4)."""
    with pytest.raises(ValueError, match="Unbekannter Rhythmus"):
        perioden.periode("dekade", "vergangener", date(2026, 8, 11))


@pytest.mark.parametrize(
    ("am_tag", "rhythmus", "heute", "erwartet"),
    [
        ("erste", "monat", date(2026, 8, 1), True),
        ("erste", "monat", date(2026, 8, 2), False),
        ("letzte", "monat", date(2026, 8, 31), True),
        # Quartalsende ist NICHT jeder Monatsletzte.
        ("letzte", "quartal", date(2026, 9, 30), True),
        ("letzte", "quartal", date(2026, 8, 31), False),
        ("erste", "quartal", date(2026, 7, 1), True),
        ("erste", "woche", date(2026, 8, 10), True),
        ("letzte", "jahr", date(2026, 12, 31), True),
        ("letzte", "jahr", date(2026, 11, 30), False),
    ],
)
def test_laeuft_heute(
    am_tag: str, rhythmus: str, heute: date, erwartet: bool
) -> None:
    assert perioden.laeuft_heute(am_tag, rhythmus, heute) is erwartet


# ----------------------------------------------------------------------
# Bericht — Scope und Validierung
# ----------------------------------------------------------------------


def test_bericht_ohne_objekt_wird_abgelehnt() -> None:
    """Ein Bericht ohne Objekte hätte keinen Gegenstand."""
    with pytest.raises(ValidationError):
        ReportCreate(
            name="Leer",
            currency="DKK",
            period_from=date(2026, 7, 1),
            period_to=date(2026, 7, 31),
            property_ids=[],
        )


def test_bericht_zeitraum_ist_gedeckelt() -> None:
    """Offene Zeiträume sind ein Vollscan über den Buchungsbestand (Wurzel 8)."""
    with pytest.raises(ValidationError):
        ReportCreate(
            name="Alles",
            currency="DKK",
            period_from=date(2020, 1, 1),
            period_to=date(2026, 12, 31),
            property_ids=["p-1"],
        )


def test_waehrung_ohne_iso_code_wird_abgelehnt() -> None:
    with pytest.raises(ValidationError):
        ReportCreate(
            name="X",
            currency="Kronen",
            period_from=date(2026, 7, 1),
            period_to=date(2026, 7, 31),
            property_ids=["p-1"],
        )


def test_fremdes_objekt_kommt_nicht_in_den_bericht() -> None:
    """Wurzel 3: die Service-Role umgeht RLS, der Scope muss hier stehen."""
    svc = _svc()
    with pytest.raises(ReportingError) as exc:
        svc.create_report(
            _ctx(),
            ReportCreate(
                name="Fremd",
                currency="DKK",
                period_from=date(2026, 7, 1),
                period_to=date(2026, 7, 31),
                property_ids=["p-9"],
            ),
        )
    assert exc.value.status_code == 404


def test_fremder_bericht_ist_nicht_ladbar() -> None:
    svc = _svc()
    report_id = _report(svc)
    with pytest.raises(ReportingError) as exc:
        svc.get_report(_ctx("t-2"), report_id)
    assert exc.value.status_code == 404


def test_bericht_ohne_buchungen_zeigt_leere_objekte() -> None:
    """Ein Objekt ohne Buchung verschwindet nicht — sonst sähe der Bericht aus,
    als wäre es nie ausgewählt worden."""
    svc = _svc()
    detail = svc.get_report(_ctx(), _report(svc))
    assert detail.empty_property_ids == ["p-1"]
    assert detail.summary.bookings == 0
    assert detail.summary.currency == "DKK"


def test_bericht_mit_zahlung_laesst_sich_nicht_loeschen() -> None:
    """Eine Zahlung ist eine Forderung; sie per cascade wegzuräumen hieße,
    Geldbewegungen stillschweigend zu löschen."""
    svc = _svc()
    report_id = _report(svc)
    svc._db.tables["owner_report_payments"].append(  # noqa: SLF001
        {
            "id": "z-1",
            "tenant_id": "t-1",
            "report_id": report_id,
            "owner_id": "o-1",
            "currency": "DKK",
            "betrag": 100,
        }
    )
    with pytest.raises(ReportingError) as exc:
        svc.delete_report(_ctx(), report_id)
    assert exc.value.status_code == 409


# ----------------------------------------------------------------------
# Zahlung
# ----------------------------------------------------------------------


def test_zahlung_ohne_zuordnung_wird_abgelehnt() -> None:
    """Ein Empfänger ohne Objekt im Bericht hat nichts zu bekommen."""
    svc = _svc(
        {
            "owners": [
                {"id": "o-1", "tenant_id": "t-1", "name": "Hansen"},
                {"id": "o-3", "tenant_id": "t-1", "name": "Ohne Objekt"},
            ],
        }
    )
    report_id = _report(svc)
    with pytest.raises(ReportingError) as exc:
        svc.create_payment(_ctx(), report_id, PaymentCreate(owner_id="o-3"))
    assert exc.value.status_code == 422


def test_zahlung_ist_idempotent() -> None:
    """Wurzel 2: der zweite Klick darf keine zweite Forderung erzeugen."""
    svc = _svc()
    report_id = _report(svc)
    erste = svc.create_payment(_ctx(), report_id, PaymentCreate(owner_id="o-1"))
    zweite = svc.create_payment(_ctx(), report_id, PaymentCreate(owner_id="o-1"))
    assert erste.id == zweite.id
    assert len(svc._db.tables["owner_report_payments"]) == 1  # noqa: SLF001


def test_zahlung_ohne_vertrag_schlaegt_fehl_statt_buchungen_wegzulassen() -> None:
    """Eine Zahlung, in der Aufenthalte fehlen, sieht vollständig aus."""
    svc = _svc(
        {
            "reservations": [
                {
                    "id": "r-1",
                    "tenant_id": "t-1",
                    "property_id": "p-1",
                    "channel": "direct",
                    "check_in": "2026-07-05",
                    "check_out": "2026-07-08",
                    "status": "confirmed",
                    "total_amount": 3000,
                    "paid_amount": 3000,
                    "currency": "DKK",
                    "num_guests": 2,
                    "is_owner_stay": False,
                    "ota_commission": 0,
                }
            ]
        }
    )
    report_id = _report(svc)
    with pytest.raises(ReportingError) as exc:
        svc.create_payment(_ctx(), report_id, PaymentCreate(owner_id="o-1"))
    assert exc.value.status_code == 422
    assert "Abrechnungsvertrag" in exc.value.message


_OTA_RES = {
    "id": "r-9",
    "tenant_id": "t-1",
    "property_id": "p-1",
    "channel": "airbnb",
    "ota_name": "Airbnb",
    "check_in": "2026-07-10",
    "check_out": "2026-07-14",
    "status": "confirmed",
    "total_amount": 4000,
    "paid_amount": 4000,
    "currency": "DKK",
    "num_guests": 2,
    "is_owner_stay": False,
}


def test_buchung_ohne_provisionssatz_bleibt_im_bericht() -> None:
    """Ein Konfigurationsloch darf nicht wie ein leerer Monat aussehen.

    Live gefunden (11.08.2026): ohne Eintrag in ``portal_abzugssaetze`` fielen
    ALLE OTA-Buchungen aus dem Bericht — der Betrieb sah 0,00 DKK und keinen
    Grund. Was feststeht (Miete, Gebühren, Brutto), muss stehen; nur der
    Portal-Abzug und die davon abhängigen Einnahmen bleiben leer, und der
    betroffene Kanal wird BENANNT.
    """
    svc = _svc({"reservations": [dict(_OTA_RES)]})
    report_id = _report(svc)
    detail = svc.get_report(_ctx(), report_id)

    assert detail.summary.bookings == 1
    assert detail.summary.rent == 4000.0
    # Nicht 0.0: eine Null behauptete, Airbnb habe nichts einbehalten.
    assert detail.summary.channel_commission is None
    assert detail.summary.income is None
    assert detail.channels_without_commission == ["Airbnb"]
    assert detail.rent_rows[0].channel is None
    assert detail.rent_rows[0].income is None
    assert detail.warnungen


def test_zahlung_ohne_provisionssatz_nennt_den_kanal() -> None:
    """Sonst schickt die Meldung den Betrieb zum falschen Formular.

    Ohne Provisionssatz ist auch ``auszahlung`` None — die Vertragsmeldung
    („Vertrag unter Eigentümer hinterlegen") wäre hier eine Falschauskunft.
    """
    svc = _svc({"reservations": [dict(_OTA_RES)]})
    report_id = _report(svc)
    with pytest.raises(ReportingError) as exc:
        svc.create_payment(_ctx(), report_id, PaymentCreate(owner_id="o-1"))
    assert exc.value.status_code == 422
    assert "Airbnb" in exc.value.message
    assert "Provisionssatz" in exc.value.message


def test_teilzahlung_ueber_dem_betrag_wird_abgelehnt() -> None:
    svc = _svc()
    report_id = _report(svc)
    zahlung = svc.create_payment(_ctx(), report_id, PaymentCreate(owner_id="o-1"))
    svc._db.tables["owner_report_payments"][0]["betrag"] = 100  # noqa: SLF001
    with pytest.raises(ReportingError) as exc:
        svc.add_part(
            _ctx(),
            zahlung.id,
            PaymentPartCreate(betrag=150, bezahlt_am=date(2026, 8, 1)),
        )
    assert exc.value.status_code == 422


def test_teilzahlung_loeschen_nimmt_das_bezahlt_datum_zurueck() -> None:
    """Wurzel 1: jede Aktion hat einen Gegenzustand.

    Bliebe ``bezahlt_am`` stehen, zählte die Statistik einen Betrag, den
    niemand bekommen hat.
    """
    svc = _svc()
    report_id = _report(svc)
    zahlung = svc.create_payment(_ctx(), report_id, PaymentCreate(owner_id="o-1"))
    svc._db.tables["owner_report_payments"][0]["betrag"] = 100  # noqa: SLF001
    svc.add_part(
        _ctx(),
        zahlung.id,
        PaymentPartCreate(betrag=100, bezahlt_am=date(2026, 8, 1)),
    )
    assert svc.get_payment(_ctx(), zahlung.id).bezahlt_am == date(2026, 8, 1)
    part_id = svc.get_payment(_ctx(), zahlung.id).parts[0].id
    nachher = svc.delete_part(_ctx(), part_id)
    assert nachher.bezahlt_am is None
    assert nachher.bezahlt_pct == 0.0


def test_als_bezahlt_markieren_legt_den_restbetrag_an() -> None:
    """Ein reines Flag ergäbe zwei Wahrheiten über dasselbe Geld: die Liste
    zeigte 100 %, die Teilzahlungen 30 %."""
    svc = _svc()
    report_id = _report(svc)
    zahlung = svc.create_payment(_ctx(), report_id, PaymentCreate(owner_id="o-1"))
    svc._db.tables["owner_report_payments"][0]["betrag"] = 200  # noqa: SLF001
    svc.add_part(
        _ctx(),
        zahlung.id,
        PaymentPartCreate(betrag=60, bezahlt_am=date(2026, 8, 1)),
    )
    nachher = svc.mark_paid(_ctx(), zahlung.id, date(2026, 8, 5))
    assert nachher.bezahlt_pct == 100.0
    assert sum(p.betrag for p in nachher.parts) == 200


def test_bezahlt_prozent_bei_betrag_null_ist_null_nicht_hundert() -> None:
    """Eine Zahlung über nichts ist weder bezahlt noch offen."""
    from decimal import Decimal  # noqa: PLC0415 — nur für diesen Test

    assert OwnerReportingService._bezahlt_pct(  # noqa: SLF001
        Decimal("0"), Decimal("0")
    ) == 0.0


# ----------------------------------------------------------------------
# Wiederkehrende Posten
# ----------------------------------------------------------------------


def test_steuern_sind_kein_wiederkehrender_posten() -> None:
    """Sonst gäbe es zwei konkurrierende Steuerquellen für denselben Aufenthalt."""
    with pytest.raises(ValidationError):
        RecurringItemCreate(
            label="Kurtaxe",
            abschnitt=Abschnitt.steuern,
            modus="je_nacht",
            betrag=5,
            currency="DKK",
        )


def test_wiederkehrender_posten_in_fremder_waehrung_bricht_die_zahlung_ab() -> None:
    """50 DKK sind 50 DKK — ein stiller Kurs 1,0 wäre plausibler Unsinn."""
    svc = _svc(
        {
            "owner_recurring_items": [
                {
                    "id": "w-1",
                    "tenant_id": "t-1",
                    "owner_id": "o-1",
                    "label": "Willkommensgebühr",
                    "abschnitt": "gebuehren",
                    "modus": "je_zeitraum",
                    "betrag": 50,
                    "currency": "EUR",
                    "property_id": None,
                    "aktiv": True,
                }
            ]
        }
    )
    report_id = _report(svc)
    with pytest.raises(ReportingError) as exc:
        svc.create_payment(_ctx(), report_id, PaymentCreate(owner_id="o-1"))
    assert exc.value.status_code == 422
    assert "Währungen" in exc.value.message


def test_wiederkehrender_posten_scoped_auf_den_eigenen_empfaenger() -> None:
    svc = _svc()
    with pytest.raises(ReportingError) as exc:
        svc.create_recurring(
            _ctx(),
            "o-2",
            RecurringItemCreate(
                label="X",
                abschnitt=Abschnitt.gebuehren,
                modus="je_buchung",
                betrag=10,
                currency="DKK",
            ),
        )
    assert exc.value.status_code == 404


# ----------------------------------------------------------------------
# Geplante Berichte
# ----------------------------------------------------------------------


def test_plan_laeuft_nur_am_lauftag() -> None:
    svc = _svc()
    svc.create_schedule(
        _ctx(),
        ScheduleCreate(
            name="Monatlich",
            currency="DKK",
            property_ids=["p-1"],
            recipient_ids=["o-1"],
        ),
    )
    # 11. August ist weder Monatserster noch Monatsletzter.
    assert svc.run_schedules(date(2026, 8, 11)).erzeugt == 0
    assert svc.run_schedules(date(2026, 8, 1)).erzeugt == 1


def test_plan_erzeugt_je_periode_nur_einen_bericht() -> None:
    """Wurzel 2: eine doppelte Cron-Zustellung ist real."""
    svc = _svc()
    svc.create_schedule(
        _ctx(),
        ScheduleCreate(
            name="Monatlich",
            currency="DKK",
            property_ids=["p-1"],
            recipient_ids=[],
        ),
    )
    svc.run_schedules(date(2026, 8, 1))
    zweiter = svc.run_schedules(date(2026, 8, 1))
    assert zweiter.erzeugt == 0
    assert len(svc._db.tables["owner_reports"]) == 1  # noqa: SLF001


def test_plan_name_traegt_die_periode() -> None:
    svc = _svc()
    svc.create_schedule(
        _ctx(),
        ScheduleCreate(
            name="Abrechnung",
            currency="DKK",
            property_ids=["p-1"],
            recipient_ids=[],
        ),
    )
    svc.run_schedules(date(2026, 8, 1))
    assert svc._db.tables["owner_reports"][0]["name"] == (  # noqa: SLF001
        "2026-07 Abrechnung"
    )


def test_fremder_plan_ist_nicht_ladbar() -> None:
    svc = _svc()
    plan = svc.create_schedule(
        _ctx(),
        ScheduleCreate(
            name="Monatlich",
            currency="DKK",
            property_ids=["p-1"],
            recipient_ids=[],
        ),
    )
    with pytest.raises(ReportingError) as exc:
        svc.get_schedule(_ctx("t-2"), plan.id)
    assert exc.value.status_code == 404


# ----------------------------------------------------------------------
# Empfänger-Übersicht
# ----------------------------------------------------------------------


def test_empfaenger_summen_bleiben_je_waehrung_getrennt() -> None:
    """Eine Mischsumme über DKK und EUR wäre eine Zahl, die es nicht gibt."""
    svc = _svc(
        {
            "owner_report_payments": [
                {
                    "id": "z-1",
                    "tenant_id": "t-1",
                    "owner_id": "o-1",
                    "report_id": "b-1",
                    "betrag": 100,
                    "currency": "DKK",
                },
                {
                    "id": "z-2",
                    "tenant_id": "t-1",
                    "owner_id": "o-1",
                    "report_id": "b-1",
                    "betrag": 50,
                    "currency": "EUR",
                },
            ]
        }
    )
    zeile = next(
        z for z in svc.list_empfaenger(_ctx()).items if z.owner_id == "o-1"
    )
    assert {w.currency: w.amount for w in zeile.payment_total} == {
        "DKK": 100.0,
        "EUR": 50.0,
    }
    assert zeile.hat_vertrag is False


def test_empfaenger_zeigt_fremde_mandanten_nicht() -> None:
    svc = _svc()
    assert [z.owner_id for z in svc.list_empfaenger(_ctx()).items] == ["o-1"]
