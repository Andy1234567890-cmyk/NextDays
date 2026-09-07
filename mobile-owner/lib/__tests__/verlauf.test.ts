import { schoeneObergrenze, teilstuecke, xMarken } from "@/components/widgets/Verlauf";

describe("schoeneObergrenze", () => {
  it("rundet auf 1/2/2,5/5 × 10^n auf", () => {
    expect(schoeneObergrenze(0)).toBe(1);
    expect(schoeneObergrenze(720)).toBe(1000);
    expect(schoeneObergrenze(172.25)).toBe(200);
    expect(schoeneObergrenze(2400)).toBe(2500);
    expect(schoeneObergrenze(46.77)).toBe(50);
    expect(schoeneObergrenze(100)).toBe(100);
  });
});

describe("teilstuecke", () => {
  it("null unterbricht die Linie statt sie auf 0 zu ziehen", () => {
    const p = [
      { label: "a", wert: 1 },
      { label: "b", wert: 2 },
      { label: "c", wert: null },
      { label: "d", wert: 4 },
    ];
    expect(teilstuecke(p)).toEqual([[0, 1], [3]]);
    expect(teilstuecke([{ label: "a", wert: null }])).toEqual([]);
  });
});

describe("xMarken", () => {
  it("wenige Punkte: alle; viele: erste, letzte und drei dazwischen", () => {
    expect(xMarken(1)).toEqual([0]);
    expect(xMarken(5)).toEqual([0, 1, 2, 3, 4]);
    const m = xMarken(31);
    expect(m[0]).toBe(0);
    expect(m[m.length - 1]).toBe(30);
    expect(m.length).toBe(5);
    expect(xMarken(12)).toEqual([0, 3, 6, 8, 11]);
  });
});
