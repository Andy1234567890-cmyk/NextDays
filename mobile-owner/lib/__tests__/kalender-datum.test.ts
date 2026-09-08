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

import { monatsKennzahlen, rasterVolleWochen } from "@/screens/Kalender";
import type { PortalCalendarDay } from "@/lib/ownerPortal";

function tagK(date: string, bookings: { eigen?: boolean }[], payout: number | null, units = 1): PortalCalendarDay {
  return {
    date,
    status: bookings.length ? "booked" : "open",
    price: null,
    owner_payout_per_night: payout,
    currency: payout === null ? null : "EUR",
    owner_payout_unknown_reason: null,
    guest_first_name: null,
    booking_source: null,
    bookings: bookings.map((b, i) => ({
      reservation_id: `r${i}`,
      unit_id: null,
      owner_payout_per_night: null,
      currency: null,
      payout_unknown_reason: null,
      guest_first_name: null,
      booking_source: null,
      is_owner_stay: !!b.eigen,
    })),
    units_booked: bookings.length,
    units_total: units,
  };
}

describe("monatsKennzahlen", () => {
  it("summiert Nächte, Eigennutzung, Auslastung und Auszahlung", () => {
    const k = monatsKennzahlen([
      tagK("2026-09-01", [{}], 100),
      tagK("2026-09-02", [{}], 120),
      tagK("2026-09-03", [{ eigen: true }], null),
      tagK("2026-09-04", [], null),
    ]);
    expect(k).toEqual({ naechte: 2, eigen: 1, auslastung: 75, payout: 220, currency: "EUR" });
  });
  it("eine belegte Nacht ohne Betrag kippt die Summe auf null, nicht auf eine Teilsumme", () => {
    const k = monatsKennzahlen([tagK("2026-09-01", [{}], 100), tagK("2026-09-02", [{}], null)]);
    expect(k.payout).toBeNull();
    expect(k.naechte).toBe(2);
  });
  it("leerer Monat: Auszahlung 0, Auslastung 0", () => {
    const k = monatsKennzahlen([tagK("2026-09-01", [], null)]);
    expect(k.payout).toBe(0);
    expect(k.auslastung).toBe(0);
  });
});


describe("rasterVolleWochen", () => {
  it("füllt Vor- und Nachlauf mit den Nachbarmonaten, immer ganze Wochen", () => {
    const z = rasterVolleWochen(2026, 9); // Oktober 2026 beginnt an einem Donnerstag
    expect(z.length % 7).toBe(0);
    expect(z[0].getDate()).toBe(28); // Mo 28.09.
    expect(z[0].getMonth()).toBe(8);
    expect(z[z.length - 1].getDate()).toBe(1); // So 01.11.
    expect(z[z.length - 1].getMonth()).toBe(10);
  });
});
