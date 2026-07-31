// Locale-Definition der Marketing-Site.
//
// Cookie-basiert (kein URL-Präfix) und mit demselben Cookie-Namen wie die
// web-App (`nd_locale`), damit die Sprachwahl beim Sprung von der
// Marketing-Site ins Dashboard erhalten bleibt.
//
// HIER STEHEN NUR SPRACHEN, FÜR DIE ES EINE VOLLSTÄNDIGE messages/<code>.json
// GIBT. Eine Sprache eintragen, ohne sie zu übersetzen, würde dem Besucher
// deutschen Text unter englischem Label zeigen — deshalb wächst diese Liste
// nur zusammen mit den Übersetzungsdateien.
//
// Umfang = die 24 EU-Amtssprachen, identisch zu web/i18n/locales.ts: die EU hat
// 27 Mitgliedsstaaten, aber 24 Amtssprachen (mehrere Länder teilen sich eine,
// z. B. DE/AT → Deutsch). Bewusst KEINE außereuropäischen Sprachen — wir spielen
// EU-weit aus; eine Sprache ohne Markt wäre eine leere Zusage.
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

// Anzeigenamen in der jeweiligen Sprache selbst (Endonym) — so wie Airbnb und
// Booking es zeigen: wer seine Sprache sucht, erkennt sie nur im Endonym.
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

// Region unter dem Sprachnamen (Referenz-UX Airbnb: „Deutsch / Deutschland").
// Ebenfalls im Endonym, damit Zeile 1 und 2 nicht die Sprache wechseln.
export const LOCALE_REGIONS: Record<Locale, string> = {
  bg: "България",
  cs: "Česká republika",
  da: "Danmark",
  de: "Deutschland",
  el: "Ελλάδα",
  en: "Ireland",
  es: "España",
  et: "Eesti",
  fi: "Suomi",
  fr: "France",
  ga: "Éire",
  hr: "Hrvatska",
  hu: "Magyarország",
  it: "Italia",
  lt: "Lietuva",
  lv: "Latvija",
  mt: "Malta",
  nl: "Nederland",
  pl: "Polska",
  pt: "Portugal",
  ro: "România",
  sk: "Slovensko",
  sl: "Slovenija",
  sv: "Sverige",
};

export const LOCALE_COOKIE = "nd_locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
