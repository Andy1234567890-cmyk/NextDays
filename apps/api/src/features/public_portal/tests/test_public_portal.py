"""Tests für public_portal (Eigentümer-Self-Service-Portal).

Schwerpunkt: Owner-Scope (nur eigene Objekte, fail-closed) und Daten-Split
(guest_masking → Owner sieht keine Beträge). In-Memory-Fake-DB.
"""
import fnmatch
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.public_portal.schemas import (
    BlockRequestCreate,
    MeterReadingCreate,
)
from src.features.public_portal.service import PortalError, PublicPortalService
from src.main import create_app

# Sperrantraege gelten nur fuer KUENFTIGE Naechte (Riegel seit 15.09.2026).
# Die Daten sind deshalb relativ zu heute, nicht fest: ein Literal wie
# `date(2026, 3, 1)` war zum Zeitpunkt des Schreibens Zukunft und ist es ein
# halbes Jahr spaeter nicht mehr — der Test waere jaehrlich umgefallen.
_ANREISE = date.today() + timedelta(days=30)
_ABREISE = _ANREISE + timedelta(days=4)


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
        self._payload_liste: list[dict] = []

    def select(self, *_a: object, **_k: object) -> "_Query":
        self._op = "select"
        return self

    def insert(self, payload: dict) -> "_Query":
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

    def upsert(self, payload: list[dict] | dict, **_k: object) -> "_Query":
        """Wie `insert`, aber mit einer Liste und ohne Doppelte (0510).

        `on_conflict` wird geschluckt: die Entdopplung passiert hier über den
        Vergleich der ganzen Zeile, was für die Testzwecke dasselbe Ergebnis
        liefert wie der UNIQUE in der echten Tabelle.
        """
        self._op = "upsert"
        self._payload_liste = payload if isinstance(payload, list) else [payload]
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
        if self._op == "update":
            treffer = [r for r in rows if self._match(r)]
            for r in treffer:
                r.update(self._payload or {})
            return _Result(treffer)
        if self._op == "delete":
            treffer = [r for r in rows if self._match(r)]
            for r in treffer:
                rows.remove(r)
            return _Result(treffer)
        if self._op == "upsert":
            neu_rows = []
            for eintrag in self._payload_liste:
                if any(
                    all(vorhanden.get(k) == v for k, v in eintrag.items())
                    for vorhanden in rows
                ):
                    continue
                row = dict(eintrag)
                row.setdefault("id", f"{self._table}-{self._db.next_id()}")
                rows.append(row)
                neu_rows.append(row)
            return _Result(neu_rows)
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
        # Bestellbare Leistungen (0510): zwei planmäßige Regeln des Betriebs.
        # „Endreinigung" gilt für alle Objekte (keine Zuordnungszeile),
        # „Wäsche" nur für p-2 — also gerade NICHT für das Objekt des
        # Eigentümers. Genau dieser Unterschied ist der Scope-Test.
        "task_rules": [
            {"id": "rule-rein", "tenant_id": "t-1", "name": "Endreinigung",
             "kind": "auto", "active": True},
            {"id": "rule-waesche", "tenant_id": "t-1", "name": "Wäsche",
             "kind": "auto", "active": True},
            # Abgeschaltet — darf nicht bestellbar sein.
            {"id": "rule-aus", "tenant_id": "t-1", "name": "Alt",
             "kind": "auto", "active": False},
            # Vorlage, keine planmäßige Regel.
            {"id": "rule-vorlage", "tenant_id": "t-1", "name": "Checkliste",
             "kind": "template", "active": True},
            # Fremder Mandant — Zielscheibe des Mandanten-Scope-Tests.
            {"id": "rule-fremd", "tenant_id": "t-9", "name": "Fremd",
             "kind": "auto", "active": True},
        ],
        "task_rule_assignments": [
            {"rule_id": "rule-waesche", "property_id": "p-2"},
        ],
        "block_request_services": [],
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


# --- Saisons: der Endpunkt ist WEG (15.09.2026) ------------------------------


def test_saison_endpunkt_existiert_nicht_mehr() -> None:
    """`/public-portal/seasons` ist entfernt, nicht reparariert.

    Er lieferte Name, Farbe und Zeitraeume und hielt `mode`/`amount` bewusst
    zurueck, weil die Preisregel Vertriebswissen des Betriebs ist (Paragraf
    4.2). Die Vorsicht lief ins Leere: `property_seasons.name` ist freier
    Text, und der Betrieb benennt seine Saisons real nach ihrer Stufe
    ("Saison A - 30", "Saison DanaCup - 50"). Der Eigentuemer las die ganze
    Aufschlagsstaffel aus der Kalenderlegende ab.

    Der Test steht hier, damit die Route nicht versehentlich zurueckkommt:
    404 ist das gewuenschte Ergebnis, nicht ein Versehen. Ein 401/403 waere
    ebenfalls falsch — das hiesse, die Route gibt es noch.
    """
    resp = client.get("/api/v1/public-portal/seasons", params={"property_id": "p-1"})
    assert resp.status_code == 404


