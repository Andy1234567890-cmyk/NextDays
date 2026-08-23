// Die Reiter des Baukastens — EINE Wahrheit für Beschriftung, Route und
// Reihenfolge.
//
// Jeder Reiter ist ein PFAD, kein Zustand. Lodgify macht das genauso
// (`/website-builder/{id}/styles`, `/pages`, `/settings/...`, `/rentals`,
// `/external-widgets`; live abgelesen am 23.08.2026), und zwar aus einem
// handfesten Grund: der Baukasten hat viele Unterpunkte, und wer einem Kollegen
// „schau dir mal die Domain-Einstellung an" schicken will, braucht dafür eine
// Adresse. Mit `?reiter=design` gab es die nicht — der Link führte immer auf
// den Standard-Reiter zurück.
//
// Der aktive Reiter wird über den PRÄFIX des Pfads bestimmt, nicht über
// Gleichheit: `/website/design/logo` gehört noch zu „design", und
// `/website/seiten/<id>` (der Abschnitts-Editor) noch zu „seiten".

export const BAUKASTEN_BASIS = "/website";

/** Reiter-Kennungen in der Reihenfolge der Leiste. */
export const REITER_IDS = [
  "design",
  "seiten",
  "einstellungen",
  "objekte",
  "widgets",
] as const;

export type ReiterId = (typeof REITER_IDS)[number];

/** Route eines Reiters. Einstellungen und Objekte/Widgets zeigen auf ihre
 *  jeweilige Einstiegsseite. */
export const REITER_HREF: Record<ReiterId, string> = {
  design: `${BAUKASTEN_BASIS}/design`,
  seiten: `${BAUKASTEN_BASIS}/seiten`,
  einstellungen: `${BAUKASTEN_BASIS}/einstellungen/adresse`,
  objekte: `${BAUKASTEN_BASIS}/objekte`,
  widgets: `${BAUKASTEN_BASIS}/widgets`,
};

/** Unterpunkte des Einstellungen-Reiters — eigene Spalte links, wie bei
 *  Lodgify (`/settings/domain`, `/languages`, `/contact`, `/display`,
 *  `/advanced`). Reihenfolge = Reihenfolge in der Spalte: erst wo die Seite
 *  liegt, dann in welchen Sprachen sie steht, dann was sie zeigt, dann die
 *  Eingriffe für Fortgeschrittene. */
export const EINSTELLUNGEN_UNTERPUNKTE = [
  "adresse",
  "sprachen",
  "kontakt",
  "anzeige",
  "erweitert",
] as const;

export type EinstellungenUnterpunkt =
  (typeof EINSTELLUNGEN_UNTERPUNKTE)[number];

/** Welcher Reiter zu einem Pfad gehört. `null`, wenn der Pfad nicht im
 *  Baukasten liegt — dann ist kein Reiter aktiv, statt willkürlich den ersten
 *  hervorzuheben. */
export function reiterAusPfad(pfad: string): ReiterId | null {
  const rest = pfad.startsWith(BAUKASTEN_BASIS)
    ? pfad.slice(BAUKASTEN_BASIS.length).replace(/^\//, "")
    : null;
  if (rest === null) return null;
  const erstes = rest.split("/")[0];
  return REITER_IDS.find((r) => r === erstes) ?? null;
}
