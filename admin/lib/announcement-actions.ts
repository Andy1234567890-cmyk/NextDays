"use server";

// Schreib-Actions der offiziellen Ankündigungen. Die Berechtigung prüft
// ausschließlich der Server (require_platform_write in FastAPI) — die UI
// blendet die Aktionen für platform_support nur zusätzlich aus.
//
// Der Bild-Upload läuft NICHT über eine Server Action, sondern über den
// BFF-Route-Handler app/api/ankuendigungen/[id]/bild: der geteilte JSON-DAL
// (lib/api-server) setzt hart application/json und kann kein multipart.
import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import type { Ankuendigung, AnkuendigungKategorie } from "./announcements";
import { api } from "./api-server";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; fehler: string };

async function call<T>(
  pfad: string,
  opts: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
  } = {},
  fehlertext = "Aktion fehlgeschlagen.",
): Promise<Ergebnis<T>> {
  try {
    const data = await api<T>(pfad, { ...opts, cache: "no-store" });
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      fehler: exc instanceof ApiError ? exc.message : fehlertext,
    };
  }
}

/** Listen- UND Detailansicht auffrischen: beide zeigen dieselbe Zeile. */
function aufraeumen(id?: string): void {
  revalidatePath("/ankuendigungen");
  if (id) revalidatePath(`/ankuendigungen/${id}`);
}

export interface AnkuendigungEingabe {
  titel: string;
  inhalt_html: string;
  kurztext: string | null;
  kategorie: AnkuendigungKategorie;
  als_popup: boolean;
  gueltig_bis: string | null;
}

/** Neue Ankündigung als ENTWURF anlegen (Veröffentlichen ist ein eigener Schritt). */
export async function anlegen(
  eingabe: AnkuendigungEingabe,
): Promise<Ergebnis<Ankuendigung>> {
  const res = await call<Ankuendigung>(
    "/platform/announcements",
    { method: "POST", body: eingabe },
    "Ankündigung konnte nicht angelegt werden.",
  );
  if (res.ok) aufraeumen(res.data.id);
  return res;
}

/** Bestehende Ankündigung ändern. Ändert den Status NICHT. */
export async function aendern(
  id: string,
  eingabe: Partial<AnkuendigungEingabe>,
): Promise<Ergebnis<Ankuendigung>> {
  const res = await call<Ankuendigung>(
    `/platform/announcements/${id}`,
    { method: "PATCH", body: eingabe },
    "Änderung fehlgeschlagen.",
  );
  if (res.ok) aufraeumen(id);
  return res;
}

/**
 * Veröffentlichen — ab hier sieht sie jeder Betrieb.
 *
 * Es gibt kein Realtime auf `announcements` (die Tabelle ist für
 * `authenticated` gesperrt, ein Abo wäre eine stumme Attrappe). Die
 * Ankündigung erscheint deshalb beim NÄCHSTEN Vollladen des Dashboards,
 * nicht sofort — genau so steht es auch im Bestätigungsdialog.
 */
export async function veroeffentlichen(
  id: string,
): Promise<Ergebnis<Ankuendigung>> {
  const res = await call<Ankuendigung>(
    `/platform/announcements/${id}/veroeffentlichen`,
    { method: "POST" },
    "Veröffentlichen fehlgeschlagen.",
  );
  if (res.ok) aufraeumen(id);
  return res;
}

/**
 * Zurückziehen — stoppt nur die Weiterverbreitung.
 *
 * Wer die Ankündigung schon quittiert hat, hat sie gesehen; das ist nicht
 * rückholbar. Der Dialog sagt das im Klartext, damit niemand „zurückziehen"
 * mit „ungeschehen machen" verwechselt.
 */
export async function zurueckziehen(
  id: string,
): Promise<Ergebnis<Ankuendigung>> {
  const res = await call<Ankuendigung>(
    `/platform/announcements/${id}/zurueckziehen`,
    { method: "POST" },
    "Zurückziehen fehlgeschlagen.",
  );
  if (res.ok) aufraeumen(id);
  return res;
}

/** Entwurf löschen (samt hochgeladener Bilder — das erledigt das Backend).
 *  Antwortet mit 204 ohne Rumpf; der geteilte DAL liefert dafür `null`. */
export async function loeschen(id: string): Promise<Ergebnis<null>> {
  const res = await call<null>(
    `/platform/announcements/${id}`,
    { method: "DELETE" },
    "Löschen fehlgeschlagen.",
  );
  if (res.ok) aufraeumen(id);
  return res;
}
