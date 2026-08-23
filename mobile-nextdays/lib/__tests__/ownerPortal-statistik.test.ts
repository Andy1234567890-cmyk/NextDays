// Tests der Zeitraum-Rechnung für die Eigentümer-Auslastung
// (lib/ownerPortal.ts).
//
// WARUM: Der Statistik-Endpunkt weist jede Spanne über 730 Tage mit 422 ab
// (harte Obergrenze, Wurzel 8). Die App darf so eine Spanne gar nicht erst
// bauen — sonst erklärt sie dem Eigentümer einen Fehler, den sie selbst
// verursacht hat. Und das Datum muss LOKAL gerechnet sein: ein
// toISOString()-Ausrutscher verschiebt den Zeitraum je nach Zeitzone um einen
// Tag, was niemandem auffällt und trotzdem falsche Monatswerte liefert.
export {};

type Modul = typeof import("../ownerPortal");

const {
  STATISTIK_MAX_TAGE,
  statistikSpanneErlaubt,
  statistikSpanneTage,
  statistikZeitraum,
}: Modul = require("../ownerPortal");

describe("statistikSpanneTage", () => {
  it("zählt beide Randtage mit", () => {
    expect(statistikSpanneTage("2026-08-01", "2026-08-01")).toBe(1);
    expect(statistikSpanneTage("2026-08-01", "2026-08-31")).toBe(31);
  });

  it("rechnet über eine Sommerzeit-Umstellung hinweg richtig", () => {
    // 29.03.2026 ist die Umstellung in Europa: ohne lokale Mitternacht käme
    // hier durch die fehlende Stunde ein Tag zu wenig heraus.
    expect(statistikSpanneTage("2026-03-01", "2026-04-01")).toBe(32);
  });

  it("liefert NaN bei unbrauchbarem Datum — nichts wird geraten", () => {
    expect(Number.isNaN(statistikSpanneTage("kein-datum", "2026-08-01"))).toBe(true);
  });
});

describe("statistikSpanneErlaubt", () => {
  it("erlaubt genau die Obergrenze und weist alles darüber ab", () => {
    expect(STATISTIK_MAX_TAGE).toBe(730);
    expect(statistikSpanneErlaubt("2025-01-01", "2026-12-31")).toBe(true); // 730
    expect(statistikSpanneErlaubt("2025-01-01", "2027-01-01")).toBe(false); // 731
  });

  it("weist eine rückwärts laufende oder unbrauchbare Spanne ab (fail-closed)", () => {
    expect(statistikSpanneErlaubt("2026-08-31", "2026-08-01")).toBe(false);
    expect(statistikSpanneErlaubt("2026-08-01", "unfug")).toBe(false);
  });
});

describe("statistikZeitraum", () => {
  it("beginnt am Ersten des N-ten Monats rückwärts und endet heute", () => {
    const heute = new Date(2026, 7, 23); // 23.08.2026, lokal
    expect(statistikZeitraum(12, heute)).toEqual({ from: "2025-09-01", to: "2026-08-23" });
    expect(statistikZeitraum(6, heute)).toEqual({ from: "2026-03-01", to: "2026-08-23" });
    expect(statistikZeitraum(3, heute)).toEqual({ from: "2026-06-01", to: "2026-08-23" });
  });

  it("hält jeden angebotenen Zeitraum unter der Server-Obergrenze", () => {
    const heute = new Date(2026, 7, 23);
    for (const monate of [3, 6, 12]) {
      const z = statistikZeitraum(monate, heute);
      expect(statistikSpanneErlaubt(z.from, z.to)).toBe(true);
    }
  });

  it("rechnet über den Jahreswechsel zurück", () => {
    const heute = new Date(2026, 0, 15); // 15.01.2026
    expect(statistikZeitraum(3, heute)).toEqual({ from: "2025-11-01", to: "2026-01-15" });
  });
});
