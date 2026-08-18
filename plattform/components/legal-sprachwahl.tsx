"use client";

// Sprachauswahl für JEDE Rechtsseite: navigiert per Query-Parameter
// (?sprache=…) auf demselben Pfad, die Seite rendert dann serverseitig die
// gewählte Sprachfassung. Der Pfad kommt aus usePathname — dadurch braucht die
// Komponente keinen Slug übergeben zu bekommen und funktioniert auch auf der
// Verzeichnisseite.
import { Icon } from "@iconify/react";
import { usePathname, useRouter } from "next/navigation";

import { Select } from "@/components/select";
import {
  LEGAL_LOCALE_LABELS,
  type LegalLocale,
} from "@/content/legal/locales";

// `verfuegbar` sind die Sprachen, in denen es DIESEN Text wirklich gibt —
// nicht alle 24. Eine Sprache anzubieten, deren Fassung fehlt, führte in ein
// 404 statt zum Text.
export function LegalSprachwahl({
  aktuell,
  beschriftung,
  verfuegbar,
}: {
  aktuell: LegalLocale;
  beschriftung: string;
  verfuegbar: readonly LegalLocale[];
}) {
  const router = useRouter();
  const pfad = usePathname();

  return (
    <label className="flex w-full items-center gap-2 text-sm text-muted-foreground sm:w-auto">
      <Icon icon="ph:globe" className="size-4" aria-hidden />
      <span className="sr-only">{beschriftung}</span>
      <Select
        value={aktuell}
        onChange={(e) => router.push(`${pfad}?sprache=${e.target.value}`)}
        className="w-full rounded-full sm:w-auto sm:py-1.5"
        wrapperClassName="w-full sm:w-auto"
      >
        {verfuegbar.map((code) => (
          <option key={code} value={code}>
            {LEGAL_LOCALE_LABELS[code]}
          </option>
        ))}
      </Select>
    </label>
  );
}
