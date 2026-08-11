// SCHWESTERDATEI-GEDANKE (bewusste Kopie von plattform/lib/backend-basis.ts):
// EINE Quelle für die Basis-URLs serverseitiger Fetches. Server-Components kennen
// keinen eigenen Origin — sie sprechen FastAPI deshalb DIREKT an, nicht über den
// Same-Origin-Proxy /api/v1.
//
// Warum ein eigener Helfer: NEXT_PUBLIC_*-Variablen werden beim Docker-Build
// eingebacken (ARG/ENV). Ein Build-Arg OHNE Wert wird zur LEEREN Zeichenkette —
// und `process.env.X ?? "fallback"` fängt nur undefined/null, nicht "". Die Basis
// war dann "", jeder SSR-Fetch bekam die relative URL "/api/v1/…" und starb mit
// ERR_INVALID_URL; der Aufrufer fing das ab und zeigte den Leerzustand. Live am
// 11.08.2026 auf der Plattform: „Noch keine Unterkünfte verfügbar", obwohl das
// Backend 21 freigegebene Objekte lieferte. Leere Werte gelten hier als NICHT
// gesetzt.
const DEV_BACKEND = "http://localhost:8000";

/** Getrimmter, slash-freier Wert — oder der Entwicklungs-Fallback, wenn die
 *  Variable fehlt ODER leer ist (Build-Arg ohne Wert). */
export function envUrl(raw: string | undefined, devFallback: string): string {
  const wert = (raw ?? "").trim().replace(/\/+$/, "");
  return wert || devFallback;
}

/** FastAPI-Basis für serverseitige Fetches (ohne trailing slash). */
export function backendBasis(): string {
  return envUrl(process.env.NEXT_PUBLIC_API_URL, DEV_BACKEND);
}
