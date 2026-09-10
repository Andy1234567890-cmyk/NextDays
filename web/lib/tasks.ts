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
  /** Zeitzone des Objekts. Der Kalendertag von `start_at`/`due_at` ist in
   *  DIESER Zone definiert, nicht in der des Bedieners — ohne sie stünden die
   *  Aufgaben eines Objekts in einer anderen Zone eine Spalte verschoben.
   *  `null` = keine gepflegte Zone, dann gilt UTC. */
  timezone: string | null;
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

/** Ein Objekt, das von keiner planmäßigen Regel erreicht wird. */
export type UngedecktesObjekt = {
  property_id: string;
  property_title: string;
  ohne_anreise: boolean;
  ohne_abreise: boolean;
};

/**
 * Wie viele Objekte planmäßige Aufgaben bekommen — und welche nicht.
 *
 * Eine Regel gilt für ALLE Objekte, solange ihr keins zugeordnet ist; sobald
 * eines zugeordnet ist, nur noch für die gelisteten. Ein danach angelegtes
 * Objekt fällt still heraus und bekommt nie eine Aufgabe.
 */
export type RegelDeckung = {
  objekte: number;
  ohne_anreise: number;
  ohne_abreise: number;
  betroffen: UngedecktesObjekt[];
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
  | "days_after_check_out"
  // Tages-Anker (0535): nur das DATUM der Reservierung zaehlt, die Uhrzeit
  // kommt aus `start_clock`/`end_clock` der Regel.
  | "arrival_day"
  | "departure_day";

export type RuleSchedule = {
  template_rule_id: string | null;
  start_trigger: TaskTrigger | null;
  end_trigger: TaskTrigger | null;
  start_offset_minutes: number;
  end_offset_minutes: number;
  /** Uhrzeitfenster „HH:MM" der Tages-Anker (0535). Bei jedem anderen Ausloeser
   *  `null` — dort gilt die Uhrzeit der Buchung. */
  start_clock: string | null;
  end_clock: string | null;
  starts_on: string | null;
  ends_on: string | null;
  /** „HH:MM" bzw. „HH:MM:SS" — leer, wenn keine Uhrzeit gesetzt ist. */
  start_time: string | null;
  duration_minutes: number | null;
};

export type RuleDetail = RuleListItem &
  RuleSchedule & {
    description: string | null;
    /** In welcher Sprache Name und Beschreibung verfasst sind (0511). `null` =
     *  unbekannt: die Regel wird dann NICHT uebersetzt, und ihr interner Name
     *  steht auch bei Lesern anderer Sprachen. */
    quellsprache: string | null;
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
  /** Sprache, in der ich Name und Beschreibung eintippe (0511). Ohne sie kann
   *  der Regelname nicht uebersetzt werden — geraten wird er nicht. */
  quellsprache?: string | null;
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
  /** `requestId` ist bei einem 500 die einzige Spur zum Fehler: der Server
   *  sendet nur „internal_error", hinterlegt Typ und Codezeile aber unter
   *  dieser ID (`GET /diagnostics/ursache/<id>`). */
  | { ok: false; error: string; status?: number; requestId?: string };

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
    const requestId = exc instanceof ApiError ? exc.requestId : undefined;
    return { ok: false, error, status, requestId };
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
  /** Datumsfilter „von–bis", siehe `TaskFilter`. */
  von?: string;
  bis?: string;
  /** Beginn des nächsten Tages BEIM NUTZER (ISO mit Zone). Muss vom Browser
   *  kommen: hier läuft Server-Code, dessen lokale Zeit die des Rechenzentrums
   *  ist — nicht die des Betriebs. Ohne den Wert teilt der Server die Reiter
   *  nach seiner Uhr ein, und eine heute später fällige Aufgabe landet unter
   *  „Bevorstehend". */
  tagesende?: string;
}): Promise<Result<TaskListItem[]>> {
  const p = new URLSearchParams();
  if (filter?.status_bucket) p.set("status_bucket", filter.status_bucket);
  for (const id of filter?.property_ids ?? []) p.append("property_id", id);
  if (filter?.von) p.set("von", filter.von);
  if (filter?.bis) p.set("bis", filter.bis);
  if (filter?.tagesende) p.set("tagesende", filter.tagesende);
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
 * Start- und Endzeitpunkt einer bestehenden Aufgabe setzen.
 *
 * Bis zum 31.08.2026 gab es diesen Weg NICHT: Status und Zuständige ließen
 * sich ändern, die Zeiten nicht. Eine Reinigung auf „28.8. von 10 bis 16 Uhr"
 * zu legen war deshalb nirgends möglich — automatisch erzeugte Aufgaben
 * tragen die Tagesgrenze 00:00, weil der Regel-Motor nur mit Tages-Offsets
 * rechnet.
 *
 * Beide Werte sind ISO-Zeitstempel oder `null` (= Zeitpunkt löschen). Ein Ende
 * vor dem Start lehnt der Server mit 422 ab.
 */
export async function setTaskZeitfenster(
  taskId: string,
  startAt: string | null,
  endAt: string | null,
): Promise<Result<TaskDetail>> {
  return call(`/tasks/${encodeURIComponent(taskId)}/zeitfenster`, {
    method: "PATCH",
    body: { start_at: startAt, end_at: endAt },
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
  /** Datumsfilter „von–bis" als ZEITPUNKTE mit Zone (`bis` = Beginn des Tages
   *  NACH dem gewählten Enddatum, exklusiv). Aus dem Browser über
   *  `zeitraumGrenzen`, aus demselben Grund wie `tagesende`: nur der Client
   *  weiß, welcher Tag beim Nutzer läuft. */
  von?: string;
  bis?: string;
  /** Beginn des nächsten Tages BEIM NUTZER (ISO mit Zone) — siehe
   *  `listMyTasks`. Kommt aus dem Browser, nicht von hier. */
  tagesende?: string;
};

function filterParams(filter?: TaskFilter): URLSearchParams {
  const p = new URLSearchParams();
  if (filter?.status_bucket) p.set("status_bucket", filter.status_bucket);
  for (const id of filter?.property_ids ?? []) p.append("property_id", id);
  for (const id of filter?.assignee_ids ?? []) p.append("assignee_id", id);
  for (const id of filter?.rule_ids ?? []) p.append("rule_id", id);
  if (filter?.von) p.set("von", filter.von);
  if (filter?.bis) p.set("bis", filter.bis);
  if (filter?.tagesende) p.set("tagesende", filter.tagesende);
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

/** Woher ein Serverfehler kam — Exception-Typ und Codezeile zur Request-ID.
 *
 *  Der Server sendet bei einem 500 bewusst nur „internal_error" (kein
 *  Stacktrace im Browser), hinterlegt die Ursache aber unter der Request-ID.
 *  Diese Abfrage holt sie fuer die Anzeige in der Oberflaeche.
 *
 *  Die Felder koennen leer sein (anderer Worker, Neustart, zu alt) — dann
 *  bleibt die Request-ID, mit der sich das Server-Log durchsuchen laesst. */
export async function getFehlerUrsache(requestId: string): Promise<
  Result<{
    request_id: string;
    typ: string | null;
    datei: string | null;
    zeile: number | null;
  }>
> {
  return call(`/diagnostics/ursache/${encodeURIComponent(requestId)}`);
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

/** Objekte ohne wirksame planmäßige Regel — dort entsteht nie eine Aufgabe. */
export async function ruleCoverage(): Promise<Result<RegelDeckung>> {
  return call("/tasks/rules/coverage");
}

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

// --- Preise beauftragbarer Dienstleistungen (0531) --------------------------
//
// Der Eigentümer bestellt im Portal eine Leistung; beim Abschluss der Aufgabe
// entsteht daraus ein Posten in SEINER Abrechnung. Ohne gepflegten Preis
// entsteht keiner — die Leistung wäre ausgeführt und unberechnet. Genau das
// war live der Fall (gemeldet 03.09.2026).

export type DienstleistungPreis = {
  id: string;
  service_type_id: string;
  /** null = Regel für alle Objekte; gesetzt = Ausnahme für genau eines. */
  property_id: string | null;
  amount: number;
  currency: string;
  note: string | null;
};

export type DienstleistungTyp = {
  id: string;
  key: string;
  kategorie: string;
  aktiv: boolean;
  tenant_id: string | null;
};

export async function listDienstleistungPreise(): Promise<
  Result<{ preise: DienstleistungPreis[]; typen: DienstleistungTyp[] }>
> {
  return call("/tasks/dienstleistung-preise");
}

export async function setDienstleistungPreis(input: {
  service_type_id: string;
  property_id?: string | null;
  amount: number;
  currency: string;
  note?: string | null;
}): Promise<Result<DienstleistungPreis>> {
  return call("/tasks/dienstleistung-preise", { method: "PUT", body: input });
}

export async function deleteDienstleistungPreis(
  preisId: string,
): Promise<Result<void>> {
  return call(`/tasks/dienstleistung-preise/${encodeURIComponent(preisId)}`, {
    method: "DELETE",
  });
}

// --- Startseiten-Kachel: die Bestände der Teamaufgaben ----------------------

/** Was an Teamaufgaben ANLIEGT. Ist-Stand, kein Verlauf. */
export type TeamaufgabenStand = {
  /** Alles Offene (`open`/`accepted`/`in_progress`) — der Bestand. */
  offen: number;
  /** Davon überfällig. 0, wenn der Server die Tagesgrenzen nicht bekam —
   *  ohne zu wissen, welcher Tag beim Leser läuft, ist das nicht bestimmbar. */
  ueberfaellig: number;
  /** Offene Aufgaben, die heute fällig sind. */
  heute: number;
  /** Offene Aufgaben ohne Zuständige:n — der stille Ausfall: niemand
   *  bekommt eine Benachrichtigung, niemand fühlt sich zuständig. */
  ohne_zustaendige: number;
  /** Wartet auf Abnahme (`inspection_state='to_review'`). */
  zur_abnahme: number;
  /** Früheste Fälligkeit unter den überfälligen; null = nichts überfällig. */
  aeltester_faellig_am: string | null;
};

/**
 * Die Zahlen der Startseiten-Kachel.
 *
 * `tagesbeginn`/`tagesende` sind die Grenzen des laufenden Tages BEIM NUTZER,
 * in dessen eigener Zone. Der Server rechnet sie NICHT selbst: der Kalendertag
 * einer Aufgabe hängt an der Zone des Objekts, und live haben 24 von 43
 * Objekten keine gepflegte Zone — eine dort unterstellte Zone wäre ein
 * erfundener Wert (Wurzel 4). Ohne die Grenzen liefert der Server den reinen
 * Bestand und lässt „überfällig"/„heute" auf 0.
 */
export async function getTeamaufgabenStand(grenzen?: {
  tagesbeginn: string;
  tagesende: string;
}): Promise<Result<TeamaufgabenStand>> {
  const p = grenzen
    ? `?tagesbeginn=${encodeURIComponent(grenzen.tagesbeginn)}&tagesende=${encodeURIComponent(grenzen.tagesende)}`
    : "";
  return call(`/tasks/startseite${p}`);
}
