"use server";

// Schreib-Actions der Betriebs-Verwaltung (0405). Die Berechtigung prüft
// ausschließlich der Server (require_platform_write in FastAPI) — die UI
// blendet die Aktionen für platform_support nur zusätzlich aus.
import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";

export type SperreErgebnis = {
  id: string;
  deactivated_at: string | null;
  deactivation_reason: string | null;
  betroffene_nutzer: number;
  login_gesperrt: number;
};

export type LoeschErgebnis = {
  id: string;
  name: string;
  reservierungen: number;
  objekte: number;
  nutzer: number;
  hinweise: string[];
};

type Ergebnis<T> = { ok: true; data: T } | { ok: false; fehler: string };

/**
 * Einen Betrieb stilllegen: kein Login mehr, keine Objekte auf dem Marktplatz.
 * Der Grund ist Pflicht — der Server weist eine leere Begründung ab.
 */
export async function betriebSperren(
  tenantId: string,
  grund: string,
): Promise<Ergebnis<SperreErgebnis>> {
  try {
    const data = await api<SperreErgebnis>(
      `/platform/tenants/${tenantId}/sperren`,
      { method: "POST", body: { reason: grund } },
    );
    revalidatePath("/betriebe");
    revalidatePath(`/betriebe/${tenantId}`);
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      fehler: exc instanceof ApiError ? exc.message : "Sperren fehlgeschlagen.",
    };
  }
}

/** Die Sperre eines Betriebs aufheben. */
export async function betriebEntsperren(
  tenantId: string,
): Promise<Ergebnis<SperreErgebnis>> {
  try {
    const data = await api<SperreErgebnis>(
      `/platform/tenants/${tenantId}/entsperren`,
      { method: "POST" },
    );
    revalidatePath("/betriebe");
    revalidatePath(`/betriebe/${tenantId}`);
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      fehler:
        exc instanceof ApiError ? exc.message : "Entsperren fehlgeschlagen.",
    };
  }
}

/**
 * Einen Betrieb endgültig löschen. UNUMKEHRBAR.
 *
 * `nameBestaetigung` muss dem Betriebsnamen entsprechen; der Server vergleicht
 * und antwortet sonst mit 422. Das Ergebnis benennt, was NICHT mitgelöscht
 * werden konnte (Stripe-Abo, Portal-Mappings, Bilder) — diese Hinweise gehören
 * angezeigt, nicht verworfen.
 */
export async function betriebLoeschen(
  tenantId: string,
  nameBestaetigung: string,
): Promise<Ergebnis<LoeschErgebnis>> {
  try {
    const data = await api<LoeschErgebnis>(
      `/platform/tenants/${tenantId}/loeschen`,
      { method: "POST", body: { name_bestaetigung: nameBestaetigung } },
    );
    revalidatePath("/betriebe");
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      fehler: exc instanceof ApiError ? exc.message : "Löschen fehlgeschlagen.",
    };
  }
}
