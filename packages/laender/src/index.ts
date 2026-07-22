// Geteilte Länderliste (EU27 + CH/GB) — Single Source über alle Frontends.
// Code + deutscher Anzeigename + Währung (ISO-4217). Währung IMMER aus dem Land
// ableiten (Wurzel 4: kein €-Hardcode; die 27 EU-Länder haben nicht alle den Euro).
//
// Bewusst SCHLANK: nur der geteilte Länder-Kern. App-spezifische Erweiterungen
// (z. B. Rechtsform-/Steuer-Logik im PMS-Onboarding) bleiben in der jeweiligen App
// — das ist keine echte fachliche Duplikation (andrena: „nicht jeder ähnliche Code
// ist Duplikation"), sondern app-eigene Fachlichkeit auf demselben Ländersatz.

export type Land = {
  code: string; // ISO-3166-1 alpha-2
  name: string; // deutscher Anzeigename
  currency: string; // ISO-4217
};

// DACH bewusst zuerst (häufigste Kunden), danach übrige EU alphabetisch + GB.
export const LAENDER: readonly Land[] = [
  { code: "DE", name: "Deutschland", currency: "EUR" },
  { code: "AT", name: "Österreich", currency: "EUR" },
  { code: "CH", name: "Schweiz", currency: "CHF" },
  { code: "BE", name: "Belgien", currency: "EUR" },
  { code: "BG", name: "Bulgarien", currency: "BGN" },
  { code: "HR", name: "Kroatien", currency: "EUR" },
  { code: "CY", name: "Zypern", currency: "EUR" },
  { code: "CZ", name: "Tschechien", currency: "CZK" },
  { code: "DK", name: "Dänemark", currency: "DKK" },
  { code: "EE", name: "Estland", currency: "EUR" },
  { code: "FI", name: "Finnland", currency: "EUR" },
  { code: "FR", name: "Frankreich", currency: "EUR" },
  { code: "GR", name: "Griechenland", currency: "EUR" },
  { code: "HU", name: "Ungarn", currency: "HUF" },
  { code: "IE", name: "Irland", currency: "EUR" },
  { code: "IT", name: "Italien", currency: "EUR" },
  { code: "LV", name: "Lettland", currency: "EUR" },
  { code: "LT", name: "Litauen", currency: "EUR" },
  { code: "LU", name: "Luxemburg", currency: "EUR" },
  { code: "MT", name: "Malta", currency: "EUR" },
  { code: "NL", name: "Niederlande", currency: "EUR" },
  { code: "PL", name: "Polen", currency: "PLN" },
  { code: "PT", name: "Portugal", currency: "EUR" },
  { code: "RO", name: "Rumänien", currency: "RON" },
  { code: "SK", name: "Slowakei", currency: "EUR" },
  { code: "SI", name: "Slowenien", currency: "EUR" },
  { code: "ES", name: "Spanien", currency: "EUR" },
  { code: "SE", name: "Schweden", currency: "SEK" },
  { code: "GB", name: "Vereinigtes Königreich", currency: "GBP" },
];

// Währung zum Ländercode. Wurzel 4: bei unbekanntem Code KEIN erfundenes EUR —
// leer zurückgeben, der Aufrufer erzwingt fail-closed eine echte Länderwahl.
export function currencyForCountry(code: string): string {
  return LAENDER.find((l) => l.code === code)?.currency ?? "";
}
