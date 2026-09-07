import { describe, expect, test } from "bun:test";
import {
  KOPF_GRUPPE,
  mitTeilVersteckt,
  regionLesen,
  regionZumSpeichern,
  sichtbarkeitKlassen,
  teilStand,
  teilVerschoben,
  teilVerschobenVor,
  teileReihenfolge,
} from "../src/index";

describe("Regionen (Kopf-/Fußzeile als Ebenen)", () => {
  test("leerer Wert = Standard: alles sichtbar, Standardreihenfolge", () => {
    const s = regionLesen("kopfzeile", null);
    expect(s.reihenfolge).toEqual(["logo", "slogan", "navigation", "sprachwaehler", "buchen"]);
    expect(s.hidden_on).toEqual([]);
    expect(teilStand(s, "logo")).toEqual({ hidden_on: [], locked: false });
  });
  test("Reihenfolge: Unbekanntes und Doppeltes raus, Fehlendes hinten dran", () => {
    const s = regionLesen("fusszeile", { reihenfolge: ["copyright", "x", "copyright", "social"] });
    expect(s.reihenfolge).toEqual(["copyright", "social", "navigation", "bildnachweise"]);
  });
  test("Teile: nur bekannte, nur gültige Geräte", () => {
    const s = regionLesen("kopfzeile", {
      teile: { buchen: { hidden_on: ["mobil", "tv"], locked: true }, fremd: { locked: true } },
    });
    expect(s.teile).toEqual({ buchen: { hidden_on: ["mobil"], locked: true } });
  });
  test("Verschieben bleibt in der Gruppe; Logo/Slogan rühren sich nicht", () => {
    let s = regionLesen("kopfzeile", null);
    s = teilVerschoben(s, "buchen", -1, KOPF_GRUPPE);
    expect(s.reihenfolge).toEqual(["logo", "slogan", "navigation", "buchen", "sprachwaehler"]);
    s = teilVerschoben(s, "navigation", -1, KOPF_GRUPPE);
    expect(s.reihenfolge[2]).toBe("navigation");
    expect(teileReihenfolge(s, KOPF_GRUPPE)).toEqual(["navigation", "buchen", "sprachwaehler"]);
  });
  test("Ziehen vor ein anderes Teil bleibt in der Gruppe", () => {
    const s = regionLesen("kopfzeile", null);
    expect(teilVerschobenVor(s, "buchen", "navigation", KOPF_GRUPPE).reihenfolge).toEqual([
      "logo", "slogan", "buchen", "navigation", "sprachwaehler",
    ]);
    expect(teilVerschobenVor(s, "buchen", "logo", KOPF_GRUPPE)).toBe(s);
  });
  test("Speichern schreibt nur Abweichungen", () => {
    const s = regionLesen("fusszeile", null);
    expect(regionZumSpeichern("fusszeile", s)).toEqual({});
    const v = mitTeilVersteckt(s, "social", ["mobil", "desktop"]);
    expect(regionZumSpeichern("fusszeile", v)).toEqual({
      teile: { social: { hidden_on: ["desktop", "mobil"], locked: false } },
    });
    expect(regionZumSpeichern("fusszeile", mitTeilVersteckt(v, "social", []))).toEqual({});
  });
  test("Sichtbarkeitsklassen wie beim Block", () => {
    expect(sichtbarkeitKlassen([], false)).toBe("");
    expect(sichtbarkeitKlassen(["mobil"], false)).toBe("hidden md:block");
    expect(sichtbarkeitKlassen(["desktop"], false)).toBe("block lg:hidden");
    expect(sichtbarkeitKlassen(["tablet"], true)).toBe("opacity-100 md:opacity-40 lg:opacity-100");
  });
});
