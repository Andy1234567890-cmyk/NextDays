// Locale-Definition der Marketing-Site.
//
// Cookie-basiert (kein URL-Präfix) und mit demselben Cookie-Namen wie die
// web-App (`nd_locale`), damit die Sprachwahl beim Sprung von der
// Marketing-Site ins Dashboard erhalten bleibt.
//
// HIER STEHEN NUR SPRACHEN, FÜR DIE ES EINE VOLLSTÄNDIGE messages/<code>.json
// GIBT. Eine Sprache eintragen, ohne sie zu übersetzen, würde dem Besucher
// deutschen Text unter englischem Label zeigen — deshalb wächst diese Liste
// nur zusammen mit den Übersetzungsdateien. Zielbild sind die 24
// EU-Amtssprachen wie in web/i18n/locales.ts.
export const DEFAULT_LOCALE = "de" as const;

export const LOCALES = ["de", "en"] as const;

export type Locale = (typeof LOCALES)[number];

// Anzeigenamen in der jeweiligen Sprache selbst.
export const LOCALE_LABELS: Record<Locale, string> = {
  de: "Deutsch",
  en: "English",
};

export const LOCALE_COOKIE = "nd_locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
