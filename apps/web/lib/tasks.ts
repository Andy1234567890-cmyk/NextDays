"use server";

// Aufgaben: Server-Actions gegen den FastAPI-tasks-Slice (/api/v1/tasks).
// Für die PM-Buchungsdetailseite: Aufgaben einer Buchung listen, Status
// umschalten, Standard-Aufgaben aus der Buchung erzeugen. Business-Logik bleibt
// im Backend (PROJECT.md §2).
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";
export type InspectionState = "to_review" | "reviewed";
export type TaskSource = "manual" | "auto" | "recurring";
export type RuleKind = "template" | "auto" | "recurring";

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

export type TaskDetail = TaskListItem & { checklist: ChecklistItem[] };

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

export type CalendarRow = {
  property_id: string | null;
  property_title: string;
  tasks: TaskListItem[];
  bookings: CalendarBooking[];
};

export type InspectionItem = TaskListItem & { photos: string[] };

export type RuleItem = {
  id?: string;
  label: string;
  description?: string | null;
  room: string | null;
  requires_photo: boolean;
  sort_order: number;
};

export type RuleListItem = {
  id: string;
  kind: RuleKind;
  name: string;
  active: boolean;
  priority: number;
  assignee_id: string | null;
  assignee_name: string | null;
  needs_inspection: boolean;
  item_count: number;
  property_ids: string[];
  schedule_label: string | null;
  updated_at: string | null;
};

export type RuleDetail = RuleListItem & {
  description: string | null;
  remove_on_cancellation: boolean;
  recurrence: Record<string, unknown>;
  items: RuleItem[];
};

export type RuleInput = {
  kind: RuleKind;
  name: string;
  description?: string | null;
  active: boolean;
  priority: number;
  assignee_id?: string | null;
  needs_inspection: boolean;
  remove_on_cancellation: boolean;
  recurrence: Record<string, unknown>;
  property_ids: string[];
  items: RuleItem[];
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error = exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    return { ok: false, error };
  }
}

/** Aufgabe anlegen (Kalender-Zelle „+"): Tag+Objekt vorbelegt. */
export async function createTask(input: {
  title: string;
  description?: string | null;
  property_id?: string | null;
  assignee_id?: string | null;
  reservation_id?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  due_at?: string | null;
  priority?: number;
  needs_inspection?: boolean;
}): Promise<Result<Task>> {
  return call("/tasks", { method: "POST", body: input });
}

/** Aufgabe löschen (Kalender-Popup). */
export async function deleteTask(taskId: string): Promise<Result<void>> {
  return call(`/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
}

async function uploadPhoto(
  path: string,
  file: File,
): Promise<Result<{ id: string }>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch(`${base}/api/v1${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      cache: "no-store",
    });
    if (!res.ok) {
      let detail = `Fehler ${res.status}`;
      try {
        const data = await res.json();
        if (typeof data?.detail === "string") detail = data.detail;
      } catch {
        // kein JSON-Body
      }
      return { ok: false, error: detail };
    }
    return { ok: true, data: (await res.json()) as { id: string } };
  } catch {
    return { ok: false, error: "Backend nicht erreichbar." };
  }
}

/** Foto-Nachweis zu einem Checklisten-Punkt hochladen (multipart → task-photos). */
export async function uploadChecklistPhoto(
  itemId: string,
  file: File,
): Promise<Result<{ id: string }>> {
  return uploadPhoto(
    `/tasks/checklist/item/${encodeURIComponent(itemId)}/photo`,
    file,
  );
}

/** Foto direkt an einer Aufgabe hochladen (→ Buchungsbild im Bilder-Modul). */
export async function uploadTaskPhoto(
  taskId: string,
  file: File,
): Promise<Result<{ id: string }>> {
  return uploadPhoto(`/tasks/${encodeURIComponent(taskId)}/photo`, file);
}

/** Aufgaben zu einer Buchung (PM-Detailseite). */
export async function listBookingTasks(
  reservationId: string,
): Promise<Result<Task[]>> {
  return call(`/tasks/by-reservation/${encodeURIComponent(reservationId)}`);
}

/** Dem angemeldeten Nutzer zugewiesene Aufgaben. */
export async function listMyTasks(): Promise<Result<Task[]>> {
  return call("/tasks/mine");
}

