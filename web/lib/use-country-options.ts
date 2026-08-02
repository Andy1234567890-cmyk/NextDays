"use client";

// Länder-Auswahl in der Sprache der Oberfläche.
//
// Die 193 Weltländer stehen NICHT in den Sprachdateien — jede Laufzeit bringt
// sie über Intl.DisplayNames bereits in allen Sprachen mit. Eine eigene Tabelle
// wäre 193 × 24 Werte, die niemand pflegt und die zwangsläufig veraltet.
// Gespeichert wird weiterhin `value` (historisch der deutsche Landesname), damit
// bestehende Kundendatensätze unverändert bleiben.
import { useLocale } from "next-intl";
import { useMemo } from "react";

import { COUNTRIES } from "@/constants/countries";

export function useCountryOptions() {
  const locale = useLocale();
  return useMemo(() => {
    const namen = new Intl.DisplayNames([locale], { type: "region" });
    const sortierer = new Intl.Collator(locale);
    return COUNTRIES.map((c) => ({
      value: c.value,
      // Kennt die Laufzeit den Code nicht, bleibt der gespeicherte Name stehen —
      // besser der deutsche Name als eine leere Zeile in der Auswahl.
      label: namen.of(c.code) ?? c.value,
    })).sort((a, b) => sortierer.compare(a.label, b.label));
  }, [locale]);
}

/** Dieselbe Liste, aber mit dem ISO-Code als Wert — für Felder, die den Code
 *  speichern (Rechnungsadresse, Stripe verlangt alpha-2), nicht den Namen.
 *  Bewusst hier und nicht mit `useTranslations("countries")` im Formular: die
 *  Sprachdateien führen nur die EU-27, die übrigen 165 Länder liefen dort in
 *  MISSING_MESSAGE und zeigten den rohen Key. */
export function useCountryCodeOptions() {
  const locale = useLocale();
  return useMemo(() => {
    const namen = new Intl.DisplayNames([locale], { type: "region" });
    const sortierer = new Intl.Collator(locale);
    return COUNTRIES.map((c) => ({
      code: c.code,
      label: namen.of(c.code) ?? c.value,
    })).sort((a, b) => sortierer.compare(a.label, b.label));
  }, [locale]);
}
