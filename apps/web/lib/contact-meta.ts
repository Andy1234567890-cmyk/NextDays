// Metadaten für die Kontakt-/Profil-Bearbeitung (Lodgify „Contact information"):
//  - Telefon-Ländervorwahlen (Auswahl der gängigsten Märkte; E.164-konform)
//  - Sprachoptionen (für „Bevorzugte Sprache" / „Gesprochene Sprachen")

export type DialCode = {
  code: string; // ISO-3166-1 alpha-2
  label: string; // Anzeigename inkl. Vorwahl
  dial: string; // internationale Vorwahl, z. B. "+45"
};

// Auf die für NextDays relevanten Märkte zugeschnitten (DK/DE/Nachbarn) +
// gängige internationale Vorwahlen. Reihenfolge = Anzeige im Dropdown.
export const DIAL_CODES: DialCode[] = [
  { code: "DK", label: "Dänemark (+45)", dial: "+45" },
  { code: "DE", label: "Deutschland (+49)", dial: "+49" },
  { code: "AT", label: "Österreich (+43)", dial: "+43" },
  { code: "CH", label: "Schweiz (+41)", dial: "+41" },
  { code: "NL", label: "Niederlande (+31)", dial: "+31" },
  { code: "SE", label: "Schweden (+46)", dial: "+46" },
  { code: "NO", label: "Norwegen (+47)", dial: "+47" },
  { code: "GB", label: "Vereinigtes Königreich (+44)", dial: "+44" },
  { code: "US", label: "USA (+1)", dial: "+1" },
];

export const DEFAULT_DIAL = "+45";

// Sprachoptionen für Profil-Felder (ISO-639-1).
export const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "English" },
  { value: "da", label: "Dansk" },
];

export function languageLabel(value: string): string {
  return LANGUAGE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

// Zerlegt eine E.164-Nummer in (Vorwahl, Rest) anhand der bekannten Vorwahlen.
export function splitPhone(value: string | null): { dial: string; rest: string } {
  if (!value) return { dial: DEFAULT_DIAL, rest: "" };
  const match = DIAL_CODES.map((d) => d.dial)
    .sort((a, b) => b.length - a.length) // längste zuerst (+45 vor +4)
    .find((d) => value.startsWith(d));
  if (match) return { dial: match, rest: value.slice(match.length).trim() };
  return { dial: DEFAULT_DIAL, rest: value };
}

// Setzt Vorwahl + Rest wieder zu einer E.164-Nummer zusammen (leer → "").
export function joinPhone(dial: string, rest: string): string {
  const digits = rest.replace(/[^\d]/g, "");
  return digits ? `${dial}${digits}` : "";
}
