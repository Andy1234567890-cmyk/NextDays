// Ausstattungsmerkmale gast-lesbar machen.
//
// Das Backend liefert SLUGS (`wifi`, `nd_parking_included`,
// `first_aid_kit_available`) — sie sind der Schlüssel des Merkmals, kein Text.
// Live am 11.08.2026 stand genau das auf der Inserat-Seite: 27 Zeilen
// „nd_sun_loungers", „gravel_roads", „key_access". Für einen Gast ist das nichts.
//
// Die Übersetzungen liegen in zwei Katalogen, weil es zwei Herkünfte gibt:
//   `amenities`          — Portal-Katalog (Airbnb ∪ Booking, 301 Merkmale)
//   `eigeneAusstattung`  — unsere eigenen `nd_`-Merkmale (99)
// Beide werden aus web/messages gespiegelt (scripts/i18n/ausstattung-plattform-sync.mjs).
//
// Kein Merkmal ohne Label: fehlt der Schlüssel in beiden Katalogen, wird die
// Zeile WEGGELASSEN statt den Slug zu zeigen. Ein fehlendes Label ist ein
// Datenfehler und wird vom Prüfskript gefunden — nicht vom Gast.
import type { useTranslations } from "next-intl";

type Uebersetzer = ReturnType<typeof useTranslations>;

// Icons für die häufigsten Merkmale. Bewusst klein und unvollständig: alles
// andere bekommt das neutrale Häkchen. Ein falsches Symbol ist schlechter als
// keins (ein „Pool"-Icon an „Gartenteich" wäre eine Falschaussage).
const ICONS: Record<string, string> = {
  wifi: "ph:wifi-high",
  internet: "ph:wifi-high",
  kitchen: "ph:cooking-pot",
  nd_kitchen: "ph:cooking-pot",
  parking: "ph:car",
  nd_parking_included: "ph:car",
  nd_parking_available: "ph:car",
  free_parking_on_premises: "ph:car",
  tv: "ph:television",
  cable_tv: "ph:television",
  heating: "ph:thermometer",
  air_conditioning: "ph:wind",
  washer: "ph:washing-machine",
  laundry_facilities: "ph:washing-machine",
  dryer: "ph:washing-machine",
  pool: "ph:swimming-pool",
  swimming_pool: "ph:swimming-pool",
  sauna: "ph:thermometer-hot",
  pets_allowed: "ph:paw-print",
  nd_pets_not_allowed: "ph:paw-print",
  garden: "ph:tree",
  nd_private_garden: "ph:tree",
  sun_terrace: "ph:sun",
  nd_sun_loungers: "ph:sun",
  balcony: "ph:sun",
  bbq_facilities: "ph:fire",
  fireplace: "ph:fire",
  elevator: "ph:elevator",
  nd_single_level: "ph:steps",
  smoke_alarms: "ph:siren",
  first_aid_kit_available: "ph:first-aid-kit",
  fire_extinguisher: "ph:fire-extinguisher",
  contactless_check_in_out: "ph:key",
  key_access: "ph:key",
  private_check_in_check_out: "ph:key",
  nd_near_sea: "ph:waves",
  beachfront: "ph:waves",
  nd_credit_card_accepted: "ph:credit-card",
  nd_smoking_not_allowed: "ph:cigarette-slash",
  all_non_smoking: "ph:cigarette-slash",
  crib: "ph:baby",
  high_chair: "ph:baby",
};

export type Ausstattung = { slug: string; label: string; icon: string };

/** Merkmale in anzeigbare Zeilen übersetzen — ohne Label kein Eintrag.
 *
 *  `t` muss der Wurzel-Übersetzer sein (`useTranslations()` ohne Namespace),
 *  weil die Schlüssel in zwei verschiedenen Namespaces liegen. */
export function ausstattungZeilen(
  t: Uebersetzer,
  slugs: readonly string[],
): Ausstattung[] {
  const zeilen: Ausstattung[] = [];
  for (const slug of slugs) {
    const label = labelOderNull(t, slug);
    if (!label) continue;
    zeilen.push({ slug, label, icon: ICONS[slug] ?? "ph:check-circle" });
  }
  // Alphabetisch in der ANGEZEIGTEN Sprache — die Backend-Reihenfolge ist die
  // Eingabereihenfolge des Betriebs und für den Gast willkürlich.
  return zeilen.sort((a, b) => a.label.localeCompare(b.label));
}

function labelOderNull(t: Uebersetzer, slug: string): string | null {
  for (const namespace of ["amenities", "eigeneAusstattung"] as const) {
    const key = `${namespace}.${slug}`;
    if (t.has(key)) return t(key);
  }
  return null;
}
