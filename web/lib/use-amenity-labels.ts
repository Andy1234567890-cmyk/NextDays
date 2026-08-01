"use client";

// Übersetzte Ausstattungs-Bezeichnungen (Slug → Label) und Kategorie-Titel.
//
// Gegenstück zu use-property-labels.ts: `property-meta.ts` hält die deutschen
// Festwerte (AMENITY_LABELS_DE), die in einer 24-sprachigen Oberfläche gemischte
// Sätze erzeugen — im englischen Objekt-Screenshot stand neben „Amenities" ein
// Chip „Barrierefreie Parkplätze". Die Anzeige kommt jetzt aus den i18n-Namen
// räumen `amenities` (Slug) und `amenityGroups` (Kategorie); die Slugs selbst
// bleiben unverändert, übersetzt wird nur das Label.
import { useTranslations } from "next-intl";

import type {
  AmenityCategory,
  RoomAmenityCategory,
} from "@/lib/property-meta";

export function useAmenityLabels() {
  const t = useTranslations("amenities");
  const tGroup = useTranslations("amenityGroups");

  return {
    /** Slug → Label. Unbekannter Slug (Altbestand) bleibt der Slug selbst. */
    amenityLabel: (slug: string) => {
      const label = t.has(slug) ? t(slug) : slug;
      return label;
    },
    /** Kategorie → Gruppentitel. */
    categoryLabel: (category: AmenityCategory) => tGroup(category),
  };
}

/** Zimmer-Ausstattung (Channex /room_facilities). Eigener Namensraum, weil es
 *  ein eigener Katalog ist — 30 Titel gibt es in beiden, mit verschiedenen
 *  UUIDs, und die Slugs unterscheiden sich zwischen den Katalogen. */
export function useRoomAmenityLabels() {
  const t = useTranslations("roomAmenities");
  const tGroup = useTranslations("roomAmenityGroups");

  return {
    roomAmenityLabel: (slug: string) => (t.has(slug) ? t(slug) : slug),
    roomCategoryLabel: (category: RoomAmenityCategory) => tGroup(category),
  };
}
