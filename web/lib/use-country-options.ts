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

/** Alle Länder als Optionen für ``SearchableSelect`` — Wert ist der ISO-Code.
 *
 *  WOFÜR (03.09.2026): Die Eigentümer-Stammdaten zeigten nur die 27 EU-Staaten
 *  plus CH/UK (`@nextdays/ui/countries`, jene Liste trägt die EU-Steuer-Labels
 *  und Telefonvorwahlen und ist dafür richtig). Eigentümer wohnen aber
 *  weltweit; ein Objekt in Dänemark kann einem Eigentümer in Kanada oder
 *  Thailand gehören, und dessen Land war nicht wählbar.
 *
 *  ``keywords`` macht die Liste über die Anzeigesprache hinaus auffindbar: der
 *  ISO-Code („DK"), der englische Name („Denmark") und der gespeicherte
 *  deutsche Name. Ohne sie müsste ein dänischer Betrieb den Landesnamen in der
 *  Oberflächensprache kennen, um sein eigenes Land zu finden.
 */
export function useCountrySearchOptions() {
  const locale = useLocale();
  return useMemo(() => {
    const namen = new Intl.DisplayNames([locale], { type: "region" });
    // Englisch als zweite Suchsprache: sie ist die Verkehrssprache der
    // Portale, und „Denmark" tippt sich auf jeder Tastatur.
    const englisch = new Intl.DisplayNames(["en"], { type: "region" });
    const sortierer = new Intl.Collator(locale);
    return COUNTRIES.map((c) => ({
      value: c.code,
      // Kennt die Laufzeit den Code nicht, bleibt der gespeicherte Name
      // stehen — besser der deutsche Name als eine leere Zeile (Wurzel 4).
      label: namen.of(c.code) ?? c.value,
      keywords: [c.code, englisch.of(c.code) ?? "", c.value].filter(Boolean),
    })).sort((a, b) => sortierer.compare(a.label, b.label));
  }, [locale]);
}
