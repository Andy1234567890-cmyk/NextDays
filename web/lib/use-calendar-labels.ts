"use client";

// Übersetzte Kanal- und Status-Bezeichnungen für den Kalender.
//
// `calendar-channels.ts` und `calendar-status.ts` halten Farbe, Logo und Icon —
// das Label stand dort bis hierher als deutscher Festwert. In der englischen
// Ansicht ergab das eine gemischte Legende („Confirmed" neben „Eingecheckt").
// Farbe/Icon bleiben in den Meta-Objekten, die Anzeige kommt aus i18n; die
// Enum-Werte (direct/portal/… bzw. pending/confirmed/…) ändern sich nicht.
import { useTranslations } from "next-intl";

import type { AvailabilitySource } from "@/lib/calendar";
import type { DisplayStatus } from "@/lib/calendar-status";

export function useCalendarLabels() {
  const t = useTranslations("calendar");

  return {
    channelLabel: (source: AvailabilitySource) => t(`channel.${source}`),
    statusLabel: (status: DisplayStatus) => t(`resStatus.${status}`),
  };
}
