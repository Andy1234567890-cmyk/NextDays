// Welche Bereiche in der Vorführung gesperrt sind (0408).
//
// Sie werden NICHT ausgeblendet: der Besucher soll sehen, dass es den Bereich
// gibt — nur eben, dass er ihn hier nicht öffnen kann. Ein verstecktes Menü
// lässt die Software kleiner wirken, als sie ist; ein sichtbar gesperrtes
// zeigt den Umfang und macht die Grenze der Vorführung erklärbar.
//
// Diese Liste ist die ANZEIGE. Der Schutz liegt im Backend
// (`features/auth/demo_gate.py`, `GESPERRTE_PRAEFIXE`): ohne ihn holte man die
// Daten per Direktaufruf trotzdem. Beide Listen decken dieselben Bereiche ab —
// wird hier einer ergänzt, gehört er auch dorthin.
const GESPERRT: readonly string[] = [
  "/buchhaltung",
  "/eigentuemer",
  "/dynamic-pricing",
  "/reservierungen/aufgaben",
  "/aufgaben",
  "/einstellungen",
  "/reservierungen/einstellungen",
  "/stop-sell",
  "/kalender/sperrantraege",
  "/gaeste/kategorien",
  "/gaeste/monatsbericht",
  "/gaeste/gutscheine",
  "/reisebueros",
  "/channels",
  "/website",
  "/werkzeuge",
  "/konto",
];

/** Liegt dieser Pfad in einem für die Vorführung gesperrten Bereich?
 *
 * Der Vergleich endet am Segment: `/konto` trifft `/konto/abrechnung`, aber
 * nicht `/kontoauszug`. Ohne diese Grenze sperrte ein kurzer Präfix
 * versehentlich fremde Seiten mit.
 */
export function istGesperrt(href: string): boolean {
  return GESPERRT.some((p) => href === p || href.startsWith(p + "/"));
}
