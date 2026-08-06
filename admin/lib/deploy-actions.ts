"use server";

// Schreib-Action des Deploy-Monitors. Ein Deploy rollt LIVE aus — die
// Berechtigung prüft ausschließlich der Server (require_platform_write in
// FastAPI); die UI blendet den Knopf für platform_support nur zusätzlich aus.
import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";

type Ergebnis = { ok: true } | { ok: false; fehler: string };

/** Einen Deploy anstoßen. Coolify antwortet sofort, der Bau läuft weiter. */
export async function deployAusloesen(
  anwendungUuid: string,
): Promise<Ergebnis> {
  try {
    await api(`/platform/deploy/${anwendungUuid}`, { method: "POST" });
    revalidatePath("/deploy");
    return { ok: true };
  } catch (exc) {
    return {
      ok: false,
      fehler:
        exc instanceof ApiError ? exc.message : "Deploy fehlgeschlagen.",
    };
  }
}
