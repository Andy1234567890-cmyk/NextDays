"use server";

// Schreib-Actions der Reichweiten-Etappe (0521): Beiträge anlegen/ändern/
// löschen, Konto verbinden/trennen. Alle auf die eigene affiliate_id gescopet.
// Ein "use server"-Modul exportiert AUSSCHLIESSLICH async functions.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { Beitrag, Provider } from "./reichweite";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; fehler: string; status?: number };

async function call<T>(
  pfad: string,
  opts: { method: "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown },
): Promise<Ergebnis<T>> {
  try {
    return { ok: true, data: await api<T>(pfad, opts) };
  } catch (exc) {
    if (exc instanceof ApiError) return { ok: false, fehler: exc.message, status: exc.status };
    return { ok: false, fehler: "service_unavailable", status: 503 };
  }
}

export async function beitragAnlegen(
  codeId: string,
  daten: { title: string; platform: string; url: string | null; published_at: string | null; utm_content: string | null },
): Promise<Ergebnis<Beitrag>> {
  const res = await call<Beitrag>(`/affiliates/codes/${codeId}/beitraege`, { method: "POST", body: daten });
  revalidatePath("/beitraege");
  return res;
}

export async function beitragAendern(
  postId: string,
  daten: { title?: string; url?: string | null; published_at?: string | null },
): Promise<Ergebnis<Beitrag>> {
  const res = await call<Beitrag>(`/affiliates/posts/${postId}`, { method: "PATCH", body: daten });
  revalidatePath("/beitraege");
  return res;
}

export async function beitragLoeschen(postId: string): Promise<Ergebnis<null>> {
  const res = await call<null>(`/affiliates/posts/${postId}`, { method: "DELETE" });
  revalidatePath("/beitraege");
  return res;
}

/** Konto verbinden: Autorisierungs-URL vom Server holen (signierter state) und
 *  den Browser dorthin schicken. Fehlt die Konfiguration, bleibt der Partner auf
 *  dem Profil und sieht den Grund. */
export async function kontoVerbinden(provider: Provider): Promise<Ergebnis<null>> {
  let url: string;
  try {
    ({ url } = await api<{ provider: string; url: string }>(`/affiliates/channels/${provider}/authorize`));
  } catch (exc) {
    if (exc instanceof ApiError) return { ok: false, fehler: exc.message, status: exc.status };
    return { ok: false, fehler: "service_unavailable", status: 503 };
  }
  redirect(url);
}

export async function kontoTrennen(connectionId: string): Promise<Ergebnis<null>> {
  const res = await call<null>(`/affiliates/channels/${connectionId}`, { method: "DELETE" });
  revalidatePath("/profil");
  revalidatePath("/beitraege");
  return res;
}
