"""Tests für den tasks-Slice (Lastenheft §2.5 + §4.3)."""
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from src.core.security import AuthContext
from src.features.tasks.schemas import (
    InventoryItemCreate,
    SubstitutionRequest,
    TaskCreate,
    TaskStatus,
)
from src.features.tasks.service import TaskError, TasksService
from src.main import create_app

client = TestClient(create_app())

# Buchungs-ID für die Scope-Tests (muss eine UUID sein, Wurzel 5).
RES_ID = "55555555-5555-4555-8555-555555555555"


def test_tasks_health() -> None:
    resp = client.get("/api/v1/tasks/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "tasks", "status": "ok"}


def _svc() -> tuple[TasksService, MagicMock]:
    m = MagicMock(name="supabase")
    return TasksService(client=m), m


def _insert_returns(m: MagicMock, rows: list[dict]) -> None:
    m.table.return_value.insert.return_value.execute.return_value.data = rows


# --- Vertretungs-Feature (§4.3) ---

def test_request_substitution_records_requester() -> None:
    svc, m = _svc()
    # §4.3-Guard: der Assignee-Check lädt zuerst die Aufgabe (select) — sie muss
    # dem Tenant gehören UND dem Antragsteller (u1) zugewiesen sein.
    m.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.\
        return_value.execute.return_value.data = [
            {"id": "t1", "assignee_id": "u1"}
        ]
    _insert_returns(
        m,
        [{"id": "s1", "task_id": "t1", "requested_by": "u1",
          "accepted_by": None, "status": "requested", "note": None}],
    )
    sub = svc.request_substitution("T", "u1", SubstitutionRequest(task_id="t1"))
    assert sub.requested_by == "u1"
    assert sub.status.value == "requested"


def test_add_checklist_item_rejects_foreign_task() -> None:
    """IDOR-Guard: eine task_id, die NICHT dem Tenant gehört, wird mit 404
    abgelehnt (kein Checklist-Insert an fremde Aufgabe)."""
    from src.features.tasks.schemas import ChecklistItemCreate

    svc, m = _svc()
    # tasks-Select liefert NICHTS → fremde/unbekannte Aufgabe.
    m.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.\
        return_value.execute.return_value.data = []
    with pytest.raises(TaskError) as exc:
        svc.add_checklist_item(
            "T", ChecklistItemCreate(task_id="foreign-task", label="X")
        )
    assert exc.value.status_code == 404


def test_request_substitution_rejects_non_assignee() -> None:
    """Nur der zugewiesene Mitarbeiter darf Vertretung anfragen — sonst 403."""
    import pytest

    from src.features.tasks.service import TaskError

    svc, m = _svc()
    # Aufgabe existiert, ist aber einem ANDEREN Mitarbeiter zugewiesen.
    m.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.\
        return_value.execute.return_value.data = [
            {"id": "t1", "assignee_id": "someone-else"}
        ]
    with pytest.raises(TaskError) as exc:
        svc.request_substitution("T", "u1", SubstitutionRequest(task_id="t1"))
    assert exc.value.status_code == 403


# --- Inventar auch ohne property (§2.5 zentraler Pool) ---

def test_inventory_without_property_is_central_pool() -> None:
    svc, m = _svc()
    _insert_returns(
        m,
        [{"id": "i1", "tenant_id": "T", "property_id": None,
          "name": "Wäschepaket", "quantity": 23}],
    )
    item = svc.add_inventory(
        "T", InventoryItemCreate(name="Wäschepaket", quantity=23)
    )
    assert item.property_id is None
    assert item.quantity == 23


# --- create_task ---

def test_create_task_defaults_open() -> None:
    svc, m = _svc()
    _insert_returns(
        m, [{"id": "t1", "tenant_id": "T", "title": "X", "status": "open"}]
    )
    t = svc.create_task("T", TaskCreate(title="X"))
    assert t.status == TaskStatus.open


# --- Aufgaben je Buchung (PM-Detailseite) ---

def test_list_by_reservation_scopes_tenant_and_reservation() -> None:
    svc, m = _svc()
    # Die Buchung wird ZUERST gescopt geladen (Wurzel 9) — dieselbe Chain
    # (select.eq.eq.limit) beantwortet den Vorab-Load.
    (
        m.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value
    ).execute.return_value.data = [{"id": RES_ID, "property_id": "p1"}]
    chain = (
        m.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value
    )
    chain.execute.return_value.data = [
        {"id": "t1", "tenant_id": "T", "reservation_id": RES_ID,
         "title": "Endreinigung", "status": "open", "property_id": "p1"},
    ]
    tasks = svc.list_by_reservation("T", RES_ID)
    assert [t.title for t in tasks] == ["Endreinigung"]
    assert tasks[0].reservation_id == RES_ID
    # Zwei gescopte Abfragen: erst die Buchung per (id, tenant_id), dann ihre
    # Aufgaben per (tenant_id, reservation_id) — kein ungescopter Roh-Zugriff
    # per ID (Wurzel 3), und der Vorab-Load ist der Wurzel-9-Guard.
    eq_calls = [c.args for c in m.table.return_value.select.return_value.eq.call_args_list]
    assert ("id", RES_ID) in eq_calls          # Buchung zuerst geladen
    assert ("tenant_id", "T") in eq_calls      # Aufgaben tenant-gescopt
    second_eq = [
        c.args
        for c in m.table.return_value.select.return_value.eq.return_value.eq.call_args_list
    ]
    assert ("tenant_id", "T") in second_eq     # Buchung tenant-gescopt
    assert ("reservation_id", RES_ID) in second_eq




# --- ohne Client: sauberer Fehler ---

def test_no_client_raises_clean_error() -> None:
    svc = TasksService(client=None)
    with pytest.raises(TaskError) as exc:
        svc.create_task("T", TaskCreate(title="X"))
    assert exc.value.status_code == 500


# --- PM-Modul: menschenlesbares Zeitplan-Label (UX-Verbesserung) ---

def test_schedule_label_weekly_pattern() -> None:
    from src.features.tasks.schedule_label import schedule_label

    # Mo (bit0) + Fr (bit4) = 1 + 16 = 17
    label = schedule_label({"frequency": "weekly", "weekday_mask": 17})
    assert label is not None
    assert "Montag" in label and "Freitag" in label


def test_schedule_label_monthly_weekday_pattern() -> None:
    from src.features.tasks.schedule_label import schedule_label

    label = schedule_label(
        {
            "frequency": "monthly",
            "weekday_pattern_position": "first",
            "weekday_pattern_weekday": 0,  # Montag
        }
    )
    assert label == "Monatlich · jeden 1. Montag"


def test_schedule_label_daily_interval() -> None:
    from src.features.tasks.schedule_label import schedule_label

    assert schedule_label({"frequency": "daily", "interval": 3}) == "Alle 3 Tage"


def test_schedule_label_empty_returns_none() -> None:
    """Keine erfundenen Fallback-Werte (CLAUDE.md Wurzel 4)."""
    from src.features.tasks.schedule_label import schedule_label

    assert schedule_label({}) is None
    assert schedule_label(None) is None
    assert schedule_label({"frequency": "unknown"}) is None


# --- PM-Modul: Foto-Pflicht beim Abschließen ---

def test_complete_task_rejects_missing_required_photo() -> None:
    """Ein requires_photo-Item ohne Foto → 422 (Foto-Pflicht, Prompt-1 §8)."""
    from src.features.tasks.schemas import ChecklistItem, TaskDetail

    svc, _ = _svc()
    detail = TaskDetail(
        id="t1",
        tenant_id="T",
        title="Endreinigung",
        status=TaskStatus.in_progress,
        checklist=[
            ChecklistItem(
                id="c1", task_id="t1", label="Bad", requires_photo=True, photos=[]
            )
        ],
    )
    svc.get_detail = MagicMock(return_value=detail)  # type: ignore[method-assign]
    with pytest.raises(TaskError) as exc:
        svc.complete_task("T", "t1", "u1")
    assert exc.value.status_code == 422


def test_complete_task_ok_when_photos_present() -> None:
    from src.features.tasks.schemas import ChecklistItem, TaskDetail

    svc, m = _svc()
    detail = TaskDetail(
        id="t1",
        tenant_id="T",
        title="Endreinigung",
        status=TaskStatus.in_progress,
        needs_inspection=True,
        checklist=[
            ChecklistItem(
                id="c1",
                task_id="t1",
                label="Bad",
                requires_photo=True,
                photos=["path/a.jpg"],
            )
        ],
    )
    done = detail.model_copy(update={"status": TaskStatus.done})
    svc.get_detail = MagicMock(  # type: ignore[method-assign]
        side_effect=[detail, done]
    )
    (
        m.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value
    ).data = [{"id": "t1"}]
    result = svc.complete_task("T", "t1", "u1")
    assert result.status == TaskStatus.done
    # needs_inspection → inspection_state auf to_review gesetzt.
    update_payload = m.table.return_value.update.call_args.args[0]
    assert update_payload["inspection_state"] == "to_review"


# --- PM-Modul: Inspektions-Entscheidung ---

def test_inspect_reject_reopens_task() -> None:
    """Zurückweisung setzt inspection_state=to_review UND status=open zur
    Nachbearbeitung."""
    from src.features.tasks.schemas import InspectionDecision

    svc, m = _svc()
    (
        m.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value
    ).data = [{"id": "t1"}]
    svc.get_detail = MagicMock(  # type: ignore[method-assign]
        return_value=MagicMock()
    )
    svc.inspect("T", "t1", InspectionDecision(approved=False))
    update_payload = m.table.return_value.update.call_args.args[0]
    assert update_payload["inspection_state"] == "to_review"
    assert update_payload["status"] == "open"


# --- PM-Modul: Status-Bucket-Filter (Meine/Team-Tabs) ---

def test_filter_bucket_teilt_zeitlich_nicht_nach_status() -> None:
    """AKTUELL/BEVORSTEHENDE entscheiden sich am Termin, nicht am Status.

    Vorher galt „current = in_progress", wodurch eine heute fällige offene
    Aufgabe unter BEVORSTEHENDE landete und der AKTUELL-Reiter leer blieb.
    """
    from datetime import UTC, datetime, timedelta

    from src.features.tasks.schemas import Task

    now = datetime.now(UTC)

    def _t(tid: str, status: TaskStatus, start: datetime | None) -> Task:
        return Task(id=tid, tenant_id="T", title=tid, status=status, start_at=start)

    faellig = _t("faellig", TaskStatus.open, now - timedelta(hours=2))
    kommend = _t("kommend", TaskStatus.open, now + timedelta(days=3))
    laufend = _t("laufend", TaskStatus.in_progress, now - timedelta(days=1))
    erledigt = _t("erledigt", TaskStatus.done, now - timedelta(days=5))
    storniert = _t("storniert", TaskStatus.cancelled, now - timedelta(days=5))
    tasks = [faellig, kommend, laufend, erledigt, storniert]

    current = {t.id for t in TasksService._filter_bucket(tasks, "current")}
    assert current == {"faellig", "laufend"}
    upcoming = {t.id for t in TasksService._filter_bucket(tasks, "upcoming")}
    assert upcoming == {"kommend"}
    done = {t.id for t in TasksService._filter_bucket(tasks, "done")}
    assert done == {"erledigt", "storniert"}
    assert len(TasksService._filter_bucket(tasks, None)) == 5


# --- Wurzel 9: by-reservation scopt wie der Buchungs-Slice ------------------
#
# Angriff: Ein Eigentümer schiebt die reservation_id einer Buchung an einem
# NICHT zugeordneten Objekt desselben Betriebs unter. Der reservations-Slice
# 404t das (reads.detail), dieser Pfad tat es nicht — der Item-Pfad gab mehr
# her als der List-Pfad.

OWN_PROP = "p-own"
FOREIGN_PROP = "p-fremd"


class _TaskTableFake:
    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows

    def select(self, *_a: object, **_k: object) -> "_TaskTableFake":
        return self

    def order(self, *_a: object, **_k: object) -> "_TaskTableFake":
        return self

    def limit(self, *_a: object, **_k: object) -> "_TaskTableFake":
        return self

    def eq(self, col: str, val: object) -> "_TaskTableFake":
        return _TaskTableFake([r for r in self._rows if r.get(col) == val])

    def execute(self) -> object:
        from types import SimpleNamespace

        return SimpleNamespace(data=list(self._rows))


class _TaskDBFake:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self._tables = tables

    def table(self, name: str) -> _TaskTableFake:
        return _TaskTableFake(list(self._tables.get(name, [])))


def _resv_svc(assigned: list[str], resv_property: str) -> TasksService:
    """Buchung an `resv_property`; `assigned` = Objekte des Anfragenden."""
    return TasksService(
        client=_TaskDBFake(  # type: ignore[arg-type]
            {
                "reservations": [
                    {"id": RES_ID, "tenant_id": "T", "property_id": resv_property}
                ],
                "tasks": [
                    {
                        "id": "task-1",
                        "tenant_id": "T",
                        "reservation_id": RES_ID,
                        "property_id": resv_property,
                        "title": "Endreinigung",
                        "status": "open",
                    }
                ],
                "owner_property_assignments": [
                    {"property_id": p, "tenant_id": "T", "user_id": "u1"}
                    for p in assigned
                ],
                "staff_property_assignments": [
                    {"property_id": p, "tenant_id": "T", "user_id": "u1"}
                    for p in assigned
                ],
            }
        )
    )


def _owner_task_ctx() -> AuthContext:
    return AuthContext(user_id="u1", tenant_id="T", role="owner")


def test_by_reservation_foreign_property_is_404() -> None:
    """Eigentümer + fremdes Objekt → 404 wie im reservations-Slice."""
    svc = _resv_svc(assigned=[OWN_PROP], resv_property=FOREIGN_PROP)
    with pytest.raises(TaskError) as exc:
        svc.list_by_reservation("T", RES_ID, _owner_task_ctx())
    assert exc.value.status_code == 404


def test_by_reservation_without_assignment_is_404() -> None:
    """Fail-closed: keine Zuordnung → nichts."""
    svc = _resv_svc(assigned=[], resv_property=OWN_PROP)
    with pytest.raises(TaskError) as exc:
        svc.list_by_reservation("T", RES_ID, _owner_task_ctx())
    assert exc.value.status_code == 404


def test_by_reservation_staff_scope_applies() -> None:
    """§4.3: derselbe Schnitt für staff/cleaner."""
    svc = _resv_svc(assigned=[OWN_PROP], resv_property=FOREIGN_PROP)
    ctx = AuthContext(user_id="u1", tenant_id="T", role="cleaner")
    with pytest.raises(TaskError) as exc:
        svc.list_by_reservation("T", RES_ID, ctx)
    assert exc.value.status_code == 404


def test_by_reservation_own_property_returns_tasks() -> None:
    """Gegenprobe: das zugeordnete Objekt liefert die Aufgaben."""
    svc = _resv_svc(assigned=[OWN_PROP], resv_property=OWN_PROP)
    tasks = svc.list_by_reservation("T", RES_ID, _owner_task_ctx())
    assert [t.id for t in tasks] == ["task-1"]


def test_by_reservation_admin_not_restricted() -> None:
    """admin sieht die Aufgaben auch ohne Zuordnung."""
    svc = _resv_svc(assigned=[], resv_property=FOREIGN_PROP)
    ctx = AuthContext(user_id="u1", tenant_id="T", role="admin")
    assert len(svc.list_by_reservation("T", RES_ID, ctx)) == 1


def test_by_reservation_foreign_tenant_is_404() -> None:
    """Cross-Tenant bleibt 404 (Wurzel 3)."""
    svc = _resv_svc(assigned=[OWN_PROP], resv_property=OWN_PROP)
    with pytest.raises(TaskError) as exc:
        svc.list_by_reservation("FREMD", RES_ID, _owner_task_ctx())
    assert exc.value.status_code == 404


def test_by_reservation_non_uuid_is_404_not_500() -> None:
    """Wurzel 5: Fehl-Input darf keinen 500 werfen."""
    svc = _resv_svc(assigned=[OWN_PROP], resv_property=OWN_PROP)
    with pytest.raises(TaskError) as exc:
        svc.list_by_reservation("T", "not-a-uuid", _owner_task_ctx())
    assert exc.value.status_code == 404


# --- 0360: vierter Status, Abhaken, Kosten, Rückmeldung --------------------
#
# Diese Tests laufen gegen ein zustandsbehaftetes DB-Doppel statt gegen
# MagicMock-Ketten: `get_detail` liest sechs Tabellen, und eine Kette je Pfad
# zu stellen sagt am Ende mehr über die Mocks als über den Dienst.


class _FakeQuery:
    def __init__(self, db: "_FakeDB", table: str) -> None:
        self._db = db
        self._table = table
        self._filters: list[tuple[str, object]] = []
        self._patch: dict | None = None
        self._delete = False
        self._insert: dict | None = None
        self._upsert: dict | None = None

    def select(self, *_a: object, **_k: object) -> "_FakeQuery":
        return self

    def eq(self, col: str, val: object) -> "_FakeQuery":
        self._filters.append((col, val))
        return self

    def in_(self, col: str, vals: list) -> "_FakeQuery":
        self._filters.append((col, ("__in__", tuple(str(v) for v in vals))))
        return self

    def order(self, *_a: object, **_k: object) -> "_FakeQuery":
        return self

    def limit(self, _n: int) -> "_FakeQuery":
        return self

    def update(self, patch: dict) -> "_FakeQuery":
        self._patch = patch
        return self

    def insert(self, row: dict) -> "_FakeQuery":
        self._insert = row
        return self

    def upsert(self, row: dict, **_k: object) -> "_FakeQuery":
        self._upsert = row
        return self

    def delete(self) -> "_FakeQuery":
        self._delete = True
        return self

    def _passt(self, row: dict) -> bool:
        for col, val in self._filters:
            if isinstance(val, tuple) and val and val[0] == "__in__":
                if str(row.get(col)) not in val[1]:
                    return False
            elif str(row.get(col)) != str(val):
                return False
        return True

    def execute(self) -> MagicMock:
        rows = self._db.tables.setdefault(self._table, [])
        treffer = [r for r in rows if self._passt(r)]
        if self._patch is not None:
            for r in treffer:
                r.update(self._patch)
            return MagicMock(data=list(treffer))
        if self._delete:
            self._db.tables[self._table] = [r for r in rows if r not in treffer]
            return MagicMock(data=list(treffer))
        if self._insert is not None:
            neu = {"id": f"neu-{len(rows) + 1}", **self._insert}
            rows.append(neu)
            return MagicMock(data=[neu])
        if self._upsert is not None:
            schluessel = "task_id"
            vorhanden = [
                r for r in rows if r.get(schluessel) == self._upsert.get(schluessel)
            ]
            if vorhanden:
                vorhanden[0].update(self._upsert)
                return MagicMock(data=[vorhanden[0]])
            rows.append(dict(self._upsert))
            return MagicMock(data=[rows[-1]])
        return MagicMock(data=list(treffer))


class _FakeDB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables

    def table(self, name: str) -> _FakeQuery:
        return _FakeQuery(self, name)


def _tables(**extra: list[dict]) -> dict[str, list[dict]]:
    basis: dict[str, list[dict]] = {
        "tasks": [
            {
                "id": "t1", "tenant_id": "T", "title": "Endreinigung",
                "status": "open", "property_id": "p1", "assignee_id": "u1",
            }
        ],
        "properties": [{"id": "p1", "tenant_id": "T", "title": "Haus", "currency": "DKK"}],
        "tenants": [{"id": "T", "currency": "EUR"}],
        # `role` steht hier, weil der Schreibpfad sie liest: nur staff/cleaner
        # hängen am Objekt-Scope, admin/co_admin/owner nicht
        # (`_require_own_assignee`).
        "users": [
            {"id": "u1", "tenant_id": "T", "full_name": "Reinigung", "role": "cleaner"},
            {"id": "u2", "tenant_id": "T", "full_name": "Zweite", "role": "cleaner"},
            {"id": "a1", "tenant_id": "T", "full_name": "Chefin", "role": "admin"},
        ],
        "checklist_items": [],
        "checklist_photos": [],
        "task_costs": [],
        "task_resolutions": [],
        "reservations": [],
        # Der cleaner arbeitet NUR an freigegebenen Objekten (§4.3). Ohne diese
        # Zeile ist er fail-closed ausgesperrt — genau richtig, aber dann
        # prüfen die Tests unten den Scope statt der neuen Funktionen.
        "staff_property_assignments": [
            {"tenant_id": "T", "user_id": "u1", "property_id": "p1"}
        ],
    }
    basis.update(extra)
    return basis


def _admin() -> AuthContext:
    return AuthContext(user_id="a1", tenant_id="T", role="admin")


def _cleaner() -> AuthContext:
    return AuthContext(user_id="u1", tenant_id="T", role="cleaner")


def test_vertretung_benachrichtigt_die_moeglichen_vertreter(monkeypatch) -> None:
    """Eine Anfrage erreichte bis 0415 NIEMANDEN — nur eine Log-Zeile.

    Der Empfaengerkreis ist derselbe, aus dem eine Zuweisung schoepfen darf
    (Capability + Objekt-Freigabe), minus dem Anfragenden.
    """
    gesendet: dict[str, object] = {}

    def _fake(_db, **kwargs):
        gesendet.update(kwargs)

    monkeypatch.setattr(
        "src.features.tasks.service.melde_vertretung_gesucht", _fake
    )
    db = _FakeDB(
        _tables(
            staff_property_assignments=[
                {"tenant_id": "T", "user_id": "u1", "property_id": "p1"},
                # Zweite Reinigungskraft MIT Freigabe fuer dasselbe Objekt —
                # nur sie kann die Aufgabe ueberhaupt uebernehmen.
                {"tenant_id": "T", "user_id": "u2", "property_id": "p1"},
            ]
        )
    )
    svc = TasksService(client=db)
    svc.request_substitution(
        "T", "u1", SubstitutionRequest(task_id="t1", note="krank")
    )
    assert gesendet["task_id"] == "t1"
    empfaenger = gesendet["empfaenger_ids"]
    assert "u1" not in empfaenger  # man vertritt sich nicht selbst
    assert "u2" in empfaenger
    # Wer fuer das Objekt NICHT freigegeben ist, wird nicht gefragt: er koennte
    # die Aufgabe ohnehin nicht uebernehmen (Wurzel 9).
    assert gesendet["titel"] == "Endreinigung"


def test_vertretung_antwort_geht_an_den_anfragenden(monkeypatch) -> None:
    """Ohne diese Meldung weiss der Anfragende nicht, ob er noch fahren muss."""
    antworten: list[dict[str, object]] = []

    def _fake(_db, **kwargs):
        antworten.append(kwargs)

    monkeypatch.setattr(
        "src.features.tasks.service.melde_vertretung_entschieden", _fake
    )
    db = _FakeDB(
        _tables(
            task_substitutions=[
                {
                    "id": "s1", "tenant_id": "T", "task_id": "t1",
                    "requested_by": "u1", "status": "requested", "note": None,
                    "accepted_by": None,
                }
            ],
            staff_property_assignments=[
                {"tenant_id": "T", "user_id": "u1", "property_id": "p1"},
                {"tenant_id": "T", "user_id": "u2", "property_id": "p1"},
            ],
        )
    )
    svc = TasksService(client=db)
    svc.accept_substitution("T", "s1", "u2", _admin())
    assert antworten[-1]["empfaenger_id"] == "u1"
    assert antworten[-1]["uebernommen"] is True
    # Der Name des Vertreters steht in der Uebernahme-Meldung.
    assert antworten[-1]["durch_name"] == "Zweite"


def test_vertretung_ablehnung_nennt_keinen_namen(monkeypatch) -> None:
    """Eine Absage ist keine Anschuldigung — kein Name in der Meldung."""
    antworten: list[dict[str, object]] = []
    monkeypatch.setattr(
        "src.features.tasks.service.melde_vertretung_entschieden",
        lambda _db, **kwargs: antworten.append(kwargs),
    )
    db = _FakeDB(
        _tables(
            task_substitutions=[
                {
                    "id": "s1", "tenant_id": "T", "task_id": "t1",
                    "requested_by": "u1", "status": "requested", "note": None,
                    "accepted_by": None,
                }
            ]
        )
    )
    svc = TasksService(client=db)
    svc.decline_substitution("T", "s1", "u2", _admin())
    assert antworten[-1]["uebernommen"] is False
    assert antworten[-1]["durch_name"] is None


def test_detail_traegt_buchungsbezug_ohne_gastdaten() -> None:
    """Das Detail nennt Referenz UND Zeitraum der Buchung — aber nichts sonst.

    Für die ausführende Person ist „ab wann ist das Objekt frei" die
    Arbeitsangabe; sie fehlte im Detail komplett, obwohl die Liste daneben die
    Referenz schon zeigte (TaskDetail erbte von der schmalen Task-Basis und
    verwarf `reservation_ref` stillschweigend).
    """
    db = _FakeDB(
        _tables(
            tasks=[
                {
                    "id": "t1", "tenant_id": "T", "title": "Endreinigung",
                    "status": "open", "property_id": "p1", "assignee_id": "u1",
                    "reservation_id": "r1",
                }
            ],
            reservations=[
                {
                    "id": "r1", "tenant_id": "T", "external_ref": "5318730188",
                    "check_in": "2026-08-18", "check_out": "2026-08-22",
                    "guest_name": "Gun Heiboe", "total_amount": "4905.00",
                }
            ],
        )
    )
    svc = TasksService(client=db)
    d = svc.get_detail("T", "t1", _cleaner())
    assert d.reservation_ref == "5318730188"
    assert d.reservation_check_in == "2026-08-18"
    assert d.reservation_check_out == "2026-08-22"
    # §4.3: kein Gastname, kein Betrag — auch nicht als Nebenprodukt.
    werte = d.model_dump()
    assert "guest_name" not in werte
    assert "total_amount" not in werte


def test_detail_ohne_buchung_erfindet_keinen_zeitraum() -> None:
    """Wurzel 4: keine Buchung heißt `None`, nicht ein plausibler Tag."""
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    d = svc.get_detail("T", "t1", _admin())
    assert d.reservation_ref is None
    assert d.reservation_check_in is None
    assert d.reservation_check_out is None


def test_detail_liest_die_buchung_nur_im_eigenen_mandanten() -> None:
    """Wurzel 3: die Buchung wird über tenant_id UND id geladen."""
    db = _FakeDB(
        _tables(
            tasks=[
                {
                    "id": "t1", "tenant_id": "T", "title": "X", "status": "open",
                    "property_id": "p1", "reservation_id": "r-fremd",
                }
            ],
            reservations=[
                {
                    "id": "r-fremd", "tenant_id": "FREMD", "external_ref": "999",
                    "check_in": "2026-08-18", "check_out": "2026-08-22",
                }
            ],
        )
    )
    svc = TasksService(client=db)
    d = svc.get_detail("T", "t1", _admin())
    assert d.reservation_check_in is None
    assert d.reservation_ref is None


def test_upload_prueft_die_bytes_nicht_den_header() -> None:
    """Wurzel 8: `content_type` ist eine Behauptung des Clients.

    Vorher entschied allein der Header, ob eine Datei „ein Bild" ist. Damit
    landete alles im Bucket, was `image/jpeg` behauptete — auch Markup, das ein
    Browser später ausführt.
    """
    db = _FakeDB(_tables(checklist_items=[
        {"id": "c1", "task_id": "t1", "label": "Bad", "done": False,
         "requires_photo": True, "sort_order": 0},
    ]))
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.upload_checklist_photo(
            "T", "c1", b"<svg onload=alert(1)>", "image/jpeg", _cleaner()
        )
    assert exc.value.status_code == 415


def test_upload_nimmt_echtes_jpeg_an() -> None:
    db = _FakeDB(_tables(checklist_items=[
        {"id": "c1", "task_id": "t1", "label": "Bad", "done": False,
         "requires_photo": True, "sort_order": 0},
    ]))
    svc = TasksService(client=db)
    db.storage = MagicMock()  # type: ignore[attr-defined]
    foto_id = svc.upload_checklist_photo(
        "T", "c1", b"\xff\xd8\xff\xe0" + b"0" * 64, "image/jpeg", _cleaner()
    )
    assert foto_id
    assert len(db.tables["checklist_photos"]) == 1
    # Der Pfad trägt die Endung des ECHTEN Typs, nicht die des Headers.
    assert db.tables["checklist_photos"][0]["storage_path"].endswith(".jpg")


def test_status_annehmen_und_anfangen() -> None:
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    d = svc.set_status("T", "t1", TaskStatus.accepted, _admin())
    assert d.status == TaskStatus.accepted
    d = svc.set_status("T", "t1", TaskStatus.in_progress, _admin())
    assert d.status == TaskStatus.in_progress


def test_status_gleicher_wert_ist_idempotent() -> None:
    """Wurzel 2: Doppeltipp auf dem Telefon ist kein Fehler."""
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    svc.set_status("T", "t1", TaskStatus.accepted, _admin())
    d = svc.set_status("T", "t1", TaskStatus.accepted, _admin())
    assert d.status == TaskStatus.accepted


def test_status_unmoeglicher_sprung_wird_abgelehnt() -> None:
    db = _FakeDB(_tables(tasks=[
        {"id": "t1", "tenant_id": "T", "title": "X", "status": "done",
         "property_id": "p1"},
    ]))
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.set_status("T", "t1", TaskStatus.in_progress, _admin())
    assert exc.value.status_code == 422


def test_status_done_erzwingt_die_fotopflicht() -> None:
    """Der Statuswechsel war bis 0360 der Weg AM Foto-Zwang vorbei."""
    db = _FakeDB(_tables(checklist_items=[
        {"id": "c1", "task_id": "t1", "label": "Bad", "done": False,
         "requires_photo": True, "sort_order": 0},
    ]))
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.set_status("T", "t1", TaskStatus.done, _admin())
    assert exc.value.status_code == 422


def test_status_zuruecknehmen_raeumt_den_abschluss_ab() -> None:
    """Wurzel 1: wer den Haken zurücknimmt, nimmt auch Zeitpunkt und Urheber
    zurück — sonst trägt eine offene Aufgabe ein „abgeschlossen am …"."""
    db = _FakeDB(_tables(tasks=[
        {"id": "t1", "tenant_id": "T", "title": "X", "status": "done",
         "property_id": "p1", "completed_at": "2026-08-01T10:00:00+00:00",
         "completed_by": "u1", "inspection_state": "to_review"},
    ]))
    svc = TasksService(client=db)
    svc.set_status("T", "t1", TaskStatus.open, _admin())
    zeile = db.tables["tasks"][0]
    assert zeile["completed_at"] is None
    assert zeile["completed_by"] is None
    assert zeile["inspection_state"] is None


def test_checklisten_punkt_abhaken_haelt_die_spur_fest() -> None:
    db = _FakeDB(_tables(checklist_items=[
        {"id": "c1", "task_id": "t1", "label": "Bad", "done": False,
         "requires_photo": False, "sort_order": 0},
    ]))
    svc = TasksService(client=db)
    d = svc.toggle_checklist_item("T", "c1", True, _cleaner())
    assert d.checklist[0].done is True
    assert db.tables["checklist_items"][0]["done_by"] == "u1"
    assert db.tables["checklist_items"][0]["done_at"]


def test_checklisten_punkt_zuruecknehmen_loescht_die_spur() -> None:
    db = _FakeDB(_tables(checklist_items=[
        {"id": "c1", "task_id": "t1", "label": "Bad", "done": True,
         "requires_photo": False, "sort_order": 0,
         "done_at": "2026-08-01T10:00:00+00:00", "done_by": "u1"},
    ]))
    svc = TasksService(client=db)
    svc.toggle_checklist_item("T", "c1", False, _cleaner())
    zeile = db.tables["checklist_items"][0]
    assert zeile["done"] is False
    assert zeile["done_at"] is None
    assert zeile["done_by"] is None


def test_checklisten_punkt_fremder_mandant_ist_404() -> None:
    """Der Scope hängt an der Aufgabe, nicht an der item_id (Wurzel 9)."""
    db = _FakeDB(_tables(checklist_items=[
        {"id": "c9", "task_id": "fremd", "label": "X", "done": False,
         "requires_photo": False, "sort_order": 0},
    ]))
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.toggle_checklist_item("T", "c9", True, _admin())
    assert exc.value.status_code == 404


def test_kosten_nehmen_die_objektwaehrung() -> None:
    from src.features.tasks.schemas import TaskCostCreate
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    d = svc.add_cost("T", "t1", TaskCostCreate(amount="12.50", note=" Klopapier "), _cleaner())
    assert d.costs[0].currency == "DKK"      # Objektwährung, nicht Betriebs-EUR
    assert d.costs[0].note == "Klopapier"
    assert d.cost_currency == "DKK"


def test_kosten_ohne_waehrung_werden_abgelehnt() -> None:
    """Wurzel 4: lieber 422 als ein erfundenes Euro in einer Abrechnung."""
    from src.features.tasks.schemas import TaskCostCreate
    db = _FakeDB(_tables(
        properties=[{"id": "p1", "tenant_id": "T", "title": "Haus", "currency": None}],
        tenants=[{"id": "T", "currency": None}],
    ))
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.add_cost("T", "t1", TaskCostCreate(amount="5.00"), _cleaner())
    assert exc.value.status_code == 422


def test_cleaner_sieht_nur_die_eigenen_auslagen() -> None:
    """§4.3: die eigene Auslage eintragen ≠ die Auslagen des Betriebs lesen."""
    db = _FakeDB(_tables(task_costs=[
        {"id": "k1", "tenant_id": "T", "task_id": "t1", "amount": "10.00",
         "currency": "DKK", "created_by": "u1"},
        {"id": "k2", "tenant_id": "T", "task_id": "t1", "amount": "99.00",
         "currency": "DKK", "created_by": "chef"},
    ]))
    svc = TasksService(client=db)
    assert len(svc.get_detail("T", "t1", _cleaner()).costs) == 1
    assert len(svc.get_detail("T", "t1", _admin()).costs) == 2


def test_cleaner_kann_fremde_auslage_nicht_loeschen() -> None:
    db = _FakeDB(_tables(task_costs=[
        {"id": "k2", "tenant_id": "T", "task_id": "t1", "amount": "99.00",
         "currency": "DKK", "created_by": "chef"},
    ]))
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.delete_cost("T", "k2", _cleaner())
    assert exc.value.status_code == 404


def test_rueckmeldung_ohne_berechtigung_darf_nicht_benoten() -> None:
    from src.features.tasks.schemas import TaskResolutionUpsert
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.set_resolution(
            "T", "t1", TaskResolutionUpsert(score=5), _cleaner(), darf_benoten=False
        )
    assert exc.value.status_code == 403


def test_rueckmeldung_text_darf_die_zustaendige_person() -> None:
    from src.features.tasks.schemas import TaskResolutionUpsert
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    d = svc.set_resolution(
        "T", "t1", TaskResolutionUpsert(note="Schlüssel klemmt"), _cleaner(),
        darf_benoten=False,
    )
    assert d.resolution is not None
    assert d.resolution.note == "Schlüssel klemmt"
    assert d.resolution.score is None


def test_rueckmeldung_ganz_leer_wird_abgelehnt() -> None:
    from src.features.tasks.schemas import TaskResolutionUpsert
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.set_resolution(
            "T", "t1", TaskResolutionUpsert(note="   "), _admin(), darf_benoten=True
        )
    assert exc.value.status_code == 422


# --- Zuweisung an einen Mitarbeiter (17.08.2026) ---------------------------
#
# Bis hierher war `assignee_id` ein Einweg-Feld: gesetzt beim Anlegen, danach
# unveränderlich. Diese Tests halten die drei Eigenschaften fest, an denen der
# neue Pfad hängt — Scope, Objekt-Freigabe, Gegenzustand.


def test_zuweisen_setzt_den_zustaendigen() -> None:
    """u2 ist cleaner MIT Freigabe für p1 — der Normalfall."""
    db = _FakeDB(
        _tables(
            staff_property_assignments=[
                {"tenant_id": "T", "user_id": "u1", "property_id": "p1"},
                {"tenant_id": "T", "user_id": "u2", "property_id": "p1"},
            ]
        )
    )
    svc = TasksService(client=db)
    d = svc.set_assignee("T", "t1", "u2", _admin())
    assert d.assignee_id == "u2"


def test_zuweisung_zuruecknehmen_ist_erlaubt() -> None:
    """`None` ist ein Zielzustand, kein fehlender Wert.

    Ohne diesen Weg bliebe eine Fehlzuweisung für immer stehen — die Aufgabe
    müsste gelöscht und neu angelegt werden, mitsamt Checkliste und Historie.
    """
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    d = svc.set_assignee("T", "t1", None, _admin())
    assert d.assignee_id is None


def test_zuweisen_an_denselben_ist_idempotent(monkeypatch: pytest.MonkeyPatch) -> None:
    """Derselbe Empfänger ist kein Wechsel — und löst keine zweite Mail aus."""
    gerufen: list[str] = []
    monkeypatch.setattr(
        "src.features.tasks.service.melde_aufgaben_zuweisung",
        lambda *a, **k: gerufen.append("mail"),
    )
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    d = svc.set_assignee("T", "t1", "u1", _admin())
    assert d.assignee_id == "u1"
    assert gerufen == []


def test_zuweisen_an_fremden_mitarbeiter_ist_422() -> None:
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.set_assignee("T", "t1", "fremd", _admin())
    assert exc.value.status_code == 422


def test_zuweisen_ohne_objekt_freigabe_ist_422() -> None:
    """Der Schreibpfad prüft, was der Lesepfad filtert (Wurzel 9).

    Ohne diese Prüfung ginge die Zuweisung durch, die Mail ginge raus — und
    beim Empfänger wäre die Aufgabe unsichtbar, weil `list_own_tasks` sie am
    fehlenden `staff_property_assignments`-Eintrag ausblendet.
    """
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        # u2 ist cleaner, hat aber keine Freigabe für p1.
        svc.set_assignee("T", "t1", "u2", _admin())
    assert exc.value.status_code == 422
    assert "Objekt" in exc.value.message


def test_zuweisen_an_admin_braucht_keine_objekt_freigabe() -> None:
    """admin/co_admin/owner hängen nicht an staff_property_assignments."""
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    d = svc.set_assignee("T", "t1", "a1", _admin())
    assert d.assignee_id == "a1"


def test_zuweisen_fremder_mandant_ist_404() -> None:
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.set_assignee("FREMD", "t1", "a1", _admin())
    assert exc.value.status_code == 404


def test_zuweisen_meldet_neuem_und_altem_zustaendigen(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Beide Richtungen (Wurzel 1).

    Nur den Neuen zu benachrichtigen ließe den Bisherigen im Glauben, die
    Aufgabe sei weiter seine — sie verschwindet wortlos aus seiner Liste.
    """
    neu: list[str | None] = []
    weg: list[str | None] = []
    monkeypatch.setattr(
        "src.features.tasks.service.melde_aufgaben_zuweisung",
        lambda *a, **k: neu.append(k.get("assignee_id")),
    )
    monkeypatch.setattr(
        "src.features.tasks.service.melde_aufgaben_entzug",
        lambda *a, **k: weg.append(k.get("assignee_id")),
    )
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    svc.set_assignee("T", "t1", "a1", _admin())
    assert neu == ["a1"]
    assert weg == ["u1"]


def test_bulk_zuweisen_zaehlt_uebersprungene() -> None:
    """Was am Scope scheitert, wird gezählt statt den ganzen Aufruf zu kippen."""
    db = _FakeDB(
        _tables(
            tasks=[
                {"id": "t1", "tenant_id": "T", "title": "A", "status": "open",
                 "property_id": "p1", "assignee_id": None},
                {"id": "t2", "tenant_id": "T", "title": "B", "status": "open",
                 "property_id": "p1", "assignee_id": None},
            ]
        )
    )
    svc = TasksService(client=db)
    res = svc.bulk_assign("T", ["t1", "t2", "gibtsnicht"], "a1", _admin())
    assert res == {"assigned": 2, "skipped": 1}


# --- Vertretung (§4.3) -----------------------------------------------------


def _mit_anfrage() -> _FakeDB:
    return _FakeDB(
        _tables(
            task_substitutions=[
                {"id": "s1", "tenant_id": "T", "task_id": "t1",
                 "requested_by": "u1", "accepted_by": None,
                 "status": "requested", "note": None}
            ]
        )
    )


def test_vertretung_annehmen_schreibt_den_zustaendigen_um() -> None:
    """Der Kern des Features — und genau das, was vorher fehlte.

    Vorher setzte `accept` nur `status='accepted'`: die Aufgabe blieb beim
    Vertretenen, tauchte beim Vertreter nie auf, und zwei Leute hielten
    dieselbe Aufgabe für ihre.
    """
    db = _mit_anfrage()
    svc = TasksService(client=db)
    sub = svc.accept_substitution("T", "s1", "a1", _admin())
    assert sub.status.value == "accepted"
    assert db.tables["tasks"][0]["assignee_id"] == "a1"


def test_vertretung_sich_selbst_ist_422() -> None:
    db = _mit_anfrage()
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.accept_substitution("T", "s1", "u1", _cleaner())
    assert exc.value.status_code == 422


def test_vertretung_zweimal_annehmen_ist_409() -> None:
    """Ohne Status-Guard ließe sich der Vertreter nachträglich überschreiben."""
    db = _mit_anfrage()
    svc = TasksService(client=db)
    svc.accept_substitution("T", "s1", "a1", _admin())
    with pytest.raises(TaskError) as exc:
        svc.accept_substitution("T", "s1", "u2", _admin())
    assert exc.value.status_code == 409


def test_vertretung_ablehnen_laesst_die_aufgabe_stehen() -> None:
    db = _mit_anfrage()
    svc = TasksService(client=db)
    sub = svc.decline_substitution("T", "s1", "a1")
    assert sub.status.value == "declined"
    assert db.tables["tasks"][0]["assignee_id"] == "u1"


def test_offene_anfragen_ohne_eigene() -> None:
    """Man vertritt sich nicht selbst — die eigene Anfrage fällt raus."""
    db = _mit_anfrage()
    svc = TasksService(client=db)
    assert svc.list_substitutions("T", "u1", _cleaner()) == []
    fremd = svc.list_substitutions("T", "a1", _admin())
    assert len(fremd) == 1
    # Ohne Titel und Objekt wäre eine Anfrage nicht entscheidbar.
    assert fremd[0].title == "Endreinigung"
    assert fremd[0].property_title == "Haus"
    assert fremd[0].requested_by_name == "Reinigung"


def test_auswahlliste_zeigt_keine_eigentuemer() -> None:
    """Ein `owner` hat VIEW_OWN_TASKS nicht — er könnte die Aufgabe nie öffnen.

    Live standen 23 Eigentümer neben 2 berechtigten Personen in der Auswahl,
    und 11 Aufgaben lagen auf Eigentümer-Konten, die sie nie zu sehen bekamen.
    """
    db = _FakeDB(
        _tables(
            users=[
                {"id": "u1", "tenant_id": "T", "full_name": "Reinigung",
                 "role": "cleaner", "email": "r@x.dk"},
                {"id": "a1", "tenant_id": "T", "full_name": "Chefin",
                 "role": "admin", "email": "c@x.dk"},
                {"id": "o1", "tenant_id": "T", "full_name": "Eigentümer",
                 "role": "owner", "email": "o@x.dk"},
            ]
        )
    )
    svc = TasksService(client=db)
    ids = {o.user_id for o in svc.moegliche_zustaendige("T")}
    assert ids == {"u1", "a1"}


def test_auswahlliste_ohne_gesperrte_und_ohne_fremde_rolle() -> None:
    """Gesperrt = kein Login = keine Arbeit. Unbekannte Rolle: fail-closed."""
    db = _FakeDB(
        _tables(
            users=[
                {"id": "u1", "tenant_id": "T", "full_name": "Aktiv",
                 "role": "cleaner", "email": "a@x.dk"},
                {"id": "u9", "tenant_id": "T", "full_name": "Gesperrt",
                 "role": "cleaner", "email": "g@x.dk",
                 "deactivated_at": "2026-08-01T00:00:00Z"},
                {"id": "u8", "tenant_id": "T", "full_name": "Fremd",
                 "role": "hausmeister", "email": "f@x.dk"},
            ]
        )
    )
    svc = TasksService(client=db)
    assert {o.user_id for o in svc.moegliche_zustaendige("T")} == {"u1"}


# --- Nachträge aus dem Review (17.08.2026) ---------------------------------


def test_vertretung_ablehnen_ohne_objekt_scope_ist_404() -> None:
    """`decline` prüft denselben Scope wie die Liste (Wurzel 9).

    Vorher nahm die Methode kein `ctx` und filterte nur auf den Mandanten:
    ein Mitarbeiter konnte eine Anfrage abwürgen, die er nicht einmal sehen
    darf — die Bitte um Vertretung wäre erledigt, ohne dass jemand einspringt.
    """
    db = _FakeDB(
        _tables(
            tasks=[
                {"id": "t1", "tenant_id": "T", "title": "X", "status": "open",
                 "property_id": "p9", "assignee_id": "u1"},
            ],
            task_substitutions=[
                {"id": "s1", "tenant_id": "T", "task_id": "t1",
                 "requested_by": "u1", "accepted_by": None,
                 "status": "requested", "note": None},
            ],
        )
    )
    svc = TasksService(client=db)
    # u1 ist cleaner und hat nur p1 frei, die Aufgabe hängt an p9.
    with pytest.raises(TaskError) as exc:
        svc.decline_substitution("T", "s1", "u1", _cleaner())
    assert exc.value.status_code == 404
    # Die Anfrage bleibt offen — sie wurde nicht heimlich entschieden.
    assert db.tables["task_substitutions"][0]["status"] == "requested"


def test_vertretung_annehmen_claimt_vor_dem_umschreiben() -> None:
    """Der Claim ist der Riegel, nicht die Reihenfolge (Wurzel 2).

    Scheitert das Umschreiben fachlich, wird der Claim zurückgerollt — sonst
    stünde eine quittierte Anfrage ohne Wirkung da, die niemand mehr annehmen
    kann.
    """
    db = _FakeDB(
        _tables(
            tasks=[
                {"id": "t1", "tenant_id": "T", "title": "X", "status": "open",
                 "property_id": "p1", "assignee_id": "u1"},
            ],
            task_substitutions=[
                {"id": "s1", "tenant_id": "T", "task_id": "t1",
                 "requested_by": "u1", "accepted_by": None,
                 "status": "requested", "note": None},
            ],
            # u2 ist cleaner OHNE Freigabe für p1 → set_assignee wirft 422.
            staff_property_assignments=[
                {"tenant_id": "T", "user_id": "u1", "property_id": "p1"},
            ],
        )
    )
    svc = TasksService(client=db)
    with pytest.raises(TaskError) as exc:
        svc.accept_substitution("T", "s1", "u2", _admin())
    assert exc.value.status_code == 422
    zeile = db.tables["task_substitutions"][0]
    assert zeile["status"] == "requested"
    assert zeile["accepted_by"] is None
    assert db.tables["tasks"][0]["assignee_id"] == "u1"


def test_auswahlliste_beruecksichtigt_objekt_freigabe() -> None:
    """Wer nicht freigegeben ist, steht gar nicht erst zur Wahl.

    Sonst verspricht die Liste etwas, das `_require_own_assignee` gleich
    darauf mit 422 ablehnt — bei der Massen-Zuweisung sogar wortlos als
    „N übersprungen".
    """
    db = _FakeDB(
        _tables(
            users=[
                {"id": "u1", "tenant_id": "T", "full_name": "Frei",
                 "role": "cleaner", "email": "f@x.dk"},
                {"id": "u2", "tenant_id": "T", "full_name": "Nicht frei",
                 "role": "cleaner", "email": "n@x.dk"},
                {"id": "a1", "tenant_id": "T", "full_name": "Chefin",
                 "role": "admin", "email": "c@x.dk"},
            ],
            staff_property_assignments=[
                {"tenant_id": "T", "user_id": "u1", "property_id": "p1"},
            ],
        )
    )
    svc = TasksService(client=db)
    # Ohne Objekt: beide Reinigungskräfte plus Chefin.
    assert {o.user_id for o in svc.moegliche_zustaendige("T")} == {
        "u1", "u2", "a1",
    }
    # Mit Objekt p1: u2 fällt raus, die Chefin bleibt (hängt nicht am Scope).
    assert {o.user_id for o in svc.moegliche_zustaendige("T", "p1")} == {
        "u1", "a1",
    }


def test_umweisung_hin_und_zurueck_meldet_zweimal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A→B→A muss A wirklich zweimal erreichen.

    Der Entdopplungs-Schlüssel trägt den Empfänger, aber der UNIQUE-Index
    greift über OFFENE Meldungen: ohne einen Vorgangs-Stempel liefe A's
    zweite Zuweisung auf seine erste, noch ungelesene — und fiele samt Mail
    aus.
    """
    schluessel: list[str | None] = []
    monkeypatch.setattr(
        "src.features.tasks.service.melde_aufgaben_zuweisung",
        lambda *a, **k: schluessel.append(k.get("vorgang")),
    )
    monkeypatch.setattr(
        "src.features.tasks.service.melde_aufgaben_entzug",
        lambda *a, **k: None,
    )
    db = _FakeDB(_tables())
    svc = TasksService(client=db)
    svc.set_assignee("T", "t1", "a1", _admin())
    svc.set_assignee("T", "t1", "u1", _admin())
    assert len(schluessel) == 2
    assert all(v for v in schluessel), "jeder Wechsel braucht einen Stempel"
