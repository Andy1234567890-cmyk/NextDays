// Sprachabhängiger Loader für ALLE Rechtsdokumente dieser App.
//
// WARUM ES DIESE DATEI GIBT (Änderung 24.08.2026):
// Datenschutz, Impressum, Cookie-Richtlinie und Auftragsverarbeitung lagen als
// je EIN deutsches Modul vor und wurden statisch importiert. Ergebnis: wer die
// Seite auf Dänisch las, bekam über dänischer Navigation die Überschrift
// „Datenschutzerklärung" und darunter deutschen Rechtstext. Live geprüft am
// 24.08.2026 für alle vier Dokumente — in allen 24 Sprachen dasselbe.
//
// Die AGB waren schon richtig gebaut (24 Sprachfassungen + `agb-laden.ts`).
// Dieses Muster gilt jetzt für alle fünf; `agb-laden.ts` geht darin auf, damit
// es nicht zwei Loader mit derselben Aufgabe gibt.
//
// Die Maps sind bewusst vollständig und explizit getippt (`Record<Locale, …>`):
// fehlt eine der 24 EU-Amtssprachen, bricht der Build — statt zur Laufzeit
// einen leeren oder deutschen Rechtstext auszuliefern. KEIN Rückfall auf
// Deutsch: bei einem Rechtstext ist die stille falsche Sprache schlimmer als
// ein Fehler, weil sie aussieht, als wäre sie richtig (Wurzel 4).
//
// Lazy Imports, damit nur die angefragte Sprache im Bundle landet — vier
// Dokumente × 24 Sprachen wären sonst in jeder Seite.
import type { Locale } from "@/i18n/locales";

import type { LegalDoc } from "./types";

/** Die Dokumente, die dieser Loader kennt — gleich den Ordnernamen. */
export type RechtsdokumentSlug =
  | "datenschutz"
  | "impressum"
  | "cookie-richtlinie"
  | "auftragsverarbeitung"
  | "agb"
  | "partner-agb";

type Loader = () => Promise<{ default: LegalDoc }>;

const DATENSCHUTZ: Record<Locale, Loader> = {
  bg: () => import("./datenschutz/bg"),
  cs: () => import("./datenschutz/cs"),
  da: () => import("./datenschutz/da"),
  de: () => import("./datenschutz/de"),
  el: () => import("./datenschutz/el"),
  en: () => import("./datenschutz/en"),
  es: () => import("./datenschutz/es"),
  et: () => import("./datenschutz/et"),
  fi: () => import("./datenschutz/fi"),
  fr: () => import("./datenschutz/fr"),
  ga: () => import("./datenschutz/ga"),
  hr: () => import("./datenschutz/hr"),
  hu: () => import("./datenschutz/hu"),
  it: () => import("./datenschutz/it"),
  lt: () => import("./datenschutz/lt"),
  lv: () => import("./datenschutz/lv"),
  mt: () => import("./datenschutz/mt"),
  nl: () => import("./datenschutz/nl"),
  pl: () => import("./datenschutz/pl"),
  pt: () => import("./datenschutz/pt"),
  ro: () => import("./datenschutz/ro"),
  sk: () => import("./datenschutz/sk"),
  sl: () => import("./datenschutz/sl"),
  sv: () => import("./datenschutz/sv"),
};

const IMPRESSUM: Record<Locale, Loader> = {
  bg: () => import("./impressum/bg"),
  cs: () => import("./impressum/cs"),
  da: () => import("./impressum/da"),
  de: () => import("./impressum/de"),
  el: () => import("./impressum/el"),
  en: () => import("./impressum/en"),
  es: () => import("./impressum/es"),
  et: () => import("./impressum/et"),
  fi: () => import("./impressum/fi"),
  fr: () => import("./impressum/fr"),
  ga: () => import("./impressum/ga"),
  hr: () => import("./impressum/hr"),
  hu: () => import("./impressum/hu"),
  it: () => import("./impressum/it"),
  lt: () => import("./impressum/lt"),
  lv: () => import("./impressum/lv"),
  mt: () => import("./impressum/mt"),
  nl: () => import("./impressum/nl"),
  pl: () => import("./impressum/pl"),
  pt: () => import("./impressum/pt"),
  ro: () => import("./impressum/ro"),
  sk: () => import("./impressum/sk"),
  sl: () => import("./impressum/sl"),
  sv: () => import("./impressum/sv"),
};

const COOKIES: Record<Locale, Loader> = {
  bg: () => import("./cookies/bg"),
  cs: () => import("./cookies/cs"),
  da: () => import("./cookies/da"),
  de: () => import("./cookies/de"),
  el: () => import("./cookies/el"),
  en: () => import("./cookies/en"),
  es: () => import("./cookies/es"),
  et: () => import("./cookies/et"),
  fi: () => import("./cookies/fi"),
  fr: () => import("./cookies/fr"),
  ga: () => import("./cookies/ga"),
  hr: () => import("./cookies/hr"),
  hu: () => import("./cookies/hu"),
  it: () => import("./cookies/it"),
  lt: () => import("./cookies/lt"),
  lv: () => import("./cookies/lv"),
  mt: () => import("./cookies/mt"),
  nl: () => import("./cookies/nl"),
  pl: () => import("./cookies/pl"),
  pt: () => import("./cookies/pt"),
  ro: () => import("./cookies/ro"),
  sk: () => import("./cookies/sk"),
  sl: () => import("./cookies/sl"),
  sv: () => import("./cookies/sv"),
};

