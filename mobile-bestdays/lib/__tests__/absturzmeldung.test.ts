// Tests der Absturz-Protokollierung (lib/absturzmeldung.ts).
//
// DER ANLASS (28.08.2026): Samsungs Geraetewartung meldete „myNextDays stuerzt
// haeufig ab". Es gab weder Fehlergrenze noch globalen Handler noch
// Crash-Reporting — jeder unbehandelte Fehler war ein spurloser Abbruch.
//
// Diese Tests halten die ZWEI Eigenschaften fest, die dabei nicht verhandelbar
// sind:
//   1. Es wird ueberhaupt protokolliert (sonst ist der naechste Absturz wieder
//      unsichtbar).
//   2. Der KUNDE bekommt davon nichts mit: im Release kein Stacktrace, keine
//      Komponentenkette — nur die Kurzmeldung, und die geht nach `adb logcat`,
//      nicht auf den Bildschirm.
export {};

const globalMitDev = globalThis as unknown as { __DEV__: boolean };

function frischesModul() {
  let modul: typeof import("../absturzmeldung");
  jest.isolateModules(() => {
    modul = require("../absturzmeldung");
  });
  // @ts-expect-error — in isolateModules zugewiesen.
  return modul;
}

describe("protokolliereAbsturz", () => {
  let fehlerAusgaben: unknown[][];
  let spion: jest.SpyInstance;
  const devVorher = globalMitDev.__DEV__;

  beforeEach(() => {
    fehlerAusgaben = [];
    spion = jest
      .spyOn(console, "error")
      .mockImplementation((...args: unknown[]) => {
        fehlerAusgaben.push(args);
      });
  });

  afterEach(() => {
    spion.mockRestore();
    globalMitDev.__DEV__ = devVorher;
  });

  it("protokolliert den Fehler ueberhaupt", () => {
    globalMitDev.__DEV__ = false;
    frischesModul().protokolliereAbsturz(new Error("Boom"));
    expect(fehlerAusgaben).toHaveLength(1);
    expect(JSON.stringify(fehlerAusgaben[0])).toContain("Boom");
  });

  it("gibt im Release WEDER Stacktrace NOCH Komponentenkette aus", () => {
    globalMitDev.__DEV__ = false;
    const fehler = new Error("Boom");
    fehler.stack = "Error: Boom\n    at geheimerPfad (/src/intern/datei.ts:42)";
    frischesModul().protokolliereAbsturz(fehler, "<Root> <AuthProvider>");

    const alles = JSON.stringify(fehlerAusgaben);
    expect(alles).not.toContain("geheimerPfad");
    expect(alles).not.toContain("AuthProvider");
    // Genau EINE Zeile: die Kurzmeldung.
    expect(fehlerAusgaben).toHaveLength(1);
  });

  it("gibt im Debug-Build Stacktrace und Kette aus", () => {
    globalMitDev.__DEV__ = true;
    const fehler = new Error("Boom");
    fehler.stack = "Error: Boom\n    at geheimerPfad (/src/intern/datei.ts:42)";
    frischesModul().protokolliereAbsturz(fehler, "<Root> <AuthProvider>");

    const alles = JSON.stringify(fehlerAusgaben);
    expect(alles).toContain("geheimerPfad");
    expect(alles).toContain("AuthProvider");
  });

  it("kuerzt eine ueberlange Meldung, statt sie ganz auszugeben", () => {
    globalMitDev.__DEV__ = false;
    frischesModul().protokolliereAbsturz(new Error("x".repeat(500)));
    const text = String(fehlerAusgaben[0][1]);
    expect(text.length).toBeLessThanOrEqual(201);
    expect(text.endsWith("…")).toBe(true);
  });

  it("vertraegt einen geworfenen Nicht-Error", () => {
    globalMitDev.__DEV__ = false;
    expect(() =>
      frischesModul().protokolliereAbsturz("nur ein String"),
    ).not.toThrow();
    expect(JSON.stringify(fehlerAusgaben)).toContain("nur ein String");
  });
});

