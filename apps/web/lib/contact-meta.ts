// Metadaten für die Kontakt-/Profil-Bearbeitung: Sprachoptionen für
// „Bevorzugte Sprache" / „Gesprochene Sprachen". Telefon-Vorwahlen liegen
// zentral in lib/countries (alle 27 EU-Staaten + CH/UK) — hier bewusst KEINE
// zweite Kopie mit eigenem Default (Wurzel 4).

// Sprachoptionen für Profil-Felder (ISO-639-1).
export const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "English" },
  { value: "da", label: "Dansk" },
];

export function languageLabel(value: string): string {
  return LANGUAGE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
