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

import {
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
