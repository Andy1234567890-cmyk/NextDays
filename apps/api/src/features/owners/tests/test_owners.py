"""Tests für den owners-Slice (verwaltete Eigentümer).

Unit/Contract: Health, Schema-Validierung, Service-CRUD + Objekt-Zuordnung mit
In-Memory-Fake-DB (tenant-Scope wird im Code erzwungen). Backfill-Logik (SQL)
wird hier nicht getestet (reine Migration), die Zuordnungs-/Scope-Logik schon.
"""
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.core.security import AuthContext
from src.features.owners.schemas import (
    OwnerCreate,
    OwnerPropertiesAssign,
    OwnerPropertyAssign,
    OwnerUpdate,
)
from src.features.owners.service import OwnerError, OwnersService
from src.main import create_app

client = TestClient(create_app())


def _ctx(tenant: str | None = "t-1") -> AuthContext:
    return AuthContext(user_id="u-1", tenant_id=tenant, role="admin")


# Embed-Name im Select → (Zieltabelle, Fremdschlüssel in der eigenen Zeile).
_EMBED_ZIEL: dict[str, tuple[str, str]] = {
    "owners": ("owners", "owner_id"),
    "properties": ("properties", "property_id"),
}


def _embeds_aus_select(spalten: str) -> dict[str, list[str]]:
    """`"owner_id, owners!inner(id, name)"` → `{"owners": ["id", "name"]}`.

    Bewusst schlicht: nur die eine Verschachtelungsebene, die der Slice nutzt.
    Mehr nachzubauen hieße, PostgREST zu implementieren statt es zu prüfen.
    """
    embeds: dict[str, list[str]] = {}
    rest = spalten
    while "(" in rest:
        kopf, _, rest = rest.partition("(")
        inner, _, rest = rest.partition(")")
        name = kopf.split(",")[-1].strip().split("!")[0].strip()
        if name:
            embeds[name] = [s.strip() for s in inner.split(",") if s.strip()]
    return embeds


class _Result:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:
    def __init__(self, db: "_DB", table: str) -> None:
        self._db = db
        self._table = table
        self._op = "select"
        self._payload: dict | list[dict] | None = None
        self._conflict: str | None = None
        self._filters: list[tuple[str, object]] = []
        self._neq: list[tuple[str, object]] = []
        self._in: tuple[str, list] | None = None
        self._is: list[tuple[str, object]] = []
        self._order: str | None = None
        self._embeds: dict[str, list[str]] = {}

    def select(self, *a: object, **_k: object) -> "_Query":
        self._op = "select"
        # Embed-Spalten aus dem Select merken (`owners!inner(id, name, …)`),
        # damit `execute` die verknüpfte Zeile mitliefert — sonst käme
        # `row["owners"]` als None zurück und ein Test auf den Feld-Zuschnitt
        # bewiese nichts.
        self._embeds = _embeds_aus_select(str(a[0]) if a else "")
        return self

    def insert(self, payload: dict | list[dict]) -> "_Query":
        self._op = "insert"
        self._payload = payload
        return self

    def upsert(
        self, payload: dict | list[dict], on_conflict: str | None = None
    ) -> "_Query":
        # Wie PostgREST: EIN Datensatz oder eine LISTE. Die Mehrfachzuordnung
        # schreibt alle Objekte in einem Aufruf; nähme die Attrappe nur ein
        # dict, liefe der Test grün an einem Schreibvorgang vorbei, den es in
        # Wirklichkeit gab.
        self._op = "upsert"
        self._payload = payload
        self._conflict = on_conflict
        return self

    def update(self, payload: dict) -> "_Query":
        self._op = "update"
        self._payload = payload
        return self

    def delete(self) -> "_Query":
        self._op = "delete"
        return self

    def eq(self, col: str, val: object) -> "_Query":
        self._filters.append((col, val))
        return self

    def neq(self, col: str, val: object) -> "_Query":
        self._neq.append((col, val))
        return self

    def in_(self, col: str, vals: list) -> "_Query":
        self._in = (col, vals)
        return self

    def is_(self, col: str, val: object) -> "_Query":
        # PostgREST-`is` prüft NULL-Sein (`.is_("guest_id", "null")`). Muss echt
        # filtern: `eigennutzungen_laden` grenzt damit auf Aufenthalte OHNE Gast
        # ein — eine Attrappe, die den Filter durchwinkt, zählte auch echte
        # Gastbuchungen mit und der Test bewiese das Gegenteil von dem, was er
        # behauptet.
        self._is.append((col, val))
        return self

    def order(self, col: str, **_k: object) -> "_Query":
        self._order = col
        return self

    def limit(self, _n: int) -> "_Query":
        return self

    def _feld(self, row: dict, col: str) -> object:
        """Spaltenwert — auch über einen `!inner`-Embed („owners.tenant_id").

        Ohne diese Auflösung liefe der Filter `.eq("owners.tenant_id", …)` ins
        Leere: der Scope-Test bewiese dann nichts, obwohl er grün ist (Wurzel 3
        wird gerade an dieser Stelle erzwungen).
        """
        if "." not in col:
            return row.get(col)
        embed, feld = col.split(".", 1)
        ziel = _EMBED_ZIEL.get(embed, (embed, f"{embed}_id"))
        treffer = [
            r
            for r in self._db.tables.get(ziel[0], [])
            if str(r.get("id")) == str(row.get(ziel[1]))
        ]
        return treffer[0].get(feld) if treffer else None

    def _match(self, row: dict) -> bool:
        ok = all(str(self._feld(row, c)) == str(v) for c, v in self._filters)
        if ok and self._neq:
            ok = all(str(self._feld(row, c)) != str(v) for c, v in self._neq)
        if ok and self._in:
            col, vals = self._in
            ok = str(row.get(col)) in {str(v) for v in vals}
        for col, val in self._is if ok else []:
            ist_null = self._feld(row, col) is None
            ok = ist_null if str(val) == "null" else not ist_null
            if not ok:
                break
        return ok

    def _mit_embeds(self, row: dict) -> dict:
        """Verknüpfte Zeilen an die Antwort hängen, wie PostgREST es tut.

        NUR die im Select genannten Spalten — genau das ist der Punkt: ein
        Test, der den Feld-Zuschnitt prüft (keine IBAN, keine Provision), muss
        an einer Attrappe scheitern, die pauschal die ganze Zeile anhängt.
        """
        if not self._embeds:
            return dict(row)
        angereichert = dict(row)
        for embed, spalten in self._embeds.items():
            tabelle, fk = _EMBED_ZIEL.get(embed, (embed, f"{embed}_id"))
            treffer = [
                r
                for r in self._db.tables.get(tabelle, [])
                if str(r.get("id")) == str(row.get(fk))
            ]
            angereichert[embed] = (
                {k: treffer[0].get(k) for k in spalten} if treffer else None
            )
        return angereichert

    def execute(self) -> _Result:
        rows = self._db.tables.setdefault(self._table, [])
        if self._op == "insert":
            payload = self._payload
            new_rows = payload if isinstance(payload, list) else [payload]
            created = []
            for p in new_rows:
                row = dict(p)
                row.setdefault("id", f"{self._table}-{self._db.next_id()}")
                row.setdefault("created_at", "2026-06-25T00:00:00Z")
                row.setdefault("updated_at", "2026-06-25T00:00:00Z")
                rows.append(row)
                created.append(row)
            return _Result(created)
        if self._op == "upsert":
            roh = self._payload
            eintraege = roh if isinstance(roh, list) else [roh]
            keys = (self._conflict or "").split(",")
            ergebnis = []
            for eintrag in eintraege:
                payload = dict(eintrag)  # type: ignore[arg-type]
                treffer = next(
                    (
                        row
                        for row in rows
                        if all(
                            str(row.get(k)) == str(payload.get(k)) for k in keys
                        )
                    ),
                    None,
                )
                if treffer is not None:
                    treffer.update(payload)
                    ergebnis.append(treffer)
                    continue
                payload.setdefault("id", f"{self._table}-{self._db.next_id()}")
                rows.append(payload)
                ergebnis.append(payload)
            return _Result(ergebnis)
        selected = [r for r in rows if self._match(r)]
        if self._op == "update":
            for r in selected:
                r.update(self._payload)  # type: ignore[arg-type]
            return _Result(selected)
        if self._op == "delete":
            self._db.tables[self._table] = [r for r in rows if not self._match(r)]
            # `on delete cascade` nachbilden: `owner_properties.owner_id` und
            # `owner_property_assignments` hängen am Eigentümer (0063/0058,
            # `confdeltype='c'` live gegen die Staging-DB geprüft). Ohne das
            # behauptete die Attrappe, nach dem Löschen eines Eigentümers
            # blieben seine Zuordnungen liegen — und ein Rollback-Test wäre
            # aus dem falschen Grund rot.
            if self._table == "owners":
                geloescht = {str(r["id"]) for r in selected}
                for kind in ("owner_properties",):
                    self._db.tables[kind] = [
                        r
                        for r in self._db.tables.get(kind, [])
                        if str(r.get("owner_id")) not in geloescht
                    ]
            return _Result(selected)
        if self._order:
            selected = sorted(selected, key=lambda r: str(r.get(self._order) or ""))
        # KOPIEN zurückgeben, wie PostgREST: dort kommt JSON über die Leitung,
        # der Aufrufer hält nie eine Referenz auf die gespeicherte Zeile.
        # Ohne das war ein zuvor geladenes `vorher`-Dict nach einem späteren
        # `update` still mitgewandert — ein Alt/Neu-Vergleich im Dienst
        # (Wurzel 1) hätte hier grün gelogen, während er live den Unterschied
        # sieht.
        return _Result([self._mit_embeds(r) for r in selected])


