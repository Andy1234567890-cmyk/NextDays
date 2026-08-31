// Aufgaben — gegen den FastAPI-tasks-Slice (/api/v1/tasks), gespiegelt aus
// apps/web/lib/tasks.ts. Zwei Sichten je nach Berechtigung:
//   VIEW_OWN_TASKS (staff/cleaner) → /tasks/mine, /tasks/detail, /complete,
//                                    PATCH /checklist/item
//   MANAGE_TASKS   (admin/co_admin) → /tasks/team, /tasks/calendar,
//                                    PATCH /status
// TaskListItem/TaskDetail tragen bewusst KEINE Gast-PII/Beträge (§4.3) — der
// cleaner sieht nur Objekt + Zeitfenster. Nichts auffüllen.
import { call, type Result } from "@/lib/api";

// `accepted` (0360, Hostaway-Gleichzug) sitzt zwischen „liegt da" und „ich bin
// dran": jemand hat die Aufgabe ANGENOMMEN, aber noch nicht angefangen. Der
// Wert fehlte hier — eine angenommene Aufgabe hatte in der App gar keine
// Beschriftung und keinen nächsten Schritt.
export type TaskStatus =
  | "open"
  | "accepted"
  | "in_progress"
  | "done"
  | "cancelled";
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
  // Anzeige-Referenz der Buchung (Portal-Referenz, sonst Kurz-ID). KEIN
  // Gastname, kein Betrag — die Zeile sieht auch die Reinigungskraft (§4.3).
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
  // Storage-Pfade der Nachweise (die Wahrheit) …
  photos: string[];
  // … und dieselben Bilder als kurzlebig signierte URLs — nur die kann die App
  // anzeigen. Ohne sie sah die ausführende Person ihren eigenen Nachweis nie,
  // sondern nur einen Zähler. Optional, weil eine noch nicht ausgerollte API
  // das Feld nicht mitschickt (die Oberfläche darf daran nicht brechen).
  photo_urls?: string[];
  // Wer den Punkt abgehakt hat und wann. Der Server liefert beides mit; ohne
  // diese Felder sah im Team nicht nachvollziehbar aus, wer was erledigt hat.
  // Die Nutzer-ID (`done_by`) bleibt bewusst draußen — die Anzeige braucht sie
  // nicht (§4.3, kein Recon-Material).
  done_at: string | null;
  done_by_name: string | null;
};

export type TaskCost = {
  id: string;
  task_id: string;
  amount: string;
  currency: string;
  note: string | null;
  created_by_name: string | null;
  created_at: string | null;
};

export type TaskResolution = {
  task_id: string;
  note: string | null;
  score: number | null;
  created_by_name: string | null;
  updated_at: string | null;
};

