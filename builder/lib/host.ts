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
