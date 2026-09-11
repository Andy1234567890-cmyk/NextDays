// Geteilte Länderliste (EU27 + CH/GB) — Single Source über alle Frontends.
// Code + Währung (ISO-4217) + länderspezifisches Formwissen. Währung IMMER aus
// dem Land ableiten (Wurzel 4: kein €-Hardcode; die 27 EU-Länder haben nicht
// alle den Euro).
//
// Bewusst SCHLANK: nur der geteilte Länder-Kern. App-spezifische Erweiterungen
// (z. B. Rechtsform-/Steuer-Logik im PMS-Onboarding) bleiben in der jeweiligen App
// — das ist keine echte fachliche Duplikation (andrena: „nicht jeder ähnliche Code
// ist Duplikation"), sondern app-eigene Fachlichkeit auf demselben Ländersatz.
//
// Der ANZEIGENAME steht hier NICHT mehr. Bis zum 10.09.2026 trug `Land.name`
// den deutschen Namen („Deutschland", „Österreich"), und alle vier Aufrufer
// rendern ihn roh — ein polnischer Partner wählte aus einer deutschen Liste.
// Ein Name ist kein Länderstammdatum, sondern eine Übersetzung: er entsteht
// beim Rendern aus der Sprache des Nutzers (`landName(code, locale)`), genau
// wie in `marketing/lib/partner-bewerbung.ts`.

export type Land = {
  code: string; // ISO-3166-1 alpha-2 — der einzige gespeicherte Wert
  currency: string; // ISO-4217
};

// DACH bewusst zuerst (häufigste Kunden), danach übrige EU alphabetisch + GB.
export const LAENDER: readonly Land[] = [
  { code: "DE", currency: "EUR" },
  { code: "AT", currency: "EUR" },
  { code: "CH", currency: "CHF" },
  { code: "BE", currency: "EUR" },
  { code: "BG", currency: "BGN" },
  { code: "HR", currency: "EUR" },
  { code: "CY", currency: "EUR" },
  { code: "CZ", currency: "CZK" },
  { code: "DK", currency: "DKK" },
  { code: "EE", currency: "EUR" },
  { code: "FI", currency: "EUR" },
  { code: "FR", currency: "EUR" },
  { code: "GR", currency: "EUR" },
  { code: "HU", currency: "HUF" },
  { code: "IE", currency: "EUR" },
  { code: "IT", currency: "EUR" },
  { code: "LV", currency: "EUR" },
  { code: "LT", currency: "EUR" },
  { code: "LU", currency: "EUR" },
  { code: "MT", currency: "EUR" },
  { code: "NL", currency: "EUR" },
  { code: "PL", currency: "PLN" },
  { code: "PT", currency: "EUR" },
  { code: "RO", currency: "RON" },
  { code: "SK", currency: "EUR" },
  { code: "SI", currency: "EUR" },
  { code: "ES", currency: "EUR" },
  { code: "SE", currency: "SEK" },
  { code: "GB", currency: "GBP" },
];

// Währung zum Ländercode. Wurzel 4: bei unbekanntem Code KEIN erfundenes EUR —
// leer zurückgeben, der Aufrufer erzwingt fail-closed eine echte Länderwahl.
export function currencyForCountry(code: string): string {
  return LAENDER.find((l) => l.code === code)?.currency ?? "";
}

// ───────────────────────────── Anzeigename ──────────────────────────────
//
// Der Name entsteht beim Rendern aus dem ISO-Code und der Sprache des
// Nutzers. `Intl.DisplayNames` kennt jeden gültigen Code, kann also nicht
// unvollständig sein, und liefert bei Unbekanntem den Code zurück statt einen
// Namen zu erfinden (Wurzel 4).

/** `Intl.DisplayNames` ist pro Aufruf teuer und eine Länderauswahl rendert
 *  Dutzende Optionen — je Sprache genau einmal bauen. */
const ANZEIGE_CACHE = new Map<string, Intl.DisplayNames>();

function anzeige(locale: string): Intl.DisplayNames {
  const vorhanden = ANZEIGE_CACHE.get(locale);
  if (vorhanden) return vorhanden;
  const neu = new Intl.DisplayNames([locale], {
    type: "region",
    fallback: "code",
  });
  ANZEIGE_CACHE.set(locale, neu);
  return neu;
}

