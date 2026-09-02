// Locale-Definition des Partner-Dashboards — die 24 EU-Amtssprachen, identisch
// zu marketing/i18n/locales.ts und web/i18n/locales.ts. Cookie-basiert (kein
// URL-Präfix), derselbe Cookie-Name `nd_locale`, damit die Sprachwahl von der
// Marketing-Seite (Programmseite /partner) hierher erhalten bleibt.
//
// HIER STEHEN NUR SPRACHEN, FÜR DIE ES EINE VOLLSTÄNDIGE messages/<code>.json
// GIBT — eine Sprache ohne Datei wäre deutscher Text unter fremdem Label.
export const DEFAULT_LOCALE = "en" as const;

export const LOCALES = [
  "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "ga", "hr",
  "hu", "it", "lt", "lv", "mt", "nl", "pl", "pt", "ro", "sk", "sl", "sv",
] as const;

export type Locale = (typeof LOCALES)[number];

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

export const LOCALE_COOKIE = "nd_locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
