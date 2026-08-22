// EINE Quelle für die Frage „ist der Marktplatz öffentlich?".
//
// Warum das existiert: myBestDays war ab 17.08.2026 unter eigener Domain live,
// indexierbar, mit echten Inseraten in der sitemap.xml. Der Marktplatz gehört
// künftig einer eigenen Gesellschaft und soll bis dahin NICHT öffentlich
// auftreten. Bis zum Start beantwortet die Domain deshalb jede öffentliche
// Anfrage mit einer Vorab-Seite.
//
// WARUM EINE KONSTANTE UND KEINE ENV-VARIABLE:
// Die Umgebungsvariable wäre der naheliegende Weg, ist hier aber die
// gefährlichere: NEXT_PUBLIC_*-Werte werden beim Docker-Build eingebacken
// (plattform/Dockerfile), und ein Build-Arg ohne Wert ist die LEERE
// Zeichenkette — nicht `undefined` (siehe lib/backend-basis.ts, wo genau das
// den Marktplatz live leer aussehen ließ). Ein vergessenes Build-Arg würde das
// Tor also lautlos ÖFFNEN. Fail-closed heißt hier: der Verschluss steht im
// Code, ein Öffnen ist ein bewusster Commit, kein Deploy-Nebeneffekt.
//
// ZUM START: hier auf `false` setzen. Damit fallen in einem Zug weg: das Tor in
// der Middleware, `noindex` im Layout, `Disallow: /` in robots.txt und die
// leere sitemap.xml — alle vier lesen diesen einen Wert.
export const VOR_DEM_START = true;

/** Pfade, die auch vor dem Start erreichbar bleiben.
 *
 *  Bewusst knapp gehalten. Jeder Eintrag ist eine Ausnahme, die ein Crawler
 *  ebenfalls findet:
 *   - `/api/`      Route-Handler (Proxy an FastAPI). Ein Redirect würde
 *                  POST/multipart-Anfragen zerreißen, und die Route-Handler
 *                  prüfen ihre Auth selbst.
 *   - `/rechtliches` Impressum, Datenschutz, Nutzungsbedingungen. Ein Anbieter
 *                  muss auch vor dem Start erreichbar sein (Impressumspflicht);
 *                  diese Seiten nennen keine Inserate.
 *   - `/_next/`, `/healthz`, Favicon: Technik. Ohne sie zeigt die Vorab-Seite
 *                  selbst kein Styling, und der Healthcheck des Containers
 *                  bekäme einen 307 statt 200 (Coolify meldet dann degraded).
 */
export const VORSTART_FREI = [
  "/api/",
  "/rechtliches",
  "/_next/",
  "/healthz",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
] as const;

/** Ist dieser Pfad vor dem Start erreichbar? */
export function vorstartFrei(pathname: string): boolean {
  return VORSTART_FREI.some(
    (p) => pathname === p || pathname.startsWith(p) || pathname === p.replace(/\/$/, ""),
  );
}

/** Nur die Nachrichten, die die Vorab-Seite braucht.
 *
 *  `NextIntlClientProvider` ohne `messages` serialisiert den KOMPLETTEN
 *  Nachrichten-Baum in das ausgelieferte HTML (532 Keys). Vor dem Start ist das
 *  ein Leck: darin stehen Marktplatz-Texte samt Markenname — im Container
 *  gemessen (22.08.2026) u. a. „myBestDays für Gastgeber", im Quelltext einer
 *  Seite, die die Marke gerade verbergen soll. Ein Crawler liest den Quelltext,
 *  nicht das gerenderte Bild.
 *
 *  Deshalb hier eine ausdrückliche Auswahl: nur `vorstart`. Der Import ist
 *  derselbe Weg wie in `i18n/request.ts` — eine Ladefunktion an einer Stelle,
 *  siehe die Begründung dort.
 */
export async function vorstartNachrichten(
  locale: string,
): Promise<Record<string, unknown>> {
  const { load } = await import("@/i18n/request");
  const gewaehlt = await load(locale);
  if (gewaehlt.vorstart) return { vorstart: gewaehlt.vorstart };
  // Fällt die gewählte Datei aus, greift Deutsch. Vier Sätze — die Seite muss
  // stehen, ein stiller Rückfall ist hier richtig.
  const basis = await load("de");
  return { vorstart: basis.vorstart ?? {} };
}
