// Die ARTEN, die ein eigenes Beitragsfeld haben kann (0485).
//
// WARUM DAS EINE EIGENE DATEI IST
// ==============================
// Die Liste gehört inhaltlich zu `site-pages.ts` — dort stehen `EigenesFeld`
// und die vier Endpunkte dazu. Sie darf dort nur nicht STEHEN: `site-pages.ts`
// trägt `"use server"`, und ein solches Modul darf ausschließlich async
// functions exportieren. Ein `export const` darin bricht nicht beim Tippen und
// nicht bei `tsc`, sondern erst zur Laufzeit, mit
//
//     Error: A "use server" file can only export async functions, found object.
//
// und einer 500 auf der ganzen Seite. Genau dieser Fall ist in `CLAUDE.md`
// festgehalten („Werte und Typen gehören in eine Nachbardatei ohne die
// Direktive") — hier ist diese Nachbardatei.
//
// Typen wären dort erlaubt (sie verschwinden beim Übersetzen); sie stehen
// trotzdem mit hier, damit Wert und Typ nicht auseinanderlaufen.

/** Deckungsgleich mit `ERLAUBTE_ARTEN` in
 *  `apps/api/src/features/site_config/beitrag_eigene_felder.py` und mit dem
 *  CHECK der Spalte `art` in Migration 0485.
 *
 *  `richtext` fehlt bewusst: ein zweiter Fließtext neben dem Beitragstext wäre
 *  ein zweiter Ort für denselben Inhalt, und der Renderer hätte keine Stelle,
 *  ihn zu zeigen. */
export const EIGENE_FELD_ARTEN = [
  "text",
  "zahl",
  "datum",
  "schalter",
  "liste",
  "link",
  "bild",
  "galerie",
] as const;

export type EigeneFeldArt = (typeof EIGENE_FELD_ARTEN)[number];
