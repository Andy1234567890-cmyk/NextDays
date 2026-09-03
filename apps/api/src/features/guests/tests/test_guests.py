"""Tests für den guests-Slice (Enterprise-Gästekarte).

Flexible In-Memory-Fake-DB (deckt die genutzten Supabase-Query-Ketten ab) +
Masking-Matrix über echte feingranulare Berechtigungen (load_guest_mask liest `users`).
"""
import re

import pytest
from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.guests.schemas import (
    ConsentCreate,
    GuestCreate,
    GuestUpdate,
    IdentityDocCreate,
)
from src.features.guests.service import GuestsError, GuestsService
from src.main import create_app

client = TestClient(create_app())


def test_guests_health() -> None:
    resp = client.get("/api/v1/guests/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "guests", "status": "ok"}


# --- In-Memory-Fake-DB ------------------------------------------------------
def _singular(tabelle):  # noqa: ANN001, ANN201
    """Tabellenname → Fremdschluessel-Stamm: properties → property.

    NICHT `rstrip("s")`: das entfernt ZEICHEN, keine Endung — aus 'properties'
    wuerde 'propertie' und der Join liefe ins Leere.
    """
    if tabelle.endswith("ies"):
        return tabelle[:-3] + "y"
    return tabelle[:-1] if tabelle.endswith("s") else tabelle


def _sortwert(v):  # noqa: ANN001, ANN201
    """Vergleichbarer Schluessel: bool/Zahl/Text getrennt, None faellt vorher raus."""
    if isinstance(v, bool):
        return (0, int(v), "")
    if isinstance(v, (int, float)):
        return (0, v, "")
    return (1, 0, str(v))


class _Res:
    def __init__(self, data, count=None) -> None:  # noqa: ANN001
        self.data = data
        self.count = count


class _Query:
    """Deckt select/insert/update/delete/upsert + Filter/Order/Range ab."""

    def __init__(self, store, name) -> None:  # noqa: ANN001
        self._store = store
        self._name = name
        self._rows = store.setdefault(name, [])
        self._op = "select"
        self._eq: dict = {}
        self._in: tuple | None = None
        self._is: tuple | None = None
        self._or: str | None = None
        self._payload = None
        self._count = None
        self._order: list[tuple] = []
        self._limit: int | None = None
        self._range: tuple | None = None
        self._embeds: list[tuple] = []

    def select(self, *cols, count=None, **_k):  # noqa: ANN002, ANN003, ANN201
        self._op = "select"
        self._count = count
        # Eingebettete Ressourcen der PostgREST-Grammatik erkennen:
        # `properties(title)` heisst „nimm die verknuepfte Zeile mit". Ohne das
        # gaebe die Fake-DB fuer jeden Join stumm `None` zurueck und ein Test
        # darueber waere wertlos — die Gaesteliste holt den Objekttitel genau so.
        spec = ", ".join(str(c) for c in cols)
        for tabelle, felder in re.findall(r"(\w+)\(([^)]*)\)", spec):
            self._embeds.append(
                (tabelle, [f.strip() for f in felder.split(",") if f.strip()])
            )
        return self

    def _mit_embeds(self, rows):  # noqa: ANN001, ANN202
        """Verknuepfte Zeile anhaengen — ueber `<tabelle_singular>_id`.

        Deckt genau den Fall der Gaesteliste ab (`reservations.property_id` →
        `properties.title`), nicht die volle PostgREST-Grammatik. Mehr waere
        Test-Infrastruktur ohne Anlass.
        """
        if not self._embeds:
            return rows
        out = []
        for r in rows:
            kopie = dict(r)
            for tabelle, felder in self._embeds:
                fk = f"{_singular(tabelle)}_id"
                ziel = next(
                    (z for z in self._store.get(tabelle, [])
                     if z.get("id") == r.get(fk)),
                    None,
                )
                kopie[tabelle] = (
                    {f: ziel.get(f) for f in felder} if ziel else None
                )
            out.append(kopie)
        return out

    def insert(self, payload):  # noqa: ANN001, ANN201
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload):  # noqa: ANN001, ANN201
        self._op = "update"
        self._payload = payload
        return self

    def upsert(self, payload, **_k):  # noqa: ANN001, ANN003, ANN201
        self._op = "upsert"
        self._payload = payload
        return self

    def delete(self):  # noqa: ANN201
        self._op = "delete"
        return self

    def eq(self, col, val):  # noqa: ANN001, ANN201
        self._eq[col] = val
        return self

    def in_(self, col, vals):  # noqa: ANN001, ANN201
        self._in = (col, list(vals))
        return self

    def is_(self, col, val):  # noqa: ANN001, ANN201
        """PostgREST `is.null` / `is.not.null` — der Dubletten-Scan schliesst
        damit anonymisierte Gaeste aus. Ein No-Op hier hiesse: der Test „nach
        dem Merge wird die Quelle nicht erneut vorgeschlagen" waere gruen,
        ohne den Filter zu pruefen."""
        self._is = (col, val)
        return self

    def or_(self, expr):  # noqa: ANN001, ANN201
        self._or = expr
        return self

    def order(self, col, *, desc=False, **_k):  # noqa: ANN001, ANN003, ANN201
        # ECHT sortieren statt durchwinken. Ein No-Op hier hiesse: jeder Test
        # ueber eine Reihenfolge ist gruen, ohne etwas zu pruefen — genau die
        # Luecke, durch die die Gaesteliste live 150 namenlose Airbnb-Gaeste vor
        # die 143 gepflegten sortierte (30.08.2026). Mehrfachaufrufe stapeln
        # sich wie in PostgREST: zuerst gerufen = aeusseres Kriterium.
        self._order.append((col, desc))
        return self

    def limit(self, n, **_k):  # noqa: ANN001, ANN003, ANN201
        self._limit = n
        return self

    def range(self, start, end):  # noqa: ANN001, ANN201
        self._range = (start, end)
        return self

    def _sortiert(self, rows):  # noqa: ANN001, ANN202
        """Sortierschluessel wie PostgREST: None zuletzt, sonst nach Typ."""
        for col, desc in reversed(self._order):
            rows = sorted(
                rows,
                key=lambda r: (r.get(col) is None, _sortwert(r.get(col))),
                reverse=desc,
            )
        return rows

    def _match(self, r):  # noqa: ANN001, ANN202
        for c, v in self._eq.items():
            if r.get(c) != v:
                return False
        if self._in:
            col, vals = self._in
            if r.get(col) not in vals:
                return False
        if self._is:
            col, val = self._is
            ist_null = r.get(col) is None
            erwartet_null = str(val).lower() == "null"
            if ist_null is not erwartet_null:
                return False
        if self._or:
            # einfache ilike-OR-Suche über die genannten Spalten
            ok = False
            for t in self._or.split(","):
                col, _op, pat = t.split(".", 2)
                # PostgREST-Grammatik: der Wert kann in Doppelquotes stehen
                # (Trenner-Escaping). Quotes + Wildcards für den Literal-Vergleich
                # entfernen (Muster wie im echten _or_ilike_term).
                needle = pat.strip('"').strip("%").lower()
                if needle in str(r.get(col) or "").lower():
                    ok = True
            if not ok:
                return False
        return True

    def execute(self):  # noqa: ANN201
        import uuid

        if self._op == "select":
            rows = [r for r in self._rows if self._match(r)]
            gesamt = len(rows)
            rows = self._sortiert(rows)
            if self._range is not None:
                start, ende = self._range
                rows = rows[start : ende + 1]
            elif self._limit is not None:
                rows = rows[: self._limit]
            rows = self._mit_embeds(rows)
            # `count="exact"` zaehlt die TREFFER, nicht die ausgelieferte Seite —
            # sonst meldete jede Liste mit Ausschnitt eine zu kleine Gesamtzahl.
            return _Res(list(rows), count=gesamt if self._count else None)
        if self._op in ("insert", "upsert"):
            payloads = (
                self._payload if isinstance(self._payload, list) else [self._payload]
            )
            out = []
            for p in payloads:
                row = dict(p)
                row.setdefault("id", str(uuid.uuid4()))
                row.setdefault("created_at", "2026-06-23T00:00:00Z")
                row.setdefault("updated_at", "2026-06-23T00:00:00Z")
                if self._op == "upsert":
                    self._rows[:] = [
                        x for x in self._rows
                        if x.get("guest_id") != row.get("guest_id")
                    ]
                self._rows.append(row)
                out.append(row)
            return _Res(out)
        if self._op == "update":
            updated = []
            for r in self._rows:
                if self._match(r):
                    r.update(self._payload)
                    updated.append(r)
            return _Res(updated)
        if self._op == "delete":
            removed = [r for r in self._rows if self._match(r)]
            self._rows[:] = [r for r in self._rows if not self._match(r)]
            return _Res(removed)
        return _Res([])