def test_portal_service_kennt_keine_saisons_mehr() -> None:
    """Auch die Methode ist weg — nicht nur die Route davor."""
    assert not hasattr(_svc(_tables()), "seasons")


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
    """Wurzel 4: fehlt die Provision, gibt es KEINE Zahl — nur den Grund.

    Der Eigentümer EXISTIERT hier (nur sein Satz ist leer), darum lautet der
    Grund `provision_zeitraum`: Es fehlen keine Stammdaten, sondern ein für den
    Aufenthalt geltender Vertrag. Die Unterscheidung kostete real eine
    Fehlersuche (13.08.2026) — ein Vertrag ab dem 12.08. deckte eine am 09.08.
    abgereiste Buchung nicht ab, und die pauschale Meldung „kein
    Provisionssatz hinterlegt" schickte die Suche zu den Stammdaten.
    """
    tables = _tables()
    tables["owners"][0]["default_commission_pct"] = None
    res = _svc(tables).calendar(_ctx(), "p-1", date(2026, 1, 5), date(2026, 1, 8))
    assert all(d.owner_payout_per_night is None for d in res.days)
    assert {d.owner_payout_unknown_reason for d in res.days} == {
        "provision_zeitraum"
    }


def test_calendar_ohne_eigentuemer_nennt_die_stammdaten() -> None:
    """Der GEGENFALL: gar kein Eigentümer-Datensatz → `provision`.

    Beide Gründe führen zu „keine Zahl", aber zu verschiedenen Abhilfen:
    hier fehlt der Eigentümer, dort der passende Vertrag. Eine Meldung, die
    beides zusammenwirft, schickt den Leser an die falsche Stelle.
    """
    tables = _tables()
    tables["owner_properties"] = []  # Objekt ohne Eigentümer
    tables["owners"] = []
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
    """Eigennutzung (0241) bringt keine Auszahlung."""
    tables = _tables()
    tables["reservations"][0]["is_owner_stay"] = True
    res = _svc(tables).calendar(_ctx(), "p-1", date(2026, 1, 5), date(2026, 1, 8))
    assert all(d.owner_payout_per_night is None for d in res.days)


def test_calendar_eigentuemer_aufenthalt_bleibt_sichtbar() -> None:
    """Die Eigennutzung MUSS als Belegung erscheinen — sonst ist sie unsichtbar.

    Der Regressionstest zum Live-Befund vom 12.08.2026: der Ladepfad filterte
    `is_owner_stay = False`, um keine 0,00-Nacht auszuweisen. Damit verschwand
    aber die BELEGUNG mit: die Nacht kam als `status='booked'` zurück, hatte
    `units_booked=0` und eine leere `bookings`-Liste. Der Kalender zeichnet
    daraufhin nichts, und der Eigentümer sah seine eigene, genehmigte Sperre
    nicht (FeWo *Stjerneskud*, 29.08.–11.09.).

    Der Test, der es NICHT gefunden hat, ist der darüber: „kein Payout" war
    erfüllt — gerade weil die Zeile ganz fehlte.
    """
    tables = _tables()
    tables["reservations"][0]["is_owner_stay"] = True
    res = _svc(tables).calendar(_ctx(), "p-1", date(2026, 1, 5), date(2026, 1, 8))
    assert all(d.units_booked == 1 for d in res.days)
    assert all(len(d.bookings) == 1 for d in res.days)
    assert all(d.bookings[0].is_owner_stay for d in res.days)


def test_calendar_eigennutzung_ohne_erfundenen_grund() -> None:
    """Kein `payout_unknown_reason` bei Eigennutzung (Wurzel 4).

    „nicht ausweisbar" hieße: eine Grundlage FEHLT (Datenfehler). Bei einer
    Eigennutzung gibt es schlicht nichts auszuzahlen. Ein Grund schickte den
    Eigentümer auf die Suche nach einem Fehler, den es nicht gibt.
    """
    tables = _tables()
    tables["reservations"][0]["is_owner_stay"] = True
    res = _svc(tables).calendar(_ctx(), "p-1", date(2026, 1, 5), date(2026, 1, 8))
    assert all(d.owner_payout_unknown_reason is None for d in res.days)
    assert all(d.bookings[0].payout_unknown_reason is None for d in res.days)


