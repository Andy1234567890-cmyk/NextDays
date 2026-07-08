"use server";

// Lodgify-Objekt-Import als Server-Actions (Node → Playwright verfügbar). Zwei
// Schritte, damit der Kunde erst SIEHT und dann AUSWÄHLT:
//   1) previewLodgify(email, password)  → meldet sich an, liest ALLE Objekte aus,
//      gibt sie (inkl. „bereits importiert?") zurück. Legt noch NICHTS an.
//   2) importSelectedLodgify(properties) → legt nur die übergebenen (ausgewählten)
//      Objekte an. Kein erneuter Login/Passwort nötig.
// Das Passwort wird NUR für den Login in Schritt 1 benutzt und NIE gespeichert.
import { api, ApiError } from "@/lib/api";
import {
  completeLodgify2FA,
  LodgifyImportError,
  readAndCloseSession,
  startLodgifyLogin,
  toPropertyInput,
  type LodgifyProperty,
} from "@/lib/lodgify-import";
import { closeLoginSession } from "@/lib/lodgify-login-session";
import { currentToken } from "@/lib/session-token";

export type { LodgifyProperty };

export type PreviewItem = {
  lodgifyId: number;
  name: string;
  imageUrl: string | null;
  propertyType: string | null;
  areaSqm: number | null;
  maxGuests: number | null;
  alreadyImported: boolean;
  // Vollständige gescrapte Daten, damit Schritt 2 ohne erneuten Login anlegt.
  raw: LodgifyProperty;
};

export type ImportOutcome = {
  imported: number;
  failed: number;
  results: { name: string; status: "imported" | "error"; error?: string }[];
};

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

type ExistingProperty = { type_attributes?: { lodgify_property_id?: number } };

async function existingLodgifyIds(token: string): Promise<Set<number>> {
  try {
    const res = await api<{ items: ExistingProperty[] }>("/properties", { token });
    return new Set(
      (res.items ?? [])
        .map((p) => p.type_attributes?.lodgify_property_id)
        .filter((x): x is number => typeof x === "number"),
    );
  } catch {
    return new Set();
  }
}

/** Objekte einer bereits eingeloggten Login-Session lesen + zur Vorschau
 *  aufbereiten (markiert bereits importierte). Schließt die Session danach. */
async function previewFromSession(
  sessionId: string,
  token: string,
): Promise<Result<PreviewItem[]>> {
  let scraped: LodgifyProperty[];
  try {
    scraped = await readAndCloseSession(sessionId);
  } catch (err) {
    const message =
      err instanceof LodgifyImportError || err instanceof Error
        ? err.message
        : "Import fehlgeschlagen.";
    return { ok: false, error: message };
  }
  const existing = await existingLodgifyIds(token);
  const items: PreviewItem[] = scraped.map((p) => ({
    lodgifyId: p.lodgifyId,
    name: p.name,
    imageUrl: p.imageUrl,
    propertyType: p.propertyType,
    areaSqm: p.areaSqm,
    maxGuests: p.maxGuests,
    alreadyImported: existing.has(p.lodgifyId),
    raw: p,
  }));
  return { ok: true, data: items };
}

/** Ergebnis von Schritt 1: entweder direkt die Objektliste, oder „2FA nötig"
 *  mit einer sessionId, über die der SMS-Code eingereicht wird. */
export type StartResult =
  | { kind: "items"; items: PreviewItem[] }
  | { kind: "needs_2fa"; sessionId: string };

/** Schritt 1: Mit E-Mail/Passwort anmelden. Ohne 2FA → Objektliste. Mit 2FA →
 *  sessionId zurück; der Umzug-Tab zeigt dann ein Code-Feld. */
export async function previewLodgify(input: {
  email: string;
  password: string;
}): Promise<Result<StartResult>> {
  const email = input.email.trim();
  const { password } = input;
  if (!email || !password) {
    return { ok: false, error: "Lodgify-E-Mail und -Passwort erforderlich." };
  }
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };

  let started: Awaited<ReturnType<typeof startLodgifyLogin>>;
  try {
    started = await startLodgifyLogin(email, password);
  } catch (err) {
    const message =
      err instanceof LodgifyImportError || err instanceof Error
        ? err.message
        : "Login fehlgeschlagen.";
    return { ok: false, error: message };
  }

  if (started.status === "needs_2fa") {
    return { ok: true, data: { kind: "needs_2fa", sessionId: started.sessionId } };
  }
  // Ohne 2FA: Objekte direkt lesen.
  const res = await previewFromSession(started.sessionId, token);
  if (!res.ok) return res;
  return { ok: true, data: { kind: "items", items: res.data } };
}

/** Schritt 1b (nur bei 2FA): SMS-Code einreichen → Login abschließen →
 *  Objektliste zurück. */
export async function submit2FACode(input: {
  sessionId: string;
  code: string;
}): Promise<Result<PreviewItem[]>> {
  const code = input.code.trim();
  if (!input.sessionId || !code) {
    return { ok: false, error: "Bitte den Bestätigungscode eingeben." };
  }
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };

  try {
    await completeLodgify2FA(input.sessionId, code);
  } catch (err) {
    // Bei falschem Code Session offen lassen (Kunde kann neuen Code eingeben);
    // nur bei „abgelaufen" ist sie ohnehin weg.
    const message =
      err instanceof LodgifyImportError || err instanceof Error
        ? err.message
        : "Code-Bestätigung fehlgeschlagen.";
    return { ok: false, error: message };
  }
  return previewFromSession(input.sessionId, token);
}

/** Laufenden Login-Vorgang abbrechen (Browser schließen), wenn der Kunde den
 *  2FA-Schritt nicht abschließt. */
export async function cancelLodgifyLogin(sessionId: string): Promise<void> {
  await closeLoginSession(sessionId);
}

/** Schritt 2: Nur die ausgewählten Objekte anlegen (idempotent, ohne Re-Login).
 *  Ein Fehler pro Objekt stoppt die anderen nicht. */
export async function importSelectedLodgify(
  selected: LodgifyProperty[],
): Promise<Result<ImportOutcome>> {
  if (!selected || selected.length === 0) {
    return { ok: false, error: "Keine Objekte ausgewählt." };
  }
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };

  // Doppel-Schutz auch hier: was schon importiert ist, wird übersprungen.
  const existing = await existingLodgifyIds(token);

  let imported = 0;
  let failed = 0;
  const results: ImportOutcome["results"] = [];
  for (const prop of selected) {
    if (existing.has(prop.lodgifyId)) continue; // bereits vorhanden → still überspringen
    try {
      await api("/properties", {
        method: "POST",
        token,
        body: toPropertyInput(prop),
      });
      imported += 1;
      results.push({ name: prop.name, status: "imported" });
    } catch (err) {
      failed += 1;
      const error = err instanceof ApiError ? err.message : "Fehler";
      results.push({ name: prop.name, status: "error", error });
    }
  }
  return { ok: true, data: { imported, failed, results } };
}
