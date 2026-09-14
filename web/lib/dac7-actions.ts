"use server";

// Schreib-Actions des DAC7-Moduls.
//
// Die fachliche Prüfung liegt beim Backend: Es entscheidet, ob eine Meldung
// erzeugt werden darf, und liefert bei Mängeln einen Prüfbericht mit Fundort
// je Befund. Der wird hier 1:1 durchgereicht — ein generisches „Fehler" wäre
// hier besonders schädlich, weil der Nutzer sonst nicht weiß, welche Angabe
// welchem Verkäufer fehlt.
import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

import type {
  Meldeformat,
  Meldelauf,
  MeldungVorschau,
  Uebermittlungsergebnis,
} from "./dac7";

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
      token: (await currentToken()) ?? undefined,
    });
    // Nur beim echten Lauf: Ein Probelauf ändert nichts, was neu geladen
    // werden müsste.
    if (!probelauf) revalidatePath("/dac7");
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
      { method: "POST", token: (await currentToken()) ?? undefined },
    );
    revalidatePath("/dac7");
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
 *  Token, das nur serverseitig verfügbar ist. Der Browser bekommt den
 *  Inhalt und speichert ihn selbst.
 *
 *  Hier wird bewusst NICHT der gemeinsame `api()`-Helfer verwendet: Der
 *  parst jede Antwort als JSON und würde an einer CSV scheitern. Statt den
 *  Helfer für diesen einen Fall umzubauen, holt diese Funktion die Datei
 *  selbst — mit demselben Bearer. */
export async function holeMeldedatei(
  laufId: string,
  format: Meldeformat = "csv",
): Promise<
  { ok: true; inhalt: string; name: string } | { ok: false; error: string }
> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };

  const backend = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  let antwort: Response;
  try {
    antwort = await fetch(
      `${backend}/api/v1/taxpayer/dac7/laeufe/${encodeURIComponent(laufId)}/datei?format=${format}`,
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

  return { ok: true, inhalt, name: `dac7-${laufId}.${format}` };
}

/** Ob die Übermittlung eingerichtet ist.
 *
 *  Gefragt wird, um keinen Knopf anzubieten, der nur fehlschlagen kann. Ist
 *  sie es nicht, bleibt der bisherige Weg: Datei herunterladen und bei der
 *  Behörde hochladen. */
export async function uebermittlungEingerichtet(): Promise<boolean> {
  try {
    const stand = await api<{ eingerichtet: boolean }>(
      "/taxpayer/dac7/uebermittlung",
      { token: (await currentToken()) ?? undefined },
    );
    return stand.eingerichtet;
  } catch {
    // Ein Fehler heißt „nicht verfügbar" — nicht „verfügbar". Ein Knopf,
    // der nur fehlschlagen kann, ist schlimmer als keiner.
    return false;
  }
}

/** Die Meldung an die Empfangsstelle übermitteln.
 *
 *  ACHTUNG, der wichtigste Fall: `angenommen: null` heißt UNBEKANNT — die
 *  Antwort kam nicht an, die Datei kann die Behörde erreicht haben. Das
 *  darf die Oberfläche NIE zu „nicht gesendet" verkürzen: Der nächste Klick
 *  erzeugte dann eine Doppelmeldung, und der Vermieter würde doppelt
 *  veranlagt.
 *
 *  Deshalb ist auch `ok: true` kein „angenommen" — es heißt nur, dass der
 *  Aufruf zustande kam. Was die Gegenstelle gesagt hat, steht im Ergebnis. */
export async function uebermittleMeldung(
  laufId: string,
): Promise<
  | { ok: true; ergebnis: Uebermittlungsergebnis }
  | { ok: false; error: string }
> {
  try {
    const ergebnis = await api<Uebermittlungsergebnis>(
      `/taxpayer/dac7/laeufe/${encodeURIComponent(laufId)}/uebermitteln`,
      { method: "POST", token: (await currentToken()) ?? undefined },
    );
    revalidatePath("/dac7");
    return { ok: true, ergebnis };
  } catch (exc) {
    return {
      ok: false,
      error:
        exc instanceof ApiError
          ? exc.message
          : "Die Übermittlung war nicht möglich.",
    };
  }
}
