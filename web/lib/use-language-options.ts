"use client";

// Gesprochene Sprachen in der Sprache der Oberfläche.
//
// Wie bei den Ländern (use-country-options): die Anzeigenamen bringt jede
// Laufzeit über Intl.DisplayNames mit, eine eigene Tabelle wäre 34 × 24 Werte
// ohne Mehrwert. Gespeichert wird weiterhin `value` (deutscher Name), damit
// bestehende Benutzerprofile unverändert bleiben.
import { useLocale } from "next-intl";
import { useMemo } from "react";

import { LANGUAGES } from "@/components/konto/user-wizard-data";

export function useLanguageOptions() {
  const locale = useLocale();
  return useMemo(() => {
    const namen = new Intl.DisplayNames([locale], { type: "language" });
    const sortierer = new Intl.Collator(locale);
    return LANGUAGES.map((l) => ({
      value: l.value as string,
      label: namen.of(l.code) ?? l.value,
    })).sort((a, b) => sortierer.compare(a.label, b.label));
  }, [locale]);
}