class _FakeDB:
    def __init__(self, store) -> None:  # noqa: ANN001
        self._store = store

    def table(self, name):  # noqa: ANN001, ANN201
        return _Query(self._store, name)


# Berechtigungssätze. access_pm_features ist das PM-Dach: ohne es fallen
# pm_guest_details/pm_booking_total weg (effective_permissions) — in der echten
# App kommt pm_* nie ohne das Dach.
_PERMS_FULL = [
    "access_pm_features",
    "pm_guest_details", "edit_guest", "view_guest_name", "view_guest_contact",
    "view_guest_id_docs", "view_booking_source", "pm_booking_total",
]
_PERMS_LIMITED = ["access_pm_features", "pm_guest_details"]  # Zugriff, alles maskiert


def _svc(store=None, *, role="admin", perms=None) -> GuestsService:  # noqa: ANN001
    store = store if store is not None else {}
    store.setdefault("users", []).append({
        "id": "u", "tenant_id": "t1", "full_name": "Tester", "email": "t@x.de",
        "role": role, "permissions": _PERMS_FULL if perms is None else perms,
    })
    return GuestsService(service_client=_FakeDB(store))


_CTX = AuthContext(user_id="u", tenant_id="t1", role="admin")


def _guest_row(tenant="t1", **over):  # noqa: ANN001, ANN201
    base = {
        "id": "g1", "tenant_id": tenant, "name": "Anna Müller",
        "first_name": "Anna", "last_name": "Müller", "email": "anna@x.de",
        "phone": "+49 170", "company": "ACME", "vip_code": "GOLD",
        "segment": "business", "is_blocked": False, "stays_count": 3,
        "last_stay_at": "2026-05-01", "total_revenue": 1200, "source": "Direct",
        "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z",
    }
    base.update(over)
    return base


