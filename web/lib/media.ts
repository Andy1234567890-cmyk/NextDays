"use server";

// Bilder-Modul: Server-Actions gegen den FastAPI-media-Slice (/api/v1/media).
// Aggregiert Buchungs-/Aufgabenfotos + Objektfotos zu einer Liste. Business-
// Logik bleibt im Backend.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type MediaKind = "booking" | "property";

export type MediaItem = {
  id: string;
  kind: MediaKind;
  url: string;
  property_id: string | null;
  property_title: string | null;
  reservation_id: string | null;
  task_title: string | null;
  author: string | null;
  uploaded_at: string | null;
  check_in: string | null;
  check_out: string | null;
};

type Result<T> =
  | { ok: true; data: T }
  /** Kennung der Fehlerantwort. Bei einem 500 sendet der Server nur
   *  „internal_error"; unter dieser ID liegen Exception-Typ und Codezeile
   *  (`GET /diagnostics/ursache/<id>`). Ohne sie waere der Fehler in der
   *  Oberflaeche nicht auffindbar. */
  | { ok: false; error: string; requestId?: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "DELETE" } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error = exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const requestId = exc instanceof ApiError ? exc.requestId : undefined;
    return { ok: false, error, requestId };
  }
}

/** Bilder-Karten (Buchungs- + Objektfotos), optional gefiltert. */
export async function listMedia(filter?: {
  booking?: boolean;
  property?: boolean;
  propertyId?: string;
}): Promise<Result<{ items: MediaItem[] }>> {
  const p = new URLSearchParams();
  if (filter?.booking === false) p.set("booking", "false");
  if (filter?.property === false) p.set("property_", "false");
  if (filter?.propertyId) p.set("property_id", filter.propertyId);
  const q = p.toString();
  return call(`/media${q ? `?${q}` : ""}`);
}

/** Ein Bild löschen (kind = booking | property). */
export async function deleteMedia(
  kind: MediaKind,
  id: string,
): Promise<Result<void>> {
  return call(`/media/${kind}/${encodeURIComponent(id)}`, { method: "DELETE" });
}
