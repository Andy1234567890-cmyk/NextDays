// Tests des Realtime-Tokenquelle-Wächters (lib/realtime.ts).
//
// DER ANLASS (19.08.2026): Beim Hot-Reload zerschoss der Wächter die laufende
// App mit „Realtime-Tokenquelle ist bereits gesetzt". Ursache ist kein Fehler in
// der Konfiguration, sondern der normale Entwickler-Ablauf: der Aufruf steht in
// `App.tsx` auf MODULEBENE (absichtlich — er muss stehen, bevor der erste Screen
// einen Channel öffnet), und Metro führt dieses Modul beim Reload erneut aus.
//
// Der Schutz selbst bleibt: ZWEI Auth-Welten an einem Realtime-Client sind ein
// echter Fehler (ADR-0019), weil die Channels der zweiten Welt still auslaufen —
// ohne Fehlermeldung, es kommen nur keine Events mehr.
export {};

const holen = async () => "token";
const abonnieren = () => () => {};

function frischesModul() {
  let modul: typeof import("../realtime");
  jest.isolateModules(() => {
    modul = require("../realtime");
  });
  // @ts-expect-error — in isolateModules zugewiesen.
  return modul;
}

describe("realtimeTokenQuelleSetzen", () => {
  it("nimmt die erste Quelle an", () => {
    const m = frischesModul();
    expect(() => m.realtimeTokenQuelleSetzen({ holen, abonnieren })).not.toThrow();
  });

  it("lässt denselben Aufruf ein zweites Mal zu (Hot-Reload)", () => {
    // Neues Objekt, gleiche Funktionen — genau was `App.tsx` beim Reload liefert.
    const m = frischesModul();
    m.realtimeTokenQuelleSetzen({ holen, abonnieren });
    expect(() => m.realtimeTokenQuelleSetzen({ holen, abonnieren })).not.toThrow();
  });

  it("wirft bei einer ANDEREN Auth-Welt", () => {
    const m = frischesModul();
    m.realtimeTokenQuelleSetzen({ holen, abonnieren });
    const andereWelt = { holen: async () => "gast-token", abonnieren };
    expect(() => m.realtimeTokenQuelleSetzen(andereWelt)).toThrow(
      /ANDEREN Auth-Welt/,
    );
  });

  it("stapelt die Token-Abos nicht", () => {
    // Ohne Aufräumen hingen nach zehn Reloads zehn Listener an jedem
    // Token-Wechsel — jeder mit einem eigenen setAuth-Aufruf.
    const m = frischesModul();
    let offen = 0;
    const zaehlend = () => {
      offen += 1;
      return () => {
        offen -= 1;
      };
    };
    m.realtimeTokenQuelleSetzen({ holen, abonnieren: zaehlend });
    m.realtimeTokenQuelleSetzen({ holen, abonnieren: zaehlend });
    m.realtimeTokenQuelleSetzen({ holen, abonnieren: zaehlend });
    expect(offen).toBe(1);
  });
});