const AVV: Record<Locale, Loader> = {
  bg: () => import("./avv/bg"),
  cs: () => import("./avv/cs"),
  da: () => import("./avv/da"),
  de: () => import("./avv/de"),
  el: () => import("./avv/el"),
  en: () => import("./avv/en"),
  es: () => import("./avv/es"),
  et: () => import("./avv/et"),
  fi: () => import("./avv/fi"),
  fr: () => import("./avv/fr"),
  ga: () => import("./avv/ga"),
  hr: () => import("./avv/hr"),
  hu: () => import("./avv/hu"),
  it: () => import("./avv/it"),
  lt: () => import("./avv/lt"),
  lv: () => import("./avv/lv"),
  mt: () => import("./avv/mt"),
  nl: () => import("./avv/nl"),
  pl: () => import("./avv/pl"),
  pt: () => import("./avv/pt"),
  ro: () => import("./avv/ro"),
  sk: () => import("./avv/sk"),
  sl: () => import("./avv/sl"),
  sv: () => import("./avv/sv"),
};

// Die AGB liegen als 24 Dateien mit BENANNTEM Export (`export const agb`) vor,
// die vier anderen mit Default-Export. Der Unterschied ist historisch (die AGB
// sind eine Kopie aus web/content/legal/agb) und wird hier gekapselt, statt
// 24 Dateien umzuschreiben und damit von der web-Fassung abweichen zu lassen.
const AGB: Record<Locale, () => Promise<{ agb: LegalDoc }>> = {
  bg: () => import("./agb/bg"),
  cs: () => import("./agb/cs"),
  da: () => import("./agb/da"),
  de: () => import("./agb/de"),
  el: () => import("./agb/el"),
  en: () => import("./agb/en"),
  es: () => import("./agb/es"),
  et: () => import("./agb/et"),
  fi: () => import("./agb/fi"),
  fr: () => import("./agb/fr"),
  ga: () => import("./agb/ga"),
  hr: () => import("./agb/hr"),
  hu: () => import("./agb/hu"),
  it: () => import("./agb/it"),
  lt: () => import("./agb/lt"),
  lv: () => import("./agb/lv"),
  mt: () => import("./agb/mt"),
  nl: () => import("./agb/nl"),
  pl: () => import("./agb/pl"),
  pt: () => import("./agb/pt"),
  ro: () => import("./agb/ro"),
  sk: () => import("./agb/sk"),
  sl: () => import("./agb/sl"),
  sv: () => import("./agb/sv"),
};

// Partner-AGB (0517/0520): ENTWURF, de + en von Hand; die übrigen 22 Sprachen
// fallen bewusst auf Englisch zurück, bis der anwaltlich geprüfte Text vorliegt
// und übersetzt ist — Rechtstexte werden nicht maschinell übersetzt.
// Partner-AGB in allen 24 Sprachen (de/en von Hand, 22 maschinell mit juristischem
// Prompt, 02.09.2026 — alle als ENTWURF gekennzeichnet). Kein Rückfall auf Englisch mehr.
type PartnerAgbLoader = () => Promise<{ partnerAgb: LegalDoc }>;
const PARTNER_AGB: Record<Locale, PartnerAgbLoader> = {
  bg: () => import("./partner-agb/bg"),
  cs: () => import("./partner-agb/cs"),
  da: () => import("./partner-agb/da"),
  de: () => import("./partner-agb/de"),
  el: () => import("./partner-agb/el"),
  en: () => import("./partner-agb/en"),
  es: () => import("./partner-agb/es"),
  et: () => import("./partner-agb/et"),
  fi: () => import("./partner-agb/fi"),
  fr: () => import("./partner-agb/fr"),
  ga: () => import("./partner-agb/ga"),
  hr: () => import("./partner-agb/hr"),
  hu: () => import("./partner-agb/hu"),
  it: () => import("./partner-agb/it"),
  lt: () => import("./partner-agb/lt"),
  lv: () => import("./partner-agb/lv"),
  mt: () => import("./partner-agb/mt"),
  nl: () => import("./partner-agb/nl"),
  pl: () => import("./partner-agb/pl"),
  pt: () => import("./partner-agb/pt"),
  ro: () => import("./partner-agb/ro"),
  sk: () => import("./partner-agb/sk"),
  sl: () => import("./partner-agb/sl"),
  sv: () => import("./partner-agb/sv"),
};

const LOADER: Record<Exclude<RechtsdokumentSlug, "agb" | "partner-agb">, Record<Locale, Loader>> =
  {
    datenschutz: DATENSCHUTZ,
    impressum: IMPRESSUM,
    "cookie-richtlinie": COOKIES,
    auftragsverarbeitung: AVV,
  };

/**
 * Ein Rechtsdokument in der Sprache des Besuchers.
 *
 * Serverseitig aufzurufen (Server Component / `generateMetadata`). Die Sprache
 * kommt aus `getLocale()`, nicht aus der URL — diese App ist Cookie-basiert
 * (i18n/locales.ts).
 */
export async function ladeRechtsdokument(
  slug: RechtsdokumentSlug,
  locale: Locale,
): Promise<LegalDoc> {
  if (slug === "agb") return (await AGB[locale]()).agb;
  if (slug === "partner-agb") {
    return (await PARTNER_AGB[locale]()).partnerAgb;
  }
  return (await LOADER[slug][locale]()).default;
}
