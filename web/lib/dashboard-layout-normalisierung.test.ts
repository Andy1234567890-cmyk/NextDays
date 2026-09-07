// `bun test web/lib/dashboard-layout-normalisierung.test.ts`
import { describe, expect, test } from "bun:test";

import {
  BREITE,
  KACHEL_IDS,
  KATALOG,
  type KachelId,
  SPALTEN,
  darfKachelSehen,
} from "@/lib/dashboard-katalog";

import {
  anordnungAusLayout,
  ausblenden,
  einblenden,
  groesseSetzen,
  hatKollision,
  layoutAusAnordnung,
  packen,
  standardAnordnung,
  verschieben,
} from "./dashboard-layout-normalisierung";

const ALLE = [...KACHEL_IDS];

describe("Katalog", () => {
  test("KACHEL_IDS und KATALOG sind deckungsgleich und dublettenfrei", () => {
    const ids = KATALOG.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...KACHEL_IDS].sort());
  });

  test("jede Standardgröße ist eine erlaubte Größe der Kachel", () => {
    for (const k of KATALOG) {
      expect(k.groessen).toContain(k.standardGroesse);
    }
  });
});

describe("packen", () => {
  test("bricht um, wenn die Breite nicht mehr in die Zeile passt", () => {
    const pos = packen([
      { id: "liste:checkouts", groesse: "m" },
      { id: "liste:checkins", groesse: "m" },
      { id: "kpi:checkins", groesse: "s" },
      { id: "kpi:confirmed", groesse: "s" },
      { id: "objekt:gesamt", groesse: "s" },
      { id: "nachricht:ungelesen", groesse: "l" },
    ]);
    expect(pos.map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [6, 0],
      [0, 1],
      [4, 1],
      [8, 1],
      [0, 2],
    ]);
  });

  test("erzeugt nie eine Kollision, auch bei zufälligen Größen", () => {
    const groessen = ["s", "m", "l"] as const;
    for (let lauf = 0; lauf < 200; lauf += 1) {
      const eintraege = ALLE.map((id, i) => ({
        id,
        groesse: groessen[(i * 7 + lauf) % 3],
      }));
      const pos = packen(eintraege);
      expect(hatKollision(pos)).toBe(false);
      for (const p of pos) expect(p.x + BREITE[p.groesse]).toBeLessThanOrEqual(SPALTEN);
    }
  });
});

describe("anordnungAusLayout", () => {
  test("ohne Layout: Katalog-Standard nur mit erlaubten Kacheln", () => {
    const erlaubt: KachelId[] = ["kpi:checkins", "objekt:gesamt"];
    const a = anordnungAusLayout(null, erlaubt);
    expect(a.sichtbar.map((k) => k.id)).toEqual(["kpi:checkins", "objekt:gesamt"]);
    expect(a.ausgeblendet).toEqual([]);
  });

  test("gespeicherte Kollisionen werden durch Neupacken aufgelöst", () => {
    const a = anordnungAusLayout(
      {
        schema_version: 1,
        kacheln: [
          { id: "kpi:checkins", x: 0, y: 0, groesse: "s" },
          { id: "kpi:confirmed", x: 0, y: 0, groesse: "s" },
          { id: "liste:checkouts", x: 2, y: 0, groesse: "l" },
        ],
        ausgeblendet: [],
      },
      ["kpi:checkins", "kpi:confirmed", "liste:checkouts"],
    );
    const layout = layoutAusAnordnung(a);
    expect(hatKollision(layout.kacheln)).toBe(false);
    // Reihenfolge y, dann x, bei Gleichstand stabil.
    expect(layout.kacheln.map((k) => k.id)).toEqual([
      "kpi:checkins",
      "kpi:confirmed",
      "liste:checkouts",
    ]);
  });

  test("unbekannte, unerlaubte und doppelte IDs fallen weg", () => {
    const a = anordnungAusLayout(
      {
        schema_version: 1,
        kacheln: [
          { id: "kpi:erfunden" as KachelId, x: 0, y: 0, groesse: "s" },
          { id: "kpi:revenue", x: 4, y: 0, groesse: "s" },
          { id: "kpi:checkins", x: 8, y: 0, groesse: "s" },
          { id: "kpi:checkins", x: 0, y: 1, groesse: "m" },
        ],
        ausgeblendet: ["kpi:erfunden" as KachelId, "kpi:revenue"],
      },
      ["kpi:checkins", "objekt:gesamt"],
    );
    expect(a.sichtbar.map((k) => k.id)).toEqual(["kpi:checkins", "objekt:gesamt"]);
    expect(a.sichtbar[0].groesse).toBe("s");
    expect(a.ausgeblendet).toEqual([]);
  });

  test("neue Katalog-Kacheln werden angehängt, nicht ausgeblendet", () => {
    const a = anordnungAusLayout(
      {
        schema_version: 1,
        kacheln: [{ id: "objekt:gesamt", x: 0, y: 0, groesse: "s" }],
        ausgeblendet: ["objekt:inaktiv"],
      },
      ["objekt:gesamt", "objekt:inaktiv", "objekt:entwurf"],
    );
    expect(a.sichtbar.map((k) => k.id)).toEqual(["objekt:gesamt", "objekt:entwurf"]);
    expect(a.ausgeblendet).toEqual(["objekt:inaktiv"]);
  });

  test("eine Größe, die die Kachel nicht trägt, fällt auf ihre Standardgröße", () => {
    const a = anordnungAusLayout(
      {
        schema_version: 1,
        kacheln: [{ id: "liste:checkouts", x: 0, y: 0, groesse: "s" }],
        ausgeblendet: [],
      },
      ["liste:checkouts"],
    );
    expect(a.sichtbar[0].groesse).toBe("m");
  });
});

