// Serverseitiger Abruf der Statusseite (Uptime Kuma) für den Footer-Punkt.
//
// WARUM ÜBERHAUPT EIN PROXY: Kuma sendet auf `/api/status-page/heartbeat/*`
// KEIN `Access-Control-Allow-Origin` (live gegengeprüft am 19.08.2026). Ein
// `fetch` aus dem Browser von mynextdays.com aus wird deshalb von der
// Same-Origin-Policy blockiert — der Punkt wäre nie erschienen, und weil die
// Komponente fail-quiet ist, hätte das niemand gemerkt. Der Abruf gehört also
// auf den Server, wo CORS nicht gilt.
//
// WAS HIER NICHT PASSIERT: kein Weiterreichen der Kuma-Antwort. Nach draußen
// geht nur die verdichtete Lage, keine Monitor-IDs, keine internen Namen,
// keine Ping-Zeiten. Sonst stünden die Namen unserer internen Dienste im
// Quelltext jeder Marketing-Seite.
import { STATUS_BASIS } from "@/lib/app-url";

// Kuma-Statuscodes eines Heartbeats.
const UNTEN = 0;
const OBEN = 1;
const WARTUNG = 3;

// 60 Sekunden Zwischenspeicher: der Footer steht auf jeder Seite, und Kuma
// prüft selbst nur minütlich. Ohne Deckel wäre jeder Seitenaufruf ein Abruf
// gegen den eigenen Monitor-Server.
export const revalidate = 60;

type Heartbeat = { status: number };
type KumaAntwort = { heartbeatList?: Record<string, Heartbeat[]> };

/**
 * Gesamtlage aus den Einzelmonitoren.
 *
 * Streng: EIN Dienst unten heißt „gestört", nicht „läuft" — wer die
 * Buchungsplattform braucht, ist nicht bedient, weil das Storybook antwortet.
 * Unbekannt (`null`) bei allem, was nicht eindeutig ist; ein grüner Punkt bei
 * unklarem Zustand wäre eine Falschaussage über den Betrieb.
 */
// NICHT exportiert: eine `route.ts` darf ausser den Handlern und einer festen
// Liste von Konfigurationswerten NICHTS exportieren — Next.js bricht sonst mit
// TS2344 ab ("does not satisfy the constraint"). Geprueft wird die Funktion
// deshalb ueber die Route selbst.
function lageAus(hb: Record<string, Heartbeat[]>): string | null {
  const letzte = Object.values(hb)
    .map((liste) => liste[liste.length - 1]?.status)
    .filter((s): s is number => typeof s === "number");

  if (letzte.length === 0) return null;
  if (letzte.some((s) => s === WARTUNG)) return "wartung";

  const unten = letzte.filter((s) => s === UNTEN).length;
  if (unten === 0) return letzte.every((s) => s === OBEN) ? "oben" : null;
  return unten === letzte.length ? "unten" : "gestoert";
}

export async function GET(): Promise<Response> {
  // Ohne konfigurierte Statusseite gibt es nichts zu melden — 204, damit die
  // Komponente den Punkt weglässt statt einen Fehler zu zeigen.
  if (!STATUS_BASIS) return new Response(null, { status: 204 });

  try {
    const antwort = await fetch(
      `${STATUS_BASIS}/api/status-page/heartbeat/status`,
      { signal: AbortSignal.timeout(5000), next: { revalidate } },
    );
    if (!antwort.ok) return new Response(null, { status: 204 });

    const daten = (await antwort.json()) as KumaAntwort;
    const lage = daten.heartbeatList ? lageAus(daten.heartbeatList) : null;
    if (!lage) return new Response(null, { status: 204 });

    return Response.json({ lage });
  } catch {
    // Fail-quiet: unser Abruf ist nicht der Zustand des Dienstes (Wurzel 5b).
    // Ein rotes Signal, weil UNSER fetch scheiterte, wäre eine Falschaussage.
    return new Response(null, { status: 204 });
  }
}
