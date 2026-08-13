"use server";

// Eigentümer-Portal · Familienzugänge und Stufe 1 der Sperrantrags-Freigabe.
//
// Eigene Datei neben `portal.ts`, weil das ein abgeschlossener Vorgang mit
// eigenem Contract ist — `portal.ts` trägt bereits Kalender, Berichte,
// Sperranträge, Zählerstände und Dienstleistungen.
//
// Eigenes `call` statt eines Imports aus `portal.ts`: Dessen Fassung ist nicht
// exportiert (in einem `"use server"`-Modul wäre jeder Export eine
// Server-Action nach außen) und kennt nur GET/POST — hier werden PATCH und
// DELETE gebraucht.
//
// KEIN Realtime auf diesen Daten: `owner_family_members` (0389) und
// `block_requests` (seit 0332) haben kein SELECT-Grant für `authenticated`,
// ein Abo wäre eine stumme Attrappe. Die Flächen schreiben stattdessen die
// Server-Antwort direkt in ihren Zustand.
//
// Business-Logik bleibt im Backend: hier wird nur aufgerufen.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<Ergebnis<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    return { ok: true, data: await api<T>(path, { ...opts, token }) };
  } catch (exc) {
    // „leer" und „konnte nicht laden" sind zwei verschiedene Aussagen
    // (Wurzel 4/5) — ein Ladefehler darf nicht als „keine Zugänge" erscheinen.
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Backend nicht erreichbar.",
    };
  }
}

/** Was ein Familienzugang darf. Muss mit dem Enum
 *  public.owner_family_access (0389) und `STUFEN` in
 *  apps/api/.../public_portal/familie.py übereinstimmen. */
export type FamilienStufe = "nutzung" | "nutzung_berichte";

export type FamilienZugang = {
  id: string;
  user_id: string;
  property_id: string;
  access: FamilienStufe;
  /** Kann fehlen, wenn der Login inzwischen gelöscht wurde — dann bleibt die
   *  Zeile leer, statt einen Namen zu erfinden (Wurzel 4). */
  email: string | null;
  full_name: string | null;
  created_at: string | null;
};

export type FamilienZugangAngelegt = {
  zugang: FamilienZugang;
  /** Ehrliche Rückmeldung: Bestand die Adresse im Betrieb schon als Login,
   *  wurde nur VERKNÜPFT — dann ging keine Mail raus, und die Oberfläche darf
   *  nicht „Einladung verschickt" behaupten. */
  einladung_versendet: boolean;
};

/** Ein Sperrwunsch der Familie, der auf die Freigabe des Eigentümers wartet. */
export type FreigabeAntrag = {
  id: string;
  property_id: string;
  unit_id: string | null;
  /** INKLUSIV („vom 1. bis zum 5."), wie im übrigen Sperrantrags-Contract. */
  start_date: string;
  end_date: string;
  reason: string | null;
  created_at: string | null;
  requested_by: string;
  /** Name statt UUID. Fehlt er, zeigt die Fläche nichts — kein Platzhalter. */
  antragsteller: string | null;
};

/** Was der eingeloggte Portal-Nutzer ist und darf.
 *
 * Steuert nur die SICHTBARKEIT der Navigation — jeder Endpunkt prüft seine
 * Rechte weiterhin selbst. Ein sichtbarer Menüpunkt führt im schlimmsten Fall
 * zu einem 403, nie zu Daten. */
export type PortalRolle = {
  ist_familienmitglied: boolean;
  darf_berichte: boolean;
  darf_zugaenge: boolean;
};

export async function ladePortalRolle(): Promise<Ergebnis<PortalRolle>> {
  return call("/public-portal/familie/rolle");
}

export async function listeFamilienzugaenge(): Promise<
  Ergebnis<{ items: FamilienZugang[]; total: number }>
> {
  return call("/public-portal/familie");
}

export async function ladeFamilienmitgliedEin(input: {
  property_id: string;
  email: string;
  full_name: string;
  access: FamilienStufe;
  /** Sprache des EMPFÄNGERS. Fehlt sie, greift im Backend die Kette
   *  Betriebssprache → Englisch — nie die Browsersprache des Einladenden. */
  preferred_language?: string | null;
}): Promise<Ergebnis<FamilienZugangAngelegt>> {
  return call("/public-portal/familie", { method: "POST", body: input });
}

export async function aendereFamilienStufe(
  mitgliedId: string,
  access: FamilienStufe,
): Promise<Ergebnis<FamilienZugang>> {
  return call(`/public-portal/familie/${mitgliedId}`, {
    method: "PATCH",
    body: { access },
  });
}

export async function entferneFamilienzugang(
  mitgliedId: string,
): Promise<Ergebnis<null>> {
  return call(`/public-portal/familie/${mitgliedId}`, { method: "DELETE" });
}

export async function listeOffeneFreigaben(): Promise<
  Ergebnis<{ items: FreigabeAntrag[]; total: number }>
> {
  return call("/public-portal/familie/freigaben");
}

/** Stufe 1 entscheiden.
 *
 * Freigeben reicht den Wunsch an die Verwaltung weiter; ablehnen beendet ihn.
 * In BEIDEN Fällen passiert am Kalender nichts — die Sperrung entsteht erst,
 * wenn die Verwaltung anschließend genehmigt. */
export async function entscheideFreigabe(
  antragId: string,
  freigeben: boolean,
  note?: string | null,
): Promise<Ergebnis<null>> {
  return call(`/public-portal/familie/freigaben/${antragId}`, {
    method: "POST",
    body: { freigeben, note: note ?? null },
  });
}
