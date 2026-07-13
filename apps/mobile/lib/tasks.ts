// Aufgaben — gegen den FastAPI-tasks-Slice (/api/v1/tasks), gespiegelt aus
// apps/web/lib/tasks.ts. Zwei Sichten je nach Berechtigung:
//   VIEW_OWN_TASKS (staff/cleaner) → /tasks/mine, /tasks/detail, /complete
//   MANAGE_TASKS   (admin/co_admin) → /tasks/team, PATCH /status
// TaskListItem/TaskDetail tragen bewusst KEINE Gast-PII/Beträge (§4.3) — der
// cleaner sieht nur Objekt + Zeitfenster. Nichts auffüllen.
import { call, type Result } from "@/lib/api";

export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";
export type InspectionState = "to_review" | "reviewed";
export type TaskSource = "manual" | "auto" | "recurring";

export type Task = {
  id: string;
  tenant_id: string;
  property_id: string | null;
  reservation_id: string | null;
  assignee_id: string | null;
  title: string;
  status: TaskStatus;
  due_at: string | null;
  needs_inspection: boolean;
  inspection_state: InspectionState | null;
  source: TaskSource;
  priority: number;
  start_at: string | null;
  end_at: string | null;
};

export type TaskListItem = Task & {
  property_title: string | null;
  assignee_name: string | null;
  checklist_total: number;
  checklist_done: number;
};

export type ChecklistItem = {
  id: string;
  task_id: string;
  label: string;
  room: string | null;
  done: boolean;
  requires_photo: boolean;
  sort_order: number;
  photos: string[];
};

export type TaskDetail = Task & {
  property_title: string | null;
  assignee_name: string | null;
  checklist: ChecklistItem[];
};

// --- Ausführung (VIEW_OWN_TASKS: staff/cleaner) ---

/** Dem angemeldeten Nutzer zugewiesene Aufgaben. */
export async function listMyTasks(): Promise<Result<Task[]>> {
  return call("/tasks/mine");
}

/** Aufgaben-Detail inkl. Checkliste. */
export async function getTaskDetail(taskId: string): Promise<Result<TaskDetail>> {
  return call(`/tasks/detail/${encodeURIComponent(taskId)}`);
}

/** Eigene Aufgabe abschließen (Foto-Pflicht serverseitig erzwungen → 422). */
export async function completeTask(taskId: string): Promise<Result<TaskDetail>> {
  return call(`/tasks/${encodeURIComponent(taskId)}/complete`, { method: "POST" });
}

// --- Verwaltung (MANAGE_TASKS: admin/co_admin) ---

/** Teamaufgaben (alle, mit Objekt-/Assignee-Namen + Fortschritt). */
export async function listTeamTasks(statusBucket?: string): Promise<Result<TaskListItem[]>> {
  const q = statusBucket ? `?status_bucket=${encodeURIComponent(statusBucket)}` : "";
  return call(`/tasks/team${q}`);
}

/** Aufgaben-Status setzen (nur MANAGE_TASKS). */
export async function setTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<Result<Task>> {
  return call(`/tasks/${encodeURIComponent(taskId)}/status`, {
    method: "PATCH",
    body: { status },
  });
}