# --- CRUD -------------------------------------------------------------------
def test_create_derives_name_from_first_last() -> None:
    svc = _svc()
    out = svc.create(_CTX, GuestCreate(first_name="Max", last_name="Muster"))
    assert out.name == "Max Muster"


def test_get_404_when_foreign_tenant() -> None:
    store = {"guests": [_guest_row(tenant="other")]}
    svc = _svc(store)
    with pytest.raises(GuestsError) as exc:
        svc.get(_CTX, "g1")
    assert exc.value.status_code == 404


def test_update_changes_fields() -> None:
    store = {"guests": [_guest_row()]}
    svc = _svc(store)
    out = svc.update(_CTX, "g1", GuestUpdate(segment="leisure"))
    assert out.segment == "leisure"


# --- Suche / Filter ---------------------------------------------------------
def test_list_search_matches_name() -> None:
    store = {"guests": [_guest_row(), _guest_row(id="g2", name="Bob", email="b@x.de")]}
    svc = _svc(store)
    out = svc.list(_CTX, q="anna")
    assert [i.id for i in out.items] == ["g1"]


def test_list_filter_blocked() -> None:
    store = {"guests": [
        _guest_row(), _guest_row(id="g2", name="Block", is_blocked=True),
    ]}
    svc = _svc(store)
    out = svc.list(_CTX, blocked=True)
    assert [i.id for i in out.items] == ["g2"]