def test_calendar_eigennutzung_ohne_gast_und_quelle() -> None:
    """Eigennutzung trägt weder Gastname noch Buchungsquelle.

    `channel='direct'` als Quelle durchzureichen ließe die eigene Sperre in der
    Oberfläche wie eine Direktbuchung aussehen — mit Kanalfarbe und Logo.
    """
    tables = _tables()
    tables["reservations"][0]["is_owner_stay"] = True
    res = _svc(tables).calendar(_ctx(), "p-1", date(2026, 1, 5), date(2026, 1, 8))
    assert all(d.guest_first_name is None for d in res.days)
    assert all(d.booking_source is None for d in res.days)
    assert all(d.bookings[0].guest_first_name is None for d in res.days)
    assert all(d.bookings[0].booking_source is None for d in res.days)


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


def test_calendar_eigennutzung_verschluckt_fremden_payout_nicht() -> None:
    """Eine Eigennutzung darf den Payout einer Schwestereinheit nicht killen.

    Der teuerste Fall des Umbaus: seit die Eigennutzung mitgeladen wird, liegt
    sie in derselben Nacht wie eine bezahlte Buchung (0265, zwei Einheiten).
    Zöge ihr fehlender Betrag die Tagessumme auf `None` — die Regel für
    unbestimmte Beträge —, verschwände das Geld der ANDEREN Einheit aus dem
    Kalender. Sie ist aber nicht unbestimmt: sie bringt nichts, und das ist
    bekannt.

    Einheit A (r-a, 80/Nacht) bleibt bezahlt, B (r-b) wird zur Eigennutzung.
    """
    tables = _zwei_einheiten(_tables())
    tables["reservations"][1]["is_owner_stay"] = True
    res = _svc(tables).calendar(_ctx(), "p-1", date(2026, 1, 2), date(2026, 1, 3))
    tag = res.days[0]
    # Beide Einheiten belegt — die Eigennutzung zählt als Belegung mit.
    assert tag.units_booked == 2
    # Die Summe ist der Payout von A allein, NICHT None.
    assert tag.owner_payout_per_night == 80.0
    assert tag.owner_payout_unknown_reason is None
    # Die Kurzform der Zelle nennt den GAST, nicht die leere Eigennutzung.
    assert tag.guest_first_name == "Erika"
    assert tag.booking_source is not None
    eigen = [b for b in tag.bookings if b.is_owner_stay]
    assert len(eigen) == 1
    assert eigen[0].owner_payout_per_night is None
    assert eigen[0].payout_unknown_reason is None


def test_earnings_zaehlt_eigennutzung_nicht_als_vermietung() -> None:
    """Die Einnahmen-Übersicht zählt VERMIETUNG — Eigennutzung gehört nicht dazu.

    Gegenstück zum Kalender, der sie bewusst MIT lädt: dort lautet die Frage
    „was belegt diese Nacht?", hier „was hat vermietet eingebracht?".

    Live gefunden am 12.08.2026: `earnings` filterte `is_owner_stay` gar nicht
    und wies dem Eigentümer 50 Nächte / 6 Buchungen aus statt 36 / 5. Die
    Auszahlungssumme blieb unauffällig, weil eine Eigennutzung
    `total_amount = 0` trägt — die falsche Zahl stand in der Belegung.
    """
    tables = _tables()
    tables["reservations"][0]["is_owner_stay"] = True
    res = _svc(tables).earnings(_ctx(), date(2026, 1, 1), date(2026, 1, 31))
    assert all(i.nights == 0 for i in res.items)
    assert all(i.reservations == 0 for i in res.items)


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


def test_earnings_zeigt_dem_eigentuemer_seine_auszahlung() -> None:
    """Die eigene Auszahlung hängt NICHT an der Gastpreis-Maske.

    Bis 08.09.2026 stand hier das Gegenteil: `total_payout is None`, weil
    `earnings` `mask.amounts` abfragte. Das verlangt PM_BOOKING_TOTAL — ein
    Recht, das ein Eigentümer per Default nicht hat. Die Einnahmen-Übersicht
    zeigte ihm deshalb durchgehend „—" samt dem Hinweis „Beträge sind für Ihren
    Zugang nicht freigegeben", während derselbe Betrag im Kalender und auf
    jedem Beleg stand. Der Kalender begründet es im Docstring von `calendar`:
    die Auszahlung ist SEIN Geld, kein Gastdatum. Der Zugriff ist über
    VIEW_OWNER_REPORTS und `_require_berichte` (0389) geschützt, nicht über
    diese Maske.
    """
    res = _svc().earnings(_ctx(), date(2026, 1, 1), date(2026, 1, 31))
    assert res.total_payout is not None
    item = next(i for i in res.items if i.property_id == "p-1")
    assert item.payout is not None
    assert item.nights == 3
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

