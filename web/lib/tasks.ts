"use server";

// Aufgaben: Server-Actions gegen den FastAPI-tasks-Slice (/api/v1/tasks).
// Für die PM-Buchungsdetailseite: Aufgaben einer Buchung listen, Status
// umschalten, Standard-Aufgaben aus der Buchung erzeugen. Business-Logik bleibt
// im Backend (PROJECT.md §2).
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

// `accepted` (0360, Hostaway-Gleichzug) sitzt zwischen „liegt da" und „ich bin
// dran": jemand hat die Aufgabe ANGENOMMEN, aber noch nicht angefangen.
export type TaskStatus =
  | "open"
  | "accepted"
  | "in_progress"
  | "done"
  | "cancelled";
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
  /** Anzeige-Referenz der Buchung (Portal-Referenz, sonst Kurz-ID). */
  reservation_ref: string | null;
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
  /** Spur hinter dem Haken (0360): wann und von wem. Altbestand trägt beides
   *  `null` — vor 0360 gab es keinen Weg zum Abhaken. */
  done_at: string | null;
  done_by: string | null;
  done_by_name: string | null;
};

/** Eine Auslage zu einer Aufgabe. Die Reinigungskraft sieht NUR ihre eigenen
 *  (§4.3) — der Server filtert, nicht die Oberfläche. */
export type TaskCost = {
  id: string;
  task_id: string;
  /** Als String vom Server (Dezimal), damit unterwegs nichts gerundet wird. */
  amount: string;
  currency: string;
  note: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string | null;
};

/** Abschluss-Rückmeldung: genau eine je Aufgabe. Die Note vergibt nur die
 *  Konto-Führung — eine Selbstbenotung sagt über die Leistung nichts. */
export type TaskResolution = {
  task_id: string;
  note: string | null;
  score: number | null;
  created_by: string | null;
  created_by_name: string | null;
  updated_at: string | null;
};

export type TaskDetail = TaskListItem & {
  checklist: ChecklistItem[];
  costs: TaskCost[];
  /** Währung, in der eine NEUE Auslage gebucht würde (Objekt-, sonst
   *  Betriebswährung). `null` heißt „keine hinterlegt" — dann bietet die
   *  Oberfläche das Kostenfeld gar nicht erst an, statt ein Feld zu zeigen,
   *  dessen Speichern mit 422 endet (Wurzel 4). */
  cost_currency: string | null;
  resolution: TaskResolution | null;
};

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

/**
 * Zeitanker einer planmäßigen Regel relativ zur Buchung (0272). Die
 * Feinjustierung steckt immer in `start_offset_minutes`/`end_offset_minutes` —
 * bei `days_before_check_in` trägt sie die ganze Distanz.
 */
export type TaskTrigger =
  | "booking_confirmed"
  | "check_in"
  | "after_check_in_24h"
  | "check_out"
  | "days_before_check_in"
  | "days_after_check_out";

export type RuleSchedule = {
  template_rule_id: string | null;
  start_trigger: TaskTrigger | null;
  end_trigger: TaskTrigger | null;
  start_offset_minutes: number;
  end_offset_minutes: number;
  starts_on: string | null;
  ends_on: string | null;
  /** „HH:MM" bzw. „HH:MM:SS" — leer, wenn keine Uhrzeit gesetzt ist. */
  start_time: string | null;
  duration_minutes: number | null;
};

export type RuleDetail = RuleListItem &
  RuleSchedule & {
    description: string | null;
    remove_on_cancellation: boolean;
    recurrence: Record<string, unknown>;
    items: RuleItem[];
    /** Anzeigename der verknüpften Vorlage (leer, wenn sie gelöscht wurde). */
    template_name: string | null;
  };

