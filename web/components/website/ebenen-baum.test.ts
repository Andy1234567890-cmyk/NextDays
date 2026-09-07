// `bun test web/components/website/ebenen-baum.test.ts`
import { describe, expect, test } from "bun:test";

import type { Block } from "@/lib/site-pages";

import {
  anzeigeBloecke,
  baumSortiert,
  elternKette,
  sichtbareReihenfolge,
  zugPruefen,
} from "./ebenen-baum";

function block(
  id: string,
  kind: Block["kind"],
  parent: string | null,
  position: number,
  settings: Record<string, unknown> = {},
): Block {
  return {
    id,
    page_id: "p",
    kind,
    parent_id: parent,
    position,
    type: "rich_text",
    content: {},
    settings,
  };
}

const container = [
  block("s1", "section", null, 1),
  block("s0", "section", null, 0),
  block("c1", "column", "s1", 0),
  block("c0", "column", "s0", 0),
];

describe("anzeigeBloecke", () => {
  test("Bausteine kommen aus der Bearbeitungsliste, ungespeicherte über den Key", () => {
    const bloecke = anzeigeBloecke(
      container,
      [
        {
          key: "k-neu",
          id: null,
          typ: "rich_text",
          content: {},
          settings: {},
          parentId: null,
        },
        {
          key: "k-1",
          id: "w1",
          typ: "rich_text",
          content: {},
          settings: {},
          parentId: "c0",
        },
      ],
      "p",
    );
    const ids = bloecke.map((b) => b.id);
    expect(ids).toContain("k-neu");
    expect(ids).toContain("w1");
    expect(bloecke.find((b) => b.id === "w1")?.parent_id).toBe("c0");
    // Container-Zeilen bleiben, Server-Bausteine in `container` werden nicht
    // doppelt geführt.
    expect(ids.filter((i) => i === "s1")).toHaveLength(1);
  });
});

describe("baumSortiert", () => {
  test("ordnet nach position, nicht nach Eingabereihenfolge (Befund 4)", () => {
    const baum = baumSortiert(container);
    expect(baum.map((k) => k.block.id)).toEqual(["s0", "s1"]);
  });
});

describe("elternKette", () => {
  test("liefert die Kette bis zur Wurzel", () => {
    const bloecke = [...container, block("w1", "widget", "c1", 0)];
    expect(elternKette(bloecke, "w1")).toEqual(["c1", "s1"]);
  });
  test("bricht bei einem Zyklus ab statt zu hängen (Befund 10)", () => {
    const zyklus = [
      block("a", "section", "b", 0),
      block("b", "column", "a", 0),
    ];
    expect(elternKette(zyklus, "a")).toEqual(["b"]);
  });
});

describe("zugPruefen", () => {
  const bloecke = [
    ...container,
    block("w1", "widget", "c0", 0),
    block("w2", "widget", "c1", 0),
    block("cGesperrt", "column", "s1", 1, { locked: true }),
  ];
  test("Baustein hinein in eine Spalte", () => {
    expect(zugPruefen(bloecke, "w1", "c1", "hinein")).toEqual({
      erlaubt: true,
    });
  });
  test("Baustein neben einen Baustein, nicht neben eine Spalte", () => {
    expect(zugPruefen(bloecke, "w1", "w2", "vor")).toEqual({ erlaubt: true });
    expect(zugPruefen(bloecke, "w1", "c1", "vor")).toMatchObject({
      erlaubt: false,
      grund: "nebenBaustein",
    });
  });
  test("Container nur unter Geschwistern", () => {
    expect(zugPruefen(bloecke, "s0", "s1", "nach")).toEqual({ erlaubt: true });
    expect(zugPruefen(bloecke, "c0", "c1", "vor")).toMatchObject({
      erlaubt: false,
      grund: "andererElternteil",
    });
    expect(zugPruefen(bloecke, "c0", "s1", "hinein")).toMatchObject({
      erlaubt: false,
      grund: "containerNichtUmhaengen",
    });
  });
  test("nichts in einen eigenen Nachkommen", () => {
    expect(zugPruefen(bloecke, "s1", "w2", "vor")).toMatchObject({
      erlaubt: false,
      grund: "zyklus",
    });
  });
  test("gesperrtes Ziel nimmt nichts an (Befund 13)", () => {
    expect(zugPruefen(bloecke, "w1", "cGesperrt", "hinein")).toMatchObject({
      erlaubt: false,
      grund: "zielGesperrt",
    });
  });
});

describe("sichtbareReihenfolge", () => {
  test("überspringt zugeklappte Zweige", () => {
    const baum = baumSortiert([...container, block("w1", "widget", "c0", 0)]);
    expect(sichtbareReihenfolge(baum, new Set())).toEqual([
      "s0",
      "c0",
      "w1",
      "s1",
      "c1",
    ]);
    expect(sichtbareReihenfolge(baum, new Set(["s0"]))).toEqual([
      "s0",
      "s1",
      "c1",
    ]);
  });
});
