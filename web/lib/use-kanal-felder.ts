// Verbindet die Feld-Kanal-Matrix (lib/kanal-felder.ts) mit den Übersetzungen.
//
// Die Matrix kennt nur Schlüssel und Zustände — kein einziger Anzeigetext steht
// dort, sonst wären 24 Sprachen nicht zu halten. Dieser Hook liefert daraus die
// fertigen Zeilen für das Badge.
"use client";

import { useTranslations } from "next-intl";

import {
  FELDER,
  KANAELE,
  type ChannelFieldRowLike,
  type KanalCode,
} from "@/lib/kanal-felder";

// Portalnamen sind Eigennamen und werden NICHT übersetzt (Regel: Portal-Logos
// und -Namen immer echt, nie eingedeutscht).
const KANAL_NAME: Record<KanalCode, string> = {
  airbnb: "Airbnb",
  booking: "Booking.com",
  mybestdays: "myBestDays",
};

/**
 * Zeilen für `<ChannelBadge kanaele={...} />` zu einem Feldschlüssel.
 * Unbekannter Schlüssel → leere Liste, das Badge fällt auf seinen Kurztext
 * zurück (kein Absturz, kein erfundener Status).
 */
export function useKanalZeilen(feld: string): ChannelFieldRowLike[] {
  const t = useTranslations("kanalFelder");
  const regel = FELDER[feld];
  if (!regel) return [];

  return KANAELE.map((code) => {
    const k = regel.kanaele[code];
    return {
      name: KANAL_NAME[code],
      status: k.status,
      hinweis: k.grund ? t(`gruende.${k.grund}`) : undefined,
    };
  });
}
