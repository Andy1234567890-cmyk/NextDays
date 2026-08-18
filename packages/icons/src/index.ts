// Lokale Icon-Registrierung für alle Frontends.
//
// WOZU: `@iconify/react` holt jedes Icon zur Laufzeit von
// `api.iconify.design`. Für 1.900 Icon-Verwendungen in sieben Anwendungen ist
// das eine Abhängigkeit von einem fremden Dienst — und sie fällt nicht auf,
// solange er antwortet. Live gesehen (18.08.2026): ein Browser-Plugin
// blockierte die Domain, und nach einem Sprachwechsel (`router.refresh()`
// montiert alle Icons neu und sie fordern ihre Daten erneut an) war die
// Oberfläche komplett icon-los — leere Kreise, kein Fehler, keine Meldung.
//
// Nach `iconsRegistrieren()` liegen alle benutzten Icons im Speicher. Iconify
// fragt dann nichts mehr nach: sein Lader wird nur für UNBEKANNTE Namen
// aktiv, und bekannt sind hier alle, die im Quellcode vorkommen.
import { addCollection } from "@iconify/react";

import { SAMMLUNGEN } from "./gebuendelt";

let registriert = false;

/** Die gebündelten Icons in @iconify/react laden.
 *
 * Beim ersten Aufruf; weitere Aufrufe sind wirkungslos. Muss laufen, BEVOR die
 * erste `<Icon>`-Komponente rendert — sonst stellt Iconify für diese eine
 * Netzanfrage, und genau die soll entfallen. In Next.js gehört der Aufruf
 * deshalb in eine Client-Komponente, die das Wurzel-Layout einbindet.
 *
 * Idempotent (Wurzel 2): `addCollection` mehrfach mit denselben Daten wäre
 * nicht falsch, aber unnötige Arbeit bei jedem Client-Render.
 */
export function iconsRegistrieren(): void {
  if (registriert) return;
  registriert = true;
  for (const sammlung of Object.values(SAMMLUNGEN)) {
    // Der Typ von `addCollection` verlangt ein veränderliches Objekt, der
    // Datensatz ist `as const`. Die Kopie ist eine Formsache, keine Laufzeit-
    // Notwendigkeit — geklont wird flach, die Icon-Einträge selbst bleiben
    // geteilt.
    addCollection({ ...sammlung } as Parameters<typeof addCollection>[0]);
  }
}

/** Wie viele Icons sind gebündelt? Für Diagnose und Tests. */
export function iconsAnzahl(): number {
  return Object.values(SAMMLUNGEN).reduce(
    (summe, s) => summe + Object.keys(s.icons).length,
    0,
  );
}
