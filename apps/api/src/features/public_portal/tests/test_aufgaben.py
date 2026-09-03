"""Eigentümer-Aufgaben im Portal (03.09.2026).

Den Scope (nur die IHM zugewiesene Aufgabe an SEINEM Objekt) prüfen die
Tasks-Tests (`test_eigentuemer_*`). Hier steht, was DIESER Modul tut: den
Contract verengen und die drei Handlungen an den Tasks-Slice durchreichen.
"""
from __future__ import annotations

from unittest.mock import MagicMock

from src.core.security import AuthContext
from src.features.public_portal.aufgaben import (
    PortalAufgabenService,
    portal_aufgabe,
)
from src.features.tasks.schemas import TaskListItem, TaskStatus


def _ctx() -> AuthContext:
    return AuthContext(user_id="o1", tenant_id="t-1", role="owner")


def _item(**kw: object) -> TaskListItem:
    basis: dict[str, object] = {
        "id": "t2", "tenant_id": "t-1", "property_id": "p1",
        "reservation_id": "r1", "assignee_id": "o1", "title": "Reinigung",
        "status": TaskStatus.open, "due_at": None, "needs_inspection": False,
        "inspection_state": None, "source": "auto", "priority": 0,
        "start_at": "2026-09-13T08:00:00+00:00",
        "end_at": "2026-09-13T12:00:00+00:00",
        "property_title": "Feriehus Britt", "assignee_name": "Eigentümer",
        "reservation_ref": "ABC123", "checklist_total": 3, "checklist_done": 1,
    }
    basis.update(kw)
    return TaskListItem(**basis)  # type: ignore[arg-type]


def test_contract_traegt_keinen_zustaendigen_und_keine_kosten() -> None:
    """Der Datensplit (§4.2/§4.3) ist eine Eigenschaft des CONTRACTS, nicht
    der Höflichkeit einer Oberfläche: das Feld existiert im Modell nicht."""
    a = portal_aufgabe(_item())
    daten = a.model_dump()
    assert "assignee_id" not in daten and "assignee_name" not in daten
    assert "costs" not in daten and "cost_currency" not in daten
    assert a.status == "open"
    assert a.property_title == "Feriehus Britt"
    assert (a.checklist_done, a.checklist_total) == (1, 3)


def test_liste_ruft_den_eigenen_lesepfad_mit_kontext() -> None:
    """`list_own_tasks` MIT `ctx`: ohne ihn fiele der Eigentümer-Scope weg und
    die Liste zeigte alles, was ihm je zugewiesen wurde — auch an Objekten,
    die ihm nicht (mehr) gehören."""
    tasks = MagicMock()
    tasks.list_own_tasks.return_value = [_item(), _item(id="t3")]
    svc = PortalAufgabenService(tasks)
    res = svc.liste(_ctx())
    assert res.total == 2 and [i.id for i in res.items] == ["t2", "t3"]
    _, kwargs = tasks.list_own_tasks.call_args
    assert kwargs["ctx"] is not None and kwargs["ctx"].role == "owner"


def test_erledigt_laeuft_ueber_complete_task_nicht_set_status() -> None:
    """Nur `complete_task` erzwingt die Foto-Pflicht der Checkliste. Ein
    `set_status(done)` ginge daran vorbei — dieselbe Regel wie fürs Personal."""
    tasks = MagicMock()
    tasks.complete_task.return_value = _item(status=TaskStatus.done)
    svc = PortalAufgabenService(tasks)
    a = svc.erledigt(_ctx(), "t2")
    assert a.status == "done"
    tasks.complete_task.assert_called_once()
    tasks.set_status.assert_not_called()


def test_anfangen_setzt_in_progress() -> None:
    tasks = MagicMock()
    tasks.set_status.return_value = _item(status=TaskStatus.in_progress)
    svc = PortalAufgabenService(tasks)
    a = svc.anfangen(_ctx(), "t2")
    assert a.status == "in_progress"
    args, _ = tasks.set_status.call_args
    assert args[2] == TaskStatus.in_progress
