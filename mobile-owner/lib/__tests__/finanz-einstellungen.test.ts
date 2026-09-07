import {
  STANDARD,
  istStandard,
  nebenkennzahlSetzen,
  punktWert,
  reihenWert,
} from "@/lib/finanz-einstellungen";
import type { PortalFinanzPunkt, PortalFinanzReihe } from "@/lib/ownerPortal";

const punkt: PortalFinanzPunkt = {
  label: "2026-07-01",
  payout: 240,
  nights: 2,
  owner_stay_nights: 0,
  capacity_unit_nights: 2,
  occupancy_rate: 100,
  reservations: 1,
};
const reihe: PortalFinanzReihe = {
  date_from: "2026-07-01",
  date_to: "2026-07-31",
  points: [punkt],
  payout_total: 2559.76,
  payout_unknown_reason: null,
  nights: 29,
  owner_stay_nights: 0,
  capacity_unit_nights: 62,
  occupancy_rate: 46.77,
  reservations: 7,
  avg_payout_per_night: 88.27,
};

describe("Kennzahl-Werte", () => {
  it("punktWert je Kennzahl; je_nacht rechnet aus payout/nights", () => {
    expect(punktWert(punkt, "auszahlung")).toBe(240);
    expect(punktWert(punkt, "naechte")).toBe(2);
    expect(punktWert(punkt, "auslastung")).toBe(100);
    expect(punktWert(punkt, "buchungen")).toBe(1);
    expect(punktWert(punkt, "je_nacht")).toBe(120);
    expect(punktWert({ ...punkt, payout: null }, "je_nacht")).toBeNull();
    expect(punktWert({ ...punkt, nights: 0 }, "je_nacht")).toBeNull();
  });
  it("reihenWert liest die Summen des Servers, rechnet nicht selbst", () => {
    expect(reihenWert(reihe, "auszahlung")).toBe(2559.76);
    expect(reihenWert(reihe, "je_nacht")).toBe(88.27);
    expect(reihenWert(reihe, "auslastung")).toBe(46.77);
    expect(reihenWert({ ...reihe, payout_total: null }, "auszahlung")).toBeNull();
  });
});

describe("Einstellungen", () => {
  it("nebenkennzahlSetzen tauscht, statt zu doppeln", () => {
    expect(nebenkennzahlSetzen(["auslastung", "je_nacht"], 0, "naechte")).toEqual(["naechte", "je_nacht"]);
    expect(nebenkennzahlSetzen(["auslastung", "je_nacht"], 0, "je_nacht")).toEqual(["je_nacht", "auslastung"]);
    expect(nebenkennzahlSetzen(["auslastung", "je_nacht"], 1, "auslastung")).toEqual(["je_nacht", "auslastung"]);
  });
  it("istStandard", () => {
    expect(istStandard(STANDARD)).toBe(true);
    expect(istStandard({ ...STANDARD, zeitraum: "letzter_monat" })).toBe(false);
    expect(istStandard({ ...STANDARD, nebenkennzahlen: ["je_nacht", "auslastung"] })).toBe(false);
  });
});
