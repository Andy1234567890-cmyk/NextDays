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
    _insert_returns(
        m,
        [{"id": "s1", "task_id": "t1", "requested_by": "u1",
          "accepted_by": None, "status": "requested", "note": None}],
    )
    sub = svc.request_substitution("T", "u1", SubstitutionRequest(task_id="t1"))
    assert sub.requested_by == "u1"
    assert sub.status.value == "requested"


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


# --- ohne Client: sauberer Fehler ---

def test_no_client_raises_clean_error() -> None:
    svc = TasksService(client=None)
    with pytest.raises(TaskError) as exc:
        svc.create_task("T", TaskCreate(title="X"))
    assert exc.value.status_code == 500
