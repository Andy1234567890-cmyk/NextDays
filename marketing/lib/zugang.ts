// Zugangssperre der Marketing-Site: gemeinsame Logik für die Middleware
// (Edge-Runtime) und den Anmelde-Endpunkt.
//
// Warum Web Crypto und nicht `node:crypto`: die Middleware läuft in der
// Edge-Runtime, dort gibt es kein `node:crypto`. `crypto.subtle` steht in
// beiden Umgebungen zur Verfügung — eine Datei für beide Seiten, statt zwei
// Kopien, die auseinanderlaufen.
//
// Das Passwort steht AUSSCHLIESSLICH in `MARKETING_ZUGANG_PASSWORT` (Laufzeit,
// bewusst OHNE `NEXT_PUBLIC_`-Präfix — sonst läge es im Browser-Bundle).
// Fehlt es, ist das ein Konfigurationsfehler und KEIN Grund, die Seite zu
// öffnen: der Aufrufer sperrt dann alles (fail-closed, Wurzel 5). Es gibt
// keinen Ersatzwert und kein eingebautes Passwort (Wurzel 4).

/** Name des Sitzungs-Cookies. `nd_`-Präfix wie die übrigen Cookies der Site. */
export const ZUGANG_COOKIE = "nd_zugang";

/** Gültigkeitsdauer einer Anmeldung: 7 Tage. */
export const ZUGANG_DAUER_MS = 7 * 24 * 60 * 60 * 1000;

/** Pfad der Anmeldeseite. */
export const ZUGANG_PFAD = "/zugang";

const kodierer = new TextEncoder();

/**
 * Das gesetzte Passwort — oder `null`, wenn keines konfiguriert ist.
 * Leerzeichen am Rand werden entfernt: ein Wert, der in Coolify versehentlich
 * mit Zeilenumbruch gespeichert wurde, soll nicht zu einem stillen
 * „Passwort stimmt nie" führen.
 */
export function zugangsPasswort(): string | null {
  const wert = process.env.MARKETING_ZUGANG_PASSWORT?.trim();
  return wert ? wert : null;
}

/** Vergleicht zwei gleich lange Bytefolgen ohne frühzeitigen Abbruch. */
function zeitkonstantGleich(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let abweichung = 0;
  for (let i = 0; i < a.length; i += 1) abweichung |= a[i] ^ b[i];
  return abweichung === 0;
}

async function hmac(schluessel: string, nachricht: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    kodierer.encode(schluessel),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatur = await crypto.subtle.sign("HMAC", key, kodierer.encode(nachricht));
  return new Uint8Array(signatur);
}

function alsHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function ausHex(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/**
 * Prüft eine Passworteingabe gegen das gesetzte Passwort.
 *
 * Beide Seiten werden ZUERST gehasht und dann zeitkonstant verglichen. Der
 * Umweg über den Hash ist der Punkt: er macht beide Seiten gleich lang, sodass
 * der Vergleich nicht über seine Laufzeit die Passwortlänge verrät. Ein
 * direktes `===` auf den Zeichenketten bricht beim ersten Unterschied ab und
 * ist damit messbar (Wurzel 5).
 */
export async function passwortStimmt(eingabe: string, erwartet: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", kodierer.encode(eingabe)),
    crypto.subtle.digest("SHA-256", kodierer.encode(erwartet)),
  ]);
  return zeitkonstantGleich(new Uint8Array(a), new Uint8Array(b));
}

/**
 * Baut den Cookie-Wert für eine gültige Sitzung: `<ablauf>.<signatur>`.
 *
 * Signiert wird mit dem Passwort als Schlüssel. Das hat eine erwünschte
 * Nebenwirkung: wird das Passwort in Coolify geändert, sind ALLE ausgegebenen
 * Cookies sofort ungültig — ein Passwortwechsel sperrt also wirklich aus,
 * statt nur die nächste Anmeldung zu betreffen.
 */
export async function sitzungAusstellen(passwort: string, jetzt = Date.now()): Promise<string> {
  const ablauf = jetzt + ZUGANG_DAUER_MS;
  return `${ablauf}.${alsHex(await hmac(passwort, `nd-zugang:${ablauf}`))}`;
}

/** Prüft einen Cookie-Wert auf Echtheit und Gültigkeitsdauer. */
export async function sitzungGueltig(
  wert: string | undefined,
  passwort: string,
  jetzt = Date.now(),
): Promise<boolean> {
  if (!wert) return false;
  const trenner = wert.indexOf(".");
  if (trenner <= 0) return false;

  const ablauf = Number(wert.slice(0, trenner));
  if (!Number.isSafeInteger(ablauf) || ablauf <= jetzt) return false;

  const geliefert = ausHex(wert.slice(trenner + 1));
  if (!geliefert) return false;

  return zeitkonstantGleich(geliefert, await hmac(passwort, `nd-zugang:${ablauf}`));
}
