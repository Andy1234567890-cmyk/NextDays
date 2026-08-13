"use server";

// Server Actions für die beiden Monitor-Tabellen (Worker + Webhook).
//
// WARUM DIESE DATEI ÜBERHAUPT EXISTIERT:
// `lib/backoffice.ts` ist reiner Transport für SERVER-Komponenten: es ruft
// `api()` aus `lib/api-server.ts`, und das liest den Bearer-Token aus einem
// httpOnly-Cookie. Ein httpOnly-Cookie ist für Browser-JS unsichtbar — der
// Aufruf aus einer `"use client"`-Komponente ging also ohne Authorization-
// Header raus und bekam vom Backend 401.
//
// Sichtbar wurde das als „Details nicht ladbar." unter jedem aufgeklappten
// Eintrag im Worker-Monitor (live 12.08.2026): eine Falschaussage, denn die
// Quellzeilen waren alle vorhanden — 60 von 60 geprüft. Betroffen war ebenso
// jedes Nachladen und jeder Filterwechsel der Liste; nur die ERSTE Seite stand
// da, weil die Server-Komponente sie als Prop mitliefert.
//
// Mit `"use server"` läuft der Aufruf auf dem Server, kommt an das Cookie und
// trägt den Bearer. Dasselbe Muster wie `auth.ts`, `deploy-actions.ts`,
// `team-actions.ts` & Co. — die Client-Komponenten dieses Bereichs rufen
// ausnahmslos Server Actions, nie `backoffice.ts` direkt.
//
// NUR FUNKTIONEN, KEINE WERTE UND KEINE TYPEN: Ein `"use server"`-Modul darf
// ausschließlich async functions exportieren. Ein `interface`/`const` hier
// bricht erst spät im `next build` („Collecting page data") mit
// `A "use server" file can only export async functions`. Die Typen bleiben
// deshalb in `backoffice.ts` und werden von dort importiert.

import { ApiError } from "@nextdays/auth/errors";

import {
  type ErledigtZustand,
  type MonitorQuelle,
  type WebhookDetail,
  type WebhookEreignisListe,
  type WebhookFilter,
  type WorkerDetail,
  type WorkerEreignisListe,
  type WorkerFilter,
  getWebhookDetail,
  getWebhookEreignisse,
  getWorkerDetail,
  getWorkerEreignisse,
  postEreignisErledigt,
  postEreignisOffen,
} from "./backoffice";

/** Der Worker-Verlauf, neueste zuerst — für das Nachladen und die Filter. */
export async function workerEreignisseHolen(
  filter: WorkerFilter = {},
): Promise<WorkerEreignisListe> {
  return getWorkerEreignisse(filter);
}

/** Die vollständige Quellzeile eines Worker-Ereignisses (Bodies, Payload). */
export async function workerDetailHolen(id: string): Promise<WorkerDetail> {
  return getWorkerDetail(id);
}

/** Die Portal-Eingänge, neueste zuerst — für das Nachladen und die Filter. */
export async function webhookEreignisseHolen(
  filter: WebhookFilter = {},
): Promise<WebhookEreignisListe> {
  return getWebhookEreignisse(filter);
}

/** Die vollständige Payload eines Portal-Eingangs, ungekürzt. */
export async function webhookDetailHolen(id: string): Promise<WebhookDetail> {
  return getWebhookDetail(id);
}

/** Ein Ereignis abhaken, optional mit Notiz (Webhook oder Worker).
 *
 *  Ohne diesen Weg blieb `resolved` auf `false` stehen — live bei ALLEN 603
 *  Webhook-Eingängen — und die Konsole zeigte 18 längst behobene Fehler
 *  dauerhaft als „Eingriff nötig". Eine Warnung, die nie verschwindet, wird
 *  übersehen.
 *
 *  Idempotent: Ein zweiter Klick überschreibt weder Zeitpunkt noch Bearbeiter. */
export async function ereignisErledigen(
  quelle: MonitorQuelle,
  id: string,
  notiz?: string,
): Promise<{ ok: true; data: ErledigtZustand } | { ok: false; fehler: string }> {
  try {
    const data = await postEreignisErledigt(quelle, id, notiz?.trim() || null);
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      fehler: exc instanceof ApiError ? exc.message : "Abhaken fehlgeschlagen.",
    };
  }
}

/** Ein versehentlich abgehaktes Ereignis wieder öffnen.
 *
 *  Ohne Rückweg wäre ein Fehlklick endgültig und liesse ein echtes Problem
 *  still aus der Liste verschwinden — genau die Sorte Verlust, gegen die diese
 *  Monitore gebaut sind. */
export async function ereignisWiederOeffnen(
  quelle: MonitorQuelle,
  id: string,
): Promise<{ ok: true; data: ErledigtZustand } | { ok: false; fehler: string }> {
  try {
    return { ok: true, data: await postEreignisOffen(quelle, id) };
  } catch (exc) {
    return {
      ok: false,
      fehler:
        exc instanceof ApiError ? exc.message : "Wiederöffnen fehlgeschlagen.",
    };
  }
}