def test_sperrantrag_fuer_vergangene_tage_wird_abgewiesen() -> None:
    """Weder Client noch Server prueften das bis zum 15.09.2026.

    Im Kalender liessen sich am Monatsanfang zwei freie VERGANGENE Tage
    ueberziehen; der Knopf wurde aktiv, und die Verwaltung bekam einen Antrag
    fuer Naechte, die vorbei sind. Der Riegel in `AufenthaltBuchen` greift nur
    beim manuellen Tippen, nicht bei der Vorbelegung aus der Ziehgeste.
    """
    from src.features.public_portal.schemas import BlockRequestCreate

    gestern = date.today() - timedelta(days=1)
    with pytest.raises(PortalError) as exc:
        _svc().request_block(
            _ctx(),
            BlockRequestCreate(
                property_id="p-1", start_date=gestern, end_date=_ABREISE
            ),
        )
    assert exc.value.status_code == 422


def test_sperrantrag_ab_heute_ist_erlaubt() -> None:
    """Die Gegenprobe: HEUTE ist keine Vergangenheit."""
    from src.features.public_portal.schemas import BlockRequestCreate

    res = _svc().request_block(
        _ctx(),
        BlockRequestCreate(
            property_id="p-1", start_date=date.today(), end_date=_ABREISE
        ),
    )
    assert res is not None


def test_request_block_on_own_property() -> None:
    svc = _svc()
    item = svc.request_block(
        _ctx(),
        BlockRequestCreate(
            property_id="p-1", start_date=_ANREISE, end_date=_ABREISE
        ),
    )
    assert item.status == "pending"
    assert item.property_id == "p-1"


