"use server";

// Buchhaltung → DATEV: Server-Actions gegen /api/v1/buchhaltung/datev/*.
// NUR async functions in dieser Datei (Regel „use server"); Typen liegen in
// buchhaltung-datev-typen.ts. Der Download läuft NICHT hier, sondern über den
// Next-Proxy /api/v1/buchhaltung/datev/exports/{id}/download (Binärdatei mit
// Content-Disposition — eine Server-Action gibt keine Datei zurück).
import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import type {
  DatevFehlerDetails,
  DatevSettings,
  DatevSettingsInput,
  ExportAnfrage,
  ExportLauf,
  Vorschau,
} from "@/lib/buchhaltung-datev-typen";
import { currentToken } from "@/lib/session-token";

export type DatevResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; details?: DatevFehlerDetails };

const SEITE = "/buchhaltung/datev";

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PUT"; body?: unknown } = {},
): Promise<DatevResult<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(`/buchhaltung/datev${path}`, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    if (exc instanceof ApiError) {
      // Das Backend liefert bei 422 `{message, fehlende_felder|probleme}` —
      // die Listen kommen strukturiert mit, nicht aus dem Text geraten.
      const details = exc.details as (DatevFehlerDetails & { message?: string }) | undefined;
      return {
        ok: false,
        error: details?.message ?? exc.message,
        status: exc.status,
        details,
      };
    }
    return { ok: false, error: "Aktion fehlgeschlagen." };
  }
}

export async function getDatevSettings(): Promise<DatevResult<DatevSettings>> {
  return call<DatevSettings>("/settings");
}

export async function saveDatevSettings(
  input: DatevSettingsInput,
): Promise<DatevResult<DatevSettings>> {
  const res = await call<DatevSettings>("/settings", { method: "PUT", body: input });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

export async function previewDatevExport(anfrage: ExportAnfrage): Promise<DatevResult<Vorschau>> {
  return call<Vorschau>("/export/vorschau", { method: "POST", body: anfrage });
}

export async function createDatevExport(anfrage: ExportAnfrage): Promise<DatevResult<ExportLauf>> {
  const res = await call<ExportLauf>("/export", { method: "POST", body: anfrage });
  if (res.ok) revalidatePath(SEITE);
  return res;
}

export async function listDatevExports(): Promise<DatevResult<ExportLauf[]>> {
  return call<ExportLauf[]>("/exports?limit=100");
}
