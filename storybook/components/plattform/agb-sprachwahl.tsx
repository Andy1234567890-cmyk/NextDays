// Sprachauswahl für die AGB-Seite. Portiert aus plattform/. In der App navigiert
// die Auswahl per ?sprache=… und die Seite rendert die gewählte Sprachfassung;
// in der Storybook-Werkstatt wird der gewählte Code nur lokal gehalten.
"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";

import { LEGAL_LOCALES, LEGAL_LOCALE_LABELS, type LegalLocale } from "./legal";

export function AgbSprachwahl({ aktuell }: { aktuell: LegalLocale }) {
  const [wert, setWert] = useState<LegalLocale>(aktuell);

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon icon="ph:globe" className="size-4" aria-hidden />
      <span className="sr-only">Sprache wählen</span>
      <select
        value={wert}
        onChange={(e) => setWert(e.target.value as LegalLocale)}
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
