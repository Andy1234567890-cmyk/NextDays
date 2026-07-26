"use server";

// Auf eine Co-Gastgeber-Einladung antworten (Empfänger-Sicht).
import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { CohostAssignment } from "./cohost-einladung";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; fehler: string };

/**
 * Einladung annehmen.
 *
 * Setzt Login voraus, die passende E-Mail-Adresse und eine geprüfte Identität —
 * das erzwingt das Backend und meldet es als klare Fehlermeldung zurück, die
 * hier unverändert durchgereicht wird.
 */
export async function nimmEinladungAn(
  token: string,
): Promise<Ergebnis<CohostAssignment>> {
  try {
    const data = await api<CohostAssignment>(
      `/cohosts/invitation/${token}/accept`,
      { method: "POST" },
    );
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      fehler:
        exc instanceof ApiError ? exc.message : "Annehmen fehlgeschlagen.",
    };
  }
}

/** Einladung ablehnen. Kein Login nötig — der Token genügt. */
export async function lehneEinladungAb(
  token: string,
): Promise<Ergebnis<null>> {
  try {
    await api<null>(`/cohosts/invitation/${token}/decline`, {
      method: "POST",
      public: true,
    });
    return { ok: true, data: null };
  } catch (exc) {
    return {
      ok: false,
      fehler:
        exc instanceof ApiError ? exc.message : "Ablehnen fehlgeschlagen.",
    };
  }
}
