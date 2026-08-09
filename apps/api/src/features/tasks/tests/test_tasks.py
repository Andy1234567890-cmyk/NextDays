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


def test_set_status_updates_scoped_and_returns_task() -> None:
    svc, m = _svc()
    (
        m.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value
    ).data = [
        {"id": "t1", "tenant_id": "T", "title": "X", "status": "done",
         "reservation_id": "r1"},
    ]
    t = svc.set_status("T", "t1", TaskStatus.done)
    assert t.status == TaskStatus.done


def test_set_status_missing_task_raises_404() -> None:
    svc, m = _svc()
    (
        m.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value
    ).data = []
    with pytest.raises(TaskError) as exc:
        svc.set_status("T", "missing", TaskStatus.done)
    assert exc.value.status_code == 404


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