# --- Unvollstaendige Gaeste (Airbnb liefert keinen Namen) -------------------
#
# Der Anlass, live gemessen am 30.08.2026 beim Beta-Betrieb: 150 von 293 Gaesten
# hiessen '—', standen wegen `order("name")` GANZ OBEN und trugen alle
# `needs_review = false`. Die Kartei sah leer aus, obwohl 143 Gaeste gepflegt
# waren — sie standen auf Seite vier.
def test_list_sortiert_unvollstaendige_ans_ende() -> None:
    """Gepflegte Gaeste zuerst, namenlose danach.

    '—' steht in der Kollation VOR jedem Buchstaben. Ohne die
    `needs_review`-Sortierung fuellt der Platzhalter also den ersten
    Bildschirm.
    """
    store = {"guests": [
        _guest_row(id="g1", name="—", needs_review=True),
        _guest_row(id="g2", name="Zora Zimmer", needs_review=False),
        _guest_row(id="g3", name="Anna Adam", needs_review=False),
    ]}
    out = _svc(store).list(_CTX)
    assert [i.id for i in out.items] == ["g3", "g2", "g1"]


def test_list_filter_needs_review() -> None:
    """Der Filter „Unvollstaendig" ist der Weg zur gezielten Nachpflege."""
    store = {"guests": [
        _guest_row(id="g1", name="—", needs_review=True),
        _guest_row(id="g2", name="Anna Adam", needs_review=False),
    ]}
    out = _svc(store).list(_CTX, needs_review=True)
    assert [i.id for i in out.items] == ["g1"]
    assert out.items[0].needs_review is True


def test_list_buchungsbezug_nur_fuer_unvollstaendige() -> None:
    """Objekt/Kanal/Anreise ersetzen den fehlenden Namen — und nur dann.

    Ein namenloser Gast ist nicht identitaetslos: er haengt an einem Objekt und
    einem Zeitraum. Bei gepflegten Gaesten bliebe der Bezug ueberfluessig und
    die Antwort nur groesser.
    """
    store = {
        "guests": [
            _guest_row(id="g1", name="—", needs_review=True),
            _guest_row(id="g2", name="Anna Adam", needs_review=False),
        ],
        "properties": [{"id": "p1", "title": "Feriehus Line"}],
        "reservations": [
            {"id": "r1", "tenant_id": "t1", "guest_id": "g1",
             "property_id": "p1", "channel": "airbnb", "check_in": "2026-08-02"},
            {"id": "r2", "tenant_id": "t1", "guest_id": "g2",
             "property_id": "p1", "channel": "website", "check_in": "2026-08-05"},
        ],
    }
    out = _svc(store).list(_CTX)
    zeilen = {i.id: i for i in out.items}
    assert zeilen["g1"].letztes_objekt == "Feriehus Line"
    assert zeilen["g1"].letzter_kanal == "airbnb"
    assert str(zeilen["g1"].letzte_anreise) == "2026-08-02"
    # Gepflegter Gast: kein Bezug, obwohl eine Buchung existiert.
    assert zeilen["g2"].letztes_objekt is None
    assert zeilen["g2"].letzter_kanal is None


def test_list_buchungsbezug_nimmt_die_juengste() -> None:
    """Bei mehreren Aufenthalten zaehlt der letzte — er ist der wiedererkennbare."""
    store = {
        "guests": [_guest_row(id="g1", name="—", needs_review=True)],
        "properties": [
            {"id": "p1", "title": "Alt"}, {"id": "p2", "title": "Neu"},
        ],
        "reservations": [
            {"id": "r1", "tenant_id": "t1", "guest_id": "g1",
             "property_id": "p1", "channel": "airbnb", "check_in": "2025-01-01"},
            {"id": "r2", "tenant_id": "t1", "guest_id": "g1",
             "property_id": "p2", "channel": "airbnb", "check_in": "2026-08-02"},
        ],
    }
    out = _svc(store).list(_CTX)
    assert out.items[0].letztes_objekt == "Neu"


