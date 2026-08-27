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

// Flagge je Sprache, als Iconify-Name (twemoji) und als Unicode-Emoji.
//
// Zwei Formen, weil es zwei Rendering-Wege gibt und keiner den anderen kann:
// wo HTML erlaubt ist, ist twemoji die bessere Wahl (das Emoji sieht auf jedem
// System anders aus, und aeltere Windows-Fassungen tragen fuer die
// Regional-Indicator-Paare gar keine Glyphe). Ein natives `<option>` dagegen
// rendert AUSSCHLIESSLICH Text; dort bliebe ein Symbol unsichtbar.
//
// Eine Sprache deckt sich nicht mit einem Land: die Flagge ist die schnelle
// Wiedererkennung, das Endonym daneben die verbindliche Angabe. Sie steht
// deshalb NEBEN dem Wort, nie an seiner Stelle.
//
// Diese Liste ist LAENGER als die der uebrigen Frontends, weil das
// Gastgeber-Dashboard 44 Sprachen fuehrt statt der 24 EU-Amtssprachen. Sie ist
// zugleich genauer: wo web/ eine mehrlaendrige Sprache auf ein Land zwingen
// muss (`en` auf GB), traegt diese Liste die Regionalfassungen getrennt
// (en/en-GB, pt-PT/pt-BR, zh-Hans/zh-Hant) und gibt jeder ihr eigenes Land.
//
// Zwei Sprachen haben kein Land, dessen Flagge sie tragen koennten:
//   * ca (Catala)   - Katalonien ist kein Staat; die Senyera gibt es als
//                     Unterregion-Flagge, ihr Emoji stellen viele Systeme
//                     nicht dar.
//   * ar (Arabisch) - Amtssprache in 22 Staaten, keiner davon namensgebend.
// Fuer beide steht deshalb das Sprach-Symbol `ph:translate` bzw. das
// Buch-Emoji als ehrlicher Platzhalter. Eine erfundene Flagge waere eine
// Falschaussage ueber das Land (Wurzel 4: kein plausibler Ersatzwert).
// Hebraeisch (he) ist unproblematisch, IL ist eindeutig.
export const LOCALE_FLAGS: Record<Locale, string> = {
  de: "twemoji:flag-germany",
  en: "twemoji:flag-united-states",
  "en-GB": "twemoji:flag-united-kingdom",
  fr: "twemoji:flag-france",
  es: "twemoji:flag-spain",
  it: "twemoji:flag-italy",
  "pt-PT": "twemoji:flag-portugal",
  "pt-BR": "twemoji:flag-brazil",
  nl: "twemoji:flag-netherlands",
  ca: "ph:translate",
  da: "twemoji:flag-denmark",
  sv: "twemoji:flag-sweden",
  no: "twemoji:flag-norway",
  fi: "twemoji:flag-finland",
  is: "twemoji:flag-iceland",
  et: "twemoji:flag-estonia",
  lv: "twemoji:flag-latvia",
  lt: "twemoji:flag-lithuania",
  pl: "twemoji:flag-poland",
  cs: "twemoji:flag-czechia",
  sk: "twemoji:flag-slovakia",
  sl: "twemoji:flag-slovenia",
  hu: "twemoji:flag-hungary",
  ro: "twemoji:flag-romania",
  bg: "twemoji:flag-bulgaria",
  hr: "twemoji:flag-croatia",
  sr: "twemoji:flag-serbia",
  el: "twemoji:flag-greece",
  ru: "twemoji:flag-russia",
  uk: "twemoji:flag-ukraine",
  ga: "twemoji:flag-ireland",
  mt: "twemoji:flag-malta",
  tr: "twemoji:flag-turkey",
  ar: "ph:translate",
  he: "twemoji:flag-israel",
  ja: "twemoji:flag-japan",
  ko: "twemoji:flag-south-korea",
  "zh-Hans": "twemoji:flag-china",
  "zh-Hant": "twemoji:flag-taiwan",
  th: "twemoji:flag-thailand",
  vi: "twemoji:flag-vietnam",
  id: "twemoji:flag-indonesia",
  ms: "twemoji:flag-malaysia",
  tl: "twemoji:flag-philippines",
  hi: "twemoji:flag-india",
};

export const LOCALE_FLAG_EMOJI: Record<Locale, string> = {
  de: "🇩🇪",
  en: "🇺🇸",
  "en-GB": "🇬🇧",
  fr: "🇫🇷",
  es: "🇪🇸",
  it: "🇮🇹",
  "pt-PT": "🇵🇹",
  "pt-BR": "🇧🇷",
  nl: "🇳🇱",
  ca: "📖",
  da: "🇩🇰",
  sv: "🇸🇪",
  no: "🇳🇴",
  fi: "🇫🇮",
  is: "🇮🇸",
  et: "🇪🇪",
  lv: "🇱🇻",
  lt: "🇱🇹",
  pl: "🇵🇱",
  cs: "🇨🇿",
  sk: "🇸🇰",
  sl: "🇸🇮",
  hu: "🇭🇺",
  ro: "🇷🇴",
  bg: "🇧🇬",
  hr: "🇭🇷",
  sr: "🇷🇸",
  el: "🇬🇷",
  ru: "🇷🇺",
  uk: "🇺🇦",
  ga: "🇮🇪",
  mt: "🇲🇹",
  tr: "🇹🇷",
  ar: "📖",
  he: "🇮🇱",
  ja: "🇯🇵",
  ko: "🇰🇷",
  "zh-Hans": "🇨🇳",
  "zh-Hant": "🇹🇼",
  th: "🇹🇭",
  vi: "🇻🇳",
  id: "🇮🇩",
  ms: "🇲🇾",
  tl: "🇵🇭",
  hi: "🇮🇳",
};

// Name des Cookies, in dem die gewählte Sprache liegt (getrennt von web via host).
export const LOCALE_COOKIE = "nd_locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
