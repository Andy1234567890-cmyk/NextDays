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

// Flagge je Sprache, als Iconify-Name (twemoji, dasselbe Set wie
// `lib/policy-meta.ts`).
//
// Diese Liste ist die EINZIGE Quelle für Sprachflaggen im Dashboard. Sie steht
// in JEDEM Sprachumschalter: Topbar, Auth-Seiten, Baukasten-Kopfzeile und der
// Sprachauswahl für E-Mail-Empfänger (Vorgabe vom 27.08.2026; die Kopfzeile des
// Baukastens führte sie seit dem 26.08.2026, Vorbild Hostaway).
//
// Gewählt ist jeweils das Land, dessen Amtssprache sie ist und nach dem der
// ISO-639-1-Code gebildet wurde — für die mehrländrigen Sprachen also DE, FR,
// PT, SV. Eine Sprache deckt sich nicht mit einem Land (Deutsch: DE/AT/CH,
// Französisch: FR/BE/LU); die Flagge ist deshalb die schnelle Wiedererkennung,
// das Endonym daneben die verbindliche Angabe. Wo beide Platz haben, stehen
// beide — die Flagge ersetzt das Wort nur dort, wo ohnehin nur ein Symbol
// hinpasst (Icon-Button der Topbar).
export const LOCALE_FLAGS: Record<Locale, string> = {
  bg: "twemoji:flag-bulgaria",
  cs: "twemoji:flag-czechia",
  da: "twemoji:flag-denmark",
  de: "twemoji:flag-germany",
  el: "twemoji:flag-greece",
  en: "twemoji:flag-united-kingdom",
  es: "twemoji:flag-spain",
  et: "twemoji:flag-estonia",
  fi: "twemoji:flag-finland",
  fr: "twemoji:flag-france",
  ga: "twemoji:flag-ireland",
  hr: "twemoji:flag-croatia",
  hu: "twemoji:flag-hungary",
  it: "twemoji:flag-italy",
  lt: "twemoji:flag-lithuania",
  lv: "twemoji:flag-latvia",
  mt: "twemoji:flag-malta",
  nl: "twemoji:flag-netherlands",
  pl: "twemoji:flag-poland",
  pt: "twemoji:flag-portugal",
  ro: "twemoji:flag-romania",
  sk: "twemoji:flag-slovakia",
  sl: "twemoji:flag-slovenia",
  sv: "twemoji:flag-sweden",
};

// Flaggen-EMOJI je Sprache — dieselbe Zuordnung wie `LOCALE_FLAGS`, nur als
// Unicode-Zeichen statt als Iconify-Name.
//
// Zwei Listen für dieselbe Sache, weil es zwei Rendering-Wege gibt und keiner
// den anderen kann: ein natives `<option>` rendert AUSSCHLIESSLICH Text — ein
// `<Icon>` darin wird nicht angezeigt, kein SVG, kein Bild. Wer in der
// E-Mail-Sprachauswahl (`components/sprache-auswahl.tsx`) eine Flagge will,
// braucht sie deshalb als Zeichen im Optionstext. Umgekehrt ist twemoji dort
// die bessere Wahl, wo HTML erlaubt ist: das Emoji sieht auf jedem System
// anders aus (und auf Windows zeigen ältere Fassungen statt der Flagge nur die
// zwei Buchstaben des Ländercodes).
//
// Die beiden Listen MÜSSEN dieselben Länder tragen; `scripts/i18n/
// sprachlisten-pruefen.mjs` erzwingt das.
export const LOCALE_FLAG_EMOJI: Record<Locale, string> = {
  bg: "🇧🇬",
  cs: "🇨🇿",
  da: "🇩🇰",
  de: "🇩🇪",
  el: "🇬🇷",
  en: "🇬🇧",
  es: "🇪🇸",
  et: "🇪🇪",
  fi: "🇫🇮",
  fr: "🇫🇷",
  ga: "🇮🇪",
  hr: "🇭🇷",
  hu: "🇭🇺",
  it: "🇮🇹",
  lt: "🇱🇹",
  lv: "🇱🇻",
  mt: "🇲🇹",
  nl: "🇳🇱",
  pl: "🇵🇱",
  pt: "🇵🇹",
  ro: "🇷🇴",
  sk: "🇸🇰",
  sl: "🇸🇮",
  sv: "🇸🇪",
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
