"use server";

// Steuerung der Diagnose-Freigabe. Nur der Kunde selbst löst das aus — es gibt
// bewusst keinen Weg, über den sich der Support Einsicht verschafft.
import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { DebugSession } from "./diagnose";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; fehler: string };

/** Diagnose für den Support freigeben (zeitlich begrenzt). */
export async function diagnoseFreigeben(
  stunden: number,
  notiz?: string,
): Promise<Ergebnis<DebugSession>> {
  try {
    const data = await api<DebugSession>("/diagnostics/debug", {
      method: "POST",
      body: { stunden, note: notiz || null },
    });
    revalidatePath("/konto");
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      fehler:
        exc instanceof ApiError ? exc.message : "Freigabe fehlgeschlagen.",
    };
  }
}

/** Freigabe sofort widerrufen. */
export async function diagnoseWiderrufen(): Promise<Ergebnis<null>> {
  try {
    await api<void>("/diagnostics/debug", { method: "DELETE" });
    revalidatePath("/konto");
    return { ok: true, data: null };
  } catch (exc) {
    return {
      ok: false,
      fehler:
        exc instanceof ApiError ? exc.message : "Widerruf fehlgeschlagen.",
    };
  }
}
