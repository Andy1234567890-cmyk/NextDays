// FILTERN und SORTIEREN nach beliebigem Feld (Framer B4/B5).
//
// WAS DAS VORBILD MACHT — UND WAS WIR VORHER HATTEN
// =================================================
// Am 28.08.2026 im offenen Framer-Projekt abgelesen: „Filter" öffnet ein Menü
// mit ALLEN Feldern der Collection; je nach Feldart bekommt man verschiedene
// Operatoren (Textfelder `Is Set`/`Isn't Set`, Datumsfelder sieben Stück).
// „Sorting" öffnet ein Panel mit Feld und Richtung — als ENTWURF, mit
// `Discard`/`Save`.
//
// Bei uns gab es vier feste Sortierungen (manuell, neueste, älteste, Titel)
// und genau einen Filter (Status). Bei 34 Spalten heisst das: nach 32 davon
// liess sich weder sortieren noch filtern.
//
// DIE EINE ASYMMETRIE, DIE ABSICHT IST
// ====================================
// Die Sortierung ist ein ENTWURF, der Filter nicht. Das steht so in der
// Analyse (Abschnitt G: „Wer beides gleich baut, baut eines davon falsch") und
// hat einen Grund: eine Sortierung ist eine Eigenschaft der LISTE, die man
// speichert; ein Filter ist ein Blick, den man wieder wegnimmt. Diese Datei
// trägt beides, aber getrennt.
//
// VERGLICHEN WIRD DER ROHWERT
// ===========================
// Nie der angezeigte. `rohWert` liefert Text, Zahl, Wahrheitswert oder Liste;
// ein Datum kommt als ISO-Zeichenkette. Wer gegen „28. Aug. 2026" filtert,
// filtert gegen die Sprache des Betrachters.
import type { Page } from "@/lib/site-pages";

import { type Spalte, rohWert } from "./spalten";

/** Die Operatoren. Ihre Namen sind i18n-Schlüssel unter
 *  `website.blog.filterOp.*` — die Liste steht hier und nicht in der
 *  Oberfläche, weil dieselben Namen an drei Stellen gebraucht werden (Menü,
 *  Chip, Vorlesefunktion). */
export const OPERATOREN = [
  "gesetzt",
  "nichtGesetzt",
  "enthaelt",
  "istGleich",
  "istNicht",
  "groesser",
  "kleiner",
  "vor",
  "nach",
  "ja",
  "nein",
] as const;
export type Operator = (typeof OPERATOREN)[number];

export type Filter = {
  /** Der Spaltenschlüssel. */
  key: string;
  op: Operator;
  /** Der Vergleichswert. Bei `gesetzt`/`nichtGesetzt`/`ja`/`nein` leer — die
   *  Operatoren tragen ihre Aussage selbst. */
  wert: string;
};

/** Welche Operatoren zu welcher Feldart passen.
 *
 *  Eine Zuordnung und keine Kette von `if`s an der Anzeigestelle: sonst zeigt
 *  das Menü einem Schalter „enthält" an, und der Filter liefert dauerhaft
 *  nichts — ein Ergebnis, das wie ein leerer Bestand aussieht.
 *
 *  `gesetzt`/`nichtGesetzt` stehen bei JEDER Art. Das ist der Filter, den das
 *  Vorbild für Textfelder als einzigen anbietet, und er ist der nützlichste:
 *  „welchem Beitrag fehlt noch das Titelbild". */
export function operatorenFuer(art: Spalte["art"]): Operator[] {
  switch (art) {
    case "schalter":
      return ["ja", "nein"];
    case "zahl":
      return ["istGleich", "groesser", "kleiner", "gesetzt", "nichtGesetzt"];
    case "datum":
      return ["vor", "nach", "istGleich", "gesetzt", "nichtGesetzt"];
    case "bild":
    case "galerie":
      return ["gesetzt", "nichtGesetzt"];
    case "liste":
      return ["enthaelt", "gesetzt", "nichtGesetzt"];
    case "status":
      return ["istGleich", "istNicht"];
    default:
      return ["enthaelt", "istGleich", "istNicht", "gesetzt", "nichtGesetzt"];
  }
}

/** Braucht dieser Operator einen Vergleichswert? */
export function brauchtWert(op: Operator): boolean {
  return !["gesetzt", "nichtGesetzt", "ja", "nein"].includes(op);
}

