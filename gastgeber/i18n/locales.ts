// Locale-Definition des Gastgeber-Dashboards. Gleiches Muster wie web/ (EU-weit,
// Cookie-basiert, kein URL-Präfix). `de` ist Quell-/Basissprache. Start mit den
// vollständigen 24 EU-Amtssprachen wie web — Übersetzungen wachsen nach.
export const DEFAULT_LOCALE = "de" as const;

export const LOCALES = [
  "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "ga", "hr",
  "hu", "it", "lt", "lv", "mt", "nl", "pl", "pt", "ro", "sk", "sl", "sv",
] as const;

export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  bg: "Български", cs: "Čeština", da: "Dansk", de: "Deutsch", el: "Ελληνικά",
  en: "English", es: "Español", et: "Eesti", fi: "Suomi", fr: "Français",
  ga: "Gaeilge", hr: "Hrvatski", hu: "Magyar", it: "Italiano", lt: "Lietuvių",
  lv: "Latviešu", mt: "Malti", nl: "Nederlands", pl: "Polski", pt: "Português",
  ro: "Română", sk: "Slovenčina", sl: "Slovenščina", sv: "Svenska",
};

// Name des Cookies, in dem die gewählte Sprache liegt (getrennt von web via host).
export const LOCALE_COOKIE = "nd_locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