class _AuthUser:
    def __init__(self, email: str | None) -> None:
        self.email = email


class _AuthUserAntwort:
    def __init__(self, user: _AuthUser | None) -> None:
        self.user = user


class _AuthAdmin:
    """Attrappe der GoTrue-Admin-API — `update_user_by_id` und `get_user_by_id`.

    Sie zeichnet die Aufrufe AUF, statt sie bloss zu schlucken: die Tests
    müssen belegen können, dass der Adresswechsel OHNE `email_confirm`
    rausging (Doppel-Opt-in, Wurzel 7) — ein `email_confirm=True` wäre die
    sofortige Umstellung, die den Eigentümer bei einem Tippfehler aussperrt.

    `anmelde_emails` bildet das Doppel-Opt-in nach: `update_user_by_id` ändert
    die Anmelde-Adresse NICHT. GoTrue schaltet sie erst um, wenn der Empfänger
    den Bestätigungslink klickt — bis dahin meldet `get_user_by_id` weiterhin
    die alte. Eine Attrappe, die sofort umschaltet, wäre in genau dem Punkt
    unrealistisch, um den es hier geht.
    """

    def __init__(self) -> None:
        self.calls: list[tuple[str, dict]] = []
        self.anmelde_emails: dict[str, str] = {}
        # Gelöschte Logins — der Beweis, dass mit dem Eigentümer auch sein
        # Zugang verschwindet und sich niemand danach noch anmelden kann.
        self.geloeschte: list[str] = []
        # Wenn gesetzt, wirft der nächste Aufruf — für den Kollisionsfall
        # (Adresse in einem ANDEREN Betrieb bereits vergeben; das sieht die
        # Vorprüfung im Dienst nicht, nur GoTrue).
        self.raises: Exception | None = None
        # Wenn gesetzt, wirft `delete_user` — für den Fall, dass GoTrue den
        # Login nicht löschen kann und der ganze Vorgang abbrechen muss.
        self.delete_raises: Exception | None = None

    def update_user_by_id(self, user_id: str, attrs: dict) -> None:
        self.calls.append((user_id, dict(attrs)))
        if self.raises is not None:
            raise self.raises

    def delete_user(self, user_id: str) -> None:
        if self.delete_raises is not None:
            raise self.delete_raises
        self.geloeschte.append(user_id)

    def get_user_by_id(self, user_id: str) -> _AuthUserAntwort:
        return _AuthUserAntwort(_AuthUser(self.anmelde_emails.get(user_id)))


class _Auth:
    def __init__(self) -> None:
        self.admin = _AuthAdmin()


class _DB:
    def __init__(self, tables: dict[str, list[dict]] | None = None) -> None:
        self.tables: dict[str, list[dict]] = tables or {}
        self._counter = 0
        self.auth = _Auth()

    def next_id(self) -> int:
        self._counter += 1
        return self._counter

    def table(self, name: str) -> _Query:
        return _Query(self, name)


def _svc(tables: dict[str, list[dict]] | None = None) -> OwnersService:
    base = {
        "owners": [],
        "owner_properties": [],
        "properties": [{"id": "p-1", "tenant_id": "t-1", "title": "Villa"}],
        "users": [],
        # Append-only-Protokoll der Adresswechsel (0352).
        "owner_email_changes": [],
    }
    if tables:
        base.update(tables)
    return OwnersService(service_client=_DB(base))


# --- Health / Schema ---------------------------------------------------------

