"use client";

// Reiter der Auswertung — waagerecht über dem Inhalt, wie bei /bewertungen.
//
// Keine zweite Seitenspalte (Lodgifys Weg): sie kostet gut ein Sechstel der
// Fläche dauerhaft, und die Tabellen hier tragen bis zu zwölf Spalten. Eine
// Navigation, die den Inhalt beschneidet, den sie erschließt, sitzt falsch —
// dieselbe Begründung wie bei den Bewertungen.
//
// Die Reiter sind KEINE Routen, sondern Zustand: fast alle lesen dieselbe
// Antwort desselben Aufrufs. Ein Routenwechsel je Reiter hieße zehn Abrufe
// mit womöglich zehn verschiedenen Ergebnissen.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import type { Reiter } from "@/lib/auswertung-typen";

const EINTRAEGE: readonly { key: Reiter; icon: string }[] = [
  { key: "kennzahlen", icon: "ph:squares-four" },
  { key: "analytics", icon: "ph:chart-line" },
  { key: "buchungen", icon: "ph:list-bullets" },
  { key: "auslastung", icon: "ph:calendar-check" },
  { key: "ausgaben", icon: "ph:receipt" },
  { key: "kanaele", icon: "ph:share-network" },
  { key: "gaeste", icon: "ph:users" },
  { key: "pace", icon: "ph:speedometer" },
  { key: "muster", icon: "ph:chart-bar" },
  { key: "stornos", icon: "ph:x-circle" },
];

export function AuswertungNav({
  aktiv,
  wechseln,
}: {
  aktiv: Reiter;
  wechseln: (r: Reiter) => void;
}) {
  const t = useTranslations("analysis");

  return (
    // Waagerecht scrollbar statt umbrechend: auf dem Telefon bleiben die
    // Reiter EINE Zeile, sonst springt der Inhalt beim Wechsel nach unten.
    <nav
      className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1 pb-0"
      aria-label={t("title")}
    >
      {EINTRAEGE.map((e) => {
        const ist = e.key === aktiv;
        return (
          <button
            key={e.key}
            type="button"
            onClick={() => wechseln(e.key)}
            aria-current={ist ? "page" : undefined}
            className={
              "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors " +
              (ist
                ? // Der offene Reiter traegt das Logo-Rot — Unterstrich UND
                  // Schrift. `--accent` ist das Dashboard-Token dafuer, NICHT
                  // `--brand`: letzteres gehoert dem Website-Baukasten und wird
                  // dort spaeter mit der Farbe des BETRIEBS ueberschrieben; ein
                  // Reiter im Dashboard duerfte davon nicht mitwandern.
                  "border-accent font-medium text-accent"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground")
            }
          >
            <Icon icon={e.icon} className="size-4" />
            {t(`tab.${e.key}`)}
          </button>
        );
      })}
    </nav>
  );
}
