// Locale-Definition des myBestDays-Marktplatzes (Gast-Seite).
//
// Umfang: die 24 EU-Amtssprachen — genau die Menge, für die es in diesem
// Monorepo VOLLSTÄNDIGE Übersetzungen gibt (web/messages, inkl. der beiden
// Ausstattungs-Kataloge mit 400 Merkmalen). Das Gastgeber-Dashboard fährt 44
// Sprachen; die 20 zusätzlichen (ja, ko, zh, ar …) haben für die Gast-Seite noch
// keine Kataloge. Sie hier zu listen wäre die Attrappe, die wir gerade
// abschaffen: der Gast wählt Japanisch und sieht Deutsch.
//
// `de` ist Quell-/Basissprache. Sprachwahl ist Cookie-basiert (kein URL-Präfix),
// damit die bestehenden Routen (/inserat/<id>, /checkout/<id>) unverändert
// bleiben und geteilte Links weiter funktionieren.
export const DEFAULT_LOCALE = "de" as const;

export const LOCALES = [
  "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "ga", "hr",
  "hu", "it", "lt", "lv", "mt", "nl", "pl", "pt", "ro", "sk", "sl", "sv",
] as const;

export type Locale = (typeof LOCALES)[number];

// Sprachnamen IN DER JEWEILIGEN SPRACHE (Endonym) — so findet ein Grieche
// „Ελληνικά" auch dann, wenn die Oberfläche gerade dänisch ist.
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

// Region/Land in der jeweiligen Sprache — zweite Zeile der Sprachauswahl (wie
// bei Airbnb: „Deutsch · Deutschland").
export const LOCALE_REGIONS: Record<Locale, string> = {
  bg: "България",
  cs: "Česko",
  da: "Danmark",
  de: "Deutschland",
  el: "Ελλάδα",
  en: "United Kingdom",
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

// Name des Cookies mit der gewählten Sprache. Eigener Name je Auth-/App-Welt:
// die Gast-Seite teilt ihn NICHT mit dem PMS (web) oder dem Gastgeber-Dashboard.
export const LOCALE_COOKIE = "nd_gast_locale";

// Anzeige-Währung des Gastes (reine Präferenz — die Abrechnung läuft immer in
// der Objektwährung, Wurzel 4). Eigenes Cookie, weil Sprache ≠ Währung: ein
// Deutscher, der in Dänemark bucht, will Deutsch und DKK sehen können.
export const CURRENCY_COOKIE = "nd_gast_currency";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

/** BCP-47-Tag fürs `lang`-Attribut und für Intl-Formatierungen. Unsere Codes
 *  sind schon gültige Tags; die Funktion hält die Absicht an einer Stelle. */
export function bcp47(locale: string): string {
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}