/** Ländername zum ISO-Code in der angegebenen Sprache.
 *  Unbekannte oder ungültige Codes kommen unverändert zurück. */
export function landName(code: string, locale: string): string {
  const iso = code.trim().toUpperCase();
  if (iso.length !== 2) return iso;
  try {
    return anzeige(locale).of(iso) ?? iso;
  } catch {
    // Ungültige Codes (z. B. Ziffern) lässt `of` werfen — dann ist der Code
    // selbst die ehrlichste Anzeige.
    return iso;
  }
}

/** `LAENDER`, sortiert nach dem Namen IN DIESER SPRACHE.
 *
 *  Für Auswahllisten: die feste DACH-zuerst-Reihenfolge hilft einem deutschen
 *  Kunden, einem polnischen sagt sie nichts — dort zählt das Alphabet SEINER
 *  Sprache. Die Sortierung übernimmt `localeCompare` mit derselben Locale. */
export function laenderNachName(
  locale: string,
): readonly (Land & { name: string })[] {
  return LAENDER.map((l) => ({ ...l, name: landName(l.code, locale) })).sort(
    (a, b) => a.name.localeCompare(b.name, locale),
  );
}

// ───────────────────────── USt-IdNr.-Beispiele ──────────────────────────
//
// Was in einem Land tatsächlich auf dem Steuerbescheid steht — kein Rateformat.
// Quelle: EU-Kommission, „VAT identification number structure" (TAXUD, Anhang
// zum VIES-Dienst) je Mitgliedstaat; CH aus dem UID-Register der ESTV, GB aus
// HMRC VAT Notice 700.
//
// Warum es das zentral gibt: vier Formulare in `partner` und `marketing`
// trugen fest `placeholder="DE123456789"` NEBEN einer Länderauswahl, die nicht
// nachzog — ein dänischer Partner las ein deutsches Beispiel und tippte eine
// Nummer, die es in DK nicht gibt. Die Liste lag zugleich in `web/lib/laender.ts`;
// sie steht jetzt hier und `web` re-exportiert sie, damit es EINE Quelle bleibt.
const VAT_BEISPIEL_NACH_LAND: Readonly<Record<string, string>> = {
  DE: "DE123456789", // 9 Ziffern
  AT: "ATU12345678", // U + 8 Ziffern
  CH: "CHE-123.456.789 MWST", // ESTV UID/MWST (Nicht-EU)
  BE: "BE0123456789", // 10 Ziffern (führende 0/1)
  BG: "BG123456789", // 9 oder 10 Ziffern
  HR: "HR12345678901", // 11 Ziffern
  CY: "CY12345678L", // 8 Ziffern + 1 Buchstabe
  CZ: "CZ12345678", // 8, 9 oder 10 Ziffern
  DK: "DK12345678", // 8 Ziffern
  EE: "EE123456789", // 9 Ziffern
  FI: "FI12345678", // 8 Ziffern
  FR: "FRXX123456789", // 2 Prüfzeichen + 9 Ziffern (SIREN)
  GR: "EL123456789", // Präfix EL, 9 Ziffern
  HU: "HU12345678", // 8 Ziffern
  IE: "IE1234567L", // 7 Zeichen + 1–2 Buchstaben
  IT: "IT12345678901", // 11 Ziffern
  LV: "LV12345678901", // 11 Ziffern
  LT: "LT123456789", // 9 oder 12 Ziffern
  LU: "LU12345678", // 8 Ziffern
  MT: "MT12345678", // 8 Ziffern
  NL: "NL123456789B01", // 9 Ziffern + B + 2 Ziffern
  PL: "PL1234567890", // 10 Ziffern
  PT: "PT123456789", // 9 Ziffern
  RO: "RO123456789", // 2–10 Ziffern
  SK: "SK1234567890", // 10 Ziffern
  SI: "SI12345678", // 8 Ziffern
  ES: "ESX1234567X", // Zeichen + 7 Ziffern + Zeichen
  SE: "SE123456789012", // 12 Ziffern
  GB: "GB123456789", // 9 Ziffern (HMRC, seit dem Brexit kein VIES-Land)
};

