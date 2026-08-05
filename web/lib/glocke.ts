"use server";

// Die Glocke: In-App-Benachrichtigungen gegen den notification_settings-Slice
// (/api/v1/notification-settings/glocke). Scope kommt im Backend aus dem Token
// (eigene user_id + Mandant) — hier wird nie eine Nutzer-ID mitgegeben.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type GlockeEintrag = {
  id: string;
  /** Katalog-Schlüssel (z. B. `listing_activity`) — bestimmt das Icon. */
  kategorie: string;
  titel: string;
  text: string | null;
  /** Relativer Pfad; nie mit Domäne davor (Wechsel .com → .dk). */
  ziel_pfad: string | null;
  property_id: string | null;
  gelesen_am: string | null;
  created_at: string;
};

export type GlockeListe = {
  eintraege: GlockeEintrag[];
  ungelesen: number;
};

type Ergebnis<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  pfad: string,
  method: "GET" | "POST" = "GET",
): Promise<Ergebnis<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    return {
      ok: true,
      data: await api<T>(`/notification-settings${pfad}`, { token, method }),
    };
  } catch (e) {
    // Ein Ladefehler darf nicht als „keine Meldungen" erscheinen: „leer" und
    // „konnte nicht laden" sind zwei verschiedene Aussagen (Wurzel 4).
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Backend nicht erreichbar.",
    };
  }
}

/** Die eigenen Meldungen samt Zähler. */
export async function listGlocke(limit = 30): Promise<Ergebnis<GlockeListe>> {
  return call<GlockeListe>(`/glocke?limit=${limit}`);
}

/** Eine Meldung quittieren. Idempotent — auch fremde IDs sind kein Fehler. */
export async function glockeGelesen(id: string): Promise<Ergebnis<null>> {
  return call<null>(`/glocke/${id}/gelesen`, "POST");
}

/** Alle eigenen Meldungen quittieren. */
export async function glockeAlleGelesen(): Promise<
  Ergebnis<{ gelesen: number }>
> {
  return call<{ gelesen: number }>("/glocke/alle-gelesen", "POST");
}