export type RuleInput = RuleSchedule & {
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

// `status` trägt den HTTP-Status des Fehlers durch. Gebraucht wird er, um „gibt
// es nicht (mehr)" (404) von „ging gerade schief" zu unterscheiden: die
// Deep-Link-Seite /aufgaben/<id> zeigt beim 404 die eigene Nicht-gefunden-Seite
// statt einer roten Meldung über einer leeren Fläche.
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

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
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
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

/** Dem angemeldeten Nutzer zugewiesene Aufgaben (Reiter + Objektfilter). */
export async function listMyTasks(filter?: {
  status_bucket?: string;
  property_ids?: string[];
}): Promise<Result<TaskListItem[]>> {
  const p = new URLSearchParams();
  if (filter?.status_bucket) p.set("status_bucket", filter.status_bucket);
  for (const id of filter?.property_ids ?? []) p.append("property_id", id);
  const q = p.toString();
  return call(`/tasks/mine${q ? `?${q}` : ""}`);
}

/** Aufgaben-Status umschalten (offen/in Arbeit/erledigt/abgebrochen). */
export async function setTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<Result<TaskDetail>> {
  return call(`/tasks/${encodeURIComponent(taskId)}/status`, {
    method: "PATCH",
    body: { status },
  });
}

/**
 * Zuständigen einer bestehenden Aufgabe setzen, wechseln oder abziehen.
 *
 * `null` nimmt die Zuweisung zurück — ein gültiger Zielzustand, kein
 * fehlender Wert. Der Server prüft dabei, ob der Empfänger die Aufgabe
 * überhaupt sehen könnte (Objekt-Freigabe); eine Zuweisung ins Nichts
 * scheitert mit 422 statt still durchzugehen.
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

/**
 * Einen Checklisten-Punkt abhaken oder das Häkchen zurücknehmen (0360).
 *
 * Bewusst mit explizitem `done` statt eines Umschalters: zwei Geräte, die
 * denselben Punkt gleichzeitig antippen, würden sich sonst gegenseitig
 * zurücksetzen. So gewinnt der zuletzt gesendete ZUSTAND.
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

/**
 * Auslage zu einer Aufgabe erfassen. KEINE Währung im Aufruf — die kommt
 * serverseitig aus dem Objekt (sonst dem Betrieb). Fehlt sie dort, antwortet
 * der Server mit 422 statt ein Euro zu erfinden.
 */
export async function addTaskCost(
  taskId: string,
  input: { amount: string; note?: string | null },
): Promise<Result<TaskDetail>> {
  return call(`/tasks/${encodeURIComponent(taskId)}/costs`, {
    method: "POST",
    body: input,
  });
}

/** Auslage zurücknehmen (eigene immer, fremde nur mit Aufgaben-Verwaltung). */
export async function deleteTaskCost(
  costId: string,
): Promise<Result<TaskDetail>> {
  return call(`/tasks/costs/${encodeURIComponent(costId)}`, {
    method: "DELETE",
  });
}

/**
 * Abschluss-Rückmeldung setzen (genau eine je Aufgabe). Der Text darf die
 * zuständige Person schreiben, die BEWERTUNG nur die Konto-Führung — ein Score
 * ohne diese Berechtigung ergibt 403.
 */
export async function setTaskResolution(
  taskId: string,
  input: { note?: string | null; score?: number | null },
): Promise<Result<TaskDetail>> {
  return call(`/tasks/${encodeURIComponent(taskId)}/resolution`, {
    method: "PUT",
    body: input,
  });
}

/**
 * Planmäßige Regeln für eine Buchung nachziehen. Der Normalfall läuft
 * automatisch im Reservierungs-Schreibpfad; das hier ist der Nachzügler-Knopf
 * für Buchungen, die es vor der Regel schon gab.
 */
export async function syncReservationTasks(
  reservationId: string,
): Promise<Result<{ touched: number }>> {
  return call(`/tasks/sync-reservation/${encodeURIComponent(reservationId)}`, {
    method: "POST",
  });
}

// --- PM-Aufgaben-Modul ---
// Konstanten liegen in `lib/aufgaben-konstanten.ts`: aus einer "use server"-
// Datei dürfen nur async-Funktionen exportiert werden.

export type TaskFilter = {
  status_bucket?: string;
  property_ids?: string[];
  assignee_ids?: string[];
  rule_ids?: string[];
};

function filterParams(filter?: TaskFilter): URLSearchParams {
  const p = new URLSearchParams();
  if (filter?.status_bucket) p.set("status_bucket", filter.status_bucket);
  for (const id of filter?.property_ids ?? []) p.append("property_id", id);
  for (const id of filter?.assignee_ids ?? []) p.append("assignee_id", id);
  for (const id of filter?.rule_ids ?? []) p.append("rule_id", id);
  return p;
}

/** Teamaufgaben (alle Aufgaben mit Assignee/Objekt-Namen). */
export async function listTeamTasks(
  filter?: TaskFilter,
): Promise<Result<TaskListItem[]>> {
  const q = filterParams(filter).toString();
  return call(`/tasks/team${q ? `?${q}` : ""}`);
}

/** Auswahl abschließen (Foto-Pflicht/Scope gelten je Aufgabe). */
export async function bulkCompleteTasks(
  ids: string[],
): Promise<Result<{ completed: number; skipped: number }>> {
  return call("/tasks/bulk/complete", { method: "POST", body: { ids } });
}

/**
 * Wer kann Zuständige:r einer Aufgabe sein?
 *
 * Bewusst NICHT `listTenantUsers()` aus `lib/account`: die Liste ist für die
 * Hauptkontakt-Auswahl gedacht und enthält alle Nutzer des Betriebs. Ein
 * Eigentümer hat `view_own_tasks` aber nicht — eine ihm zugewiesene Aufgabe
 * könnte er nie öffnen. Der Server leitet die Menge aus der Capability ab,
 * nicht aus einer hier abgeschriebenen Rollenliste.
 */
export type TaskAssigneeOption = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
};

