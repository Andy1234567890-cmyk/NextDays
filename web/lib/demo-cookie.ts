// Name des Vorfuehr-Markierungs-Cookies — EINE Quelle fuer Middleware und
// Auth-Actions.
//
// Eigene Datei, weil `lib/auth.ts` `"use server"` traegt: dort darf
// AUSSCHLIESSLICH eine async function exportiert werden, eine Konstante bricht
// den Build erst spaet in „Collecting page data" (CLAUDE.md, Frontend-Gate).
// Die Middleware laeuft ausserdem in der Edge-Runtime und darf `lib/auth.ts`
// gar nicht ziehen.
//
// Das Cookie ist KEIN Sicherheitsmerkmal — es sagt nur, wie lange die Sitzung
// leben soll. Die Schranke gegen Schreibzugriffe der Vorfuehrung bleibt der
// serverseitige `demo_gate` am `is_demo` des Mandanten (Wurzel 7).
export const DEMO_COOKIE = "nd_demo";

/** Laufzeit einer Vorfuehr-Sitzung: 2 Stunden. Sie gehoert keinem
 *  Arbeitsplatz, sondern einem BESUCH — und ein Besuch ist nach zwei Stunden
 *  vorbei. Vorher galten dieselben 30 Tage wie fuer einen echten Login: ein
 *  einmaliger `/demo`-Aufruf blieb damit einen Monat die aktive Sitzung des
 *  Browsers und zog jeden spaeteren Link aus einer Benachrichtigungs-Mail in
 *  die Vorfuehrung, wo die verlinkte Aufgabe zwangsläufig „nicht verfuegbar"
 *  war (live 24.08.2026).
 *
 *  Der Wert steht HIER und nicht in `@nextdays/auth/server`: jenes Modul
 *  traegt `"use server"` und darf ausschliesslich async functions exportieren —
 *  eine exportierte Zahl liess dort jeden Seitenaufruf mit HTTP 500 und
 *  „A `use server` file can only export async functions, found number"
 *  scheitern. */
export const DEMO_REFRESH_MAX_AGE = 60 * 60 * 2;

/** Angefragter Pfad (inkl. Query) als Request-Header, von der Middleware
 *  gesetzt.
 *
 *  WARUM: Eine Server Component kennt den angefragten Pfad NICHT. Das
 *  Dashboard-Layout ist aber die Stelle, die bei fehlender Sitzung auf `/login`
 *  leitet — ohne den Pfad kann es kein Rueckziel mitgeben und die Anmeldung
 *  endet immer im Dashboard, auch wenn der Nutzer aus einer
 *  Benachrichtigungs-Mail auf eine bestimmte Aufgabe geklickt hat.
 *
 *  Eine Weiche in der Ziel-SEITE reicht dafuer nicht: das Layout rendert
 *  vorher und leitet schon um — die Seite kommt gar nicht dran (live geprueft
 *  24.08.2026: HTTP 307 auf `/login` ohne Rueckziel). */
export const PFAD_HEADER = "x-nd-pfad";
