// Sprachliste NUR für die Rechtstexte: Die Plattform-UI selbst ist (noch)
// einsprachig Deutsch, aber die Gast-AGB müssen EU-weit in allen 24
// Amtssprachen abrufbar sein. Codes identisch zu apps/web/i18n/locales.ts.
export const LEGAL_LOCALES = [
  "bg",
  "cs",
  "da",
  "de",
  "el",
  "en",
  "es",
  "et",
  "fi",
  "fr",
  "ga",
  "hr",
  "hu",
  "it",
  "lt",
  "lv",
  "mt",
  "nl",
  "pl",
  "pt",
  "ro",
  "sk",
  "sl",
  "sv",
] as const;

export type LegalLocale = (typeof LEGAL_LOCALES)[number];

export const DEFAULT_LEGAL_LOCALE: LegalLocale = "de";

// Anzeigenamen (in der jeweiligen Sprache selbst) für die Sprachauswahl.
export const LEGAL_LOCALE_LABELS: Record<LegalLocale, string> = {
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

export function isLegalLocale(
  value: string | undefined | null,
): value is LegalLocale {
  return !!value && (LEGAL_LOCALES as readonly string[]).includes(value);
}
