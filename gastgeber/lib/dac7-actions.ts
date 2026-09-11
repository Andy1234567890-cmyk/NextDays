"use server";

// Schreib-Actions der DAC7-Meldung (Server Actions über den Host-Cookie-DAL).
//
// Die fachliche Prüfung liegt beim Backend: Es entscheidet, ob eine Meldung
// erzeugt werden darf, und liefert bei Mängeln einen Prüfbericht mit Fundort
// je Befund. Der wird hier 1:1 durchgereicht — ein generisches „Fehler" wäre
// hier besonders schädlich, weil der Nutzer sonst nicht weiß, welche Angabe
// welchem Eigentümer fehlt.
import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import { api, hostToken } from "./api-server";
import type { Meldelauf, MeldungVorschau } from "./dac7";

type VorschauErgebnis =
  | { ok: true; vorschau: MeldungVorschau }
  | { ok: false; error: string };

type LaufErgebnis =
  | { ok: true; lauf: Meldelauf }
  | { ok: false; error: string };

/** Die Meldung eines Jahres berechnen.
 *
 *  Mit `probelauf: true` wird nur gerechnet und geprüft, NICHTS abgelegt —
 *  der Weg, um vor der ersten echten Meldung zu sehen, ob die Daten
 *  tragen. Ein Probelauf ist auch nach einer Abgabe möglich, weil er am
 *  abgegebenen Stand nichts ändert.
 *
 *  Achtung: `ok: true` heißt NICHT, dass eine Datei entstanden ist. Fehlt
 *  eine Pflichtangabe, ist der Lauf trotzdem erfolgreich berechnet — die
 *  Vorschau trägt dann `datei_verfuegbar: false` und im Bericht die Liste
 *  der Mängel. Nur ein echter Serverfehler gibt `ok: false`. */
export async function erzeugeMeldung(
  jahr: number,
  { probelauf = false, art = "betrieb" as const } = {},
): Promise<VorschauErgebnis> {
  try {
    const vorschau = await api<MeldungVorschau>("/taxpayer/dac7/erzeugen", {
      method: "POST",
      body: { jahr, art, probelauf },
    });
    // Nur beim echten Lauf: Ein Probelauf ändert nichts, was neu geladen
    // werden müsste.
    if (!probelauf) revalidatePath("/konto");
    return { ok: true, vorschau };
  } catch (exc) {
    return {
      ok: false,
      error:
        exc instanceof ApiError
          ? exc.message
          : "Die Meldung konnte nicht berechnet werden.",
    };
  }
}

/** Einen Lauf als abgegeben kennzeichnen.
 *
 *  Bestätigt, dass die Datei bei der Behörde hochgeladen wurde — wir laden
 *  nicht selbst hoch. Ab dann ist der Lauf unveränderlich; Änderungen sind
 *  nur noch als Korrekturmeldung möglich. */
export async function meldungAbgeben(laufId: string): Promise<LaufErgebnis> {
  try {
    const lauf = await api<Meldelauf>(
      `/taxpayer/dac7/laeufe/${encodeURIComponent(laufId)}/abgeben`,
      { method: "POST" },
    );
    revalidatePath("/konto");
    return { ok: true, lauf };
  } catch (exc) {
    return {
      ok: false,
      error:
        exc instanceof ApiError
          ? exc.message
          : "Der Lauf konnte nicht als abgegeben gekennzeichnet werden.",
    };
  }
}

/** Die CSV eines Laufs holen.
 *
 *  Läuft über eine Server Action und nicht über einen direkten Link, weil
 *  die Datei Steuer-IDs und Kontokennungen enthält: Der Abruf braucht das
 *  Host-Cookie, das nur serverseitig verfügbar ist. Der Browser bekommt den
 *  Inhalt und speichert ihn selbst.
 *
 *  Hier wird bewusst NICHT der gemeinsame `api()`-Helfer verwendet: Der
 *  parst jede Antwort als JSON und würde an einer CSV scheitern. Statt das
 *  geteilte Paket für diesen einen Fall umzubauen, holt diese Funktion die
 *  Datei selbst — mit demselben Bearer aus demselben Cookie. */
export async function holeMeldedatei(
  laufId: string,
): Promise<{ ok: true; inhalt: string; name: string } | { ok: false; error: string }> {
  const token = await hostToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };

  // Dieselbe Adresse wie im geteilten DAL (packages/auth/src/server.ts) —
  // eine zweite Konvention wäre eine Quelle stiller Abweichung.
  const backend = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  let antwort: Response;
  try {
    antwort = await fetch(
      `${backend}/api/v1/taxpayer/dac7/laeufe/${encodeURIComponent(laufId)}/datei`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
  } catch {
    return { ok: false, error: "Backend nicht erreichbar." };
  }

  const inhalt = await antwort.text();
  if (!antwort.ok) {
    // Die Fehlerantwort ist JSON, die Erfolgsantwort CSV — deshalb erst
    // hier auspacken, und nur versuchsweise.
    let meldung = `Fehler ${antwort.status}`;
    try {
      const daten = JSON.parse(inhalt) as { detail?: string };
      if (daten.detail) meldung = daten.detail;
    } catch {
      // Keine JSON-Antwort: Dann bleibt der Status die beste Auskunft.
    }
    return { ok: false, error: meldung };
  }

  return { ok: true, inhalt, name: `dac7-${laufId}.csv` };
}