describe("absturzDiagnosePruefen", () => {
  // Die Probe ist das Werkzeug, mit dem sich auf einem ECHTEN Geraet zeigen
  // laesst, dass die Absturz-Diagnose ankommt. Sie muss vier Faelle abdecken
  // und darf dabei selbst nichts umbringen.
  it("protokolliert vier Faelle und wirft nicht", () => {
    const globalMitDev2 = globalThis as unknown as { __DEV__: boolean };
    const vorher = globalMitDev2.__DEV__;
    globalMitDev2.__DEV__ = false;
    const fehler: unknown[][] = [];
    const eSpion = jest
      .spyOn(console, "error")
      .mockImplementation((...a: unknown[]) => {
        fehler.push(a);
      });
    const wSpion = jest.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => frischesModul().absturzDiagnosePruefen()).not.toThrow();
    expect(fehler).toHaveLength(4);
    // Auch die Probe darf im Release keine Kette ausgeben.
    expect(JSON.stringify(fehler)).not.toContain("<Probe>");
    // Der lange Fall muss gekuerzt sein.
    expect(JSON.stringify(fehler)).toContain("…");

    eSpion.mockRestore();
    wSpion.mockRestore();
    globalMitDev2.__DEV__ = vorher;
  });
});

describe("absturzHandlerSetzen", () => {
  it("ruft den vorherigen Handler weiter (roter Schirm bleibt)", () => {
    const vorher = jest.fn();
    const gesetzt: ((f: unknown, fatal?: boolean) => void)[] = [];
    (globalThis as Record<string, unknown>).ErrorUtils = {
      getGlobalHandler: () => vorher,
      setGlobalHandler: (h: (f: unknown, fatal?: boolean) => void) =>
        gesetzt.push(h),
    };
    const spion = jest.spyOn(console, "error").mockImplementation(() => {});

    frischesModul().absturzHandlerSetzen();
    expect(gesetzt).toHaveLength(1);

    const fehler = new Error("Boom");
    gesetzt[0](fehler, true);
    expect(vorher).toHaveBeenCalledWith(fehler, true);

    spion.mockRestore();
    delete (globalThis as Record<string, unknown>).ErrorUtils;
  });

  it("faellt still aus, wenn es kein ErrorUtils gibt", () => {
    delete (globalThis as Record<string, unknown>).ErrorUtils;
    expect(() => frischesModul().absturzHandlerSetzen()).not.toThrow();
  });
});

// --- Senden an die eigene API (30.08.2026) ---------------------------------
//
// DER ANLASS: die Protokollzeile geht nach `adb logcat`. Auf dem Geraet eines
// Beta-Testers ist das dasselbe wie gar nichts — es liest nur, wer ein Kabel
// und die Android-Werkzeuge hat. Zwei Tage lang stuerzte die App bei den
// Testern ab, ohne dass irgendjemand an die Ursache herankam.
describe("absturzSenden", () => {
  let fetchSpion: jest.Mock;
  let konsole: jest.SpyInstance;

  beforeEach(() => {
    fetchSpion = jest.fn(() => Promise.resolve({ ok: true } as Response));
    (globalThis as unknown as { fetch: unknown }).fetch = fetchSpion;
    konsole = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    konsole.mockRestore();
  });

  it("meldet den Absturz an die API — mit Stacktrace", () => {
    frischesModul().protokolliereAbsturz(new Error("Start kaputt"));
    expect(fetchSpion).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpion.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/diagnostics/startabsturz");
    const leib = JSON.parse(String(opts.body));
    expect(leib.events[0].message).toContain("Start kaputt");
    // Der Stacktrace ist der eigentliche Wert: ohne ihn weiss man DASS es
    // kracht, nicht WO.
    expect(leib.events[0].context.stack).toContain("Start kaputt");
    expect(leib.events[0].context.ms_seit_start).toBeGreaterThanOrEqual(0);
  });

  it("sendet hoechstens fuenf Mal je Sitzung", () => {
    // Ein Absturz kommt selten allein: Fehlergrenze und globaler Handler
    // feuern nacheinander, eine kaputte Render-Schleife dutzendfach. Ohne
    // Deckel waere das ein Sturm gegen die eigene API — aus einer App, die
    // gerade abstuerzt.
    const modul = frischesModul();
    for (let i = 0; i < 12; i += 1) {
      modul.protokolliereAbsturz(new Error(`Boom ${i}`));
    }
    expect(fetchSpion).toHaveBeenCalledTimes(5);
  });

  it("kippt NICHT, wenn das Senden fehlschlaegt", () => {
    // Der haeufigste Fall beim Startabsturz: kein Netz. Ein Fehler HIER waere
    // der zweite Absturz, mitten in der Absturzbehandlung.
    fetchSpion.mockImplementation(() => Promise.reject(new Error("kein Netz")));
    expect(() =>
      frischesModul().protokolliereAbsturz(new Error("Boom")),
    ).not.toThrow();
  });

  it("kippt NICHT, wenn fetch selbst fehlt", () => {
    delete (globalThis as Record<string, unknown>).fetch;
    expect(() =>
      frischesModul().protokolliereAbsturz(new Error("Boom")),
    ).not.toThrow();
  });
});
