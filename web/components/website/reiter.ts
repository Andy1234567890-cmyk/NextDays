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
  "seo",
  // Anfragen aus den Formular-Abschnitten (0436). Eigener Reiter und kein
  // Unterpunkt: es sind eingehende Nachrichten von Gästen, keine Einstellung.
  // Wer sie sucht, sucht sie nicht unter „SEO" und nicht unter „Design".
  "anfragen",
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
  // SEO steht NEBEN den Einstellungen und nicht darin (0430): es sind fünf
  // Unterpunkte mit Tabellen und einer eigenen Import-Maske. Hostaway hat es
  // aus demselben Grund als eigenen Bereich („SEO/AEO" mit Untermenü) —
  // gedrängt unter „Einstellungen" wären es zehn Punkte in einer Spalte.
  seo: `${BAUKASTEN_BASIS}/seo`,
  anfragen: `${BAUKASTEN_BASIS}/anfragen`,
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

/** Unterpunkte des SEO-Reiters (0430). Reihenfolge = Reihenfolge in der Spalte,
 *  und sie folgt der Arbeitsweise: erst die site-weiten Angaben (der Rückfall
 *  für alles), dann Seite für Seite, dann die strukturierten Daten, dann die
 *  Messung, zuletzt die Weiterleitungen — die braucht nur, wer umzieht.
 *
 *  Der erste Punkt heißt `uebersicht` und nicht `allgemein`: er zeigt nicht nur
 *  Felder, sondern auch, was daraus entsteht (sitemap.xml, robots.txt,
 *  llms.txt). Ohne diese Anzeige weiß niemand, dass es die Dateien gibt. */
export const SEO_UNTERPUNKTE = [
  "uebersicht",
  "seiten",
  "schema",
  "messung",
  "weiterleitungen",
] as const;

export type SeoUnterpunkt = (typeof SEO_UNTERPUNKTE)[number];

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
