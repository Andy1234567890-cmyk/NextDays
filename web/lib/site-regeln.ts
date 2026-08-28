"use server";

// Personalisierungs-Regeln der Kunden-Website (0440) — Server-Actions gegen
// /api/v1/site-config/rules.
//
// Eigene Datei aus demselben Grund wie `site-weiterleitungen.ts`: eine Regel
// ist eine eigene Ressource mit Liste, Anlegen, Ändern, Reihenfolge und
// Löschen — nicht ein weiteres Feld am Branding.
//
// Zu `"use server"`: hier dürfen AUSSCHLIESSLICH async functions exportiert
// werden. Typen sind erlaubt (sie verschwinden beim Kompilieren), ein `const`
// oder Objekt bricht den Build erst in „Collecting page data".
import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type RegelStatus = "draft" | "active" | "disabled";
export type AktionsArt = "popup" | "top_bar" | "effect" | "script";

export type EffektName =
  | "schnee" | "feuerwerk" | "blaetter" | "herzen" | "sterne"
  | "fledermaeuse" | "ballons" | "pride" | "kleeblaetter";

/** Die Bedingungen. Ein fehlendes Feld heißt „diese Bedingung stellt sich
 *  nicht" — ein leeres Objekt heißt also „immer". */
export type Ausloeser = {
  geraet?: "desktop" | "mobile";
  zeit?: {
    start_datum?: string | null;
    end_datum?: string | null;
    ganztags?: boolean;
    von?: string | null;
    bis?: string | null;
    zeitzone?: string;
    wiederholung?:
      | "keine" | "taeglich" | "woechentlich" | "monatlich" | "jaehrlich";
  };
  besuche?: { modus: "first" | "min"; anzahl?: number };
  ort?: { land?: string | null; ort?: string | null; radius_km?: number };
  kampagne?: { parameter: Record<string, string>; exakt?: boolean };
};

export type Regel = {
  id: string;
  name: string;
  triggers: Ausloeser;
  action_type: AktionsArt;
  action: Record<string, unknown>;
  seiten: string[];
  einmal_je_besucher: boolean;
  wieder_nach_tagen: number | null;
  status: RegelStatus;
  sort_order: number;
  created_at: string | null;
};

export type RegelEingabe = {
  name: string;
  triggers?: Ausloeser;
  action: Record<string, unknown>;
  seiten?: string[];
  einmal_je_besucher?: boolean;
  wieder_nach_tagen?: number | null;
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error =
      exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

/** Alle Regeln in ihrer Reihenfolge — die Reihenfolge IST der Vorrang. */
export async function listRegeln(): Promise<
  Result<{ items: Regel[]; total: number }>
> {
  return call("/site-config/rules");
}

export async function createRegel(
  eingabe: RegelEingabe,
): Promise<Result<Regel>> {
  const res = await call<Regel>("/site-config/rules", {
    method: "POST",
    body: eingabe,
  });
  if (res.ok) revalidatePath("/website/regeln");
  return res;
}

export async function updateRegel(
  id: string,
  aenderung: Partial<RegelEingabe> & { status?: RegelStatus },
): Promise<Result<Regel>> {
  const res = await call<Regel>(`/site-config/rules/${id}`, {
    method: "PATCH",
    body: aenderung,
  });
  if (res.ok) revalidatePath("/website/regeln");
  return res;
}

export async function deleteRegel(id: string): Promise<Result<null>> {
  const res = await call<null>(`/site-config/rules/${id}`, {
    method: "DELETE",
  });
  if (res.ok) revalidatePath("/website/regeln");
  return res;
}

/** Die Reihenfolge setzen. VOLLSTÄNDIG, von oben nach unten.
 *
 *  Nicht als einzelne Verschiebung: eine Teilangabe hinterlässt doppelte Ränge,
 *  und der Rang entscheidet, welche von zwei Regeln derselben Art auf derselben
 *  Seite gewinnt. */
export async function ordneRegeln(
  ids: string[],
): Promise<Result<{ items: Regel[]; total: number }>> {
  const res = await call<{ items: Regel[]; total: number }>(
    "/site-config/rules/reorder",
    { method: "POST", body: { ids } },
  );
  if (res.ok) revalidatePath("/website/regeln");
  return res;
}