/** Aufgaben-Status umschalten (offen/in Arbeit/erledigt/abgebrochen). */
export async function setTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<Result<Task>> {
  return call(`/tasks/${encodeURIComponent(taskId)}/status`, {
    method: "PATCH",
    body: { status },
  });
}

/** Standard-Aufgaben aus einer Buchung erzeugen (Anreise-Check + Endreinigung). */
export async function generateBookingTasks(input: {
  reservation_id: string;
  property_id: string;
  check_in: string;
  check_out: string;
}): Promise<Result<Task[]>> {
  return call("/tasks/from-booking", { method: "POST", body: input });
}

// --- PM-Aufgaben-Modul ---

/** Teamaufgaben (alle Aufgaben mit Assignee/Objekt-Namen). */
export async function listTeamTasks(filter?: {
  status_bucket?: string;
  property_id?: string;
  assignee_id?: string;
}): Promise<Result<TaskListItem[]>> {
  const p = new URLSearchParams();
  if (filter?.status_bucket) p.set("status_bucket", filter.status_bucket);
  if (filter?.property_id) p.set("property_id", filter.property_id);
  if (filter?.assignee_id) p.set("assignee_id", filter.assignee_id);
  const q = p.toString();
  return call(`/tasks/team${q ? `?${q}` : ""}`);
}

/** Kalender-Timeline: Aufgaben im Zeitraum, nach Objekt gruppiert. */
export async function getTaskCalendar(
  monthFrom: string,
  monthTo: string,
  assigneeId?: string,
): Promise<Result<{ rows: CalendarRow[] }>> {
  const p = new URLSearchParams({ month_from: monthFrom, month_to: monthTo });
  if (assigneeId) p.set("assignee_id", assigneeId);
  return call(`/tasks/calendar?${p.toString()}`);
}

/** Aufgaben-Detail inkl. Checkliste. */
export async function getTaskDetail(taskId: string): Promise<Result<TaskDetail>> {
  return call(`/tasks/detail/${encodeURIComponent(taskId)}`);
}

/** Aufgabe abschließen (Foto-Pflicht wird serverseitig erzwungen). */
export async function completeTask(taskId: string): Promise<Result<TaskDetail>> {
  return call(`/tasks/${encodeURIComponent(taskId)}/complete`, { method: "POST" });
}

/** Inspektions-Liste (Tab: to_review | reviewed | upcoming). */
export async function listInspection(
  tab: string,
): Promise<Result<InspectionItem[]>> {
  return call(`/tasks/inspection?tab=${encodeURIComponent(tab)}`);
}

/** Inspektions-Entscheidung: freigeben oder zurückweisen. */
export async function inspectTask(
  taskId: string,
  approved: boolean,
  note?: string,
): Promise<Result<TaskDetail>> {
  return call(`/tasks/${encodeURIComponent(taskId)}/inspect`, {
    method: "POST",
    body: { approved, note: note ?? null },
  });
}

// --- Regeln / Vorlagen ---

const RULE_PATH: Record<RuleKind, string> = {
  template: "/tasks/templates",
  auto: "/tasks/auto",
  recurring: "/tasks/recurring",
};

/** Regeln/Vorlagen einer Art auflisten. */
export async function listRules(
  kind: RuleKind,
): Promise<Result<RuleListItem[]>> {
  return call(RULE_PATH[kind]);
}

/** Eine Regel/Vorlage im Detail (inkl. Items + Objekt-Zuordnung). */
export async function getRule(ruleId: string): Promise<Result<RuleDetail>> {
  return call(`/tasks/rules/${encodeURIComponent(ruleId)}`);
}

/** Regel/Vorlage anlegen. */
export async function createRule(input: RuleInput): Promise<Result<RuleDetail>> {
  return call("/tasks/rules", { method: "POST", body: input });
}

/** Regel/Vorlage ändern. */
export async function updateRule(
  ruleId: string,
  input: RuleInput,
): Promise<Result<RuleDetail>> {
  return call(`/tasks/rules/${encodeURIComponent(ruleId)}`, {
    method: "PUT",
    body: input,
  });
}

/** Regel/Vorlage löschen. */
export async function deleteRule(ruleId: string): Promise<Result<void>> {
  return call(`/tasks/rules/${encodeURIComponent(ruleId)}`, { method: "DELETE" });
}
