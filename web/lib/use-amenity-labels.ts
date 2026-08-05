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
  const tEigen = useTranslations("eigeneAusstattung");
  const tGroup = useTranslations("amenityGroups");

  return {
    /** Slug → Label. Unbekannter Slug (Altbestand) bleibt der Slug selbst. */
    amenityLabel: (slug: string) => {
      if (t.has(slug)) return t(slug);
      // Eigene Merkmale (`nd_*`) stehen in keinem Channex-Katalog und damit in
      // keinem der beiden Portal-Namensräume. Ohne diesen Zweig stünde in der
      // Übersicht der rohe Slug — sichtbar geworden an „nd_parking_included".
      if (tEigen.has(slug)) return tEigen(slug);
      return slug;
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
  const tEigen = useTranslations("eigeneAusstattung");
  const tGroup = useTranslations("roomAmenityGroups");

  return {
    // Eigene Merkmale werden beim Speichern in `room_amenities` abgelegt und
    // laufen deshalb über DIESEN Weg zurück in die Anzeige.
    roomAmenityLabel: (slug: string) => {
      if (t.has(slug)) return t(slug);
      if (tEigen.has(slug)) return tEigen(slug);
      return slug;
    },
    roomCategoryLabel: (category: RoomAmenityCategory) => tGroup(category),
  };
}
