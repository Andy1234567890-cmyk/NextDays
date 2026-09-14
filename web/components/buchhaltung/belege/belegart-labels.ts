// Übersetzte Namen der Belegarten — eine Quelle für Liste, Tabs und Editor-Hülle.
// Kein "use client": auch aus Server Components nutzbar (getTranslations).
import type { getTranslations } from "next-intl/server";

import { BELEGARTEN, type Belegart } from "@/lib/buchhaltung-belege-typen";

type T = Awaited<ReturnType<typeof getTranslations>>;

export function belegartLabels(t: T): Record<Belegart, string> {
  return Object.fromEntries(
    BELEGARTEN.map((art) => [art, t(`belegePage.type_${art}`)]),
  ) as Record<Belegart, string>;
}