def test_list_kanal_faellt_unter_die_quellen_maske() -> None:
    """Der Kanal ist Vertriebsherkunft (§4.3) — Objekt und Datum bleiben.

    Die Reinigung muss die Buchung zuordnen koennen, ohne zu erfahren, ueber
    welches Portal sie kam.
    """
    store = {
        "guests": [_guest_row(id="g1", name="—", needs_review=True)],
        "properties": [{"id": "p1", "title": "Feriehus Line"}],
        "reservations": [
            {"id": "r1", "tenant_id": "t1", "guest_id": "g1",
             "property_id": "p1", "channel": "airbnb", "check_in": "2026-08-02"},
        ],
    }
    out = _svc(store, role="cleaner", perms=_PERMS_LIMITED).list(_CTX)
    assert out.items[0].letzter_kanal is None
    assert out.items[0].letztes_objekt == "Feriehus Line"


def test_list_ohne_unvollstaendige_kein_buchungsabruf() -> None:
    """Kein Zusatzabruf, wenn nichts nachzuschlagen ist (N+1-Vermeidung)."""
    store = {"guests": [_guest_row(id="g1", name="Anna Adam")]}
    out = _svc(store).list(_CTX)
    assert out.items[0].letztes_objekt is None


# --- Masking-Matrix ---------------------------------------------------------
def test_admin_sees_full_name_contact_amount() -> None:
    store = {"guests": [_guest_row()]}
    svc = _svc(store, role="admin", perms=_PERMS_LIMITED)  # admin = alles trotzdem
    out = svc.get(_CTX, "g1")
    assert out.name == "Anna Müller"
    assert out.email == "anna@x.de"
    assert out.total_revenue == 1200.0


def test_limited_role_masks_name_contact_amount() -> None:
    store = {"guests": [_guest_row()]}
    svc = _svc(store, role="staff", perms=_PERMS_LIMITED)
    ctx = AuthContext(user_id="u", tenant_id="t1", role="staff")
    out = svc.get(ctx, "g1")
    assert out.name == "Anna"          # nur Vorname
    assert out.email is None           # kein Kontakt
    assert out.last_name is None       # Nachname verborgen
    assert out.total_revenue is None   # kein Betrag


def test_id_docs_masked_without_permission() -> None:
    store = {
        "guests": [_guest_row()],
        "guest_identity_documents": [{
            "id": "d1", "tenant_id": "t1", "guest_id": "g1",
            "doc_type": "passport", "number": "P1234567",
            "issuing_country": "DE", "valid_until": "2030-01-01",
        }],
    }
    svc = _svc(store, role="staff", perms=_PERMS_LIMITED)
    ctx = AuthContext(user_id="u", tenant_id="t1", role="staff")
    out = svc.list_identity_docs(ctx, "g1")
    assert out.items[0].number == "••• 4567"   # maskiert


def test_id_docs_full_with_permission() -> None:
    store = {
        "guests": [_guest_row()],
        "guest_identity_documents": [{
            "id": "d1", "tenant_id": "t1", "guest_id": "g1",
            "doc_type": "passport", "number": "P1234567",
        }],
    }
    svc = _svc(store)  # admin
    out = svc.list_identity_docs(_CTX, "g1")
    assert out.items[0].number == "P1234567"


def test_add_id_doc_denied_without_permission() -> None:
    store = {"guests": [_guest_row()]}
    svc = _svc(store, role="staff", perms=_PERMS_LIMITED)
    ctx = AuthContext(user_id="u", tenant_id="t1", role="staff")
    with pytest.raises(GuestsError) as exc:
        svc.add_identity_doc(
            ctx, "g1", IdentityDocCreate(doc_type="id_card", number="X1")
        )
    assert exc.value.status_code == 403


# --- Consent append-only ----------------------------------------------------
def test_consent_append_only_keeps_history() -> None:
    store = {"guests": [_guest_row()]}
    svc = _svc(store)
    svc.add_consent(_CTX, "g1", ConsentCreate(
        consent_type="marketing_email", status="granted",
    ))
    svc.add_consent(_CTX, "g1", ConsentCreate(
        consent_type="marketing_email", status="revoked",
    ))
    out = svc.list_consents(_CTX, "g1")
    assert out.total == 2  # beide Einträge erhalten (kein Update)


