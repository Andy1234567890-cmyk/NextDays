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

// Datenmodul ohne React-Kontext: `useTranslations` läuft hier nicht. Die
// Einträge tragen deshalb Übersetzungs-SCHLÜSSEL (…Key), die erst in der
// rendernden Komponente über t(...) aufgelöst werden. `key` ist ein API-Wert
// und bleibt unübersetzt.
export interface ZugriffsStufe {
  key: CohostAccess;
  labelKey: string;
  kurzKey: string;
  icon: string;
  /** Was diese Stufe darf — vollständig, nicht beispielhaft. */
  darfKeys: string[];
  /** Was sie NICHT darf. Leer bei Vollzugriff. */
  darfNichtKeys: string[];
}

export const ZUGRIFFS_STUFEN: ZugriffsStufe[] = [
  {
    key: "full",
    labelKey: "stufeVollLabel",
    kurzKey: "stufeVollKurz",
    icon: "ph:shield-star",
    darfKeys: [
      "stufeVollDarf1",
      "stufeVollDarf2",
      "stufeVollDarf3",
      "stufeVollDarf4",
      "stufeVollDarf5",
      "stufeVollDarf6",
      "stufeVollDarf7",
    ],
    darfNichtKeys: ["stufeVollDarfNicht1"],
  },
  {
    key: "calendar_messaging",
    labelKey: "stufeKalenderNachrichtenLabel",
    kurzKey: "stufeKalenderNachrichtenKurz",
    icon: "ph:chat-circle-dots",
    darfKeys: [
      "stufeKalenderNachrichtenDarf1",
      "stufeKalenderNachrichtenDarf2",
    ],
    darfNichtKeys: [
      "stufeKalenderNachrichtenDarfNicht1",
      "stufeKalenderNachrichtenDarfNicht2",
      "stufeKalenderNachrichtenDarfNicht3",
      "stufeKalenderNachrichtenDarfNicht4",
    ],
  },
  {
    key: "calendar",
    labelKey: "stufeKalenderLabel",
    kurzKey: "stufeKalenderKurz",
    icon: "ph:calendar-blank",
    darfKeys: ["stufeKalenderDarf1"],
    darfNichtKeys: [
      "stufeKalenderDarfNicht1",
      "stufeKalenderDarfNicht2",
      "stufeKalenderDarfNicht3",
      "stufeKalenderDarfNicht4",
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
