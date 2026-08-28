// Aus den flachen Block-Zeilen den Baum bauen — für die Ebenen-Ansicht (0472).
//
// Der Server liefert der VERWALTUNG eine flache Liste mit `parent_id`; der
// öffentliche Resolver liefert dem Renderer bereits einen Baum. Beides ist
// richtig: der Editor muss einzelne Zeilen ändern und braucht sie flach, die
// Anzeige braucht die Struktur.
//
// Diese Umwandlung steht deshalb an EINER Stelle im Dashboard und nicht in
// jeder Ansicht, die einen Baum zeigen will.

import type { Block } from "@/lib/site-pages";

/** Ein Knoten des Ebenen-Baums. */
export type BaumKnoten = {
  block: Block;
  art: "section" | "column" | "inner_column" | "widget";
  kinder: BaumKnoten[];
};

/**
 * Flache Zeilen zu einem Baum verbinden.
 *
 * Verwaiste Zeilen — solche, deren Elternteil nicht in der Liste steht —
 * werden ANGEHÄNGT statt verworfen. Anders als im Renderer: dort würde eine
 * verwaiste Spalte über die volle Breite erscheinen und wie ein Layoutfehler
 * aussehen. Hier ist die Liste ein WERKZEUG, und ein Baustein, den man nicht
 * sieht, ist einer, den man nicht mehr löschen kann.
 */
export function baumBauen(blocks: Block[]): BaumKnoten[] {
  const nachId = new Map<string, BaumKnoten>();
  for (const b of blocks) {
    nachId.set(b.id, {
      block: b,
      art: (b.kind ?? "widget") as BaumKnoten["art"],
      kinder: [],
    });
  }
  const wurzeln: BaumKnoten[] = [];
  for (const b of blocks) {
    const knoten = nachId.get(b.id)!;
    const eltern = b.parent_id ? nachId.get(b.parent_id) : null;
    if (eltern) eltern.kinder.push(knoten);
    else wurzeln.push(knoten);
  }
  return wurzeln;
}

/** Wie viele BAUSTEINE unter diesem Knoten hängen — Container zählen nicht mit.
 *
 *  Die Zahl steht an Abschnitten und Spalten. „3" an einem Abschnitt heißt
 *  „drei Inhalte", nicht „drei Spalten": Container sind Gerüst, und ein Gerüst
 *  zählt man nicht. */
export function bausteineZaehlen(knoten: BaumKnoten): number {
  if (knoten.art === "widget") return 1;
  return knoten.kinder.reduce((s, k) => s + bausteineZaehlen(k), 0);
}

/** Die BAUSTEINE unter einem Knoten, in Anzeigereihenfolge (Tiefensuche).
 *
 *  Gebraucht, um einen Container zu benennen: ein Abschnitt heißt nach dem,
 *  was in ihm steht. Acht Zeilen „Abschnitt" untereinander benennen nichts —
 *  genau das war im Screenshot vom 25.08.2026 zu sehen, und es ist der Grund,
 *  warum man den Baum dort nicht lesen konnte. */
export function bausteineDarunter(knoten: BaumKnoten): BaumKnoten[] {
  if (knoten.art === "widget") return [knoten];
  return knoten.kinder.flatMap(bausteineDarunter);
}

/**
 * Trägt der Breitenanteil dieser Spalte eine Information?
 *
 * Nein, solange sie die EINZIGE Spalte ihres Elternteils ist: „12/12" an einer
 * Spalte, die es allein gibt, sagt nur, dass die volle Breite voll ist. Im
 * Screenshot stand dieses Abzeichen achtmal untereinander und trug nichts bei
 * — es machte die Spalte, die wirklich geteilt ist, nur schwerer auffindbar.
 *
 * Dasselbe Prinzip wie im Renderer: eine Spalte über die volle Breite ist
 * keine Spalte, sie ist der Abschnitt.
 */
export function spanZeigen(eltern: BaumKnoten | null, knoten: BaumKnoten): boolean {
  if (knoten.art !== "column" && knoten.art !== "inner_column") return false;
  if (knoten.block.span == null) return false;
  const geschwister = (eltern?.kinder ?? []).filter(
    (k) => k.art === "column" || k.art === "inner_column",
  );
  return geschwister.length > 1;
}

/**
 * Die Reihenfolge der BAUSTEINE, wie der Baum sie vorgibt.
 *
 * Der Editor führt eine flache Bausteinliste, der Baum die Container. Beide
 * beschreiben dieselbe Seite, und ihre Reihenfolgen müssen übereinstimmen —
 * sonst gewinnt beim nächsten Speichern die eine über die andere.
 *
 * Genau das war der Fehler bis 28.08.2026: „Nach unten" an einem Abschnitt
 * verschob ihn korrekt (der Server quittierte 200 und die Zeile stand richtig
 * in der Datenbank), und das Speichern direkt danach schrieb die ALTE
 * Reihenfolge wieder zurück — denn `replace_blocks` leitet den Rang eines
 * Abschnitts aus der Position seines ersten Bausteins in der gesendeten Liste
 * ab. Für den Kunden bewegte sich nichts, mehrfaches Klicken half nicht, und
 * es gab keine Fehlermeldung (Wurzel 2: zwei Wege auf dieselbe Ordnung).
 *
 * Rückgabe: die Widget-IDs in Baum-Reihenfolge (Abschnitt → Spalte → Widget,
 * je nach `position`).
 */
export function bausteinReihenfolge(blocks: Block[]): string[] {
  const sortiert = (liste: BaumKnoten[]) =>
    [...liste].sort((a, b) => a.block.position - b.block.position);
  const ids: string[] = [];
  function lauf(knoten: BaumKnoten[]) {
    for (const k of sortiert(knoten)) {
      if (k.art === "widget") ids.push(k.block.id);
      else lauf(k.kinder);
    }
  }
  lauf(baumBauen(blocks));
  return ids;
}