def test_consent_rejects_invalid_status() -> None:
    store = {"guests": [_guest_row()]}
    svc = _svc(store)
    with pytest.raises(GuestsError) as exc:
        svc.add_consent(_CTX, "g1", ConsentCreate(
            consent_type="x", status="maybe",
        ))
    assert exc.value.status_code == 422


# --- DSGVO-Löschung / Anonymisierung ----------------------------------------
def test_delete_hard_when_no_reservation() -> None:
    store = {"guests": [_guest_row()], "reservations": []}
    svc = _svc(store)
    out = svc.delete(_CTX, "g1")
    assert out == {"deleted": True}
    assert store["guests"] == []


def test_delete_anonymizes_when_reservation_exists() -> None:
    store = {
        "guests": [_guest_row()],
        "reservations": [{"id": "r1", "tenant_id": "t1", "guest_id": "g1"}],
        "guest_identity_documents": [
            {"id": "d1", "tenant_id": "t1", "guest_id": "g1", "number": "X"}
        ],
    }
    svc = _svc(store)
    out = svc.delete(_CTX, "g1")
    assert out == {"anonymized": True}
    g = store["guests"][0]
    assert g["name"] == "Anonymisiert" and g["email"] is None
    assert g["anonymized_at"] is not None
    assert store["guest_identity_documents"] == []  # sensible Daten entfernt


# --- Cross-Tenant-Isolation -------------------------------------------------
def test_cross_tenant_list_isolated() -> None:
    store = {"guests": [_guest_row(), _guest_row(id="g2", tenant="t2", name="Fremd")]}
    svc = _svc(store)
    out = svc.list(_CTX)
    assert [i.id for i in out.items] == ["g1"]  # nur eigener Tenant


def test_cross_tenant_subresource_404() -> None:
    store = {"guests": [_guest_row(tenant="t2")]}
    svc = _svc(store)
    with pytest.raises(GuestsError) as exc:
        svc.list_notes(_CTX, "g1")
    assert exc.value.status_code == 404


# --- Merge ------------------------------------------------------------------
def test_merge_reparents_subresources_and_anonymizes_source() -> None:
    store = {
        "guests": [
            _guest_row(id="g1", email="dup@x.de", name="Anna (Dublette)"),
            _guest_row(id="g2", email="anna@x.de", name="Anna Müller"),
        ],
        "guest_addresses": [
            {"id": "a1", "tenant_id": "t1", "guest_id": "g1", "city": "Berlin"},
        ],
        "reservations": [
            {"id": "r1", "tenant_id": "t1", "guest_id": "g1"},
        ],
        "channex_booking": [
            {"id": "b1", "tenant_id": "t1", "guest_id": "g1"},
        ],
        "guest_external_ids": [
            {"id": "e1", "tenant_id": "t1", "guest_id": "g1",
             "channel": "ota", "external_id": "X"},
        ],
    }
    svc = _svc(store)
    out = svc.merge(_CTX, "g1", "g2")
    assert out == {"merged": True, "target_id": "g2"}

    # Sub-Ressourcen + Reservierung + Buchung hängen jetzt am Ziel.
    assert store["guest_addresses"][0]["guest_id"] == "g2"
    assert store["reservations"][0]["guest_id"] == "g2"
    assert store["channex_booking"][0]["guest_id"] == "g2"
    # Personenbezogene externe IDs der Quelle wurden verworfen (DSGVO).
    assert store["guest_external_ids"] == []
    # Quell-Gast ist anonymisiert, Ziel unverändert.
    src = next(g for g in store["guests"] if g["id"] == "g1")
    assert src["email"] is None
    assert src["anonymized_at"] is not None
    tgt = next(g for g in store["guests"] if g["id"] == "g2")
    assert tgt["email"] == "anna@x.de"


