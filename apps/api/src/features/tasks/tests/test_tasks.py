"""Tests für den tasks-Slice (Lastenheft §2.5 + §4.3)."""
from datetime import datetime
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from src.features.tasks.schemas import (
    BookingTasksRequest,
    InventoryItemCreate,
    SubstitutionRequest,
    TaskCreate,
    TaskStatus,
)
from src.features.tasks.service import TaskError, TasksService
from src.main import create_app

client = TestClient(create_app())


def test_tasks_health() -> None:
    resp = client.get("/api/v1/tasks/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "tasks", "status": "ok"}


def _svc() -> tuple[TasksService, MagicMock]:
    m = MagicMock(name="supabase")
    return TasksService(client=m), m


def _insert_returns(m: MagicMock, rows: list[dict]) -> None:
    m.table.return_value.insert.return_value.execute.return_value.data = rows


# --- auto-Generierung bei Buchung (§2.5) ---

def test_generate_for_booking_creates_arrival_and_cleaning() -> None:
    svc, m = _svc()
    _insert_returns(
        m,
        [
            {"id": "t1", "tenant_id": "T", "title": "Anreise-Check/Inspektion",
             "status": "open", "property_id": "p1"},
            {"id": "t2", "tenant_id": "T", "title": "Endreinigung",
             "status": "open", "property_id": "p1"},
        ],
    )
    req = BookingTasksRequest(
        reservation_id="r1",
        property_id="p1",
        check_in=datetime(2026, 7, 1, 15, 0),
        check_out=datetime(2026, 7, 8, 10, 0),
    )
    tasks = svc.generate_for_booking("T", req)
    assert [t.title for t in tasks] == ["Anreise-Check/Inspektion", "Endreinigung"]
    payload = m.table.return_value.insert.call_args.args[0]
    assert len(payload) == 2
    assert payload[0]["due_at"] == req.check_in.isoformat()
    assert payload[1]["due_at"] == req.check_out.isoformat()


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
    chain = (
        m.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value
    )
    chain.execute.return_value.data = [
        {"id": "t1", "tenant_id": "T", "reservation_id": "r1",
         "title": "Endreinigung", "status": "open", "property_id": "p1"},
    ]
    tasks = svc.list_by_reservation("T", "r1")
    assert [t.title for t in tasks] == ["Endreinigung"]
    assert tasks[0].reservation_id == "r1"
    # Beide Filter gesetzt: tenant_id + reservation_id (Wurzel 3 — kein
    # ungescopter Roh-Zugriff per ID).
    eq_calls = m.table.return_value.select.return_value.eq.call_args_list
    assert eq_calls[0].args == ("tenant_id", "T")
    second_eq = m.table.return_value.select.return_value.eq.return_value.eq
    assert second_eq.call_args.args == ("reservation_id", "r1")


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