export async function listTaskAssignees(
  propertyId?: string | null,
): Promise<Result<TaskAssigneeOption[]>> {
  // Mit Objekt: der Server blendet zusätzlich aus, wer für dieses Objekt
  // keine Freigabe hat. Ohne Objekt (Filterleisten, Regel-Editor) bleibt es
  // bei „wer kann grundsätzlich Aufgaben übernehmen".
  const q = propertyId
    ? `?property_id=${encodeURIComponent(propertyId)}`
    : "";
  return call(`/tasks/assignees${q}`);
}

/** Auswahl einem Mitarbeiter zuweisen (`null` zieht die Zuweisung ab). */
export async function bulkAssignTasks(
  ids: string[],
  assigneeId: string | null,
): Promise<Result<{ assigned: number; skipped: number }>> {
  return call("/tasks/bulk/assign", {
    method: "POST",
    body: { ids, assignee_id: assigneeId },
  });
}

/** Auswahl löschen. */
export async function bulkDeleteTasks(
  ids: string[],
): Promise<Result<{ deleted: number; skipped: number }>> {
  return call("/tasks/bulk/delete", { method: "POST", body: { ids } });
}

/** Kalender-Timeline: Aufgaben im Zeitraum, nach Objekt gruppiert. */
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

// --- Vertretung (0415) -----------------------------------------------------
// Die vier Endpunkte gibt es seit 0019, eine Oberfläche dafür nie: eine Anfrage
// landete in `task_substitutions` und blieb dort liegen. Wer ausfiel, fragte
// ins Leere — die Aufgabe blieb bei ihm, während er annahm, jemand übernehme.

/** Eine offene Vertretungsanfrage, die ich übernehmen könnte. */
export type Vertretung = {
  id: string;
  task_id: string;
  requested_by: string;
  requested_by_name: string | null;
  accepted_by: string | null;
  status: "requested" | "accepted" | "declined";
  note: string | null;
  title: string;
  property_title: string | null;
  property_id: string | null;
  start_at: string | null;
  end_at: string | null;
};

/**
 * Offene Anfragen, die ich übernehmen könnte.
 *
 * Eigene Anfragen fallen serverseitig raus (man vertritt sich nicht selbst),
 * ebenso Aufgaben an Objekten ohne Freigabe (Wurzel 9).
 */
export async function listSubstitutions(): Promise<Result<Vertretung[]>> {
  return call("/tasks/substitution");
}

/** Vertretung übernehmen — die Aufgabe wechselt dabei wirklich den Zuständigen. */
export async function acceptSubstitution(
  id: string,
): Promise<Result<{ id: string; status: string }>> {
  return call(`/tasks/substitution/${encodeURIComponent(id)}/accept`, {
    method: "POST",
  });
}

/** Vertretung ablehnen. Die Aufgabe bleibt, wo sie ist. */
export async function declineSubstitution(
  id: string,
): Promise<Result<{ id: string; status: string }>> {
  return call(`/tasks/substitution/${encodeURIComponent(id)}/decline`, {
    method: "POST",
  });
}

/** Vertretung für eine Aufgabe anfragen (nur der Zuständige, §4.3). */
export async function requestSubstitution(
  taskId: string,
  note: string | null,
): Promise<Result<{ id: string; status: string }>> {
  return call("/tasks/substitution", {
    method: "POST",
    body: { task_id: taskId, note },
  });
}

/** Aufgaben-Detail inkl. Checkliste. */
export async function getTaskDetail(taskId: string): Promise<Result<TaskDetail>> {
  return call(`/tasks/detail/${encodeURIComponent(taskId)}`);
}

/** Aufgabe abschließen (Foto-Pflicht wird serverseitig erzwungen). */
export async function completeTask(taskId: string): Promise<Result<TaskDetail>> {
  return call(`/tasks/${encodeURIComponent(taskId)}/complete`, { method: "POST" });
}

/**
 * Inspektions-Liste (Tab: to_review | reviewed | upcoming). `photos` enthält
 * SIGNIERTE URLs aus dem privaten Bucket — direkt in ein `<img>` einsetzbar.
 */
export async function listInspection(
  tab: string,
  propertyIds?: string[],
): Promise<Result<InspectionItem[]>> {
  const p = new URLSearchParams({ tab });
  for (const id of propertyIds ?? []) p.append("property_id", id);
  return call(`/tasks/inspection?${p.toString()}`);
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
