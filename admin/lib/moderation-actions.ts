"use server";

// Schreib-Actions der Objekt-Freigabe. Die Berechtigung prüft ausschließlich der
// Server (require_platform_write in FastAPI) — die UI blendet die Aktionen für
// platform_support nur zusätzlich aus.
import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { ModerationProperty } from "./backoffice";

type Ergebnis =
  | { ok: true; data: ModerationProperty }
  | { ok: false; fehler: string };

/** Ein Objekt für den Marktplatz freigeben. */
export async function freigeben(
  propertyId: string,
  notiz?: string,
): Promise<Ergebnis> {
  try {
    const data = await api<ModerationProperty>(
      `/platform/moderation/${propertyId}/approve`,
      { method: "POST", body: { note: notiz ?? null } },
    );
    revalidatePath("/freigaben");
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      fehler:
        exc instanceof ApiError ? exc.message : "Freigabe fehlgeschlagen.",
    };
  }
}

/** Ein Objekt ablehnen. Die Begründung ist Pflicht (der Server erzwingt sie). */
export async function ablehnen(
  propertyId: string,
  notiz: string,
): Promise<Ergebnis> {
  try {
    const data = await api<ModerationProperty>(
      `/platform/moderation/${propertyId}/reject`,
      { method: "POST", body: { note: notiz } },
    );
    revalidatePath("/freigaben");
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      fehler:
        exc instanceof ApiError ? exc.message : "Ablehnung fehlgeschlagen.",
    };
  }
}