def test_request_block_foreign_property_404() -> None:
    with pytest.raises(PortalError) as exc:
        _svc().request_block(
            _ctx(),
            BlockRequestCreate(
                property_id="p-2", start_date=_ANREISE, end_date=_ABREISE
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
            start_date=_ANREISE, end_date=_ABREISE,
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
            property_id="p-1", start_date=_ANREISE,
            end_date=_ABREISE,
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
                start_date=_ANREISE, end_date=_ABREISE,
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


# --- Bestellte Leistungen zur Eigentümersperrung (0510) ----------------------
#
# Bis 0510 erzeugte eine genehmigte Sperre dieselbe Regelkette wie eine
# Gastbuchung — Arbeit, die niemand beauftragt und niemand bezahlt hat. Jetzt
# entsteht eine Aufgabe nur zu einer bestellten Leistung.


def test_bestellbare_leistungen_nur_passende() -> None:
    """Angeboten wird, was für DIESES Objekt planmäßig und aktiv ist.

    „Wäsche" hängt an p-2 und darf für p-1 nicht angeboten werden — sonst
    bestellte der Eigentümer eine Leistung, aus der zu seiner Sperre nie eine
    Aufgabe entstünde. Die Vorlage und die abgeschaltete Regel fehlen ebenso;
    beides ergäbe eine Aufgabe, die es im normalen Betrieb nicht gibt.
    """
    res = _svc().bestellbare_leistungen(_ctx(), "p-1")
    assert [i.rule_id for i in res.items] == ["rule-rein"]
    # Der Name kommt mit — die Oberfläche darf keine UUID anzeigen müssen.
    assert res.items[0].name == "Endreinigung"


def test_bestellbare_leistungen_fremdes_objekt_404() -> None:
    """Derselbe Objekt-Scope wie beim Antrag selbst (Wurzel 3/9)."""
    with pytest.raises(PortalError) as exc:
        _svc().bestellbare_leistungen(_ctx(), "p-2")
    assert exc.value.status_code == 404


def test_sperrantrag_mit_bestellung_speichert_sie() -> None:
    from src.features.public_portal.schemas import BlockRequestCreate

    svc = _svc()
    item = svc.request_block(
        _ctx(),
        BlockRequestCreate(
            property_id="p-1",
            start_date=_ANREISE,
            end_date=_ABREISE,
            bestellte_leistungen=["rule-rein"],
        ),
    )
    assert [b.rule_id for b in item.bestellte_leistungen] == ["rule-rein"]
    assert item.bestellte_leistungen[0].name == "Endreinigung"
    # 0538: frisch bestellt heisst NICHT genehmigt — der Eigentuemer sieht,
    # dass die Agentur noch entscheidet.
    assert item.bestellte_leistungen[0].status == "angefragt"


def test_sperrantrag_ohne_bestellung_bleibt_leer() -> None:
    """Der Normalfall und die Vorgabe: nichts bestellt, keine Aufgabe.

    Wichtig als eigener Test, weil das Gegenteil — „leer heißt alle" — genau
    der Zustand vor 0510 war.
    """
    from src.features.public_portal.schemas import BlockRequestCreate

    svc = _svc()
    item = svc.request_block(
        _ctx(),
        BlockRequestCreate(
            property_id="p-1",
            start_date=_ANREISE,
            end_date=_ABREISE,
        ),
    )
    assert item.bestellte_leistungen == []


def test_bestellung_einer_fremden_regel_wird_abgewiesen() -> None:
    """Eine Regel-ID aus einem fremden Mandanten: 422, kein stiller Wegfall.

    Wurzel 3: der Service umgeht RLS. Ungeprüft hinge die fremde Regel am
    Antrag und würde bei der Genehmigung zur Aufgabe.
    """
    from src.features.public_portal.schemas import BlockRequestCreate

    with pytest.raises(PortalError) as exc:
        _svc().request_block(
            _ctx(),
            BlockRequestCreate(
                property_id="p-1",
                start_date=_ANREISE,
                end_date=_ABREISE,
                bestellte_leistungen=["rule-fremd"],
            ),
        )
    assert exc.value.status_code == 422


def test_bestellung_einer_regel_fuer_ein_anderes_objekt_wird_abgewiesen() -> None:
    """„Wäsche" gilt nur für p-2 — zu einer Sperre auf p-1 nicht bestellbar.

    Der Fehler, den man übersieht: die Regel gehört dem richtigen Mandanten und
    ist aktiv und planmäßig. Nur ihre Objekt-Zuordnung passt nicht.
    """
    from src.features.public_portal.schemas import BlockRequestCreate

    with pytest.raises(PortalError) as exc:
        _svc().request_block(
            _ctx(),
            BlockRequestCreate(
                property_id="p-1",
                start_date=_ANREISE,
                end_date=_ABREISE,
                bestellte_leistungen=["rule-waesche"],
            ),
        )
    assert exc.value.status_code == 422


def test_bestellung_abgeschalteter_regel_wird_abgewiesen() -> None:
    from src.features.public_portal.schemas import BlockRequestCreate

    with pytest.raises(PortalError) as exc:
        _svc().request_block(
            _ctx(),
            BlockRequestCreate(
                property_id="p-1",
                start_date=_ANREISE,
                end_date=_ABREISE,
                bestellte_leistungen=["rule-aus"],
            ),
        )
    assert exc.value.status_code == 422


def test_doppelte_bestellung_erzeugt_eine_zeile() -> None:
    """Doppelklick/Retry (Wurzel 2): zweimal dieselbe Leistung ist eine.

    Zwei Zeilen wären zwei Aufgaben. In der echten Tabelle fängt das der UNIQUE
    aus 0510 ab; hier wird geprüft, dass der Service ihn nutzt statt blind
    zweimal einzufügen.
    """
    from src.features.public_portal.schemas import BlockRequestCreate

    tables = _tables()
    svc = PublicPortalService(service_client=_DB(tables))
    svc.request_block(
        _ctx(),
        BlockRequestCreate(
            property_id="p-1",
            start_date=_ANREISE,
            end_date=_ABREISE,
            bestellte_leistungen=["rule-rein", "rule-rein"],
        ),
    )
    assert len(tables["block_request_services"]) == 1


# --- Sperrung zurueckziehen / Aufhebung beantragen (0513) --------------------
#
# Der Sperrantrag kannte bis 0513 nur eine Richtung: anlegen. „Wir kommen doch
# nicht" ging nur per Anruf, und bis jemand ihn umsetzte, blieben Naechte aus
# dem Verkauf — genau die, die jemand freiwillig zurueckgeben wollte.


def _mit_antrag(status: str = "pending", **extra: object) -> dict[str, list[dict]]:
    """Tabellen mit EINEM eigenen Antrag im gewuenschten Zustand."""
    tables = _tables()
    tables["block_requests"] = [
        {
            "id": "br-1",
            "tenant_id": "t-1",
            "property_id": "p-1",
            "requested_by": "owner-1",
            "start_date": _ANREISE.isoformat(),
            "end_date": _ABREISE.isoformat(),
            "status": status,
            "reason": None,
            "owner_freigabe": "nicht_noetig",
            "aufhebung": "keine",
            "created_at": "2026-08-01T00:00:00Z",
            **extra,
        }
    ]
    return tables


def test_offener_antrag_wird_zurueckgezogen() -> None:
    """Nichts genehmigt heisst nichts gesperrt — also kein Gegenzustand.

    Der Antrag verschwindet wirklich, statt auf 'rejected' zu gehen: 'rejected'
    hiesse „die Agentur hat abgelehnt" und waere eine Falschaussage ueber sie.
    """
    tables = _mit_antrag("pending")
    PublicPortalService(service_client=_DB(tables)).zurueckziehen(_ctx(), "br-1")
    assert tables["block_requests"] == []


def test_genehmigter_antrag_laesst_sich_nicht_zurueckziehen() -> None:
    """Hier haengt eine Reservierung dran — das entscheidet die Agentur.

    Ohne diesen Riegel loeschte der Eigentuemer den Antrag, und die Belegung
    bliebe ohne Anker im Kalender stehen: gesperrt fuer immer, ohne dass noch
    etwas darauf hinweist (Wurzel 1).
    """
    tables = _mit_antrag("approved")
    with pytest.raises(PortalError) as exc:
        PublicPortalService(service_client=_DB(tables)).zurueckziehen(_ctx(), "br-1")
    assert exc.value.status_code == 409
    assert tables["block_requests"]  # steht noch


def test_fremder_antrag_ist_nicht_zurueckziehbar() -> None:
    """Wurzel 3/9: nur EIGENE Antraege, nicht die anderer Eigentuemer.

    `requested_by` ist Teil der Ladeabfrage, nicht eine Pruefung danach.
    """
    tables = _mit_antrag("pending", requested_by="owner-fremd")
    with pytest.raises(PortalError) as exc:
        PublicPortalService(service_client=_DB(tables)).zurueckziehen(_ctx(), "br-1")
    assert exc.value.status_code == 404
    assert tables["block_requests"]


def test_aufhebung_beantragen_laesst_die_sperrung_bestehen() -> None:
    """DER KERN: ein Wunsch gibt nichts frei.

    `status` bleibt 'approved' — die Naechte sind bis zur Entscheidung der
    Agentur weiter gesperrt. Stuende hier ein anderer Status, riefe der
    EXCLUDE-Constraint aus 0377 oder der Kalender ein anderes Ergebnis hervor.
    """
    tables = _mit_antrag("approved")
    item = PublicPortalService(service_client=_DB(tables)).aufhebung_beantragen(
        _ctx(), "br-1", "Wir kommen doch nicht"
    )
    assert item.aufhebung == "beantragt"
    zeile = tables["block_requests"][0]
    assert zeile["status"] == "approved"
    assert zeile["aufhebung_grund"] == "Wir kommen doch nicht"
    assert zeile["aufhebung_beantragt_am"]


def test_aufhebung_nur_bei_genehmigter_sperrung() -> None:
    """Ein offener Antrag wird zurueckgezogen, nicht aufgehoben."""
    tables = _mit_antrag("pending")
    with pytest.raises(PortalError) as exc:
        PublicPortalService(service_client=_DB(tables)).aufhebung_beantragen(
            _ctx(), "br-1", None
        )
    assert exc.value.status_code == 409


def test_zweiter_aufhebungswunsch_wird_abgewiesen() -> None:
    """Wurzel 2: ein Doppelklick darf den Beantragungszeitpunkt nicht
    ueberschreiben — sonst rutscht der Vorgang in der Warteschlange der Agentur
    immer wieder nach hinten."""
    tables = _mit_antrag(
        "approved", aufhebung="beantragt",
        aufhebung_beantragt_am="2026-08-20T10:00:00Z",
    )
    with pytest.raises(PortalError) as exc:
        PublicPortalService(service_client=_DB(tables)).aufhebung_beantragen(
            _ctx(), "br-1", None
        )
    assert exc.value.status_code == 409
    assert tables["block_requests"][0]["aufhebung_beantragt_am"] == (
        "2026-08-20T10:00:00Z"
    )


def test_aufhebung_fremder_sperrung_ist_nicht_moeglich() -> None:
    tables = _mit_antrag("approved", requested_by="owner-fremd")
    with pytest.raises(PortalError) as exc:
        PublicPortalService(service_client=_DB(tables)).aufhebung_beantragen(
            _ctx(), "br-1", None
        )
    assert exc.value.status_code == 404


def test_leerer_grund_wird_nicht_als_text_gespeichert() -> None:
    """Ein Leerzeichen ist keine Begruendung (Wurzel 4): sonst zeigte die
    Agentur-Warteschlange „Begruendung: " mit nichts dahinter."""
    tables = _mit_antrag("approved")
    PublicPortalService(service_client=_DB(tables)).aufhebung_beantragen(
        _ctx(), "br-1", "   "
    )
    assert tables["block_requests"][0]["aufhebung_grund"] is None


# --- Finanzübersicht der Startseite (07.09.2026) -----------------------------
# Dieselbe Zahl wie im Kalender: r-1 (900 €, 20 %, 3 Nächte 05.–07.01.) ergibt
# 720 € netto, 240 € je Nacht. Was hier abweicht, weicht auch vom Beleg ab.


def test_finanzen_tagesreihe_summiert_naechte_und_payout() -> None:
    res = _svc().finanzen(_ctx(), date(2026, 1, 1), date(2026, 1, 31))
    assert res.granularity == "day"
    assert res.event == "calendar"
    assert res.currency == "EUR"
    assert res.property_ids == ["p-1"]
    assert res.units_total == 1
    assert res.comparison is None
    reihe = res.current
    assert len(reihe.points) == 31
    je_tag = {p.label: p for p in reihe.points}
    # Die drei Nächte tragen je 240 €; der Abreisetag ist keine Nacht mehr.
    assert je_tag["2026-01-05"].payout == 240.0
    assert je_tag["2026-01-07"].payout == 240.0
    assert je_tag["2026-01-08"].payout == 0.0
    assert je_tag["2026-01-08"].nights == 0
    # Anreise zählt genau einmal, am Anreisetag.
    assert je_tag["2026-01-05"].reservations == 1
    assert je_tag["2026-01-06"].reservations == 0
    # Auslastung je Tag: eine Einheit, eine Nacht → 100 %.
    assert je_tag["2026-01-05"].occupancy_rate == 100.0
    assert je_tag["2026-01-05"].capacity_unit_nights == 1
    assert reihe.payout_total == 720.0
    assert reihe.payout_unknown_reason is None
    assert reihe.nights == 3
    assert reihe.reservations == 1
    assert reihe.capacity_unit_nights == 31
    assert reihe.occupancy_rate == 9.68
    assert reihe.avg_payout_per_night == 240.0


def test_finanzen_monatsreihe_bei_langer_spanne() -> None:
    res = _svc().finanzen(_ctx(), date(2026, 1, 1), date(2026, 12, 31))
    assert res.granularity == "month"
    assert [p.label for p in res.current.points][:3] == ["2026-01", "2026-02", "2026-03"]
    assert len(res.current.points) == 12
    januar = res.current.points[0]
    assert (januar.payout, januar.nights, januar.capacity_unit_nights) == (720.0, 3, 31)
    assert res.current.payout_total == 720.0


def test_finanzen_ereignis_anreise_bucht_ganz_auf_den_anreisetag() -> None:
    res = _svc().finanzen(
        _ctx(), date(2026, 1, 1), date(2026, 1, 31), event="check_in"
    )
    assert res.event == "check_in"
    je_tag = {p.label: p for p in res.current.points}
    assert je_tag["2026-01-05"].payout == 720.0
    assert je_tag["2026-01-05"].nights == 3
    assert je_tag["2026-01-05"].reservations == 1
    assert je_tag["2026-01-06"].payout == 0.0
    assert je_tag["2026-01-06"].nights == 0
    assert res.current.payout_total == 720.0
    assert res.current.avg_payout_per_night == 240.0


def test_finanzen_vergleich_ist_der_vorjahreszeitraum() -> None:
    res = _svc().finanzen(
        _ctx(), date(2026, 1, 1), date(2026, 1, 31), compare=True
    )
    assert res.comparison is not None
    assert (str(res.comparison.date_from), str(res.comparison.date_to)) == (
        "2025-01-01",
        "2025-01-31",
    )
    assert len(res.comparison.points) == 31
    # Kein Umsatz im Vorjahr ist eine echte Null, kein fehlender Wert.
    assert res.comparison.payout_total == 0.0
    assert res.comparison.nights == 0


def test_finanzen_eigennutzung_zaehlt_zur_auslastung_nicht_zum_geld() -> None:
    tables = _tables()
    tables["reservations"].append(
        {
            "id": "r-eigen",
            "property_id": "p-1",
            "tenant_id": "t-1",
            "guest_id": None,
            "channel": "direct",
            "ota_name": None,
            "check_in": "2026-01-10",
            "check_out": "2026-01-12",
            "status": "confirmed",
            "total_amount": 0,
            "channel_fee": 0,
            "currency": "EUR",
            "is_owner_stay": True,
        }
    )
    res = _svc(tables).finanzen(_ctx(), date(2026, 1, 1), date(2026, 1, 31))
    je_tag = {p.label: p for p in res.current.points}
    assert je_tag["2026-01-10"].owner_stay_nights == 1
    assert je_tag["2026-01-10"].nights == 0
    assert je_tag["2026-01-10"].occupancy_rate == 100.0
    # Die Eigennutzung ist keine Anreise im Sinn der Vermietung.
    assert je_tag["2026-01-10"].reservations == 0
    assert res.current.payout_total == 720.0
    assert res.current.owner_stay_nights == 2
    assert res.current.nights == 3


def test_finanzen_unbestimmter_betrag_kippt_den_punkt_mit_grund() -> None:
    # Ohne Provisionssatz gibt es keinen Betrag — der Punkt und die Summe
    # werden None mit Grund, nie eine erfundene Null (Wurzel 4).
    tables = _tables()
    tables["owners"][0]["default_commission_pct"] = None
    res = _svc(tables).finanzen(_ctx(), date(2026, 1, 1), date(2026, 1, 31))
    je_tag = {p.label: p for p in res.current.points}
    assert je_tag["2026-01-05"].payout is None
    assert je_tag["2026-01-05"].nights == 1
    assert je_tag["2026-01-20"].payout == 0.0
    assert res.current.payout_total is None
    assert res.current.payout_unknown_reason is not None
    assert res.current.avg_payout_per_night is None


def test_finanzen_ohne_finanzfreigabe_kein_geld_aber_auslastung() -> None:
    svc = _svc()
    # Familienzugang ohne Berichte-Freigabe (0389): der Endpunkt bleibt offen,
    # jedes Geldfeld ist None, die Belegung sichtbar.
    svc._darf_berichte = lambda _ctx: False  # noqa: SLF001
    res = svc.finanzen(_ctx(), date(2026, 1, 1), date(2026, 1, 31))
    assert res.currency is None
    assert res.current.payout_total is None
    assert res.current.payout_unknown_reason is None
    assert res.current.avg_payout_per_night is None
    assert all(p.payout is None for p in res.current.points)
    assert res.current.nights == 3


def test_finanzen_fremdes_objekt_404() -> None:
    with pytest.raises(PortalError) as exc:
        _svc().finanzen(_ctx(), date(2026, 1, 1), date(2026, 1, 31), property_id="p-2")
    assert exc.value.status_code == 404


def test_finanzen_spanne_gedeckelt_422() -> None:
    with pytest.raises(PortalError) as exc:
        _svc().finanzen(_ctx(), date(2024, 1, 1), date(2026, 12, 31))
    assert exc.value.status_code == 422


def test_finanzen_ende_vor_anfang_400() -> None:
    with pytest.raises(PortalError) as exc:
        _svc().finanzen(_ctx(), date(2026, 2, 1), date(2026, 1, 1))
    assert exc.value.status_code == 400


def test_finanzen_route_verlangt_anmeldung() -> None:
    resp = client.get(
        "/api/v1/public-portal/finanzen",
        params={"date_from": "2026-01-01", "date_to": "2026-01-31"},
    )
    assert resp.status_code == 401


def test_finanzen_kennt_nur_zwei_ereignisse() -> None:
    # Ein unbekanntes Ereignis ist ein 422, kein stiller Rückfall auf
    # „calendar" (Wurzel 4) und kein 500.
    with pytest.raises(PortalError) as exc:
        _svc().finanzen(_ctx(), date(2026, 1, 1), date(2026, 1, 31), event="umsatz")
    assert exc.value.status_code == 422


# --- Abrechnung im Detail (07.09.2026) --------------------------------------


def test_statement_detail_delegiert_an_den_abrechnungs_slice(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from src.features.owner_statements import service as os_service

    gesehen: dict[str, object] = {}

    def fake_get(self: object, ctx: AuthContext, statement_id: str) -> str:  # noqa: ARG001
        gesehen["ctx"] = ctx
        gesehen["id"] = statement_id
        return "beleg"

    monkeypatch.setattr(os_service.OwnerStatementsService, "get", fake_get)
    res = _svc().statement_detail(_ctx(), "s-1")
    assert res == "beleg"
    assert gesehen["id"] == "s-1"
    assert getattr(gesehen["ctx"], "role", None) == "owner"


def test_statement_detail_reicht_404_des_abrechnungs_slices_durch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from src.features.owner_statements import service as os_service

    def fake_get(self: object, ctx: AuthContext, statement_id: str) -> None:  # noqa: ARG001
        raise os_service.StatementError("Statement nicht gefunden.", status_code=404)

    monkeypatch.setattr(os_service.OwnerStatementsService, "get", fake_get)
    with pytest.raises(PortalError) as exc:
        _svc().statement_detail(_ctx(), "fremd")
    assert exc.value.status_code == 404


def test_statement_detail_ohne_finanzfreigabe_403() -> None:
    svc = _svc()
    svc._darf_berichte = lambda _ctx: False  # noqa: SLF001
    with pytest.raises(PortalError) as exc:
        svc.statement_detail(_ctx(), "s-1")
    assert exc.value.status_code == 403


def test_statement_detail_route_verlangt_anmeldung() -> None:
    resp = client.get("/api/v1/public-portal/statements/s-1")
    assert resp.status_code == 401


# --- Gäste am Sperrantrag (0606) ---------------------------------------------


def test_request_block_traegt_gaeste_und_liefert_sie_zurueck() -> None:
    svc = _svc()
    item = svc.request_block(
        _ctx(),
        BlockRequestCreate(
            property_id="p-1",
            start_date=_ANREISE,
            end_date=_ABREISE,
            guests=2,
            reason="Spätes Check-out gewünscht",
        ),
    )
    assert item.guests == 2
    assert item.reason == "Spätes Check-out gewünscht"
    liste = svc.my_block_requests(_ctx())
    assert liste.items[0].guests == 2


def test_request_block_ohne_gaeste_bleibt_none() -> None:
    # Nicht angegeben ist nicht „eine Person" (Wurzel 4).
    item = _svc().request_block(
        _ctx(),
        BlockRequestCreate(
            property_id="p-1", start_date=_ANREISE, end_date=_ABREISE
        ),
    )
    assert item.guests is None


def test_request_block_gaeste_ausser_bereich_422() -> None:
    with pytest.raises(ValueError, match="guests"):
        BlockRequestCreate(
            property_id="p-1",
            start_date=_ANREISE,
            end_date=_ABREISE,
            guests=0,
        )
