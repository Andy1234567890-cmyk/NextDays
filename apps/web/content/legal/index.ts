import type { Locale } from "@/i18n/locales";

import type { LegalDoc } from "./types";

// Explizite, vollständige Loader-Map: TypeScript erzwingt einen Eintrag für
// jede der 24 EU-Amtssprachen — fehlt eine Sprache, bricht der Build.
// Lazy Imports, damit nur der Text der angefragten Sprache geladen wird.
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
