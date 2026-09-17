"use server";

// Schreib-Action Buchungsberechtigungen. Die Meldung des Backends wird
// durchgereicht — dort steht der Grund, den der Gastgeber braucht (Wurzel 5).
import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { Buchungsberechtigung, Buchungsmodus, Zielgruppe } from "./buchungsrechte";

type Ergebnis =
  | { ok: true; stand: Buchungsberechtigung }
  | { ok: false; error: string };

/** Entscheidung setzen — gilt für den Betrieb und alle seine Objekte. */
export async function setzeBuchungsberechtigung(
  modus: Buchungsmodus,
  zielgruppe: Zielgruppe,
  vorabFrage: string | null = null,
): Promise<Ergebnis> {
  try {
    const stand = await api<Buchungsberechtigung>("/booking-access", {
      method: "PUT",
      body: { modus, zielgruppe, vorab_frage: vorabFrage },
    });
    revalidatePath("/konto");
    return { ok: true, stand };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.",
    };
  }
}
