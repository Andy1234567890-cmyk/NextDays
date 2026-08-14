// Die MCP-Scopes als Werte — bewusst NEBEN `mcp-verbindungen.ts`.
//
// Jenes Modul trägt "use server": darin darf ausschließlich `async function`
// exportiert werden. Ein `export const` dort bricht erst beim Build in
// „Collecting page data" mit `A "use server" file can only export async
// functions` — also lange nach `tsc` und ESLint, die das nicht prüfen.
//
// Beide Werte müssen mit `SCOPE_LESEN`/`SCOPE_FREITEXT` in
// apps/api/src/features/mcp/oauth_service.py übereinstimmen. Ein Tippfehler
// hier führt zu „Unbekannte Scopes" und einem Abbruch mitten im Flow.

/** Lesender Zugriff auf Kalender, Buchungen und Posteingang. */
export const SCOPE_LESEN = "mcp:read";

/** Zusätzlich Nachrichteninhalte und Buchungsnotizen. */
export const SCOPE_FREITEXT = "mcp:freetext";

/**
 * Zusätzlich ÄNDERN im operativen Geschäft: Kalender sperren, Preise setzen,
 * Buchungen stornieren oder verschieben, Aufgaben führen, Nachrichten senden.
 *
 * NICHT im Konto — Abo, Rechnungen, Nutzerverwaltung, Sicherheit und die
 * Verbindungen selbst haben gar kein Werkzeug und sind darum auch mit diesem
 * Scope unerreichbar.
 */
export const SCOPE_SCHREIBEN = "mcp:write";
