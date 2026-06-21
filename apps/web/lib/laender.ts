// Zentrale Länderliste für Registrierung + Onboarding (Firmendaten).
// Start-Markt: DACH zuerst, dann alle EU-Länder. Währung pro Land (ISO 4217).
// Modell ist länderneutral (tenants.country = ISO-3166-1 alpha-2) — weltweit
// erweiterbar; hier bewusst auf DACH+EU+CH begrenzt (siehe Onboarding-Plan).

export type Land = {
  code: string; // ISO-3166-1 alpha-2
  label: string;
  currency: string; // ISO-4217
};

// DACH bewusst zuerst (häufigste Kunden), danach übrige EU alphabetisch.
export const LAENDER: readonly Land[] = [
  { code: "DE", label: "Deutschland", currency: "EUR" },
  { code: "AT", label: "Österreich", currency: "EUR" },
  { code: "CH", label: "Schweiz", currency: "CHF" },
  // übrige EU
  { code: "BE", label: "Belgien", currency: "EUR" },
  { code: "BG", label: "Bulgarien", currency: "BGN" },
  { code: "HR", label: "Kroatien", currency: "EUR" },
  { code: "CY", label: "Zypern", currency: "EUR" },
  { code: "CZ", label: "Tschechien", currency: "CZK" },
  { code: "DK", label: "Dänemark", currency: "DKK" },
  { code: "EE", label: "Estland", currency: "EUR" },
  { code: "FI", label: "Finnland", currency: "EUR" },
  { code: "FR", label: "Frankreich", currency: "EUR" },
  { code: "GR", label: "Griechenland", currency: "EUR" },
  { code: "HU", label: "Ungarn", currency: "HUF" },
  { code: "IE", label: "Irland", currency: "EUR" },
  { code: "IT", label: "Italien", currency: "EUR" },
  { code: "LV", label: "Lettland", currency: "EUR" },
  { code: "LT", label: "Litauen", currency: "EUR" },
  { code: "LU", label: "Luxemburg", currency: "EUR" },
  { code: "MT", label: "Malta", currency: "EUR" },
  { code: "NL", label: "Niederlande", currency: "EUR" },
  { code: "PL", label: "Polen", currency: "PLN" },
  { code: "PT", label: "Portugal", currency: "EUR" },
  { code: "RO", label: "Rumänien", currency: "RON" },
  { code: "SK", label: "Slowakei", currency: "EUR" },
  { code: "SI", label: "Slowenien", currency: "EUR" },
  { code: "ES", label: "Spanien", currency: "EUR" },
  { code: "SE", label: "Schweden", currency: "SEK" },
];

export function currencyForCountry(code: string): string {
  return LAENDER.find((l) => l.code === code)?.currency ?? "EUR";
}

// Gängige Rechtsformen (länderneutral genug für DACH+EU; Freitext erlaubt).
export const RECHTSFORMEN: readonly string[] = [
  "Einzelunternehmen",
  "GbR",
  "GmbH",
  "UG (haftungsbeschränkt)",
  "GmbH & Co. KG",
  "OG / OHG",
  "KG",
  "e.K.",
  "AG",
  "Andere",
];
