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
export function spanZeigen(
  eltern: BaumKnoten | null,
  knoten: BaumKnoten,
): boolean {
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

// ---------------------------------------------------------------------------
// Etappe 1 der Framer-Parität (05.09.2026, docs/BAUKASTEN-EBENEN-BEFUNDE-2026-09-05.md)
// ---------------------------------------------------------------------------

/** Eine Bearbeitungszeile des Editors — so viel davon, wie der Baum braucht.
 *
 *  Der Editor führt Bausteine in `zeilen` (mit `key`, weil neue noch keine
 *  DB-ID haben) und Container in `baumBlocks`. Der Baum zeigte bis heute NUR
 *  `baumBlocks` — und der änderte sich erst nach `router.refresh()`. Jede
 *  Bausteinänderung (hinzufügen, löschen, umsortieren, sperren, verstecken)
 *  war im Baum deshalb unsichtbar, bis man die Seite neu lud (Befund 1/2). */
export type BaumZeile = {
  key: string;
  id: string | null;
  typ: Block["type"];
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  parentId?: string | null;
};

/** Kennung, unter der ein Baustein im Baum geführt wird: die DB-ID, und für
 *  einen noch ungespeicherten sein Editor-Schlüssel. */
export function baumKennung(z: BaumZeile): string {
  return z.id ?? z.key;
}

/**
 * Der Baum, wie der Editor ihn ZEIGT — Container vom Server, Bausteine aus
 * der Bearbeitungsliste. EINE Quelle für Ebenen und Abschnittsliste (Wurzel 2).
 *
 * Die Reihenfolge der Bausteine ist die der Liste (`position` = Listenindex);
 * die Container behalten ihre Server-`position`. Ein Baustein ohne Elternteil
 * (frisch angelegt, noch nicht gespeichert) steht als Wurzel und trägt keine
 * Container-Hülle — der Server legt sie beim Speichern an.
 */
export function anzeigeBloecke(
  container: readonly Block[],
  zeilen: readonly BaumZeile[],
  pageId: string,
): Block[] {
  const huellen = container.filter((b) => (b.kind ?? "widget") !== "widget");
  const bausteine: Block[] = zeilen.map((z, i) => ({
    id: baumKennung(z),
    page_id: pageId,
    kind: "widget",
    parent_id: z.parentId ?? null,
    position: i,
    type: z.typ,
    content: z.content,
    settings: z.settings,
  }));
  return [...huellen, ...bausteine];
}

/** `baumBauen`, aber die Kinder nach `position` geordnet.
 *
 *  Befund 4: `baumBauen` behielt die Eingabereihenfolge, obwohl der Editor
 *  nach einem Rangtausch nur die ZAHL änderte — der Baum bewegte sich nicht. */
export function baumSortiert(blocks: readonly Block[]): BaumKnoten[] {
  const sortiere = (liste: BaumKnoten[]): BaumKnoten[] => {
    liste.sort((a, b) => a.block.position - b.block.position);
    for (const k of liste) sortiere(k.kinder);
    return liste;
  };
  return sortiere(baumBauen([...blocks]));
}

/** Die Elternkette einer Kennung, von unten nach oben — ohne die Kennung
 *  selbst. Bricht bei einem Zyklus ab, statt ewig zu laufen (Befund 10). */
export function elternKette(blocks: readonly Block[], id: string): string[] {
  const elternVon = new Map(blocks.map((b) => [b.id, b.parent_id ?? null]));
  const kette: string[] = [];
  const gesehen = new Set<string>([id]);
  let lauf = elternVon.get(id) ?? null;
  while (lauf && !gesehen.has(lauf)) {
    gesehen.add(lauf);
    kette.push(lauf);
    lauf = elternVon.get(lauf) ?? null;
  }
  return kette;
}

export type ZugStelle = "vor" | "nach" | "hinein";

/**
 * Darf QUELLE an ZIEL gezogen werden?
 *
 * Reine Funktion, damit sie testbar ist und der Grund einer Ablehnung
 * benannt werden kann — ein stummer Drop ist derselbe Fehler wie ein
 * verschluckter Exception (Befund 11). Regeln, dieselben wie im Backend:
 *   · nichts in sich selbst oder in einen eigenen Nachkommen (Zyklus);
 *   · Baustein → vor/nach einen Baustein, oder HINEIN in eine Spalte;
 *   · Container → vor/nach einen Container DERSELBEN Art beim SELBEN
 *     Elternteil (der Server hängt Container nicht um, `move_container`
 *     ändert nur den Rang);
 *   · ein GESPERRTES Ziel nimmt nichts an, eine gesperrte Quelle bewegt sich
 *     nicht (Befund 13 — vorher war nur die Quelle geprüft).
 */
export function zugPruefen(
  blocks: readonly Block[],
  quelleId: string,
  zielId: string,
  wohin: ZugStelle,
): { erlaubt: true } | { erlaubt: false; grund: string } {
  if (quelleId === zielId) return { erlaubt: false, grund: "selbst" };
  const nachId = new Map(blocks.map((b) => [b.id, b]));
  const quelle = nachId.get(quelleId);
  const ziel = nachId.get(zielId);
  if (!quelle || !ziel) return { erlaubt: false, grund: "unbekannt" };
  if (quelle.settings?.locked === true)
    return { erlaubt: false, grund: "quelleGesperrt" };
  if (ziel.settings?.locked === true)
    return { erlaubt: false, grund: "zielGesperrt" };
  if (elternKette(blocks, zielId).includes(quelleId)) {
    return { erlaubt: false, grund: "zyklus" };
  }
  const quelleArt = quelle.kind ?? "widget";
  const zielArt = ziel.kind ?? "widget";
  if (quelleArt === "widget") {
    if (wohin === "hinein") {
      return zielArt === "column" || zielArt === "inner_column"
        ? { erlaubt: true }
        : { erlaubt: false, grund: "nurInSpalte" };
    }
    return zielArt === "widget"
      ? { erlaubt: true }
      : { erlaubt: false, grund: "nebenBaustein" };
  }
  if (wohin === "hinein")
    return { erlaubt: false, grund: "containerNichtUmhaengen" };
  if (quelleArt !== zielArt) return { erlaubt: false, grund: "andereArt" };
  if ((quelle.parent_id ?? null) !== (ziel.parent_id ?? null)) {
    return { erlaubt: false, grund: "andererElternteil" };
  }
  return { erlaubt: true };
}

/** Die Kennungen in Anzeigereihenfolge (Tiefensuche), nur die AUFGEKLAPPTEN
 *  Zweige — für ↑/↓ im Baum. */
export function sichtbareReihenfolge(
  baum: readonly BaumKnoten[],
  zu: ReadonlySet<string>,
): string[] {
  const ids: string[] = [];
  const lauf = (knoten: readonly BaumKnoten[]) => {
    for (const k of knoten) {
      ids.push(k.block.id);
      if (!zu.has(k.block.id)) lauf(k.kinder);
    }
  };
  lauf(baum);
  return ids;
}
