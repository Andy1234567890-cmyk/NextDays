"use client";

// Übersetzte Objekttyp- und Status-Bezeichnungen.
//
// Die Labels standen bis hierher als deutsche Festwerte in `property-meta.ts`
// (TYPE_LABELS/STATUS_LABELS). In einer Oberfläche, die in 24 Sprachen läuft,
// erzeugt das gemischte Sätze — im englischen Objekt-Screenshot stand neben
// „8 objects" ein Badge „Aktiv". Die Bezeichnungen kommen jetzt aus dem
// i18n-Namensraum `objects.meta`; die Enum-Werte selbst bleiben unverändert,
// übersetzt wird nur die Anzeige.
import { useTranslations } from "next-intl";

import { HOTEL_TYPES, VR_TYPES } from "@/lib/property-meta";
import type { PropertyStatus, PropertyType } from "@/lib/properties";

const STATUS_WERTE: PropertyStatus[] = ["draft", "active", "inactive"];

export function usePropertyLabels() {
  const t = useTranslations("objects.meta");

  const typeLabel = (typ: PropertyType) => t(`type.${typ}`);
  const statusLabel = (status: PropertyStatus) => t(`status.${status}`);

  return {
    typeLabel,
    statusLabel,
    /** Alle Status als Auswahl-Optionen (Reihenfolge wie im Enum). */
    statusOptions: STATUS_WERTE.map((value) => ({ value, label: statusLabel(value) })),
    /** Objekttypen der Betriebsart — Ferienvermietung sieht Ferienobjekt-Typen,
     *  ein Hotel seine Zimmertypen (Datenmodell: 1 property = 1 Einheit). */
    typeOptionsFor: (accommodationType: "vacation_rental" | "hotel" | null | undefined) =>
      (accommodationType === "hotel" ? HOTEL_TYPES : VR_TYPES).map((value) => ({
        value,
        label: typeLabel(value),
      })),
  };
}
