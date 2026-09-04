// Typen der oeffentlichen Terminal-Oberflaeche (Paket F2, Vertrag §3.2).
//
// Eigene Datei OHNE "use server" neben `personal-terminal.ts`: ein
// Server-Action-Modul darf ausschliesslich async functions exportieren.
//
// Die Formen selbst stehen in `personal-betrieb-typen.ts` (ein Ort fuer den
// Vertrag); hier nur, was ausschliesslich die Terminal-Seite braucht.
export type {
  TerminalAktion,
  TerminalInfo,
  TerminalSchicht,
  TerminalStatus,
  TerminalWetter,
  TerminalZeit,
} from "@/lib/personal-betrieb-typen";
export { TERMINAL_AKTIONEN } from "@/lib/personal-betrieb-typen";

/**
 * Ergebnis eines Terminal-Aufrufs.
 *
 * Bewusst NICHT `Result<T>` aus `personal-typen.ts`: dort heisst der Fehlerfall
 * „Nicht angemeldet", was hier nie zutrifft — das Terminal hat keine Sitzung,
 * seine Berechtigung IST der Token. Der Fehlercode wird durchgereicht, weil die
 * Oberflaeche drei davon gross und unterschiedlich anzeigen muss
 * (`pin_falsch` 401, `gesperrt` 423, `stempel_id_unbekannt` 404).
 */
export type TerminalErgebnis<T> =
  | { ok: true; data: T }
  | { ok: false; code: string | null; status: number; meldung: string };