describe("Operationen", () => {
  const start = standardAnordnung(["kpi:checkins", "kpi:confirmed", "objekt:gesamt"]);

  test("verschieben ordnet um und behält Größen", () => {
    const a = verschieben(start, "objekt:gesamt", "kpi:checkins");
    expect(a.sichtbar.map((k) => k.id)).toEqual([
      "objekt:gesamt",
      "kpi:checkins",
      "kpi:confirmed",
    ]);
  });

  test("Größenwechsel packt neu und lehnt unerlaubte Größen ab", () => {
    const a = groesseSetzen(start, "kpi:checkins", "m");
    expect(a.sichtbar[0].groesse).toBe("m");
    expect(layoutAusAnordnung(a).kacheln.map((k) => k.x)).toEqual([0, 6, 0]);
    // `l` ist für eine Kennzahl nicht erlaubt → unverändert.
    expect(groesseSetzen(start, "kpi:checkins", "l")).toBe(start);
  });

  test("aus- und einblenden sind Umkehrungen, Einblenden hängt hinten an", () => {
    const aus = ausblenden(start, "kpi:checkins");
    expect(aus.sichtbar.map((k) => k.id)).toEqual(["kpi:confirmed", "objekt:gesamt"]);
    expect(aus.ausgeblendet).toEqual(["kpi:checkins"]);
    const ein = einblenden(aus, "kpi:checkins");
    expect(ein.sichtbar.map((k) => k.id)).toEqual([
      "kpi:confirmed",
      "objekt:gesamt",
      "kpi:checkins",
    ]);
    expect(ein.ausgeblendet).toEqual([]);
  });
});

describe("darfKachelSehen", () => {
  const me = (role: string | null, capabilities: string[], permissions: string[]) => ({
    role,
    capabilities,
    permissions,
  });

  test("admin sieht alles, auch Beträge trotz hide_prices", () => {
    expect(darfKachelSehen({ art: "betraege" }, me("admin", [], ["hide_prices"]))).toBe(true);
  });

  test("Beträge verlangen pm_booking_total ohne hide_prices", () => {
    expect(darfKachelSehen({ art: "betraege" }, me("owner", [], ["pm_booking_total"]))).toBe(true);
    expect(
      darfKachelSehen({ art: "betraege" }, me("owner", [], ["pm_booking_total", "hide_prices"])),
    ).toBe(false);
    expect(darfKachelSehen({ art: "betraege" }, me("staff", [], []))).toBe(false);
  });

  test("Capability und Permission werden getrennt geprüft, fail-closed", () => {
    expect(
      darfKachelSehen({ art: "capability", capability: "approve_block" }, me("co_admin", ["approve_block"], [])),
    ).toBe(true);
    expect(
      darfKachelSehen({ art: "capability", capability: "approve_block" }, me("co_admin", [], ["approve_block"])),
    ).toBe(false);
    expect(darfKachelSehen({ art: "permission", permission: "pm_chat" }, me(null, [], []))).toBe(false);
  });
});