/** Ist ein Rohwert „gesetzt"?
 *
 *  `false` ist GESETZT. Ein Schalter auf „nein" ist eine Entscheidung, keine
 *  Lücke — ihn als „nicht gesetzt" zu zählen wäre dieselbe Verwechslung wie
 *  `0` und `null` (Wurzel 4). Eine leere Liste und ein leerer Text dagegen
 *  sind Lücken.
 */
function istGesetzt(wert: unknown): boolean {
  if (wert === null || wert === undefined) return false;
  if (typeof wert === "string") return wert.trim().length > 0;
  if (Array.isArray(wert)) return wert.length > 0;
  return true;
}

function alsText(wert: unknown): string {
  if (wert === null || wert === undefined) return "";
  if (Array.isArray(wert)) return wert.join(" ");
  return String(wert);
}

/** Trifft EIN Filter auf EINE Zeile zu?
 *
 *  `zustand` kommt von aussen, weil der Status kein Feld der Zeile ist,
 *  sondern aus drei Spalten abgeleitet wird (`zustandVon`). Ihn hier noch
 *  einmal abzuleiten wäre eine zweite Wahrheit darüber, wann ein Beitrag
 *  „bereit" ist (Wurzel 2). */
export function trifftZu(
  filter: Filter,
  spalte: Spalte,
  beitrag: Page,
  zustand: string,
): boolean {
  const roh = spalte.key === "status" ? zustand : rohWert(spalte, beitrag);
  const gesucht = filter.wert.trim().toLowerCase();

  switch (filter.op) {
    case "gesetzt":
      return istGesetzt(roh);
    case "nichtGesetzt":
      return !istGesetzt(roh);
    case "ja":
      return roh === true;
    case "nein":
      return roh !== true;
    case "enthaelt":
      return alsText(roh).toLowerCase().includes(gesucht);
    case "istGleich":
      if (spalte.art === "zahl") return Number(roh) === Number(gesucht);
      if (spalte.art === "datum") {
        // Auf den TAG genau, nicht auf die Sekunde: in der Zeile steht ein
        // Zeitstempel, im Filter ein Datum. Ein Vergleich der vollen
        // Zeichenketten träfe nie zu.
        return alsText(roh).slice(0, 10) === gesucht;
      }
      return alsText(roh).toLowerCase() === gesucht;
    case "istNicht":
      return alsText(roh).toLowerCase() !== gesucht;
    case "groesser":
      return Number(roh) > Number(gesucht);
    case "kleiner":
      return Number(roh) < Number(gesucht);
    case "vor":
      return istGesetzt(roh) && alsText(roh).slice(0, 10) < gesucht;
    case "nach":
      return istGesetzt(roh) && alsText(roh).slice(0, 10) > gesucht;
    default:
      // Ein unbekannter Operator lässt die Zeile stehen, statt sie
      // wegzufiltern: ein Filter, der ohne Grund alles ausblendet, sieht aus
      // wie ein leerer Bestand.
      return true;
  }
}

/** Die Sortierung: ein Feld und eine Richtung.
 *
 *  `manuell` ist die Handsortierung (Ziehgriff) und deshalb kein Spaltenname —
 *  sie steht in `post_sort` und nicht in einem Feld, das man anzeigen könnte.
 */
export type Sortierung = {
  key: "manuell" | string;
  richtung: "auf" | "ab";
};

/** Zwei Zeilen nach einer Spalte vergleichen.
 *
 *  Leere Werte stehen IMMER hinten, in beiden Richtungen. Das ist Absicht:
 *  „absteigend nach Datum" soll die neuesten zeigen, nicht die undatierten —
 *  und wer nach einem Feld sortiert, sucht die Zeilen, die es haben. */
export function vergleiche(spalte: Spalte, a: Page, b: Page): number {
  const wa = rohWert(spalte, a);
  const wb = rohWert(spalte, b);
  const la = istGesetzt(wa);
  const lb = istGesetzt(wb);
  if (!la && !lb) return 0;
  if (!la) return 1;
  if (!lb) return -1;
  if (spalte.art === "zahl") return Number(wa) - Number(wb);
  if (spalte.art === "schalter") return Number(wb) - Number(wa);
  // Datum als ISO-Zeichenkette: die Zeichenfolge ist dort chronologisch, und
  // ein `new Date()` je Vergleich wären bei 200 Zeilen tausende Objekte.
  return alsText(wa).localeCompare(alsText(wb), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}
