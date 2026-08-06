"use server";

// Schreib-Action des Deploy-Monitors. Ein Deploy rollt LIVE aus — die
// Berechtigung prüft ausschließlich der Server (require_platform_write in
// FastAPI); die UI blendet den Knopf für platform_support nur zusätzlich aus.
import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { DeployLog } from "./backoffice";

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

type LogErgebnis =
  | { ok: true; data: DeployLog }
  | { ok: false; fehler: string };

/** Build-Log nachladen (Server Action, damit der Token im Cookie bleibt). */
export async function logHolen(deploymentUuid: string): Promise<LogErgebnis> {
  try {
    const data = await api<DeployLog>(
      `/platform/deploy/log/${deploymentUuid}`,
      { cache: "no-store" },
    );
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      fehler:
        exc instanceof ApiError ? exc.message : "Log konnte nicht geladen werden.",
    };
  }
}
