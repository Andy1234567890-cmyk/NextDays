// Registry aller Rechtsdokumente dieser App.
//
// EINE Liste — Seiten, Footer und Querverweise lesen daraus, damit ein neues
// Dokument nicht an drei Stellen nachgetragen werden muss und kein Link ins
// Leere zeigt. Die Anzeigetexte im Footer kommen aus messages/<locale>.json
// (footer.*), gemappt über den slug — hier steht bewusst kein deutscher Text.
import { avv } from "./avv";
import { cookies } from "./cookies";
import { datenschutz } from "./datenschutz";
import { impressum } from "./impressum";

import type { LegalDoc } from "./types";

export type LegalEintrag = { doc: LegalDoc };

// Reihenfolge = Reihenfolge im Footer.
export const RECHTSDOKUMENTE: LegalEintrag[] = [
  { doc: datenschutz },
  { doc: impressum },
  { doc: cookies },
  { doc: avv },
];

export { avv, cookies, datenschutz, impressum };
export type { LegalDoc } from "./types";
