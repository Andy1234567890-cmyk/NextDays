"use client";

// Sprachauswahl für die AGB-Seite: navigiert per Query-Parameter (?sprache=…),
// die Seite rendert dann serverseitig die gewählte Sprachfassung.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";

import {
  LEGAL_LOCALES,
  LEGAL_LOCALE_LABELS,
  type LegalLocale,
} from "@/content/legal/locales";

export function AgbSprachwahl({ aktuell }: { aktuell: LegalLocale }) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon icon="ph:globe" className="size-4" aria-hidden />
      <span className="sr-only">Sprache wählen</span>
      <select
        value={aktuell}
        onChange={(e) => router.push(`/agb?sprache=${e.target.value}`)}
        className="rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground"
      >
        {LEGAL_LOCALES.map((code) => (
          <option key={code} value={code}>
            {LEGAL_LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
