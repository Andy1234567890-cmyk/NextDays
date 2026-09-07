import { describe, expect, test } from "bun:test";
import {
  eigenerWert,
  herkunft,
  jeGeraetMoeglich,
  mitWert,
  wirksamerWert,
} from "../src/index";

describe("mitWert / eigenerWert / wirksamerWert", () => {
  test("Desktop schreibt in die Grundfassung, verschachtelt", () => {
    const s = mitWert({}, "desktop", ["stil", "opazitaet"], 0.5);
    expect(s).toEqual({ stil: { opazitaet: 0.5 } });
    expect(eigenerWert(s, "desktop", ["stil", "opazitaet"])).toBe(0.5);
  });
  test("Tablet schreibt nach je_geraet.tablet und lässt die Grundfassung", () => {
    const basis = { stil: { opazitaet: 0.5 } };
    const s = mitWert(basis, "tablet", ["stil", "opazitaet"], 0.8);
    expect(s).toEqual({
      stil: { opazitaet: 0.5 },
      je_geraet: { tablet: { stil: { opazitaet: 0.8 } } },
    });
    expect(basis).toEqual({ stil: { opazitaet: 0.5 } });
    expect(eigenerWert(s, "tablet", ["stil", "opazitaet"])).toBe(0.8);
    expect(eigenerWert(s, "mobil", ["stil", "opazitaet"])).toBeUndefined();
    expect(wirksamerWert(s, "mobil", ["stil", "opazitaet"])).toBe(0.8);
    expect(herkunft(s, "mobil", ["stil", "opazitaet"])).toEqual({ quelle: "tablet", eigen: false });
  });
  test("null löscht und räumt leere Unterobjekte weg", () => {
    const s = mitWert(
      { stil: { opazitaet: 0.5 }, je_geraet: { tablet: { stil: { opazitaet: 0.8 } } } },
      "tablet",
      ["stil", "opazitaet"],
      null,
    );
    expect(s).toEqual({ stil: { opazitaet: 0.5 } });
    expect(mitWert(s, "desktop", ["stil", "opazitaet"], null)).toEqual({});
  });
  test("scroll und a11y gibt es nur in der Grundfassung", () => {
    expect(jeGeraetMoeglich(["scroll", "anker"])).toBe(false);
    expect(jeGeraetMoeglich(["stil", "radius"])).toBe(true);
    const s = mitWert({}, "mobil", ["scroll", "anker"], "kontakt");
    expect(s).toEqual({ scroll: { anker: "kontakt" } });
    expect(eigenerWert(s, "mobil", ["scroll", "anker"])).toBe("kontakt");
  });
  test("ein ganzes Unterobjekt ersetzen (Radius als eine Zeile)", () => {
    const s = mitWert({ stil: { radius: { alle: 8 } } }, "desktop", ["stil", "radius"], {
      oben_links: 4,
      oben_rechts: 4,
    });
    expect(s.stil).toEqual({ radius: { oben_links: 4, oben_rechts: 4 } });
  });
  test("fremde Schlüssel bleiben unberührt", () => {
    const s = mitWert({ hidden_on: ["mobil"], layout_abstand: 16 }, "tablet", ["layout_abstand"], 8);
    expect(s.hidden_on).toEqual(["mobil"]);
    expect(s.layout_abstand).toBe(16);
    expect(wirksamerWert(s, "tablet", ["layout_abstand"])).toBe(8);
  });
});
