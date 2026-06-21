// Zentrale Locale-Definition. Wir spielen EU-weit aus.
// Die EU hat 27 Mitgliedsstaaten, aber 24 Amtssprachen (mehrere Länder teilen
// sich eine Sprache, z. B. DE/AT → Deutsch, FR/BE/LU → Französisch) → daher
// 24 Sprachen, nicht 27.
// `de` ist die Quell-/Basissprache (von Hand gepflegt), `en` die Brücke.
// Sprachwahl ist Cookie-basiert (kein URL-Präfix), damit bestehende Routen/Links
// unverändert bleiben.

export const DEFAULT_LOCALE = "de" as const;

// ISO-639-1 Codes der 24 EU-Amtssprachen.
export const LOCALES = [
  "bg", // Bulgarisch
  "cs", // Tschechisch
  "da", // Dänisch
  "de", // Deutsch (Basis)
  "el", // Griechisch
  "en", // Englisch
  "es", // Spanisch
  "et", // Estnisch
  "fi", // Finnisch
  "fr", // Französisch
  "ga", // Irisch
  "hr", // Kroatisch
  "hu", // Ungarisch
  "it", // Italienisch
  "lt", // Litauisch
  "lv", // Lettisch
  "mt", // Maltesisch
  "nl", // Niederländisch
  "pl", // Polnisch
  "pt", // Portugiesisch
  "ro", // Rumänisch
  "sk", // Slowakisch
  "sl", // Slowenisch
  "sv", // Schwedisch
] as const;

export type Locale = (typeof LOCALES)[number];

// Anzeigenamen (in der jeweiligen Sprache selbst) für den Umschalter.
export const LOCALE_LABELS: Record<Locale, string> = {
  bg: "Български",
  cs: "Čeština",
  da: "Dansk",
  de: "Deutsch",
  el: "Ελληνικά",
  en: "English",
  es: "Español",
  et: "Eesti",
  fi: "Suomi",
  fr: "Français",
  ga: "Gaeilge",
  hr: "Hrvatski",
  hu: "Magyar",
  it: "Italiano",
  lt: "Lietuvių",
  lv: "Latviešu",
  mt: "Malti",
  nl: "Nederlands",
  pl: "Polski",
  pt: "Português",
  ro: "Română",
  sk: "Slovenčina",
  sl: "Slovenščina",
  sv: "Svenska",
};

// Name des Cookies, in dem die gewählte Sprache liegt.
export const LOCALE_COOKIE = "nd_locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

// Mapping Land (ISO-3166-1) → bevorzugte Locale, für Auto-Erkennung beim ersten
// Besuch (z. B. aus den Firmendaten oder Accept-Language). Nur EU + CH.
export const LOCALE_FOR_COUNTRY: Record<string, Locale> = {
  DE: "de",
  AT: "de",
  CH: "de",
  BE: "nl",
  BG: "bg",
  HR: "hr",
  CY: "el",
  CZ: "cs",
  DK: "da",
  EE: "et",
  FI: "fi",
  FR: "fr",
  GR: "el",
  HU: "hu",
  IE: "en",
  IT: "it",
  LV: "lv",
  LT: "lt",
  LU: "fr",
  MT: "mt",
  NL: "nl",
  PL: "pl",
  PT: "pt",
  RO: "ro",
  SK: "sk",
  SI: "sl",
  ES: "es",
  SE: "sv",
};