def test_owners_health() -> None:
    resp = client.get("/api/v1/owners/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "owners", "status": "ok"}


def test_owner_create_requires_name() -> None:
    with pytest.raises(ValidationError):
        OwnerCreate(name="")


def test_owner_create_rejects_bad_commission() -> None:
    with pytest.raises(ValidationError):
        OwnerCreate(name="X", default_commission_pct=150)


def test_owner_update_all_optional() -> None:
    assert OwnerUpdate().model_dump(exclude_unset=True) == {}


# --- CRUD --------------------------------------------------------------------

def test_create_sets_tenant_from_context() -> None:
    svc = _svc()
    res = svc.create(_ctx(), OwnerCreate(name="Max Mustermann", default_commission_pct=20))
    assert res.tenant_id == "t-1"
    assert res.name == "Max Mustermann"
    assert res.default_commission_pct == 20


def test_create_without_tenant_fails() -> None:
    svc = _svc()
    with pytest.raises(OwnerError) as exc:
        svc.create(_ctx(tenant=None), OwnerCreate(name="X"))
    assert exc.value.status_code == 400


def test_get_missing_raises_404() -> None:
    svc = _svc()
    with pytest.raises(OwnerError) as exc:
        svc.get(_ctx(), "owners-x")
    assert exc.value.status_code == 404


def test_list_returns_items_with_property_count() -> None:
    svc = _svc()
    a = svc.create(_ctx(), OwnerCreate(name="A"))
    svc.create(_ctx(), OwnerCreate(name="B"))
    svc.assign_property(_ctx(), a.id, OwnerPropertyAssign(property_id="p-1"))
    res = svc.list(_ctx())
    assert res.total == 2
    by_name = {i.name: i for i in res.items}
    assert by_name["A"].property_count == 1
    assert by_name["B"].property_count == 0


def test_list_shows_effective_commission_from_override() -> None:
    # Owner-Default 0, aber Objekt-Override 29 → Karte zeigt effektiv 29 (kein 0).
    svc = _svc()
    a = svc.create(_ctx(), OwnerCreate(name="A", default_commission_pct=0))
    svc.assign_property(
        _ctx(),
        a.id,
        OwnerPropertyAssign(property_id="p-1", commission_override_pct=29),
    )
    item = {i.name: i for i in svc.list(_ctx()).items}["A"]
    assert item.commission_min == 29.0
    assert item.commission_max == 29.0


def test_list_commission_none_without_properties() -> None:
    # Ohne zugeordnete Objekte: min/max None → UI fällt auf den Default zurück.
    svc = _svc()
    svc.create(_ctx(), OwnerCreate(name="A", default_commission_pct=15))
    item = {i.name: i for i in svc.list(_ctx()).items}["A"]
    assert item.commission_min is None and item.commission_max is None


def test_update_changes_fields() -> None:
    svc = _svc()
    owner = svc.create(_ctx(), OwnerCreate(name="A"))
    upd = svc.update(_ctx(), owner.id, OwnerUpdate(default_commission_pct=15, iban="DE00"))
    assert upd.default_commission_pct == 15
    assert upd.iban == "DE00"


def test_delete_removes_owner() -> None:
    svc = _svc()
    owner = svc.create(_ctx(), OwnerCreate(name="A"))
    svc.delete(_ctx(), owner.id)
    with pytest.raises(OwnerError) as exc:
        svc.get(_ctx(), owner.id)
    assert exc.value.status_code == 404


def test_delete_entfernt_portalzugang_und_portalsicht() -> None:
    """Mit dem Eigentümer verschwindet sein Login — samt Portal-Sicht.

    Bliebe der Login stehen, hätte das zwei Folgen, beide live aufgetreten
    (10.08.2026): der gelöschte Eigentümer könnte sich weiter anmelden, und
    ein später mit derselben Adresse neu angelegter Eigentümer bekäme KEINE
    Einladungsmail — `_portalzugang_einrichten` würde den übrig gebliebenen
    Login nur verknüpfen.
    """
    db = _DB(
        {
            "owners": [
                {
                    "id": "o-1",
                    "tenant_id": "t-1",
                    "name": "A",
                    "user_id": "u-1",
                }
            ],
            "owner_properties": [],
            "properties": [],
            "users": [{"id": "u-1", "tenant_id": "t-1", "role": "owner"}],
            "owner_property_assignments": [
                {"id": "a-1", "tenant_id": "t-1", "user_id": "u-1", "property_id": "p-1"}
            ],
            "reservations": [],
            "owner_email_changes": [],
        }
    )
    svc = OwnersService(service_client=db)

    svc.delete(_ctx(), "o-1")

    assert db.auth.admin.geloeschte == ["u-1"]  # GoTrue-Login weg
    assert db.tables["users"] == []  # users-Zeile weg
    assert db.tables["owner_property_assignments"] == []  # Portal-Sicht weg
    assert db.tables["owners"] == []


def test_delete_bricht_ab_wenn_login_nicht_geloescht_werden_kann() -> None:
    """Scheitert das Löschen des Logins, bleibt der Eigentümer vollständig.

    Fail-closed (Wurzel 5): ein Eigentümer weg und sein Zugang übrig wäre
    genau der Zustand, den dieser Fix beseitigt. Lieber ein klarer Fehler und
    ein wiederholbarer zweiter Versuch.
    """
    db = _DB(
        {
            "owners": [
                {"id": "o-1", "tenant_id": "t-1", "name": "A", "user_id": "u-1"}
            ],
            "owner_properties": [],
            "properties": [],
            "users": [{"id": "u-1", "tenant_id": "t-1", "role": "owner"}],
            "owner_property_assignments": [],
            "reservations": [],
            "owner_email_changes": [],
        }
    )
    db.auth.admin.delete_raises = RuntimeError("GoTrue nicht erreichbar")
    svc = OwnersService(service_client=db)

    with pytest.raises(OwnerError) as exc:
        svc.delete(_ctx(), "o-1")

    assert exc.value.status_code == 502
    assert db.tables["owners"] != []  # Eigentümer steht noch
    assert db.tables["users"] != []  # und sein Login auch


# --- Objekt-Zuordnung --------------------------------------------------------

def test_assign_property_with_share_and_commission() -> None:
    svc = _svc()
    owner = svc.create(_ctx(), OwnerCreate(name="A"))
    res = svc.assign_property(
        _ctx(),
        owner.id,
        OwnerPropertyAssign(property_id="p-1", ownership_share=60, commission_override_pct=12),
    )
    assert len(res.properties) == 1
    link = res.properties[0]
    assert link.property_id == "p-1"
    assert link.ownership_share == 60
    assert link.commission_override_pct == 12


def test_assign_foreign_property_rejected() -> None:
    svc = _svc()
    owner = svc.create(_ctx(), OwnerCreate(name="A"))
    with pytest.raises(OwnerError) as exc:
        svc.assign_property(_ctx(), owner.id, OwnerPropertyAssign(property_id="p-fremd"))
    assert exc.value.status_code == 400


def test_assign_is_upsert_updates_share() -> None:
    svc = _svc()
    owner = svc.create(_ctx(), OwnerCreate(name="A"))
    svc.assign_property(
        _ctx(), owner.id, OwnerPropertyAssign(property_id="p-1", ownership_share=50)
    )
    res = svc.assign_property(
        _ctx(), owner.id, OwnerPropertyAssign(property_id="p-1", ownership_share=80)
    )
    assert len(res.properties) == 1
    assert res.properties[0].ownership_share == 80


def test_unassign_property() -> None:
    svc = _svc()
    owner = svc.create(_ctx(), OwnerCreate(name="A"))
    svc.assign_property(_ctx(), owner.id, OwnerPropertyAssign(property_id="p-1"))
    res = svc.unassign_property(_ctx(), owner.id, "p-1")
    assert res.properties == []


# --- Exklusivität: ein Objekt gehört genau einem Eigentümer ------------------

def test_assign_property_owned_by_other_rejected() -> None:
    """p-1 gehört Owner A — Owner B darf es nicht zusätzlich bekommen (409)."""
    svc = _svc()
    a = svc.create(_ctx(), OwnerCreate(name="A"))
    b = svc.create(_ctx(), OwnerCreate(name="B"))
    svc.assign_property(_ctx(), a.id, OwnerPropertyAssign(property_id="p-1"))
    with pytest.raises(OwnerError) as exc:
        svc.assign_property(_ctx(), b.id, OwnerPropertyAssign(property_id="p-1"))
    assert exc.value.status_code == 409


def test_available_properties_excludes_other_owners_property() -> None:
    """Frei + eigenes Objekt erscheinen; Objekt eines anderen Owners nicht."""
    svc = _svc(
        {
            "properties": [
                {"id": "p-1", "tenant_id": "t-1", "title": "Villa"},
                {"id": "p-2", "tenant_id": "t-1", "title": "Haus"},
                {"id": "p-3", "tenant_id": "t-1", "title": "Loft"},
            ]
        }
    )
    a = svc.create(_ctx(), OwnerCreate(name="A"))
    b = svc.create(_ctx(), OwnerCreate(name="B"))
    svc.assign_property(_ctx(), a.id, OwnerPropertyAssign(property_id="p-1"))
    svc.assign_property(_ctx(), b.id, OwnerPropertyAssign(property_id="p-2"))
    # Für A: das eigene p-1 + das freie p-3, aber NICHT B's p-2.
    avail = {p.id for p in svc.available_properties(_ctx(), a.id).items}
    assert avail == {"p-1", "p-3"}


def test_available_properties_scoped_by_accommodation_type() -> None:
    """Betriebsart hotel → nur Zimmertypen zur Zuordnung anbieten."""
    svc = _svc(
        {
            "tenants": [{"id": "t-1", "accommodation_type": "hotel"}],
            "properties": [
                {
                    "id": "p-1",
                    "tenant_id": "t-1",
                    "title": "FeWo",
                    "property_type": "appartement",
                },
                {
                    "id": "p-2",
                    "tenant_id": "t-1",
                    "title": "Zimmer 101",
                    "property_type": "einzelzimmer",
                },
            ],
        }
    )
    a = svc.create(_ctx(), OwnerCreate(name="A"))
    avail = {p.id for p in svc.available_properties(_ctx(), a.id).items}
    assert avail == {"p-2"}


# --- Owner-Login-Verknüpfung -------------------------------------------------

def test_link_user_must_be_owner_role() -> None:
    svc = _svc({"users": [{"id": "u-9", "tenant_id": "t-1", "role": "staff"}]})
    with pytest.raises(OwnerError) as exc:
        svc.create(_ctx(), OwnerCreate(name="A", user_id="u-9"))
    assert exc.value.status_code == 400


def test_link_unknown_user_404() -> None:
    svc = _svc()
    with pytest.raises(OwnerError) as exc:
        svc.create(_ctx(), OwnerCreate(name="A", user_id="u-unknown"))
    assert exc.value.status_code == 404


def test_link_valid_owner_user_ok() -> None:
    svc = _svc({"users": [{"id": "u-own", "tenant_id": "t-1", "role": "owner"}]})
    res = svc.create(_ctx(), OwnerCreate(name="A", user_id="u-own"))
    assert res.user_id == "u-own"


# --- Portalzugang ------------------------------------------------------------
#
# Der Einladungs-/Mailweg selbst (AuthService.invite → EinladungService) ist in
# `auth/tests` abgedeckt; hier steht die Logik des owners-Slice davor und
# danach: die 422-Sperre ohne Adresse, die Idempotenz über eine bereits
# vorhandene Adresse und die Verknüpfung von `owners.user_id`.

def test_portalzugang_ohne_email_422() -> None:
    """Ohne Postfach kein Einmal-Link — klarer Fehler statt stillem Überspringen.

    Die Prüfung greift VOR dem Insert: der Eigentümer darf nicht angelegt sein,
    wenn der Aufruf scheitert, sonst legt der Betreiber ihn beim zweiten
    Versuch doppelt an.
    """
    svc = _svc()
    with pytest.raises(OwnerError) as exc:
        svc.create(_ctx(), OwnerCreate(name="Ohne Adresse", portalzugang=True))
    assert exc.value.status_code == 422
    assert svc.list(_ctx()).total == 0


def test_portalzugang_verknuepft_bestehenden_owner_login() -> None:
    """Gibt es zu der Adresse schon einen owner-Login, wird DIESER verknüpft.

    Das ist der Idempotenz-Anker (Wurzel 2): ein Doppelklick darf keinen
    zweiten Nutzer und keine zweite Einladungsmail erzeugen. Weil der
    vorhandene Nutzer wiederverwendet wird, läuft der Mailweg hier gar nicht
    erst an — der Test kommt deshalb ohne SMTP aus.

    Und genau deshalb ist `einladung_versendet` hier FALSE: es ging keine Mail
    raus. Der Test behauptete früher das Gegenteil und hielt damit einen Bug
    fest — die Oberfläche meldete „Einladung versendet", der Betrieb wartete
    auf eine Mail, die es nie gab (live am 10.08.2026).
    """
    svc = _svc(
        {
            "users": [
                {
                    "id": "u-own",
                    "tenant_id": "t-1",
                    "role": "owner",
                    "email": "a@example.com",
                }
            ]
        }
    )
    res = svc.create(
        _ctx(),
        OwnerCreate(name="A", email="a@example.com", portalzugang=True),
    )
    assert res.user_id == "u-own"
    assert res.einladung_versendet is False


def test_portalzugang_weist_fremde_rolle_ab() -> None:
    """Ein Mitarbeiter-Login wird nicht still zum Eigentümer umgewidmet."""
    svc = _svc(
        {
            "users": [
                {
                    "id": "u-staff",
                    "tenant_id": "t-1",
                    "role": "staff",
                    "email": "s@example.com",
                }
            ]
        }
    )
    with pytest.raises(OwnerError) as exc:
        svc.create(
            _ctx(),
            OwnerCreate(name="S", email="s@example.com", portalzugang=True),
        )
    assert exc.value.status_code == 400


def test_nachtraeglicher_portalzugang_ohne_email_422() -> None:
    """Auch der Folgeschritt verlangt eine Adresse."""
    svc = _svc()
    owner = svc.create(_ctx(), OwnerCreate(name="Ohne Adresse"))
    with pytest.raises(OwnerError) as exc:
        svc.portalzugang_einladen(_ctx(), owner.id)
    assert exc.value.status_code == 422


def test_nachtraeglicher_portalzugang_fremder_tenant_404() -> None:
    """Gleicher Scope wie der List-Pfad (Wurzel 9) — kein fremder Mandant."""
    svc = _svc({"users": [{"id": "u-own", "tenant_id": "t-1", "role": "owner"}]})
    owner = svc.create(_ctx(), OwnerCreate(name="A", email="a@example.com"))
    with pytest.raises(OwnerError) as exc:
        svc.portalzugang_einladen(_ctx(tenant="t-fremd"), owner.id)
    assert exc.value.status_code == 404


def test_erneut_senden_ohne_portalzugang_409() -> None:
    """Ohne Login gibt es nichts erneut zu senden.

    Der Knopf gehört zum Zustand „hat Zugang". Wird er trotzdem auf einen
    Eigentümer ohne `user_id` abgesetzt (veraltete Seite, direkter Aufruf),
    ist die richtige Antwort ein klarer Konflikt — NICHT still einen Zugang
    anzulegen. Das wäre eine andere Handlung als die, auf die geklickt wurde
    (dafür gibt es `portalzugang_einladen`).
    """
    svc = _svc()
    owner = svc.create(_ctx(), OwnerCreate(name="Ohne Zugang", email="a@example.com"))
    with pytest.raises(OwnerError) as exc:
        svc.einladung_erneut_senden(_ctx(), owner.id)
    assert exc.value.status_code == 409


def test_erneut_senden_fremder_tenant_404() -> None:
    """Gleicher Scope wie der List-Pfad (Wurzel 9).

    Entscheidend ist, dass der 404 kommt, BEVOR irgendetwas mit dem Login
    passiert: die `user_id` stammt aus der gescopten Zeile, nie aus der
    Anfrage. Ein Admin eines fremden Mandanten kann damit keine Einladung an
    ein fremdes Konto auslösen.
    """
    svc = _svc({"users": [{"id": "u-own", "tenant_id": "t-1", "role": "owner"}]})
    owner = svc.create(
        _ctx(), OwnerCreate(name="A", email="a@example.com", user_id="u-own")
    )
    with pytest.raises(OwnerError) as exc:
        svc.einladung_erneut_senden(_ctx(tenant="t-fremd"), owner.id)
    assert exc.value.status_code == 404


def test_erneut_senden_ohne_email_422() -> None:
    """Ein Login ohne hinterlegte Adresse hat kein Ziel für die Mail."""
    svc = _svc({"users": [{"id": "u-own", "tenant_id": "t-1", "role": "owner"}]})
    owner = svc.create(_ctx(), OwnerCreate(name="A", user_id="u-own"))
    with pytest.raises(OwnerError) as exc:
        svc.einladung_erneut_senden(_ctx(), owner.id)
    assert exc.value.status_code == 422


# --- E-Mail-Wechsel (Login + Stammdaten) -------------------------------------
#
# Die Adresse ist hier nicht nur Korrespondenzadresse: sie ist zugleich die
# ANMELDEADRESSE des verknüpften Portalzugangs. Bis 0352 schrieb das Speichern
# ausschliesslich `owners.email` — der Login lief weiter gegen die alte Adresse
# in GoTrue, und „Einladung erneut senden" ging dorthin. Diese Tests halten die
# drei Eigenschaften fest, an denen der neue Weg hängt: der GoTrue-Aufruf ohne
# `email_confirm`, der sichtbare Zwischenzustand und das Protokoll.

def _mit_login(
    email: str = "alt@example.com", anmelde_email: str | None = None
) -> tuple[OwnersService, str]:
    """Eigentümer MIT verknüpftem Portalzugang — der Normalfall dieser Tests.

    `anmelde_email` trennt die beiden Adressen absichtlich: so entsteht der
    Bestandsfall, bei dem `owners.email` bereits die neue Adresse trägt, der
    Login aber noch auf der alten steht.
    """
    svc = _svc(
        {
            "users": [
                {
                    "id": "u-own",
                    "tenant_id": "t-1",
                    "role": "owner",
                    "email": email,
                }
            ]
        }
    )
    owner = svc.create(
        _ctx(), OwnerCreate(name="A", email=email, user_id="u-own")
    )
    svc._db.auth.admin.anmelde_emails["u-own"] = (  # noqa: SLF001  pylint: disable=protected-access
        anmelde_email or email
    )
    svc._db.auth.admin.calls.clear()  # noqa: SLF001  pylint: disable=protected-access
    return svc, owner.id


def test_email_wechsel_stoesst_gotrue_ohne_email_confirm_an() -> None:
    """Doppel-Opt-in: GoTrue bekommt NUR die neue Adresse, kein `email_confirm`.

    Mit `email_confirm=True` gälte die neue Adresse sofort — ein Tippfehler
    oder ein fremdes Postfach sperrte den Eigentümer dauerhaft aus und liesse
    sein Konto per „Passwort vergessen" übernehmen (Wurzel 7). Der Test prüft
    deshalb den ganzen Payload, nicht nur, DASS gerufen wurde.
    """
    svc, owner_id = _mit_login()
    svc.update(_ctx(), owner_id, OwnerUpdate(email="neu@example.com"))
    calls = svc._db.auth.admin.calls  # noqa: SLF001  pylint: disable=protected-access
    assert calls == [("u-own", {"email": "neu@example.com"})]


def test_email_wechsel_meldet_den_zwischenzustand() -> None:
    """Die Antwort NENNT die Adresse, an die die Bestätigung ging.

    Ohne dieses Feld zeigte die Maske nach dem Speichern die neue Adresse und
    verschwiege, dass die Anmeldung bis zur Bestätigung weiter auf der alten
    läuft — eine Aussage über den Zustand, die nicht stimmt (Wurzel 5b).
    """
    svc, owner_id = _mit_login()
    res = svc.update(_ctx(), owner_id, OwnerUpdate(email="neu@example.com"))
    assert res.email_bestaetigung_an == "neu@example.com"
    assert res.email == "neu@example.com"


def test_abweichende_anmeldeadresse_heilt_beim_speichern() -> None:
    """Der Bestandsfall: `owners.email` neu, Login noch alt — Speichern zieht nach.

    So entstanden die Datensätze vor 0352: das Speichern schrieb nur
    `owners.email`. Verglich man danach die neue Adresse gegen den alten
    `owners`-Wert, waren beide gleich — „keine Änderung" —, und der Datensatz
    konnte sich nie mehr heilen. Die Maske zeigte eine Adresse, mit der man
    sich nicht anmelden kann, ohne jedes sichtbare Zeichen (Wurzel 5b).
    Bezugsgrösse ist deshalb die Anmelde-Adresse: hier ist das Feld unverändert
    und der Wechsel wird trotzdem erkannt.
    """
    svc, owner_id = _mit_login(
        email="neu@example.com", anmelde_email="alt@example.com"
    )
    res = svc.update(_ctx(), owner_id, OwnerUpdate(email="neu@example.com"))
    assert svc._db.auth.admin.calls == [  # noqa: SLF001  pylint: disable=protected-access
        ("u-own", {"email": "neu@example.com"})
    ]
    assert res.email_bestaetigung_an == "neu@example.com"


def test_offener_wechsel_ist_auch_ohne_speichern_sichtbar() -> None:
    """`GET` meldet den offenen Wechsel — sonst ist er nach Neuladen unsichtbar.

    Der Zwischenzustand lebt in GoTrue und überdauert die Sitzung, in der er
    ausgelöst wurde. Hinge der Hinweis nur an der Antwort des Speichervorgangs,
    wäre er nach einem Neuladen weg — und mit ihm der Knopf, mit dem sich die
    Bestätigung erneut anstossen lässt.
    """
    svc, owner_id = _mit_login(
        email="neu@example.com", anmelde_email="alt@example.com"
    )
    assert svc.get(_ctx(), owner_id).email_bestaetigung_an == "neu@example.com"


def test_uebereinstimmende_adressen_melden_keinen_wechsel() -> None:
    """Stimmen Stammdaten und Login überein, ist NICHTS offen — kein Hinweis."""
    svc, owner_id = _mit_login()
    assert svc.get(_ctx(), owner_id).email_bestaetigung_an is None


def test_email_unveraendert_stoesst_keinen_wechsel_an() -> None:
    """Dieselbe Adresse noch einmal zu speichern ist keine Änderung (Wurzel 2).

    Die Maske schickt beim Speichern IMMER alle Felder mit. Ohne den Vergleich
    gegen den Bestand löste jede Korrektur einer Telefonnummer einen
    GoTrue-Adresswechsel samt Bestätigungsmail aus — der Eigentümer bekäme
    Post, ohne dass sich an seiner Adresse etwas geändert hat.
    """
    svc, owner_id = _mit_login()
    res = svc.update(
        _ctx(), owner_id, OwnerUpdate(email="alt@example.com", phone="+49 1")
    )
    assert svc._db.auth.admin.calls == []  # noqa: SLF001  pylint: disable=protected-access
    assert res.email_bestaetigung_an is None


def test_email_nur_gross_klein_ist_kein_wechsel() -> None:
    """„Max@…" → „max@…" ist für GoTrue dieselbe Adresse — keine Mail dafür."""
    svc, owner_id = _mit_login(email="Max@example.com")
    svc.update(_ctx(), owner_id, OwnerUpdate(email="max@example.com"))
    assert svc._db.auth.admin.calls == []  # noqa: SLF001  pylint: disable=protected-access


def test_email_wechsel_ohne_portalzugang_nur_stammdaten() -> None:
    """Ohne Login gibt es keine Anmeldeadresse, die mitzuziehen wäre.

    Die Adresse ist dann reine Korrespondenzadresse und sofort gültig — kein
    GoTrue-Aufruf, kein Zwischenzustand, aber sehr wohl ein Protokolleintrag.
    """
    svc = _svc()
    owner = svc.create(_ctx(), OwnerCreate(name="A", email="alt@example.com"))
    res = svc.update(_ctx(), owner.id, OwnerUpdate(email="neu@example.com"))
    assert svc._db.auth.admin.calls == []  # noqa: SLF001  pylint: disable=protected-access
    assert res.email_bestaetigung_an is None
    protokoll = svc._db.tables["owner_email_changes"]  # noqa: SLF001  pylint: disable=protected-access
    assert len(protokoll) == 1
    assert protokoll[0]["login_wechsel_angestossen"] is False


def test_email_wechsel_wird_protokolliert() -> None:
    """Alt → neu, auslösender Nutzer — sonst steht im Nachhinein nur der
    Endzustand da und niemand kann rekonstruieren, wer ihn herbeigeführt hat."""
    svc, owner_id = _mit_login()
    svc.update(_ctx(), owner_id, OwnerUpdate(email="neu@example.com"))
    protokoll = svc._db.tables["owner_email_changes"]  # noqa: SLF001  pylint: disable=protected-access
    assert len(protokoll) == 1
    eintrag = protokoll[0]
    assert eintrag["alte_email"] == "alt@example.com"
    assert eintrag["neue_email"] == "neu@example.com"
    assert eintrag["actor_user_id"] == "u-1"
    assert eintrag["tenant_id"] == "t-1"
    assert eintrag["user_id"] == "u-own"
    assert eintrag["login_wechsel_angestossen"] is True


def test_email_kollision_im_betrieb_gibt_409_ohne_zu_schreiben() -> None:
    """Adresse schon von einem anderen Zugang belegt → 409 VOR jedem Schreiben.

    Würde erst geschrieben und dann GoTrue gefragt, stünde `owners.email` auf
    der neuen Adresse und der Login auf der alten — genau die Spaltung, die
    dieser Weg beseitigt (Wurzel 1/5: kein halber Zustand).
    """
    svc = _svc(
        {
            "users": [
                {"id": "u-own", "tenant_id": "t-1", "role": "owner",
                 "email": "alt@example.com"},
                {"id": "u-andere", "tenant_id": "t-1", "role": "staff",
                 "email": "belegt@example.com"},
            ]
        }
    )
    owner = svc.create(
        _ctx(),
        OwnerCreate(name="A", email="alt@example.com", user_id="u-own"),
    )
    with pytest.raises(OwnerError) as exc:
        svc.update(_ctx(), owner.id, OwnerUpdate(email="belegt@example.com"))
    assert exc.value.status_code == 409
    # Nichts geschrieben: die Stammdaten tragen weiter die alte Adresse.
    assert svc.get(_ctx(), owner.id).email == "alt@example.com"
    assert svc._db.auth.admin.calls == []  # noqa: SLF001  pylint: disable=protected-access


def test_email_wechsel_gotrue_ablehnung_gibt_409_statt_500() -> None:
    """Lehnt GoTrue ab (Adresse in einem FREMDEN Betrieb vergeben), ist das ein
    Konflikt — kein 500 und kein stiller Erfolg (Wurzel 5)."""
    svc, owner_id = _mit_login()
    svc._db.auth.admin.raises = RuntimeError("email exists")  # noqa: SLF001  pylint: disable=protected-access
    with pytest.raises(OwnerError) as exc:
        svc.update(_ctx(), owner_id, OwnerUpdate(email="neu@example.com"))
    assert exc.value.status_code == 409


def test_email_bestaetigung_erneut_senden_ruft_gotrue_erneut() -> None:
    """Der Wiederholungsweg: derselbe Adresswechsel noch einmal anstossen.

    GoTrue kennt keinen eigenen „erneut senden"-Aufruf; `update_user_by_id`
    mit unverändertem Ziel erneuert den offenen Wechsel. Wichtig ist, dass es
    bei dem EINEN freigegebenen Aufruf bleibt und kein zweiter Mailweg
    entsteht (Wurzel 2/4).
    """
    svc, owner_id = _mit_login()
    svc.update(_ctx(), owner_id, OwnerUpdate(email="neu@example.com"))
    ziel = svc.email_bestaetigung_erneut_senden(_ctx(), owner_id)
    assert ziel == "neu@example.com"
    calls = svc._db.auth.admin.calls  # noqa: SLF001  pylint: disable=protected-access
    assert calls[-1] == ("u-own", {"email": "neu@example.com"})
    assert len(calls) == 2


def test_email_bestaetigung_erneut_senden_ohne_zugang_409() -> None:
    """Ohne Login gibt es nichts zu bestätigen — die Adresse gilt bereits."""
    svc = _svc()
    owner = svc.create(_ctx(), OwnerCreate(name="A", email="a@example.com"))
    with pytest.raises(OwnerError) as exc:
        svc.email_bestaetigung_erneut_senden(_ctx(), owner.id)
    assert exc.value.status_code == 409


def test_email_bestaetigung_erneut_senden_fremder_tenant_404() -> None:
    """Gleicher Scope wie der List-Pfad (Wurzel 9): die `user_id` stammt aus
    der GESCOPTEN Zeile, nie aus der Anfrage."""
    svc, owner_id = _mit_login()
    with pytest.raises(OwnerError) as exc:
        svc.email_bestaetigung_erneut_senden(_ctx(tenant="t-fremd"), owner_id)
    assert exc.value.status_code == 404


def test_email_bestaetigung_erneut_senden_ohne_email_422() -> None:
    """Ein Eigentümer ohne Adresse hat kein Ziel für die Bestätigung."""
    svc = _svc({"users": [{"id": "u-own", "tenant_id": "t-1", "role": "owner"}]})
    owner = svc.create(_ctx(), OwnerCreate(name="A", user_id="u-own"))
    with pytest.raises(OwnerError) as exc:
        svc.email_bestaetigung_erneut_senden(_ctx(), owner.id)
    assert exc.value.status_code == 422


def test_geloeschter_tenant_gibt_409_statt_500() -> None:
    """Ein gültiger Token auf einen gelöschten Mandanten darf keinen 500 werfen.

    Real aufgetreten: ein Parallel-Lauf hielt noch ein gültiges JWT, während
    der zugehörige Tenant schon weg war. `owners.tenant_id` referenziert
    `tenants(id)`, der Insert scheiterte mit 23503, und der rohe `APIError`
    entkam als nacktes `internal_error`-500 (Wurzel 5: client-erreichbarer
    Input darf keinen 500 werfen). Live gegen die laufende API reproduziert
    und danach als 409 gegengeprüft.
    """
    from postgrest.exceptions import APIError

    class _FkDB(_DB):
        def table(self, name: str) -> object:
            if name == "owners":
                raise APIError({"code": "23503", "message": "fk"})
            return super().table(name)

    svc = OwnersService(service_client=_FkDB({}))  # type: ignore[arg-type]
    with pytest.raises(OwnerError) as exc:
        svc.create(_ctx(), OwnerCreate(name="Geist"))
    assert exc.value.status_code == 409


def test_sprache_wird_zurueckgegeben() -> None:
    """`owners.language` muss in der Antwort stehen.

    Regression: `_owner_row` ließ das Feld aus, die Antwort fiel still auf den
    Schema-Default `None` zurück. Die DB trug längst „da", die API meldete
    `null` — und die UI zeigte nach dem Speichern wieder ein leeres
    Sprachfeld (Wurzel 4). Live gegen die Staging-DB reproduziert.
    """
    svc = _svc()
    res = svc.create(_ctx(), OwnerCreate(name="A", language="da"))
    assert res.language == "da"
    assert svc.get(_ctx(), res.id).language == "da"


# --- Objektzuweisung beim ANLEGEN (Mehrfachauswahl) --------------------------

def _svc_drei() -> OwnersService:
    """Dienst mit drei freien Objekten im Tenant t-1."""
    return _svc(
        {
            "properties": [
                {"id": "p-1", "tenant_id": "t-1", "title": "Villa"},
                {"id": "p-2", "tenant_id": "t-1", "title": "Haus"},
                {"id": "p-3", "tenant_id": "t-1", "title": "Loft"},
            ]
        }
    )


def test_create_ordnet_mehrere_objekte_in_einem_zug_zu() -> None:
    """Der eigentliche Auftrag: Eigentümer + seine Objekte in EINEM Aufruf."""
    svc = _svc_drei()
    res = svc.create(
        _ctx(), OwnerCreate(name="A", property_ids=["p-1", "p-2", "p-3"])
    )
    assert {link.property_id for link in res.properties} == {"p-1", "p-2", "p-3"}
    # Und die Zuordnung ist wirklich persistiert, nicht nur in der Antwort.
    assert {link.property_id for link in svc.get(_ctx(), res.id).properties} == {
        "p-1",
        "p-2",
        "p-3",
    }


def test_create_ohne_objekte_bleibt_erlaubt() -> None:
    """Objektzuweisung ist OPTIONAL — ein Eigentümer darf ohne Objekt entstehen."""
    svc = _svc_drei()
    res = svc.create(_ctx(), OwnerCreate(name="A"))
    assert res.properties == []


def test_create_mit_fremdem_objekt_legt_keinen_eigentuemer_an() -> None:
    """Wurzel 3 + Wurzel 5: fremde ID → Fehler UND kein halber Zustand.

    Ein untergemischtes Objekt eines anderen Mandanten darf nicht zugeordnet
    werden. Genauso wichtig: der Eigentümer darf dann nicht angelegt
    zurückbleiben — sonst steht er ohne seine Objekte in der Liste.
    """
    svc = _svc_drei()
    with pytest.raises(OwnerError) as exc:
        svc.create(_ctx(), OwnerCreate(name="A", property_ids=["p-1", "p-fremd"]))
    assert exc.value.status_code == 400
    assert svc.list(_ctx()).total == 0


def test_create_mit_bereits_vergebenem_objekt_nennt_das_objekt() -> None:
    """Race zwischen Dialogöffnen und Speichern: 409 MIT Objektnamen."""
    svc = _svc_drei()
    a = svc.create(_ctx(), OwnerCreate(name="A", property_ids=["p-1"]))
    assert a.properties
    with pytest.raises(OwnerError) as exc:
        svc.create(_ctx(), OwnerCreate(name="B", property_ids=["p-1", "p-2"]))
    assert exc.value.status_code == 409
    # Der Objektname MUSS im Text stehen — sonst muss der Betreiber bei 18
    # Objekten selbst suchen, welches gemeint war.
    #
    # Der NAME des anderen Eigentümers steht ebenfalls im Text, wird hier aber
    # nicht geprüft: er kommt aus dem eingebetteten Select `owners(name)`, und
    # die In-Memory-Attrappe kennt keine PostgREST-Joins. Ein Test, der ihn
    # hier fordert, würde die Attrappe testen statt den Code. Live gegen die
    # Staging-DB gegengeprüft (siehe Slice-README).
    assert "Villa" in exc.value.message
    # Kein halber Zustand: B wurde zurückgenommen, p-2 blieb frei.
    assert svc.list(_ctx()).total == 1
    assert "p-2" in {p.id for p in svc.available_properties(_ctx(), a.id).items}


def test_create_dedupliziert_doppelte_objekt_ids() -> None:
    """Wurzel 2: dieselbe ID doppelt in der Auswahl erzeugt EINE Zuordnung."""
    req = OwnerCreate(name="A", property_ids=["p-1", "p-1", "p-2"])
    assert req.property_ids == ["p-1", "p-2"]


def test_create_weist_leere_objekt_id_ab() -> None:
    """Eine leere ID ist ein Fehler, kein still übersprungener Eintrag."""
    with pytest.raises(ValidationError):
        OwnerCreate(name="A", property_ids=["p-1", "  "])


def test_create_begrenzt_die_objektliste() -> None:
    """Wurzel 8: kein unbegrenzter Schreib-Hebel über die Listenlänge."""
    with pytest.raises(ValidationError):
        OwnerCreate(name="A", property_ids=[f"p-{i}" for i in range(501)])


# --- Nachträgliche Mehrfachzuordnung -----------------------------------------

def test_assign_properties_ordnet_mehrere_auf_einmal_zu() -> None:
    svc = _svc_drei()
    owner = svc.create(_ctx(), OwnerCreate(name="A"))
    res = svc.assign_properties(_ctx(), owner.id, ["p-1", "p-3"])
    assert {link.property_id for link in res.properties} == {"p-1", "p-3"}


def test_assign_properties_fremder_tenant_404() -> None:
    """Wurzel 9: derselbe Scope wie der List-Pfad, auch auf dem Batch-Weg."""
    svc = _svc_drei()
    owner = svc.create(_ctx(), OwnerCreate(name="A"))
    with pytest.raises(OwnerError) as exc:
        svc.assign_properties(_ctx(tenant="t-2"), owner.id, ["p-1"])
    assert exc.value.status_code == 404


def test_assign_properties_ueberspringt_belegtes_objekt_nicht_still() -> None:
    svc = _svc_drei()
    a = svc.create(_ctx(), OwnerCreate(name="A", property_ids=["p-1"]))
    b = svc.create(_ctx(), OwnerCreate(name="B"))
    with pytest.raises(OwnerError) as exc:
        svc.assign_properties(_ctx(), b.id, ["p-1", "p-2"])
    assert exc.value.status_code == 409
    # Nichts halb geschrieben: p-2 hängt NICHT an B.
    assert svc.get(_ctx(), b.id).properties == []
    assert {link.property_id for link in svc.get(_ctx(), a.id).properties} == {"p-1"}


def test_assign_properties_leere_liste_abgewiesen() -> None:
    """Ein Batch-Aufruf ohne Objekte ist ein Aufrufer-Fehler, kein No-op."""
    with pytest.raises(ValidationError):
        OwnerPropertiesAssign(property_ids=[])


# --- Freie Objekte (Auswahl im Anlege-Dialog) --------------------------------

def test_free_properties_zeigt_nur_objekte_ohne_eigentuemer() -> None:
    svc = _svc_drei()
    svc.create(_ctx(), OwnerCreate(name="A", property_ids=["p-1"]))
    frei = {p.id for p in svc.free_properties(_ctx()).items}
    assert frei == {"p-2", "p-3"}


def test_free_properties_liefert_adresse_und_foto() -> None:
    """Adresse/Foto machen 18 ähnlich benannte Objekte unterscheidbar."""
    svc = _svc(
        {
            "properties": [
                {
                    "id": "p-1",
                    "tenant_id": "t-1",
                    "title": "Villa",
                    "street": "Strandvej",
                    "house_number": "7",
                    "city": "Skagen",
                    "photos": ["https://example.invalid/a.jpg"],
                }
            ]
        }
    )
    item = svc.free_properties(_ctx()).items[0]
    assert item.subtitle == "Strandvej 7, Skagen"
    assert item.photo == "https://example.invalid/a.jpg"


def test_free_properties_ohne_adresse_erfindet_nichts() -> None:
    """Wurzel 4: fehlende Adresse bleibt leer, kein Platzhaltertext."""
    svc = _svc_drei()
    item = svc.free_properties(_ctx()).items[0]
    assert item.subtitle is None
    assert item.photo is None


# --- Portal-Sicht: owner_properties UND owner_property_assignments -----------

def _svc_mit_login() -> OwnersService:
    """Tenant mit drei Objekten und einem vorhandenen owner-Login."""
    return _svc(
        {
            "properties": [
                {"id": "p-1", "tenant_id": "t-1", "title": "Villa"},
                {"id": "p-2", "tenant_id": "t-1", "title": "Haus"},
                {"id": "p-3", "tenant_id": "t-1", "title": "Loft"},
            ],
            "users": [
                {
                    "id": "u-owner",
                    "tenant_id": "t-1",
                    "email": "e@example.invalid",
                    "role": "owner",
                }
            ],
            "owner_property_assignments": [],
        }
    )


def test_portalzugang_macht_die_objekte_im_portal_sichtbar() -> None:
    """Regression: Zugang da, Portal leer.

    `owner_properties` ist die ABRECHNUNG, `owner_property_assignments` (0058)
    die PORTAL-Sicht — nur letztere steuert `owner_can_see_property`. Der
    owners-Slice schrieb bisher ausschließlich die erste: der Eigentümer bekam
    einen Zugang und sah nach dem Login NICHTS.
    """
    svc = _svc_mit_login()
    res = svc.create(
        _ctx(),
        OwnerCreate(
            name="A",
            email="e@example.invalid",
            portalzugang=True,
            property_ids=["p-1", "p-2"],
        ),
    )
    assert res.user_id == "u-owner"
    sicht = {
        r["property_id"]
        for r in svc._db.tables["owner_property_assignments"]  # noqa: SLF001  pylint: disable=protected-access
    }
    assert sicht == {"p-1", "p-2"}


def test_nachtraegliche_zuordnung_zieht_die_portal_sicht_nach() -> None:
    """Ein später zugeordnetes Objekt muss der Eigentümer auch SEHEN."""
    svc = _svc_mit_login()
    owner = svc.create(
        _ctx(),
        OwnerCreate(name="A", email="e@example.invalid", portalzugang=True),
    )
    svc.assign_properties(_ctx(), owner.id, ["p-3"])
    sicht = {
        r["property_id"]
        for r in svc._db.tables["owner_property_assignments"]  # noqa: SLF001  pylint: disable=protected-access
    }
    assert sicht == {"p-3"}


def test_unassign_entzieht_auch_die_portal_sicht() -> None:
    """Wurzel 1: mit dem Eigentum endet der Einblick.

    Bliebe die Zeile in `owner_property_assignments` stehen, sähe ein
    Eigentümer Kalender und Daten eines Objekts weiter, das ihm nicht mehr
    gehört — Zuordnung entfernt, Zugriff trotzdem offen.
    """
    svc = _svc_mit_login()
    owner = svc.create(
        _ctx(),
        OwnerCreate(
            name="A",
            email="e@example.invalid",
            portalzugang=True,
            property_ids=["p-1", "p-2"],
        ),
    )
    svc.unassign_property(_ctx(), owner.id, "p-1")
    sicht = {
        r["property_id"]
        for r in svc._db.tables["owner_property_assignments"]  # noqa: SLF001  pylint: disable=protected-access
    }
    assert sicht == {"p-2"}


def test_portalsicht_ist_idempotent() -> None:
    """Wurzel 2: zweimal einladen erzeugt keine doppelten Sicht-Zeilen."""
    svc = _svc_mit_login()
    owner = svc.create(
        _ctx(),
        OwnerCreate(
            name="A",
            email="e@example.invalid",
            portalzugang=True,
            property_ids=["p-1"],
        ),
    )
    svc.portalzugang_einladen(_ctx(), owner.id)
    zeilen = svc._db.tables["owner_property_assignments"]  # noqa: SLF001  pylint: disable=protected-access
    assert len(zeilen) == 1


def test_ohne_portalzugang_keine_portal_sicht() -> None:
    """Ohne Login gibt es niemanden, dem etwas sichtbar gemacht werden könnte."""
    svc = _svc_mit_login()
    svc.create(_ctx(), OwnerCreate(name="A", property_ids=["p-1"]))
    assert svc._db.tables["owner_property_assignments"] == []  # noqa: SLF001  pylint: disable=protected-access


def test_create_schreibt_keine_request_felder_in_die_owners_zeile() -> None:
    """Regression: `property_ids` darf NICHT im Insert-Payload landen.

    `property_ids` und `portalzugang` sind Steuerfelder des Requests, keine
    Spalten von `owners` — die Objekte hängen in `owner_properties`. Blieben
    sie im Payload, weist PostgREST den Insert mit PGRST204 ab („Could not
    find the 'property_ids' column of 'owners'") und der Aufruf endet als 500.
    Genau so live gegen die Staging-DB passiert; die In-Memory-Attrappe merkte
    es nicht, weil sie jedes Feld annimmt. Deshalb prüft der Test die
    GESCHRIEBENE Zeile statt nur die Antwort.
    """
    svc = _svc_drei()
    res = svc.create(_ctx(), OwnerCreate(name="A", property_ids=["p-1"]))
    zeile = next(
        r
        for r in svc._db.tables["owners"]  # noqa: SLF001  pylint: disable=protected-access
        if str(r["id"]) == res.id
    )
    assert "property_ids" not in zeile
    assert "portalzugang" not in zeile


def test_create_nimmt_anlage_zurueck_wenn_der_portalzugang_scheitert() -> None:
    """Regression: kein Eigentümer mit Objekten, aber ohne den Zugang.

    Live gesehen (Staging): bei einer Adresse, die der Mailvalidator ablehnt,
    standen Eigentümer UND Objektzuordnungen bereits in der DB, der Aufruf
    endete trotzdem im Fehler. Der Betreiber sah einen fehlgeschlagenen
    Vorgang, legte den Eigentümer erneut an — und hatte ihn doppelt.

    Die Anlage muss deshalb an JEDEM Fehlschlag danach hängen, nicht nur an
    den fachlichen `OwnerError` der Objektzuordnung.
    """
    svc = _svc_drei()

    def _explodiert(*_a: object, **_k: object) -> dict:
        raise RuntimeError("Einladung nicht zustellbar")

    svc._portalzugang_einrichten = _explodiert  # type: ignore[method-assign]  # noqa: SLF001  pylint: disable=protected-access
    with pytest.raises(RuntimeError):
        svc.create(
            _ctx(),
            OwnerCreate(
                name="A",
                email="e@example.invalid",
                portalzugang=True,
                property_ids=["p-1"],
            ),
        )
    # Weder der Eigentümer noch seine Zuordnung dürfen zurückbleiben.
    assert svc.list(_ctx()).total == 0
    assert "p-1" in {p.id for p in svc.free_properties(_ctx()).items}


# --- Eigentümer eines Objekts (GET /owners/by-property/{property_id}) --------
#
# Der Personenbezug für die Eigennutzung (0353, `reservations.owner_id`).
# Vorher gab es diesen Weg nicht: das Frontend listete alle Eigentümer und lud
# für jeden mit Objekten das Detail nach — ein N+1 für eine Frage, die eine
# Zeile in `owner_properties` beantwortet.

def _svc_mit_eigentuemer() -> OwnersService:
    """Ein Objekt mit Eigentümer, plus ein Objekt eines FREMDEN Mandanten."""
    return _svc(
        {
            "properties": [
                {"id": "p-1", "tenant_id": "t-1", "title": "Villa"},
                {"id": "p-2", "tenant_id": "t-1", "title": "Haus ohne Owner"},
                {"id": "p-9", "tenant_id": "t-9", "title": "Fremd"},
            ],
            "owners": [
                {
                    "id": "o-1",
                    "tenant_id": "t-1",
                    "name": "Herr Ohm",
                    "company": "Ohm GmbH",
                    "email": "ohm@example.invalid",
                    "phone": "+49 111",
                    "country": "DE",
                    "language": "de",
                    # Felder, die die Antwort NICHT tragen darf.
                    "iban": "DE00 1234",
                    "bic": "GENODE",
                    "default_commission_pct": 18.0,
                    "notes": "intern: zahlt spät",
                    "tax_id": "12/345/67890",
                },
                {
                    "id": "o-9",
                    "tenant_id": "t-9",
                    "name": "Fremder Eigentümer",
                    "email": "fremd@example.invalid",
                },
            ],
            "owner_properties": [
                {"id": "op-1", "owner_id": "o-1", "property_id": "p-1"},
                # Ein Link am FREMDEN Objekt — die Route darf ihn nie erreichen.
                {"id": "op-9", "owner_id": "o-9", "property_id": "p-9"},
            ],
        }
    )


def test_by_property_liefert_den_eigentuemer() -> None:
    res = _svc_mit_eigentuemer().by_property(_ctx(), "p-1")
    assert res.property_id == "p-1"
    assert res.owner is not None
    assert res.owner.id == "o-1"
    assert res.owner.name == "Herr Ohm"
    assert res.owner.company == "Ohm GmbH"
    assert res.owner.email == "ohm@example.invalid"
    assert res.owner.language == "de"


def test_by_property_liefert_keine_finanz_oder_bankdaten() -> None:
    """Wurzel 9: keine Felder an eine Route, die sie nicht braucht.

    Für das Anlegen einer Eigennutzung reichen Name/Kontakt/Sprache. IBAN,
    Provisionssatz, Steuer-ID und interne Notizen wären Recon-Material, das
    sich über eine Objekt-ID erschließen ließe. `OwnerKontakt` erbt deshalb
    NICHT von `OwnerBase` — dieser Test hält fest, dass ein später an
    `OwnerBase` ergänztes Feld hier nicht automatisch mitläuft.
    """
    res = _svc_mit_eigentuemer().by_property(_ctx(), "p-1")
    assert res.owner is not None
    felder = set(res.owner.model_dump().keys())
    assert felder == {
        "id", "name", "company", "email", "phone", "country", "language",
    }
    for verboten in (
        "iban", "bic", "account_holder", "default_commission_pct",
        "default_payout_method", "statement_frequency", "notes", "tax_id",
        "vat_id", "user_id", "tenant_id",
    ):
        assert verboten not in felder


def test_by_property_ohne_eigentuemer_ist_kein_fehler() -> None:
    """Wurzel 4/5: „nachgesehen, keiner da" MUSS von „Abruf fehlgeschlagen"
    unterscheidbar bleiben.

    Ein Objekt ohne Zuordnung ist ein gültiger Zustand — 200 mit `owner=None`,
    nicht 404. Ein 404 hätte diesen Fall mit „Objekt gibt es nicht" vermischt,
    und der Aufrufer müsste raten, ob er einen Eigentümer anlegen soll oder
    ob der Abruf kaputt war.
    """
    res = _svc_mit_eigentuemer().by_property(_ctx(), "p-2")
    assert res.property_id == "p-2"
    assert res.owner is None


def test_by_property_fremder_tenant_404() -> None:
    """Wurzel 3: der Scope wird serverseitig erzwungen.

    Ohne ihn ließe sich über eine geratene property_id der Eigentümer eines
    fremden Betriebs samt Name, E-Mail und Telefon auslesen. Dieselbe Meldung
    wie bei einem gar nicht existierenden Objekt — kein Existenz-Leak.
    """
    with pytest.raises(OwnerError) as exc:
        _svc_mit_eigentuemer().by_property(_ctx(), "p-9")
    assert exc.value.status_code == 404


def test_by_property_unbekanntes_objekt_404() -> None:
    with pytest.raises(OwnerError) as exc:
        _svc_mit_eigentuemer().by_property(_ctx(), "p-gibt-es-nicht")
    assert exc.value.status_code == 404


def test_by_property_ohne_tenant_400() -> None:
    with pytest.raises(OwnerError) as exc:
        _svc_mit_eigentuemer().by_property(_ctx(tenant=None), "p-1")
    assert exc.value.status_code == 400


def test_by_property_ignoriert_einen_fremden_eigentuemer_am_eigenen_objekt() -> None:
    """Zweite Scope-Achse: `owner_properties` trägt selbst KEINE tenant_id.

    Zeigte ein Link (Datenfehler, manipulierter Direktpfad) vom eigenen Objekt
    auf den Stammsatz eines fremden Mandanten, lieferte ein ungeprüfter Join
    dessen Kontaktdaten aus. Der `owners!inner`-Filter auf `tenant_id` fängt
    das ab; die Antwort ist dann „kein Eigentümer" — nicht der fremde.
    """
    svc = _svc(
        {
            "properties": [{"id": "p-1", "tenant_id": "t-1", "title": "Villa"}],
            "owners": [
                {"id": "o-9", "tenant_id": "t-9", "name": "Fremder"},
            ],
            "owner_properties": [
                {"id": "op-x", "owner_id": "o-9", "property_id": "p-1"},
            ],
        }
    )
    assert svc.by_property(_ctx(), "p-1").owner is None


def test_by_property_route_verlangt_manage_owners() -> None:
    """Wurzel 9: Autorisierung, nicht bloß Authentifizierung.

    Der Guard ist derselbe `MANAGE_OWNERS` wie an allen anderen Routen des
    Slice — er trägt laut Rollen-Matrix nur admin/co_admin. `staff`, `cleaner`
    und `owner` erreichen die Eigentümer-Kontaktdaten damit nicht.
    """
    from src.features.auth.permissions import Capability, has_capability
    from src.features.auth.schemas import UserRole

    assert has_capability(UserRole.admin, Capability.MANAGE_OWNERS) is True
    assert has_capability(UserRole.co_admin, Capability.MANAGE_OWNERS) is True
    assert has_capability(UserRole.owner, Capability.MANAGE_OWNERS) is False
    assert has_capability(UserRole.staff, Capability.MANAGE_OWNERS) is False
    assert has_capability(UserRole.cleaner, Capability.MANAGE_OWNERS) is False


def test_by_property_route_steht_vor_der_platzhalter_route() -> None:
    """FastAPI wertet Routen in Deklarationsreihenfolge aus.

    Stünde `/by-property/{property_id}` nach `/{owner_id}`, läse FastAPI
    „by-property" als owner_id und die Route wäre nie erreichbar — ein Fehler,
    den keine Typprüfung findet und der erst im Betrieb als 404 auffällt.
    """
    from src.features.owners.router import router

    pfade = [getattr(r, "path", "") for r in router.routes]
    assert "/owners/by-property/{property_id}" in pfade
    assert pfade.index("/owners/by-property/{property_id}") < pfade.index(
        "/owners/{owner_id}"
    )


# --- Storno-Partei beim Auflösen der Eigennutzungen (0410) -------------------

def test_eigennutzung_wird_als_eigentuemer_storniert(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """0410 — die aufgelöste Eigennutzung trägt den EIGENTÜMER als Partei.

    Angeklickt hat die Löschung der Betrieb, storniert wird aber ausschliesslich
    SEINE Eigennutzung, die mit ihm wegfällt. Die Zuordnung bleibt in der
    append-only Historie stehen, auch wenn der Eigentümer selbst gelöscht ist —
    deshalb muss sie stimmen, nicht bloss vorhanden sein.
    """
    from unittest.mock import MagicMock  # noqa: PLC0415

    from src.features.owners.eigennutzungen import (  # noqa: PLC0415
        eigennutzungen_entfernen,
    )

    reservations = MagicMock(name="ReservationsService")
    monkeypatch.setattr(
        "src.features.reservations.service.ReservationsService", reservations
    )
    db = MagicMock(name="supabase")
    ctx = AuthContext(user_id="admin-1", tenant_id="t-1", role="admin")
    eigennutzungen_entfernen(
        db,
        ctx,
        "t-1",
        "own-1",
        [{"id": "66666666-6666-4666-8666-666666666666", "status": "confirmed"}],
        fehler=OwnerError,
    )
    kwargs = reservations.return_value.cancel.call_args.kwargs
    assert kwargs["partei"].value == "eigentuemer"
    assert kwargs["reason_code"].value == "eigennutzung_aufgeloest"


# --- Archivierte Objekte (0416) -----------------------------------------------


def test_available_properties_blendet_archivierte_aus() -> None:
    """Ein archiviertes Objekt ist aus dem Vertrag heraus und darf keinem
    Eigentümer mehr angeboten werden — live stand „Fewo-Mosbjerg-Sindal"
    (archiviert 21.08.2026) weiter als freies Objekt in der Auswahl."""
    svc = _svc(
        {
            "properties": [
                {"id": "p-1", "tenant_id": "t-1", "title": "Villa"},
                {"id": "p-arch", "tenant_id": "t-1", "title": "Fewo-Mosbjerg-Sindal",
                 "archived_at": "2026-08-21T14:11:12+00:00"},
            ]
        }
    )
    a = svc.create(_ctx(), OwnerCreate(name="A"))
    assert {p.id for p in svc.available_properties(_ctx(), a.id).items} == {"p-1"}


def test_assign_property_lehnt_archiviertes_objekt_ab() -> None:
    """Dieselbe Grenze serverseitig: die Auswahl zeigt es nicht, ein direkter
    Aufruf mit der ID darf es ebenso wenig zuordnen (Wurzel 3)."""
    svc = _svc(
        {
            "properties": [
                {"id": "p-arch", "tenant_id": "t-1", "title": "Archiv",
                 "archived_at": "2026-08-21T14:11:12+00:00"},
            ]
        }
    )
    a = svc.create(_ctx(), OwnerCreate(name="A"))
    with pytest.raises(OwnerError) as exc:
        svc.assign_property(_ctx(), a.id, OwnerPropertyAssign(property_id="p-arch"))
    assert exc.value.status_code == 422


def test_assign_properties_batch_lehnt_archiviertes_objekt_mit_namen_ab() -> None:
    """Der Batch-Pfad ist der, den Detailseite und Anlege-Dialog wirklich
    nutzen — er muss dieselbe Grenze ziehen wie der Einzelpfad und das Objekt
    beim Namen nennen."""
    svc = _svc(
        {
            "properties": [
                {"id": "p-1", "tenant_id": "t-1", "title": "Villa"},
                {"id": "p-arch", "tenant_id": "t-1", "title": "Fewo-Mosbjerg-Sindal",
                 "archived_at": "2026-08-21T14:11:12+00:00"},
            ]
        }
    )
    a = svc.create(_ctx(), OwnerCreate(name="A"))
    with pytest.raises(OwnerError) as exc:
        svc.assign_properties(_ctx(), a.id, ["p-1", "p-arch"])
    assert exc.value.status_code == 422
    assert "Fewo-Mosbjerg-Sindal" in str(exc.value)
    # Nichts geschrieben: auch das gültige Objekt bleibt unzugeordnet.
    assert svc.get(_ctx(), a.id).properties == []


# --- Dänische Kennungen: CPR (0127) und Reg.-/Konto-Nr. (0581) --------------
# Format hier und im DB-CHECK identisch; ein Formatfehler ist 422, kein 500.


def test_cpr_wird_mit_bindestrich_normalisiert() -> None:
    assert OwnerUpdate(cpr_number="0101901234").cpr_number == "010190-1234"
    assert OwnerUpdate(cpr_number="010190-1234").cpr_number == "010190-1234"


@pytest.mark.parametrize("wert", ["12345-6789", "0101901234567", "abcdef-1234", "010190 1234"])
def test_cpr_falsches_format_ist_422(wert: str) -> None:
    with pytest.raises(ValidationError):
        OwnerUpdate(cpr_number=wert)
    with pytest.raises(ValidationError):
        OwnerCreate(name="A", cpr_number=wert)


def test_cpr_leer_ist_kein_wert() -> None:
    assert OwnerUpdate(cpr_number="  ").cpr_number is None


def test_bank_reg_nr_genau_vier_ziffern() -> None:
    assert OwnerUpdate(bank_reg_nr="1234").bank_reg_nr == "1234"
    for wert in ("123", "12345", "12a4"):
        with pytest.raises(ValidationError):
            OwnerUpdate(bank_reg_nr=wert)


def test_bank_konto_nr_bis_zehn_ziffern() -> None:
    assert OwnerUpdate(bank_konto_nr="12 3456 7890").bank_konto_nr == "1234567890"
    for wert in ("12345678901", "12-34"):
        with pytest.raises(ValidationError):
            OwnerUpdate(bank_konto_nr=wert)


def test_update_schreibt_cpr_und_dk_bank() -> None:
    svc = _svc()
    owner = svc.create(_ctx(), OwnerCreate(name="Jens", bank_reg_nr="5479", bank_konto_nr="123456"))
    assert owner.bank_reg_nr == "5479"
    upd = svc.update(_ctx(), owner.id, OwnerUpdate(cpr_number="0101901234"))
    assert upd.cpr_number == "010190-1234"
    assert upd.bank_konto_nr == "123456"


def test_owner_kontakt_leitet_keine_kennungen_aus() -> None:
    """Die Objekt-Route (`OwnerKontakt`) trägt weder CPR noch Bank (Wurzel 9)."""
    from src.features.owners.schemas import OwnerKontakt

    felder = set(OwnerKontakt.model_fields)
    assert not felder & {"cpr_number", "bank_reg_nr", "bank_konto_nr", "iban"}
