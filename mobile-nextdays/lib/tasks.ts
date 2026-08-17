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

/** Wer kann Zuständige:r einer Aufgabe sein?
 *
 * Eigener Endpunkt statt `/auth/account/users`: dort stehen ALLE Nutzer des
 * Betriebs, auch Eigentümer — die haben `view_own_tasks` aber nicht und
 * könnten eine ihnen zugewiesene Aufgabe nie öffnen. Der Server leitet die
 * Menge aus der Capability ab und filtert gesperrte Zugänge.
 *
 * Kein `permissions`-Feld: die Rechte fremder Konten gehören nicht in eine
 * Auswahlliste (Wurzel 9).
 */
export type Mitarbeiter = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string;
};

export async function listTaskAssignees(): Promise<Result<Mitarbeiter[]>> {
  return call("/tasks/assignees");
}

/**
 * Auswahl-Beschriftung, gleiche Logik wie `web/lib/mitarbeiter-optionen.ts`:
 * bei mehrdeutigem Namen kommt die E-Mail dazu. Im Beta-Betrieb tragen zwei
 * Konten denselben `full_name`; ohne diese Unterscheidung wählt man blind.
 */
export function mitarbeiterOptionen(
  users: Mitarbeiter[],
): { value: string; label: string }[] {
  const aktiv = users;
  const proName = new Map<string, number>();
  for (const u of aktiv) {
    const name = u.full_name?.trim();
    if (name) proName.set(name, (proName.get(name) ?? 0) + 1);
  }
  return aktiv.map((u) => {
    const name = u.full_name?.trim();
    if (!name) return { value: u.user_id, label: u.email ?? u.user_id };
    const mehrdeutig = (proName.get(name) ?? 0) > 1;
    return {
      value: u.user_id,
      label: mehrdeutig && u.email ? `${name} (${u.email})` : name,
    };
  });
}

/**
 * Zuständigen einer bestehenden Aufgabe setzen oder abziehen (MANAGE_TASKS).
 *
 * `null` nimmt die Zuweisung zurück. Der Server prüft, ob der Empfänger die
 * Aufgabe überhaupt sehen könnte (Objekt-Freigabe) — eine Zuweisung ins
 * Nichts scheitert mit 422 statt still durchzugehen.
 */
export async function setTaskAssignee(
  taskId: string,
  assigneeId: string | null,
): Promise<Result<TaskDetail>> {
  return call(`/tasks/${encodeURIComponent(taskId)}/assignee`, {
    method: "PATCH",
    body: { assignee_id: assigneeId },
  });
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
