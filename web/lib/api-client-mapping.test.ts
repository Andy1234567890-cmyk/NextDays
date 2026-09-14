// `bun test web/lib/api-client-mapping.test.ts`
//
// Der Bestand aus Taskilo ruft die ALTEN Pfade; `mapEndpoint` biegt sie auf den
// Buchhaltungs-Slice um. Ein Pfad, der hier nicht umgebogen wird, läuft zur
// Laufzeit ins 404 — tsc und ESLint sehen das nicht (13 solcher Löcher am
// 11.09.2026, docs/buchhaltung/TASKILO-FINANZ-BESTAND-2026-09-11.md).
import { describe, expect, test } from "bun:test";

import { mapEndpoint } from "./api-client";

describe("mapEndpoint", () => {
  test("alte Slice-Pfade landen unter /buchhaltung", () => {
    expect(mapEndpoint("/api/v1/expenses/company/t1?limit=5")).toBe(
      "/api/v1/buchhaltung/expenses/company/t1?limit=5",
    );
    expect(mapEndpoint("/api/v1/reminders")).toBe("/api/v1/buchhaltung/reminders");
    expect(mapEndpoint("/api/v1/invoices")).toBe("/api/v1/buchhaltung/invoices");
  });

  test("Sonderfälle des Bestands: finance/customers und /api/finapi", () => {
    expect(mapEndpoint("/api/v1/finance/customers?search=x")).toBe(
      "/api/v1/buchhaltung/customers?search=x",
    );
    expect(mapEndpoint("/api/finapi/accounts-enhanced")).toBe(
      "/api/v1/buchhaltung/finapi/accounts-enhanced",
    );
  });

  test("bereits gemappte und fremde Pfade bleiben unverändert", () => {
    expect(mapEndpoint("/api/v1/buchhaltung/invoices")).toBe("/api/v1/buchhaltung/invoices");
    expect(mapEndpoint("/api/v1/reservations")).toBe("/api/v1/reservations");
    // Kein Teilstring-Treffer: `invoicesX` ist kein Buchhaltungs-Segment.
    expect(mapEndpoint("/api/v1/invoicesX")).toBe("/api/v1/invoicesX");
  });
});
