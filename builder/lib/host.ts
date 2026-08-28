// Host des aktuellen Requests — die Kennung, unter der eine Kunden-Site läuft.
//
// Stand vorher dreimal wortgleich in den Routen (Startseite, Unterseite,
// Inserat). Eine Kopie, die man an einer Stelle korrigiert und an zwei anderen
// vergisst, ist genau die Fehlerklasse, die hier nichts zu suchen hat.
import { headers } from "next/headers";

/** Host ohne Port, klein geschrieben. null, wenn kein Host-Header ankam —
 *  dann ist die Anfrage nicht zuordenbar und der Aufrufer zeigt einen
 *  neutralen Hinweis (kein erfundener Standard-Host). */
export async function aktuellerHost(): Promise<string | null> {
  const h = await headers();
  const raw = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  return raw.split(":")[0]!.trim().toLowerCase() || null;
}

/** Die Sprache aus dem Pfad-Präfix, gesetzt von der Middleware (0476).
 *
 *  `null`, wenn die Adresse kein Sprachsegment trug — dann gilt die
 *  Standardsprache der Website, und `/kontakt` bleibt die Adresse der
 *  Standardfassung.
 *
 *  Warum aus einem HEADER und nicht aus `params`: die Middleware schreibt
 *  `/da/kontakt` intern auf `/kontakt` um, damit es den Routenbaum nur EINMAL
 *  gibt. Nach dem Rewrite sieht die Route ihr Sprachsegment nicht mehr — der
 *  Header ist der Weg, auf dem es trotzdem ankommt.
 *
 *  Der Header ist NICHT vertrauenswürdig, weil er von außen kommen könnte; die
 *  Middleware löscht ihn deshalb bei jedem Request zuerst und setzt ihn nur
 *  selbst (dieselbe Vorsichtsmaßnahme wie bei `x-tenant-id`). Zusätzlich prüft
 *  `spracheWaehlen` gegen die geführten Sprachen der Website — eine erfundene
 *  Sprache fällt dort heraus. */
export async function spracheAusPfad(): Promise<string | null> {
  const h = await headers();
  return h.get("x-site-sprache")?.trim().toLowerCase() || null;
}