def test_merge_rejects_same_source_and_target() -> None:
    svc = _svc(store={"guests": [_guest_row(id="g1")]})
    with pytest.raises(GuestsError) as exc:
        svc.merge(_CTX, "g1", "g1")
    assert exc.value.status_code == 400


def test_merge_404_when_guest_foreign() -> None:
    store = {"guests": [_guest_row(id="g1")]}  # g2 fehlt
    svc = _svc(store)
    with pytest.raises(GuestsError) as exc:
        svc.merge(_CTX, "g1", "g2")
    assert exc.value.status_code == 404


# --- Dubletten-Vorschlag ----------------------------------------------------
#
# Anlass, live am 03.09.2026 in der Gaestekartei: „Andreas Dumler" stand
# zweimal. Eine Zeile ohne jeden Kontakt (Aufenthalt 2026-08-16), eine mit
# Booking-Alias-Mail und Rufnummer (2027-07-31). Kein Anzeigefehler — der
# Resolver mergt bewusst nie ueber den Namen, und ohne Kontaktmerkmal gab es
# keinen Schluessel.
def test_dubletten_findet_gleichen_namen() -> None:
    """Der live gesehene Fall: gleicher Name, nur eine Zeile hat Kontakt."""
    store = {"guests": [
        _guest_row(id="g1", name="Andreas Dumler", email=None, phone=None,
                   last_stay_at="2026-08-16"),
        _guest_row(id="g2", name="Andreas Dumler",
                   email="adumle.357783@guest.booking.com",
                   phone="+4917621113286", last_stay_at="2027-07-31"),
        _guest_row(id="g3", name="Anna Adam", email="anna@x.de"),
    ]}
    out = _svc(store).duplicates(_CTX)
    assert out.total == 1
    gruppe = out.groups[0]
    assert gruppe.reason == "name"
    assert sorted(g.id for g in gruppe.guests) == ["g1", "g2"]
    # Die Zeile MIT Kontakt ist als Ziel erkennbar — daran haengt die
    # Empfehlung in der Oberflaeche.
    mit_kontakt = [g.id for g in gruppe.guests if g.has_contact]
    assert mit_kontakt == ["g2"]


def test_dubletten_ignoriert_namenlose_platzhalter() -> None:
    """'—' ist kein Name und darf nie gruppieren.

    Sonst waeren alle namenlosen Airbnb-Gaeste eine einzige Riesen-Dublette —
    beim Beta-Betrieb 150 Zeilen in einer Gruppe, und der Vorschlag waere
    Schrott statt Hilfe.
    """
    store = {"guests": [
        _guest_row(id="g1", name="—", email=None, phone=None),
        _guest_row(id="g2", name="—", email=None, phone=None),
        _guest_row(id="g3", name="  ", email=None, phone=None),
    ]}
    out = _svc(store).duplicates(_CTX)
    assert out.groups == []


def test_dubletten_erkennt_gleiche_email_vor_name() -> None:
    """Gleiche E-Mail ist der belastbarste Hinweis und steht zuerst."""
    store = {"guests": [
        _guest_row(id="g1", name="A. Mueller", email="Anna@X.de", phone=None),
        _guest_row(id="g2", name="Anna Mueller", email="anna@x.de", phone=None),
        _guest_row(id="g3", name="Bob Bau", email="b1@x.de", phone=None),
        _guest_row(id="g4", name="Bob Bau", email="b2@x.de", phone=None),
    ]}
    out = _svc(store).duplicates(_CTX)
    assert [g.reason for g in out.groups] == ["email", "name"]
    # Case-insensitiv gruppiert (wie der Unique-Index auf lower(email)).
    assert sorted(g.id for g in out.groups[0].guests) == ["g1", "g2"]


