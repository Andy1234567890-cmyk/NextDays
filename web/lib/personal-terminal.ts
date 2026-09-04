"use server";

// Oeffentliche Terminal-Oberflaeche (Vertrag §3.2): die drei Routen unter
// `/personal/terminal/*` laufen OHNE Nutzer-JWT. Ihre Berechtigung ist der
// Terminal-Token im Header `X-Terminal-Token`.
//
// WARUM EINE EIGENE DATEI UND NICHT `api()` AUS lib/api.ts
// -------------------------------------------------------
// `api()` kennt nur `Authorization: Bearer`. Ein zweites Header-Feld dort
// einzubauen hiesse, die Datei aller Pakete anzufassen, damit EINE Flaeche
// einen Sonderfall bekommt. Stattdessen hier ein schmaler eigener `fetch`
// gegen dieselbe Basis-URL (`apiBasis()` — EINE Quelle der Adresse).
//
// WAS HIER BEWUSST NICHT PASSIERT
// -------------------------------
// * Kein `console.log`/`console.error` mit dem Token, der PIN oder der
//   Stempel-ID. Der Token ist ein Dauer-Zugang zur Stempeluhr eines Betriebs;
//   ein Log-Eintrag damit steht in jedem Coolify-Protokoll (Wurzel 6). Was
//   geloggt wird, ist ausschliesslich Route + HTTP-Status.
// * Kein Cookie, kein `localStorage`. Der Token kommt bei JEDEM Aufruf als
//   Argument von der Seite (die ihn aus der URL hat) und lebt nur im Speicher
//   dieser Seite.
// * Kein Fallback bei fehlendem Token: ohne Token gibt es keinen Aufruf
//   (fail-closed, Wurzel 5) — nie ein „vielleicht klappt es ohne".
import { apiBasis } from "@/lib/api";
import type {
  TerminalAktion,
  TerminalErgebnis,
  TerminalInfo,
  TerminalStatus,
  TerminalZeit,
} from "@/lib/personal-terminal-typen";

/** Erlaubte Aktionen — serverseitig gegengeprueft, damit die Seite keinen
 *  freien String in den Rumpf schreiben kann. */
const AKTIONEN = new Set(["start", "pause", "pause_ende", "ende"]);

async function ruf<T>(
  pfad: string,
  token: string,
  body?: unknown,
): Promise<TerminalErgebnis<T>> {
  const sauber = token.trim();
  if (!sauber) {
    // Fail-CLOSED: ohne Token gar kein Aufruf.
    return { ok: false, code: "token_fehlt", status: 401, meldung: "Kein Terminal-Token." };
  }
  const headers: Record<string, string> = { "X-Terminal-Token": sauber };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${apiBasis()}/personal/terminal${pfad}`, {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch (exc) {
    // Netzwerkgrund sichtbar machen, ohne den Token zu nennen (Wurzel 5).
    const grund = exc instanceof Error ? exc.message : String(exc);
    console.error("[terminal] Backend nicht erreichbar", { pfad, grund });
    return { ok: false, code: "netzwerk", status: 503, meldung: "Backend nicht erreichbar." };
  }

  if (!res.ok) {
    let code: string | null = null;
    let meldung = `Fehler ${res.status}`;
    try {
      const daten = await res.json();
      if (typeof daten?.detail === "string") meldung = daten.detail;
      else if (daten?.detail && typeof daten.detail === "object") {
        const d = daten.detail as Record<string, unknown>;
        if (typeof d.code === "string") code = d.code;
        if (typeof d.message === "string") meldung = d.message;
      }
    } catch {
      // kein JSON-Rumpf — Standardmeldung behalten
    }
    // NUR Route und Status, nie Token/PIN/Stempel-ID.
    console.warn("[terminal] Aufruf abgelehnt", { pfad, status: res.status, code });
    return { ok: false, code, status: res.status, meldung };
  }

  if (res.status === 204) return { ok: true, data: undefined as T };
  return { ok: true, data: (await res.json()) as T };
}

/** Kopfdaten des Terminals: Name, Objekt, Betrieb, Zeitzone, Wetter heute. */
export async function terminalInfo(token: string): Promise<TerminalErgebnis<TerminalInfo>> {
  return ruf<TerminalInfo>("/info", token);
}

/**
 * Schritt 1 der Stempelung: Stempel-ID pruefen.
 *
 * Liefert den Anzeigenamen („Vorname N." — der Server kuerzt, nicht wir),
 * eine offene Stempelung und die Schicht heute. Unbekannte ID → 404
 * `stempel_id_unbekannt`.
 */
export async function terminalStatus(
  token: string,
  stempelId: string,
): Promise<TerminalErgebnis<TerminalStatus>> {
  const id = stempelId.trim();
  if (!/^\d{4}$/.test(id)) {
    return {
      ok: false,
      code: "stempel_id_unbekannt",
      status: 404,
      meldung: "Stempel-ID muss vier Ziffern haben.",
    };
  }
  return ruf<TerminalStatus>("/status", token, { stempel_id: id });
}

/**
 * Schritt 2: mit PIN stempeln.
 *
 * Fehlercodes des Vertrags: 401 `pin_falsch`, 423 `gesperrt` (5 Fehlversuche →
 * 15 min), 404 `stempel_id_unbekannt`.
 */
export async function terminalStempeln(
  token: string,
  stempelId: string,
  pin: string,
  aktion: TerminalAktion,
): Promise<TerminalErgebnis<TerminalZeit>> {
  const id = stempelId.trim();
  if (!/^\d{4}$/.test(id)) {
    return {
      ok: false,
      code: "stempel_id_unbekannt",
      status: 404,
      meldung: "Stempel-ID muss vier Ziffern haben.",
    };
  }
  if (!/^\d{4,6}$/.test(pin)) {
    return { ok: false, code: "pin_falsch", status: 401, meldung: "PIN: 4 bis 6 Ziffern." };
  }
  if (!AKTIONEN.has(aktion)) {
    return { ok: false, code: "aktion_unbekannt", status: 422, meldung: "Unbekannte Aktion." };
  }
  return ruf<TerminalZeit>("/stempeln", token, { stempel_id: id, pin, aktion });
}
