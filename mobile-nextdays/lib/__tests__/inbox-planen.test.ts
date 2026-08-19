// Tests der Zeitpunkt-Vorschläge fürs geplante Senden
// (components/inbox/AntwortWerkzeuge.tsx).
//
// WARUM DAS EINEN TEST BRAUCHT: Der Server weist einen Sendezeitpunkt in der
// Vergangenheit ab. Ein Knopf „Heute 18:00", der um 20 Uhr noch angeboten wird,
// führt also garantiert in eine Fehlermeldung — und zwar erst nach dem Tippen
// der Nachricht. Solche Fehler zeigt kein Typcheck und kein Blick auf den
// Bildschirm am Vormittag.
export {};

type Modul = typeof import("../../components/inbox/AntwortWerkzeuge");
const { planVorschlaege }: Modul = require("../../components/inbox/AntwortWerkzeuge");

describe("planVorschlaege", () => {
  it("bietet am Vormittag auch heute Abend an", () => {
    const vorschlaege = planVorschlaege(new Date("2026-08-19T09:00:00"));
    expect(vorschlaege.map((v) => v.label)).toEqual([
      "In einer Stunde",
      "Heute 18:00",
      "Morgen 9:00",
      "Morgen 15:00",
    ]);
  });

  it("lässt heute Abend weg, sobald 18:00 vorbei ist", () => {
    const vorschlaege = planVorschlaege(new Date("2026-08-19T20:30:00"));
    expect(vorschlaege.map((v) => v.label)).not.toContain("Heute 18:00");
  });

  it("liefert NIE einen Zeitpunkt in der Vergangenheit", () => {
    // Mehrere Uhrzeiten über den Tag, inklusive der Grenze um 18:00.
    for (const stunde of [0, 8, 17, 18, 19, 23]) {
      const jetzt = new Date(`2026-08-19T${String(stunde).padStart(2, "0")}:05:00`);
      for (const v of planVorschlaege(jetzt)) {
        expect(v.at.getTime()).toBeGreaterThan(jetzt.getTime());
      }
    }
  });

  it("überschreitet den Monatswechsel korrekt", () => {
    // 31.08. → „morgen" ist der 01.09., nicht der 32.08.
    const vorschlaege = planVorschlaege(new Date("2026-08-31T10:00:00"));
    const morgen = vorschlaege.find((v) => v.label === "Morgen 9:00")!;
    expect(morgen.at.getMonth()).toBe(8); // September (0-basiert)
    expect(morgen.at.getDate()).toBe(1);
  });
});

describe("snoozeZiele", () => {
  type VorgangModul = typeof import("../../components/inbox/VorgangSheet");
  const { snoozeZiele }: VorgangModul = require("../../components/inbox/VorgangSheet");

  it("liegt immer in der Zukunft — auch spät am Abend", () => {
    // 23:30 ist der kritische Fall: morgen früh muss der nächste Tag sein.
    const jetzt = new Date("2026-08-19T23:30:00");
    const ziele = snoozeZiele(jetzt);
    expect(ziele).toHaveLength(3);
    for (const z of ziele) {
      expect(z.at.getTime()).toBeGreaterThan(jetzt.getTime());
    }
  });

  it("legt das Ziel nächste Woche sieben Tage später auf 9 Uhr", () => {
    const ziele = snoozeZiele(new Date("2026-08-19T14:00:00"));
    const woche = ziele.find((z) => z.label === "Nächste Woche")!;
    expect(woche.at.getDate()).toBe(26);
    expect(woche.at.getHours()).toBe(9);
  });
});