def test_dubletten_gast_nur_in_einer_gruppe() -> None:
    """Ein Gast darf nie in zwei Gruppen stehen.

    Sonst schlaegt die Oberflaeche denselben Merge zweimal vor (einmal unter
    „E-Mail", einmal unter „Name") und der zweite Klick trifft eine bereits
    anonymisierte Quelle.
    """
    store = {"guests": [
        _guest_row(id="g1", name="Anna Mueller", email="anna@x.de", phone=None),
        _guest_row(id="g2", name="Anna Mueller", email="anna@x.de", phone=None),
    ]}
    out = _svc(store).duplicates(_CTX)
    assert out.total == 1
    assert out.groups[0].reason == "email"


def test_dubletten_uebergeht_anonymisierte() -> None:
    """Nach dem Merge darf die Quelle nicht erneut vorgeschlagen werden.

    `merge` anonymisiert die Quelle (Name „Zusammengefuehrt", Kontakt genullt).
    Ohne den `anonymized_at`-Filter bliebe sie in der Liste und der Betrieb
    wuerde denselben Fall endlos wieder angeboten bekommen.
    """
    store = {"guests": [
        _guest_row(id="g1", name="Andreas Dumler", email=None, phone=None,
                   anonymized_at="2026-09-03T10:00:00Z"),
        _guest_row(id="g2", name="Andreas Dumler", email="a@x.de", phone=None),
    ]}
    out = _svc(store).duplicates(_CTX)
    assert out.groups == []


def test_dubletten_bleibt_im_tenant() -> None:
    """Wurzel 3: gleicher Name in einem FREMDEN Tenant ist keine Dublette."""
    store = {"guests": [
        _guest_row(id="g1", name="Andreas Dumler", email=None, phone=None),
        _guest_row(id="g2", tenant="t2", name="Andreas Dumler",
                   email=None, phone=None),
    ]}
    out = _svc(store).duplicates(_CTX)
    assert out.groups == []


def test_dubletten_has_contact_trotz_maskierung() -> None:
    """staff sieht keine Kontaktwerte — die Ziel-Empfehlung muss trotzdem stimmen.

    `has_contact` wird aus den ROHEN Spalten abgeleitet. Waere es im Frontend
    aus `email`/`phone` berechnet, stuende fuer eingeschraenkte Rollen ueberall
    „kein Kontakt" und der Betrieb wuerde in die falsche Richtung mergen.
    """
    store = {"guests": [
        _guest_row(id="g1", name="Andreas Dumler", email=None, phone=None),
        _guest_row(id="g2", name="Andreas Dumler", email="a@x.de",
                   phone="+4917621113286"),
    ]}
    svc = _svc(store, role="staff", perms=["pm_guest_details"])
    out = svc.duplicates(AuthContext(user_id="u", tenant_id="t1", role="staff"))
    gruppe = out.groups[0]
    ziel = next(g for g in gruppe.guests if g.id == "g2")
    assert ziel.has_contact is True
    # Der Wert selbst bleibt maskiert (kein Kontakt-Einblick fuer staff).
    assert ziel.email != "a@x.de"


def test_dubletten_gleiche_telefonnummer_verschieden_formatiert() -> None:
    """+49 176 … und 0049176… sind dieselbe Nummer (E.164-Normalisierung)."""
    store = {"guests": [
        _guest_row(id="g1", name="Andreas D.", email=None,
                   phone="+49 176 21113286"),
        _guest_row(id="g2", name="A. Dumler", email=None,
                   phone="004917621113286"),
    ]}
    out = _svc(store).duplicates(_CTX)
    assert out.total == 1
    assert out.groups[0].reason == "phone"


# --- EDIT_GUEST-Berechtigung (Schreibrecht) ---------------------------------
def test_edit_guest_default_assignment() -> None:
    from src.features.auth.granular_permissions import (
        Permission,
        default_permissions_for,
    )
    from src.features.auth.schemas import UserRole

    # Admin = alle, co_admin per Default; staff/owner NICHT.
    assert "edit_guest" in default_permissions_for(UserRole.admin)
    assert "edit_guest" in default_permissions_for(UserRole.co_admin)
    assert "edit_guest" not in default_permissions_for(UserRole.staff)
    assert "edit_guest" not in default_permissions_for(UserRole.owner)
    assert Permission.EDIT_GUEST.value == "edit_guest"
