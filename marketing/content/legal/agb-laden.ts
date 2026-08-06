// Sprachabhängiger Loader für die AGB.
//
// Warum die AGB anders geladen werden als Datenschutz/Impressum/Cookies: Jene
// vier Dokumente liegen als EIN Modul vor und werden über die Oberfläche
// übersetzt; die AGB gibt es als 24 fertige Sprachfassungen (Quelle ist
// web/content/legal/agb, siehe Kopf-Kommentar der Dateien). Deshalb hier eine
// Loader-Map statt eines statischen Imports.
//
// Die Map ist bewusst vollständig und explizit getippt: fehlt eine der 24
// EU-Amtssprachen, bricht der Build — statt zur Laufzeit einen leeren
// Rechtstext auszuliefern. Lazy Imports, damit nur die angefragte Sprache im
// Bundle landet.
import type { Locale } from "@/i18n/locales";

import type { LegalDoc } from "./types";

const AGB_LOADERS: Record<Locale, () => Promise<{ agb: LegalDoc }>> = {
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

export async function loadAgb(locale: Locale): Promise<LegalDoc> {
  return (await AGB_LOADERS[locale]()).agb;
}
