"use server";

// Aufgaben: Server-Actions gegen den FastAPI-tasks-Slice (/api/v1/tasks).
// Für die PM-Buchungsdetailseite: Aufgaben einer Buchung listen, Status
// umschalten, Standard-Aufgaben aus der Buchung erzeugen. Business-Logik bleibt
// im Backend (PROJECT.md §2).
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";

export type Task = {
  id: string;
  tenant_id: string;
  property_id: string | null;
  reservation_id: string | null;
  assignee_id: string | null;
  title: string;
  status: TaskStatus;
  due_at: string | null;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
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
