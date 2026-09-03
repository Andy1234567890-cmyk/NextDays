"""Eigentümer-Aufgaben: der schmale Portal-Weg über den Tasks-Slice (03.09.2026).

Der Eigentümer spricht (Portal UND App) ausschließlich `/public-portal/*`.
Die Aufgaben-Logik liegt im Tasks-Slice und bleibt dort — hier wird nur
gerufen und auf den Portal-Contract verengt. Den Scope erzwingt der
TasksService selbst (`_eigentuemer_sieht`: nur die IHM zugewiesene Aufgabe an
SEINEM Objekt); dieser Modul fügt keine zweite, abweichende Prüfung hinzu.
"""
from __future__ import annotations

from src.core.security import AuthContext
from src.features.tasks.schemas import TaskDetail, TaskListItem, TaskStatus
from src.features.tasks.service import TaskError, TasksService

from .schemas_aufgaben import PortalTaskItem, PortalTaskList


def portal_aufgabe(t: TaskListItem | TaskDetail) -> PortalTaskItem:
    """Auf den Portal-Contract verengen — nichts erfinden, nichts hinzufügen."""
    return PortalTaskItem(
        id=t.id,
        title=t.title,
        status=str(t.status.value if hasattr(t.status, "value") else t.status),
        property_id=t.property_id,
        property_title=t.property_title,
        start_at=t.start_at,
        end_at=t.end_at,
        reservation_ref=t.reservation_ref,
        checklist_total=t.checklist_total,
        checklist_done=t.checklist_done,
    )


class PortalAufgabenService:
    """Drei Handlungen: ansehen, anfangen, erledigt melden.

    Zeitfenster, Zuständigen oder Objekt ändert der Eigentümer NICHT — das ist
    Einsatzplanung der Verwaltung (§4.2 read-only); die Routen dafür verlangen
    MANAGE_TASKS und existieren hier nicht.
    """

    def __init__(self, tasks: TasksService) -> None:
        self._tasks = tasks

    def liste(self, ctx: AuthContext) -> PortalTaskList:
        rows = self._tasks.list_own_tasks(
            str(ctx.tenant_id), ctx.user_id, status_bucket=None, ctx=ctx
        )
        items = [portal_aufgabe(t) for t in rows]
        return PortalTaskList(items=items, total=len(items))

    def anfangen(self, ctx: AuthContext, task_id: str) -> PortalTaskItem:
        detail = self._tasks.set_status(
            str(ctx.tenant_id), task_id, TaskStatus.in_progress, ctx
        )
        return portal_aufgabe(detail)

    def erledigt(self, ctx: AuthContext, task_id: str) -> PortalTaskItem:
        # Über `complete_task`, nicht `set_status(done)`: dort hängt die
        # Foto-Pflicht der Checkliste, und die gilt für den Eigentümer genauso.
        detail = self._tasks.complete_task(
            str(ctx.tenant_id), task_id, ctx.user_id, ctx
        )
        return portal_aufgabe(detail)


__all__ = ["PortalAufgabenService", "TaskError", "portal_aufgabe"]
