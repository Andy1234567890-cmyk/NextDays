// Lauf: `bun test packages/security-headers/src/csp.test.ts`
//
// Die CSP ist eine Sicherheitsgrenze — jede Lockerung muss eng und begruendet
// sein. Diese Tests halten fest, dass der STANDARD eng bleibt und eine
// Freigabe nur genau das oeffnet, was sie verspricht.
import { describe, expect, test } from "bun:test";

import { buildCsp } from "./index";

const direktive = (csp: string, name: string) =>
  csp.split("; ").find((z) => z.startsWith(`${name} `)) ?? "";

describe("CSP: Standard bleibt eng", () => {
  test("ohne Optionen gibt es GAR KEIN frame-src", () => {
    // Ohne die Direktive greift `default-src 'self'` — der engere Zustand.
    expect(buildCsp({}).includes("frame-src")).toBe(false);
  });

  test("object-src bleibt immer 'none'", () => {
    expect(direktive(buildCsp({}), "object-src")).toBe("object-src 'none'");
    expect(direktive(buildCsp({ frameBlob: true }), "object-src")).toBe(
      "object-src 'none'",
    );
  });

  test("frameBlob oeffnet KEINE fremde Herkunft", () => {
    const csp = buildCsp({ frameBlob: true });
    // Genau zwei Quellen: die eigene Seite und eigene Speicher-Objekte.
    expect(direktive(csp, "frame-src")).toBe("frame-src 'self' blob:");
    // Und es bleibt bei den anderen Direktiven, wie es war.
    expect(direktive(csp, "default-src")).toBe("default-src 'self'");
  });

  test("frameBlob und frameSrc schliessen sich nicht aus", () => {
    // Der Baukasten braucht beides: seine Vorschau-Origin UND (kuenftig)
    // eigene Blobs. Eine Option darf die andere nicht verdraengen.
    const csp = buildCsp({
      frameBlob: true,
      frameSrc: ["https://sites.example.com"],
    });
    const zeile = direktive(csp, "frame-src");
    expect(zeile).toContain("'self'");
    expect(zeile).toContain("blob:");
    expect(zeile).toContain("https://sites.example.com");
  });

  test("frameAncestors bleibt standardmaessig 'none'", () => {
    // Clickjacking-Schutz: diese App darf niemand einbetten.
    expect(direktive(buildCsp({ frameBlob: true }), "frame-ancestors")).toBe(
      "frame-ancestors 'none'",
    );
  });
});
