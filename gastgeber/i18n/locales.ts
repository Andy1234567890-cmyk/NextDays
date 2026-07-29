// Locale-Definition des Gastgeber-Dashboards.
//
// Umfang: weltweit. Grundlage ist das, was Airbnb UND Booking.com tatsächlich
// ausliefern (belegt durch Locale-Proben gegen beide Anbieter, Juli 2026) —
// nicht die 24 EU-Amtssprachen, mit denen web/ gestartet ist. Wer weltweit
// verkauft, braucht Japanisch und Türkisch dringender als Maltesisch.
//
// Irisch und Maltesisch führt keiner der beiden Anbieter; wir behalten sie
// trotzdem, weil sie EU-Amtssprachen sind und web/ sie bereits übersetzt hat.
// Streichen wäre ein Rückschritt hinter den vorhandenen Stand.
//
// `de` ist Quell-/Basissprache: nur diese Datei wird von Hand gepflegt, alle
// anderen werden daraus übersetzt. Sprachwahl ist Cookie-basiert (kein
// URL-Präfix), damit bestehende Routen unverändert bleiben.
//
// WICHTIG: In LOCALES darf nur stehen, wofür es eine messages/<code>.json
// gibt. Eine Sprache in der Auswahl, die dann doch Deutsch anzeigt, ist die
// Attrappe, die wir gerade abschaffen (Wurzel 4 — keine Fantasiewerte).
export const DEFAULT_LOCALE = "de" as const;

export const LOCALES = [
  // Westeuropa
  "de", "en", "en-GB", "fr", "es", "it", "pt-PT", "pt-BR", "nl", "ca",
  // Nordeuropa
  "da", "sv", "no", "fi", "is",
  // Baltikum
  "et", "lv", "lt",
  // Mittel-/Osteuropa
  "pl", "cs", "sk", "sl", "hu", "ro", "bg", "hr", "sr", "el", "ru", "uk",
  // EU-Amtssprachen ohne OTA-Vorbild (Bestand aus web/)
  "ga", "mt",
  // Naher Osten
  "tr", "ar", "he",
  // Asien
  "ja", "ko", "zh-Hans", "zh-Hant", "th", "vi", "id", "ms", "tl", "hi",
] as const;

export type Locale = (typeof LOCALES)[number];

/** Sprachen, die von rechts nach links gesetzt werden.
 *
 *  Genau diese zwei — dieselben, die Airbnb und Booking fahren. Persisch und
 *  Urdu bietet keiner von beiden an; wir führen sie deshalb auch nicht, statt
 *  Sprachen zu tragen, für die wir keine Pflege haben. */
export const RTL_LOCALES: readonly Locale[] = ["ar", "he"];

export function isRtl(locale: string): boolean {
  return (RTL_LOCALES as readonly string[]).includes(locale);
}

/** Leserichtung für das `dir`-Attribut am <html>-Element. */
export function textrichtung(locale: string): "rtl" | "ltr" {
  return isRtl(locale) ? "rtl" : "ltr";
}

// Sprachnamen IN DER JEWEILIGEN SPRACHE (Endonym) — so macht es Airbnb, und
// so findet ein Japaner „日本語" auch dann, wenn die Oberfläche gerade
// bulgarisch ist. Intl.DisplayNames wäre die Laufzeitquelle, liefert den
// Namen aber in der AKTIVEN Sprache statt in der eigenen.
export const LOCALE_LABELS: Record<Locale, string> = {
  de: "Deutsch",
  en: "English (US)",
  "en-GB": "English (UK)",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  "pt-PT": "Português (PT)",
  "pt-BR": "Português (BR)",
  nl: "Nederlands",
  ca: "Català",
  da: "Dansk",
  sv: "Svenska",
  no: "Norsk",
  fi: "Suomi",
  is: "Íslenska",
  et: "Eesti",
  lv: "Latviešu",
  lt: "Lietuvių",
  pl: "Polski",
  cs: "Čeština",
  sk: "Slovenčina",
  sl: "Slovenščina",
  hu: "Magyar",
  ro: "Română",
  bg: "Български",
  hr: "Hrvatski",
  sr: "Srpski",
  el: "Ελληνικά",
  ru: "Русский",
  uk: "Українська",
  ga: "Gaeilge",
  mt: "Malti",
  tr: "Türkçe",
  ar: "العربية",
  he: "עברית",
  ja: "日本語",
  ko: "한국어",
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文",
  th: "ไทย",
  vi: "Tiếng Việt",
  id: "Bahasa Indonesia",
  ms: "Bahasa Melayu",
  tl: "Filipino",
  hi: "हिन्दी",
};

// Name des Cookies, in dem die gewählte Sprache liegt (getrennt von web via host).
export const LOCALE_COOKIE = "nd_locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
