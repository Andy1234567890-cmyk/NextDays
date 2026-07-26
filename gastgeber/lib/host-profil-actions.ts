"use server";

// Schreib-Action für das Gastgeber-Profil (Airbnb „Über den Gastgeber"):
// PATCH /host-profile — nur gesetzte Felder werden geändert (PATCH-Semantik).
// full_name/hosting_since_year sind read-only (kommen aus users) und dürfen
// hier NICHT mitgeschickt werden.
import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { HostProfile } from "./host-profil";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

// Editierbare Felder (ohne die abgeleiteten full_name/hosting_since_year).
export type HostProfilePatch = Partial<
  Omit<HostProfile, "full_name" | "hosting_since_year">
>;

/** Einzelne Profilfelder ändern. Gibt das aktualisierte Profil zurück. */
export async function updateHostProfile(
  patch: HostProfilePatch,
): Promise<Result<HostProfile>> {
  try {
    const data = await api<HostProfile>("/host-profile", {
      method: "PATCH",
      body: patch,
    });
    // KEIN revalidatePath: das Profil ist user-gebunden und wird vom Panel aus
    // der Server-Antwort direkt in den State gespiegelt. Ein Layout-weites
    // Revalidate ließ Next die Server-Action-Antwort neu rendern → „An
    // unexpected response was received from the server".
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      error:
        exc instanceof ApiError
          ? exc.message
          : "Profil konnte nicht gespeichert werden.",
    };
  }
}
