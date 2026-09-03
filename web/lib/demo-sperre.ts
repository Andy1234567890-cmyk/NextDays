// Welche Bereiche in der Vorführung gesperrt sind.
//
// Sie werden NICHT ausgeblendet: der Besucher soll sehen, dass es den Bereich
// gibt — nur eben, dass er ihn hier nicht öffnen kann. Ein verstecktes Menü
// lässt die Software kleiner wirken, als sie ist; ein sichtbar gesperrtes
// zeigt den Umfang und macht die Grenze der Vorführung erklärbar.
//
// Diese Liste ist die ANZEIGE. Der Schutz liegt im Backend
// (`features/auth/demo_gate.py`, `GESPERRTE_PRAEFIXE`): ohne ihn holte man die
// Daten per Direktaufruf trotzdem. Wird hier einer ergänzt, gehört er auch
// dorthin.
//
// Am 02.09.2026 nachgezogen: zehn Einträge trugen hier ein Schloss, das die API
// nicht kannte — per URL waren die Bereiche trotzdem ladbar. Die Entscheidung
// war „unsichtbar", die fehlenden Präfixe stehen seither in
// `demo_gate.GESPERRTE_PRAEFIXE` (`/tasks`, `/booking-conditions`,
// `/calendar/block-requests`) bzw. `GESPERRTE_ENDPUNKTE` (die drei
// `/pricing/*`-Pfade des Dynamic Pricing).
//
// Vier Einträge sind dabei ENTFALLEN, weil es die Seiten nicht gibt:
// `/aufgaben` (die Fläche heißt `/reservierungen/aufgaben`), `/werkzeuge`,
// `/gaeste/kategorien`, `/gaeste/monatsbericht`, `/gaeste/gutscheine` — kein
// Menüpunkt und kein Verzeichnis unter `web/app/(dashboard)/`. Ein Eintrag für
// eine Seite, die es nicht gibt, sperrt nichts und verdeckt nur, was die Liste
// wirklich abdeckt.
//
// `/pricing` ist bewusst NICHT als Präfix gesperrt: darunter hängen Preise,
// Promotions und Rate-Grid, also gerade das, was die Vorführung zeigen soll.
// Nur das Dynamic-Pricing-Panel ist gesperrt (siehe `GESPERRTE_ENDPUNKTE`).
const GESPERRT: readonly string[] = [
  "/buchhaltung",
  "/eigentuemer",
  "/dynamic-pricing",
  "/reservierungen/aufgaben",
  "/einstellungen",
  "/stop-sell",
  "/kalender/sperrantraege",
  "/reisebueros",
  "/channels",
  "/website",
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