export type TaskDetail = TaskListItem & {
  checklist: ChecklistItem[];
  // An- und Abreisetag der Buchung, an der die Aufgabe hängt (nur Kalendertage,
  // §4.3). „Der Gast reist am 22. ab" ist die eigentliche Arbeitsangabe.
  reservation_check_in: string | null;
  reservation_check_out: string | null;
  costs: TaskCost[];
  // Währung einer NEUEN Auslage (Objekt-, sonst Betriebswährung). `null` heißt
  // „für dieses Objekt ist keine hinterlegt" → das Kostenfeld bleibt weg,
  // statt ein Feld anzubieten, dessen Speichern mit 422 endet (Wurzel 4).
  cost_currency: string | null;
  resolution: TaskResolution | null;
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

/**
 * Beginn des NÄCHSTEN Tages beim Nutzer, als ISO-Zeitstempel MIT Zone.
 *
 * Der Server kann das nicht selbst bestimmen: die Zeitzone hängt am Objekt
 * (`properties.timezone`), und eine Liste über mehrere Objekte hat keine
 * einzige richtige. Das Gerät weiß dagegen sicher, welcher Tag hier läuft —
 * deshalb liefert der Client die Grenze und der Server rechnet nur damit.
 *
 * Ohne diese Angabe verglich der Server gegen seine Uhr, und eine heute um
 * 16:00 fällige Aufgabe lag morgens unter „Bevorstehend" statt „Aktuell".
 */
function tagesende(): string {
  const d = new Date();
  d.setHours(24, 0, 0, 0); // Mitternacht des kommenden Tages, lokale Zeit
  return d.toISOString();
}

/** Filter → Query. Mehrfachauswahl wirkt: jeder Wert wird angehängt. */
function filterParams(filter?: TaskFilter): URLSearchParams {
  const p = new URLSearchParams();
  if (filter?.status_bucket) p.set("status_bucket", filter.status_bucket);
  for (const id of filter?.property_ids ?? []) p.append("property_id", id);
  for (const id of filter?.assignee_ids ?? []) p.append("assignee_id", id);
  for (const id of filter?.rule_ids ?? []) p.append("rule_id", id);
  // Immer mitsenden: die Reiter-Einteilung ist ohne Tagesgrenze schief, und
  // eine ältere Server-Fassung ignoriert einen unbekannten Parameter.
  p.set("tagesende", tagesende());
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

/**
 * Auslage zu einer Aufgabe erfassen. KEINE Währung im Aufruf — die kommt
 * serverseitig aus dem Objekt (sonst dem Betrieb). Fehlt sie dort, antwortet
 * der Server mit 422 statt einen Euro zu erfinden (Wurzel 4).
 */
export async function addTaskCost(
  taskId: string,
  amount: string,
  note: string | null,
): Promise<Result<TaskDetail>> {
  return call(`/tasks/${encodeURIComponent(taskId)}/costs`, {
    method: "POST",
    body: { amount, note },
  });
}

/** Auslage zurücknehmen (staff/cleaner nur die eigenen — der Server filtert). */
export async function deleteTaskCost(costId: string): Promise<Result<TaskDetail>> {
  return call(`/tasks/costs/${encodeURIComponent(costId)}`, { method: "DELETE" });
}

/**
 * Aufgabe löschen — nur mit `manage_tasks` (der Server setzt das durch, 403).
 *
 * Die Route gab es im Backend längst (`DELETE /tasks/{task_id}`) und das Web
 * ruft sie an zwei Stellen auf; in der App war sie nie verdrahtet, weshalb eine
 * von Hand angelegte Aufgabe dort nicht mehr wegzubekommen war (gemeldet
 * 31.08.2026: „Aufgaben kann ich nicht löschen").
 *
 * Serverseitig prüft `delete_task` denselben Objekt-Scope wie der Listen-Pfad
 * (Wurzel 9) — eine Aufgabe an einem fremden Objekt ergibt 404, nicht 204.
 * Löschen ist ENDGÜLTIG (kein `deleted_at`), deshalb fragt die Oberfläche
 * vorher nach; wer eine Aufgabe nur vom Tisch haben will, setzt sie auf
 * `cancelled` und behält damit die Spur.
 */
export async function deleteTask(taskId: string): Promise<Result<void>> {
  return call(`/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
}

/**
 * Abschluss-Rückmeldung setzen (genau eine je Aufgabe).
 *
 * Den TEXT darf jede zuständige Person schreiben, die BEWERTUNG nur die
 * Konto-Führung (`manage_tasks`) — ein Score ohne dieses Recht ergibt 403.
 * Deshalb wird `score` nur mitgesendet, wenn er gesetzt ist.
 */
export async function setTaskResolution(
  taskId: string,
  note: string | null,
  score?: number | null,
): Promise<Result<TaskDetail>> {
  const body: Record<string, unknown> = { note };
  if (score != null) body.score = score;
  return call(`/tasks/${encodeURIComponent(taskId)}/resolution`, {
    method: "PUT",
    body,
  });
}

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
 * Offene Vertretungsanfragen, die ich übernehmen könnte.
 *
 * Eigene Anfragen fallen serverseitig raus (man vertritt sich nicht selbst),
 * ebenso Aufgaben an Objekten ohne Freigabe (Wurzel 9). Ohne diese Liste war
 * die Vertretung unerreichbar: eine Anfrage ging raus und niemand erfuhr davon
 * — es gibt dafür weder eine Web-Oberfläche noch eine Benachrichtigung.
 */
export async function listSubstitutions(): Promise<Result<Vertretung[]>> {
  return call("/tasks/substitution");
}

/** Eine Vertretung übernehmen — die Aufgabe wird damit mir zugewiesen. */
export async function acceptSubstitution(
  id: string,
): Promise<Result<{ id: string; status: string }>> {
  return call(`/tasks/substitution/${encodeURIComponent(id)}/accept`, {
    method: "POST",
  });
}

/** Eine Vertretung ablehnen (sie bleibt für andere sichtbar bzw. wird zu). */
export async function declineSubstitution(
  id: string,
): Promise<Result<{ id: string; status: string }>> {
  return call(`/tasks/substitution/${encodeURIComponent(id)}/decline`, {
    method: "POST",
  });
}

/**
 * Vertretung für eine Aufgabe anfragen (`request_substitute`).
 *
 * Der Weg der ausführenden Person aus einer Aufgabe: sie kann sie nicht
 * umhängen (das ist Verteilung), aber abgeben. Ein Kollege nimmt die Anfrage
 * an — im Web oder hier.
 */
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

/**
 * Ein aufgenommenes oder gewähltes Bild als Multipart-Feld `file`.
 *
 * React Native schickt Dateien als `{uri, name, type}` — kein `Blob`, kein
 * `File`. Der Typ MUSS mitkommen: der Server prüft ihn gegen die echten
 * Anfangsbytes (Wurzel 8) und lehnt alles ab, was kein JPEG/PNG/WebP ist.
 */
export type Bilddatei = { uri: string; name: string; type: string };

function bildFormular(bild: Bilddatei): FormData {
  const form = new FormData();
  // Der Cast ist nötig, weil die DOM-Typen für `append` nur Blob/string kennen;
  // die React-Native-Laufzeit erwartet genau dieses Objekt.
  form.append("file", bild as unknown as Blob);
  return form;
}

/** Foto-Nachweis zu einem Checklisten-Punkt hochladen (privater Bucket). */
export async function uploadChecklistPhoto(
  itemId: string,
  bild: Bilddatei,
): Promise<Result<{ id: string }>> {
  return call(`/tasks/checklist/item/${encodeURIComponent(itemId)}/photo`, {
    method: "POST",
    body: bildFormular(bild),
  });
}

/**
 * Foto direkt an der Aufgabe — auch ohne Checkliste möglich.
 *
 * Der Server legt dafür bei Bedarf EIN Sammel-Item „Fotos" an und hängt das
 * Bild dort ein (idempotent, Wurzel 2); es erscheint anschließend als
 * Buchungsbild im Bilder-Modul.
 */
export async function uploadTaskPhoto(
  taskId: string,
  bild: Bilddatei,
): Promise<Result<{ id: string }>> {
  return call(`/tasks/${encodeURIComponent(taskId)}/photo`, {
    method: "POST",
    body: bildFormular(bild),
  });
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

/**
 * Arbeitszustand setzen: annehmen, anfangen, zurücklegen, abschließen.
 *
 * Seit 0360 reicht dafür `VIEW_OWN_TASKS` — den Zustand der eigenen Arbeit
 * meldet die Person, die sie tut. Die App hat das lange nur Verwaltern
 * angeboten; eine Reinigungskraft konnte „ich bin dran" nicht sagen. Fremde
 * Aufgaben sind serverseitig ein 404 (Wurzel 9), der Scope bleibt also dort.
 *
 * Antwort ist das ganze Detail (nicht nur die Zeile) — Status, Zeitpunkte und
 * Inspektionsfolge kommen in einem Zug zurück.
 */
export async function setTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<Result<TaskDetail>> {
  return call(`/tasks/${encodeURIComponent(taskId)}/status`, {
    method: "PATCH",
    body: { status },
  });
}
