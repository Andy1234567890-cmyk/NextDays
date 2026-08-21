// Aufgaben — gegen den FastAPI-tasks-Slice (/api/v1/tasks), gespiegelt aus
// apps/web/lib/tasks.ts. Zwei Sichten je nach Berechtigung:
//   VIEW_OWN_TASKS (staff/cleaner) → /tasks/mine, /tasks/detail, /complete,
//                                    PATCH /checklist/item
//   MANAGE_TASKS   (admin/co_admin) → /tasks/team, /tasks/calendar,
//                                    PATCH /status
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

/**
 * Die drei Zeit-Reiter des Webs (AKTUELL · BEVORSTEHENDE · ABGESCHLOSSEN).
 * Die Einteilung nimmt der SERVER vor (`_filter_bucket`) — sie ist zeitlich,
 * nicht nach Status, und darf hier nicht zweitgerechnet werden.
 */
export type StatusBucket = "current" | "upcoming" | "done";

export type TaskFilter = {
  status_bucket?: StatusBucket;
  property_ids?: string[];
  assignee_ids?: string[];
  rule_ids?: string[];
};

/** Filter → Query. Mehrfachauswahl wirkt: jeder Wert wird angehängt. */
function filterParams(filter?: TaskFilter): URLSearchParams {
  const p = new URLSearchParams();
  if (filter?.status_bucket) p.set("status_bucket", filter.status_bucket);
  for (const id of filter?.property_ids ?? []) p.append("property_id", id);
  for (const id of filter?.assignee_ids ?? []) p.append("assignee_id", id);
  for (const id of filter?.rule_ids ?? []) p.append("rule_id", id);
  return p;
}

// --- Ausführung (VIEW_OWN_TASKS: staff/cleaner) ---

/**
 * Dem angemeldeten Nutzer zugewiesene Aufgaben.
 *
 * Liefert `TaskListItem`, nicht `Task`: der Endpunkt reichert seit je Objekt-
 * und Zuständigen-Namen sowie den Checklisten-Fortschritt an (Router:
 * `response_model=list[TaskListItem]`). Der frühere `Task`-Typ hier war eine
 * Untertreibung — die App zeigte deshalb weder Objekt noch Fortschritt, obwohl
 * beides in der Antwort stand.
 */
export async function listMyTasks(
  filter?: Pick<TaskFilter, "status_bucket" | "property_ids">,
): Promise<Result<TaskListItem[]>> {
  const q = filterParams(filter).toString();
  return call(`/tasks/mine${q ? `?${q}` : ""}`);
}

/** Aufgaben-Detail inkl. Checkliste. */
export async function getTaskDetail(taskId: string): Promise<Result<TaskDetail>> {
  return call(`/tasks/detail/${encodeURIComponent(taskId)}`);
}

/**
 * Einen Checklistenpunkt ab- oder wieder anhaken.
 *
 * Erlaubt für den Zuständigen (VIEW_OWN_TASKS) — der Server prüft den Scope
 * und die Foto-Pflicht; ein Punkt mit `requires_photo` und ohne Nachweis
 * scheitert dort mit 422. Antwort ist das ganze Detail, damit Fortschritt und
 * Status in einem Zug stimmen.
 */
export async function toggleChecklistItem(
  itemId: string,
  done: boolean,
): Promise<Result<TaskDetail>> {
  return call(`/tasks/checklist/item/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    body: { done },
  });
}

/** Eigene Aufgabe abschließen (Foto-Pflicht serverseitig erzwungen → 422). */
export async function completeTask(taskId: string): Promise<Result<TaskDetail>> {
  return call(`/tasks/${encodeURIComponent(taskId)}/complete`, { method: "POST" });
}

// --- Verwaltung (MANAGE_TASKS: admin/co_admin) ---

/** Teamaufgaben (alle, mit Objekt-/Assignee-Namen + Fortschritt). */
export async function listTeamTasks(
  filter?: TaskFilter,
): Promise<Result<TaskListItem[]>> {
  const q = filterParams(filter).toString();
  return call(`/tasks/team${q ? `?${q}` : ""}`);
}

/** Eine Buchung der Kalender-Zeile. KEINE Beträge/Gast-PII (§4.3). */
export type CalendarBooking = {
  id: string;
  property_id: string;
  channel: string;
  ota_name: string | null;
  guests: number;
  adults: number;
  children: number;
  check_in: string;
  check_out: string;
  status: string;
};

/** Eine Objekt-Zeile des Aufgaben-Kalenders (property_id `null` = ohne Objekt). */
export type CalendarRow = {
  property_id: string | null;
  property_title: string;
  tasks: TaskListItem[];
  bookings: CalendarBooking[];
};

/**
 * Aufgaben-Kalender eines Monats: je Objekt eine Zeile mit ihren Aufgaben UND
 * ihren Buchungen. Die Buchungen sind der Grund, hier zu laden statt in
 * `/tasks/team`: nur mit ihnen lässt sich am Tag „Abreise/Anreise" ausweisen,
 * und genau das braucht die Reinigung.
 *
 * Nur MANAGE_TASKS (Router: `_manage()`). Mitarbeiter bekommen ihre Agenda aus
 * `/tasks/mine` — dort ist der Scope die Autorisierung (Wurzel 9).
 *
 * `monthFrom`/`monthTo` sind ISO-Zeitstempel (Monatsanfang bzw. -ende 23:59:59)
 * wie im Web; das Backend vergleicht sie als Strings gegen `start_at`/`due_at`.
 */
export async function getTaskCalendar(
  monthFrom: string,
  monthTo: string,
  filter?: Pick<TaskFilter, "assignee_ids" | "rule_ids">,
): Promise<Result<{ rows: CalendarRow[] }>> {
  const p = filterParams(filter);
  p.set("month_from", monthFrom);
  p.set("month_to", monthTo);
  return call(`/tasks/calendar?${p.toString()}`);
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
