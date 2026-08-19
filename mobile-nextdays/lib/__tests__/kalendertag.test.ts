// Tests des Kurzdatums (lib/kalendertag.ts).
//
// DER ANLASS: In der Buchungsansicht stand „19. Aug" bei einer Buchung für den
// 19.08.2027 — am 19.08.2026 gelesen, sah das nach „heute" aus. Ein Datum ohne
// Jahr ist nur innerhalb des laufenden Jahres eindeutig.
export {};

type Modul = typeof import("../kalendertag");
const { tagKurz, tagKurzOderNull }: Modul = require("../kalendertag");

describe("tagKurz", () => {
  it("lässt das laufende Jahr weg", () => {
    expect(tagKurz("2026-08-19", 2026)).toBe("19. Aug");
  });

  it("nennt ein fremdes Jahr", () => {
    expect(tagKurz("2027-08-19", 2026)).toBe("19. Aug 2027");
    expect(tagKurz("2023-12-01", 2026)).toBe("1. Dez 2023");
  });

  it("zählt den Monat richtig (kein Off-by-one)", () => {
    expect(tagKurz("2026-01-05", 2026)).toBe("5. Jan");
    expect(tagKurz("2026-12-31", 2026)).toBe("31. Dez");
  });

  it("gibt bei fehlendem Datum null zurück", () => {
    expect(tagKurzOderNull(null)).toBeNull();
  });
});
