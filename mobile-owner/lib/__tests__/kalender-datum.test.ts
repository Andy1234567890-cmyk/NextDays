// Datumsroutinen des Kalenders. Sie sind der Grund, warum diese Tests
// existieren: eine UTC-Verschiebung zeigt den FALSCHEN Tag als belegt, und das
// sieht niemand — die Zahl ist plausibel, nur um einen Tag verschoben.
//
// Geprüft wird bewusst in ZWEI Zeitzonen (CLAUDE.md/Memory: CI läuft in UTC,
// der Betrieb in Europe/Copenhagen). Ein Test, der nur in UTC läuft, hätte
// genau den Fehler nicht gefunden, den er verhindern soll.
import { iso, monatsRaster } from "@/screens/Kalender";

describe("iso", () => {
  it("bildet das LOKALE Datum, nicht das UTC-Datum", () => {
    // 1. März 2026, 00:30 lokal. `toISOString()` läge östlich von UTC noch im
    // Februar — genau die Verschiebung, die den Kalender falsch färbt.
    const d = new Date(2026, 2, 1, 0, 30);
    expect(iso(d)).toBe("2026-03-01");
  });

  it("füllt Monat und Tag zweistellig", () => {
    expect(iso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("stimmt auch am letzten Tag des Jahres", () => {
    expect(iso(new Date(2026, 11, 31, 23, 45))).toBe("2026-12-31");
  });
});

describe("monatsRaster", () => {
  it("beginnt montags und hat den richtigen Vorlauf", () => {
    // März 2026 beginnt an einem Sonntag → sechs leere Zellen davor.
    const zellen = monatsRaster(2026, 2);
    expect(zellen.slice(0, 6).every((z) => z === null)).toBe(true);
    expect(iso(zellen[6] as Date)).toBe("2026-03-01");
  });

  it("hat ohne Vorlauf keine leere Zelle", () => {
    // Juni 2026 beginnt an einem Montag.
    const zellen = monatsRaster(2026, 5);
    expect(zellen[0]).not.toBeNull();
    expect(iso(zellen[0] as Date)).toBe("2026-06-01");
  });

  it("kennt die Schaltjahres-Länge", () => {
    const tage2028 = monatsRaster(2028, 1).filter(Boolean).length;
    const tage2026 = monatsRaster(2026, 1).filter(Boolean).length;
    expect(tage2028).toBe(29);
    expect(tage2026).toBe(28);
  });

  it("enthält jeden Tag genau einmal", () => {
    const tage = monatsRaster(2026, 8).filter(Boolean) as Date[];
    const menge = new Set(tage.map(iso));
    expect(menge.size).toBe(tage.length);
    expect(tage.length).toBe(30);
  });
});
