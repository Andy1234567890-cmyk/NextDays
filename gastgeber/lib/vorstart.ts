// SCHWESTERDATEI zu plattform/lib/vorstart.ts — bewusste Kopie (ADR-0019
// Stufe 1). Beide Marktplatz-Frontends müssen zum selben Zeitpunkt öffnen;
// zwei Schalter, die auseinanderlaufen, wären genau der Zustand, den das Tor
// verhindern soll (Gastgeber-Anmeldung offen, Gäste-Seite zu).
//
// Warum das existiert: myBestDays war ab 17.08.2026 unter eigener Domain live.
// `gastgeber.mybestdays.dk/anmelden` war ohne Login erreichbar und trug den
// Markennamen im Titel („myBestDays — Gastgeber", live geprüft am 22.08.2026)
// sowie viermal im Seitentext. Der Marktplatz gehört künftig einer eigenen
// Gesellschaft und tritt bis dahin nicht öffentlich auf.
//
// WARUM EINE KONSTANTE UND KEINE ENV-VARIABLE: NEXT_PUBLIC_*-Werte werden beim
// Docker-Build eingebacken, und ein Build-Arg ohne Wert ist die LEERE
// Zeichenkette — nicht `undefined`. Ein vergessenes Build-Arg würde das Tor
// lautlos ÖFFNEN. Der Verschluss steht deshalb im Code; das Öffnen ist ein
// bewusster Commit, kein Deploy-Nebeneffekt.
//
// ZUM START: hier auf `false` setzen — UND in plattform/lib/vorstart.ts.
export const VOR_DEM_START = true;

/** Pfade, die auch vor dem Start erreichbar bleiben.
 *
 *  Knapper als bei der Gäste-Seite, weil hier fast alles ohnehin Login
 *  verlangt. `/api/` muss frei bleiben: die Route-Handler prüfen ihre Auth
 *  selbst über den Host-Cookie, und ein Redirect würde POST/multipart-Anfragen
 *  zerreißen (Next.js: „Failed to find Server Action").
 */
export const VORSTART_FREI = [
  "/api/",
  "/_next/",
  "/healthz",
  "/favicon.ico",
  "/robots.txt",
] as const;

/** Ist dieser Pfad vor dem Start erreichbar? */
export function vorstartFrei(pathname: string): boolean {
  return VORSTART_FREI.some(
    (p) => pathname === p || pathname.startsWith(p) || pathname === p.replace(/\/$/, ""),
  );
}
