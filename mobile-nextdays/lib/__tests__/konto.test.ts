// Tests der Konto-Schicht (lib/konto.ts, lib/rechte-texte.ts).
//
// Zwei Dinge, die man hier falsch machen kann und die kein Typcheck sieht:
//  1. Die Berechtigungs-Bezeichnungen sind eine KOPIE der Web-Texte. Driftet
//     die Liste, zeigt das Profil rohe IDs — dann muss die Datei nachgezogen
//     werden. Der Test hält fest, dass die Gruppen nicht leer und die IDs
//     eindeutig sind.
//  2. Ein leeres Telefonfeld muss als `null` rausgehen, nicht als "". Das
//     Backend unterscheidet „nicht erfasst" von „bewusst geleert".
export {};

type RechteModul = typeof import("../rechte-texte");
const { RECHTE_GRUPPEN }: RechteModul = require("../rechte-texte");

describe("RECHTE_GRUPPEN", () => {
  it("hat drei Gruppen, alle gefüllt", () => {
    expect(RECHTE_GRUPPEN.length).toBe(3);
    for (const g of RECHTE_GRUPPEN) {
      expect(g.titel.length).toBeGreaterThan(0);
      expect(g.rechte.length).toBeGreaterThan(0);
    }
  });

  it("führt jede ID genau einmal", () => {
    const ids = RECHTE_GRUPPEN.flatMap((g) => g.rechte.map((r) => r.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("hat für jede ID eine Bezeichnung — nie die rohe ID als Label", () => {
    for (const g of RECHTE_GRUPPEN) {
      for (const r of g.rechte) {
        expect(r.label.length).toBeGreaterThan(2);
        expect(r.label).not.toBe(r.id);
        // Ein Label, das den Unterstrich-Schlüssel enthält, wäre ein
        // durchgerutschter Fallback.
        expect(r.label).not.toMatch(/^[a-z_]+$/);
      }
    }
  });

  it("deckt die Rechte ab, die das Posteingang-Gating braucht", () => {
    const ids = new Set(RECHTE_GRUPPEN.flatMap((g) => g.rechte.map((r) => r.id)));
    for (const nötig of [
      "inbox_view_all",
      "inbox_reply",
      "inbox_assign",
      "view_guest_name",
    ]) {
      expect(ids.has(nötig)).toBe(true);
    }
  });
});

describe("Profil-Eingabe", () => {
  // Dieselbe Normalisierung wie im Screen: leer → null.
  const normalisiert = (eingabe: string) => eingabe.trim() || null;

  it("macht aus einem leeren Feld null", () => {
    expect(normalisiert("   ")).toBeNull();
    expect(normalisiert("")).toBeNull();
  });

  it("lässt eine Nummer unangetastet", () => {
    expect(normalisiert(" +45 43167040 ")).toBe("+45 43167040");
  });
});

describe("initialenAus", () => {
  type Modul = typeof import("../initialen");
  const { initialenAus }: Modul = require("../initialen");

  it("nimmt Vor- und Nachnamen", () => {
    expect(initialenAus("Jeanine Ågaard", "info@airsmil.dk")).toBe("JÅ");
  });

  it("nimmt bei drei Namen den ersten und den letzten", () => {
    // „Anna Maria Schmidt" → AS, nicht AM: der Nachname ist die Kennung.
    expect(initialenAus("Anna Maria Schmidt", null)).toBe("AS");
  });

  it("fällt auf die E-Mail zurück, wenn kein Name da ist", () => {
    expect(initialenAus(null, "info@airsmil.dk")).toBe("I");
    expect(initialenAus("   ", "test@example.com")).toBe("T");
  });

  it("gibt undefined zurück, wenn beides fehlt — kein erfundenes U", () => {
    // Der Avatar zeigt dann sein Symbol; ein Platzhalter-Buchstabe wäre eine
    // Behauptung über einen Namen, den es nicht gibt.
    expect(initialenAus(null, null)).toBeUndefined();
    expect(initialenAus("", "")).toBeUndefined();
  });
});