/** Platzhalter-Beispiel für die USt-IdNr. eines Landes.
 *
 *  Leer, solange kein Land gewählt ist oder das Format nicht belegt ist:
 *  Wurzel 4 — ein zusammengebautes `XX123456789` sähe echt aus und wäre
 *  geraten. Ein leerer Platzhalter ist ehrlich, ein falscher führt in die Irre. */
export function vatBeispielFuerLand(code: string): string {
  return VAT_BEISPIEL_NACH_LAND[code.trim().toUpperCase()] ?? "";
}

// ──────────────────────────── Registergericht ───────────────────────────
//
// Länder, in denen das Handelsregister von einem GERICHT geführt wird und ein
// Betrieb deshalb ein „Registergericht" angeben kann.
//
// In der EU führt das Register je Land ein Gericht, eine Handelskammer oder
// eine Behörde (EU-Justizportal, „Business registers in EU countries"). Nur im
// ersten Fall existiert ein Registergericht. Dänemark etwa hat ausschließlich
// die zentrale CVR-Nummer der Erhvervsstyrelsen — dort nach einem
// Registergericht zu fragen, ist eine Frage ohne Antwort, und der Nutzer sucht
// den Fehler bei sich (genau so gemeldet für AirSmil, DK).
//
// Bewusst eine ALLOWLIST (Wurzel 5, fail-closed): ein Land, dessen System hier
// nicht belegt ist, bekommt das Feld NICHT. Ein zu viel gezeigtes Feld verlangt
// eine Angabe, die es nicht gibt; ein zu wenig gezeigtes ist ein optionales
// Feld weniger — die harmlosere Richtung.
const REGISTERGERICHT_LAENDER: ReadonlySet<string> = new Set([
  "DE", // Amtsgericht als Registergericht (HRA/HRB)
  "AT", // Firmenbuchgericht (Landes-/Handelsgericht)
  "PL", // Krajowy Rejestr Sądowy, geführt von den Bezirksgerichten
  "HU", // Firmengericht (cégbíróság)
  "CZ", // Handelsregister bei den Kreisgerichten
  "SK", // Obchodný register bei den Bezirksgerichten
  "SI", // Registergericht (sodni register)
  "HR", // Handelsgericht (trgovački sud)
  "BG", // historisch gerichtlich geführt, Angabe weiterhin üblich
  "LU", // Registre de commerce et des sociétés, gerichtlich verankert
  "BE", // Kruispuntbank/BCE über die Unternehmensgerichte
]);

/** Führt dieses Land ein gerichtliches Handelsregister? */
export function hatRegistergericht(code: string): boolean {
  return REGISTERGERICHT_LAENDER.has(code.trim().toUpperCase());
}

// ──────────────────────── Verwaltungsebene (Region) ─────────────────────
//
// Länder mit einer echten, im Register geführten Verwaltungsebene unterhalb
// des Staates — Bundesland, Provinz, Region, Grafschaft. Nur dort ergibt eine
// Adresszeile „Bundesland/Region" Sinn.
//
// Dänemark kennt seit der Kommunalreform 2007 nur Kommunen und Regionen, und
// KEINE davon steht in einer Firmenadresse; Stripe verlangt `address.state`
// für DK, LU, MT, SI, BE, NL und weitere Kleinstaaten dementsprechend NICHT
// (Stripe „Required verification information" je Land). Ein Pflichtfeld, das
// es nicht gibt, hält den Nutzer auf und er sucht den Fehler bei sich.
//
// Wieder ALLOWLIST und fail-closed in dieselbe Richtung: ein nicht belegtes
// Land bekommt das Feld nicht (ein optionales Feld weniger) statt eine Angabe
// zu verlangen, die dort keinen Namen hat.
const REGION_LAENDER: ReadonlySet<string> = new Set([
  "DE", // Bundesland
  "AT", // Bundesland
  "CH", // Kanton
  "ES", // Comunidad autónoma / Provincia
  "IT", // Regione / Provincia
  "PL", // Województwo
  "RO", // Județ
  "GR", // Περιφέρεια
  "PT", // Distrito
  "IE", // County
  "GB", // County
  "FR", // Région (in Adressen üblich, im RCS geführt)
]);

/** Kennt dieses Land eine Verwaltungsebene, die in eine Adresse gehört? */
export function hatRegion(code: string): boolean {
  return REGION_LAENDER.has(code.trim().toUpperCase());
}
