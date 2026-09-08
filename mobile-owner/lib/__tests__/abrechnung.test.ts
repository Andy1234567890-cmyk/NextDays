import { abrechnungJahr, abrechnungTitel, imJahr, jahreAus, summenJeWaehrung } from "@/lib/abrechnung";
import { txt } from "@/lib/test-uebersetzer";
import type { PortalStatement } from "@/lib/ownerPortal";

function st(p: Partial<PortalStatement>): PortalStatement {
  return {
    id: p.id ?? "s",
    period_from: p.period_from ?? "2026-05-01",
    period_to: p.period_to ?? "2026-05-31",
    status: "finalized",
    owner_payout: p.owner_payout ?? 100,
    currency: p.currency ?? "EUR",
    invoice_number: null,
    created_at: null,
  };
}

describe("abrechnungTitel", () => {
  it("ganzer Monat → Monatsname", () => {
    expect(abrechnungTitel(txt, st({}))).toBe("Abrechnung Mai 2026");
    expect(abrechnungTitel(txt, st({ period_from: "2026-02-01", period_to: "2026-02-28" }))).toBe(
      "Abrechnung Februar 2026",
    );
  });
  it("krummer Zeitraum → Spanne", () => {
    expect(abrechnungTitel(txt, st({ period_from: "2026-05-01", period_to: "2026-05-15" }))).toBe(
      "Abrechnung 1.–15. Mai 2026",
    );
    expect(abrechnungTitel(txt, st({ period_from: "2026-04-01", period_to: "2026-06-30" }))).toBe(
      "Abrechnung 1. Apr – 30. Jun 2026",
    );
  });
});

describe("Jahre und Summen", () => {
  const items = [
    st({ id: "a", period_to: "2026-05-31", owner_payout: 919.4 }),
    st({ id: "b", period_from: "2026-04-01", period_to: "2026-04-30", owner_payout: 3134.9 }),
    st({ id: "c", period_from: "2025-12-01", period_to: "2025-12-31", owner_payout: 100 }),
    st({ id: "d", period_from: "2025-11-01", period_to: "2025-11-30", owner_payout: 50, currency: "DKK" }),
  ];
  it("jahreAus absteigend", () => {
    expect(jahreAus(items)).toEqual([2026, 2025]);
    expect(abrechnungJahr(items[2])).toBe(2025);
  });
  it("summenJeWaehrung wirft Währungen nicht zusammen", () => {
    expect(summenJeWaehrung(items)).toEqual([
      { currency: "EUR", betrag: 919.4 + 3134.9 + 100 },
      { currency: "DKK", betrag: 50 },
    ]);
  });
  it("imJahr neueste zuerst", () => {
    expect(imJahr(items, 2026).map((s) => s.id)).toEqual(["a", "b"]);
  });
});
