// Die drei Co-Gastgeber-Zugriffsstufen für die Oberfläche.
//
// Der Katalog beschreibt KONKRET, was jede Stufe darf — abstrakte Häkchen
// („Kalender: ja/nein") führen dazu, dass jemand aus Bequemlichkeit Vollzugriff
// vergibt. Die Liste ist deshalb in der Sprache des Gastgebers formuliert,
// nicht in der des Rechtesystems.
//
// Inhalte belegt durch airbnb.com/help/article/1534 (abgerufen 2026-07-26).
// Die Rechte selbst erzwingt ausschließlich das Backend
// (features/auth/permissions.py) — dieser Katalog ist reine Darstellung.
import type { CohostAccess } from "@/lib/cohosts";

export interface ZugriffsStufe {
  key: CohostAccess;
  label: string;
  kurz: string;
  icon: string;
  /** Was diese Stufe darf — vollständig, nicht beispielhaft. */
  darf: string[];
  /** Was sie NICHT darf. Leer bei Vollzugriff. */
  darfNicht: string[];
}

export const ZUGRIFFS_STUFEN: ZugriffsStufe[] = [
  {
    key: "full",
    label: "Vollzugriff",
    kurz: "Verwaltet das Objekt vollständig",
    icon: "ph:shield-star",
    darf: [
      "Objektdaten, Fotos und Beschreibung bearbeiten",
      "Preise und Rabatte festlegen",
      "Kalender bearbeiten und Verfügbarkeit pflegen",
      "Buchungsanfragen annehmen und ablehnen",
      "Mit Gästen schreiben",
      "Einnahmen und Auszahlungen einsehen",
      "Weitere Co-Gastgeber einladen (nur mit eingeschränktem Zugriff)",
    ],
    darfNicht: [
      "Auszahlungsdaten einrichten oder ändern — das bleibt bei dir",
    ],
  },
  {
    key: "calendar_messaging",
    label: "Kalender und Nachrichten",
    kurz: "Sieht den Kalender, schreibt mit Gästen",
    icon: "ph:chat-circle-dots",
    darf: [
      "Kalender ansehen — sehen, wann Gäste an- und abreisen",
      "Mit Gästen schreiben, Fragen beantworten, Anreise abstimmen",
    ],
    darfNicht: [
      "Den Kalender ändern",
      "Preise oder Objektdaten bearbeiten",
      "Buchungen annehmen oder ablehnen",
      "Einnahmen einsehen",
    ],
  },
  {
    key: "calendar",
    label: "Nur Kalender",
    kurz: "Sieht nur, wer wann da ist",
    icon: "ph:calendar-blank",
    darf: ["Kalender ansehen — sehen, wann Gäste an- und abreisen"],
    darfNicht: [
      "Den Kalender ändern",
      "Mit Gästen schreiben",
      "Preise oder Objektdaten bearbeiten",
      "Einnahmen einsehen",
    ],
  },
];

export function stufeVon(access: CohostAccess): ZugriffsStufe {
  // Kein Fallback auf eine „Standardstufe": Ein unbekannter Wert ist ein
  // Datenfehler und darf nicht als harmlose Stufe erscheinen (Wurzel 4).
  const treffer = ZUGRIFFS_STUFEN.find((s) => s.key === access);
  if (!treffer) {
    throw new Error(`Unbekannte Zugriffsstufe: ${access}`);
  }
  return treffer;
}
