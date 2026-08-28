// Tests des Logout-Gegenzustands (lib/push.ts, `pushAbmelden`).
//
// DER ANLASS (28.08.2026): Bei der Absturz-Absicherung wurden `pushEinrichten`
// und `pushTapVerdrahten` in `try` gefasst — `pushAbmelden` als einzige NICHT,
// obwohl sie denselben Werfer (`fcm()`) enthaelt.
//
// Das war nicht bloss eine Luecke, sondern kehrte den Zweck der Funktion um:
// `AuthContext.logout` ruft sie mit `await` VOR `apiLogout()`. Ein Wurf in
// `fcm()` kippte damit den GANZEN Logout — der Nutzer blieb angemeldet, und das
// Geraet bekam weiter die Meldungen des abgemeldeten Betriebs. Also genau der
// Schaden, den `pushAbmelden` verhindern soll, ausgeloest von ihrem eigenen
// Fehlschlag (Wurzel 1).
export {};

const abmelde_aufrufe: unknown[] = [];

jest.mock("../api", () => ({
  call: jest.fn(async (pfad: string, opt: unknown) => {
    abmelde_aufrufe.push({ pfad, opt });
    return { ok: true, data: {} };
  }),
}));

function ladePush() {
  let modul: typeof import("../push");
  jest.isolateModules(() => {
    modul = require("../push");
  });
  // @ts-expect-error — in isolateModules zugewiesen.
  return modul;
}

describe("pushAbmelden", () => {
  let warnSpion: jest.SpyInstance;

  beforeEach(() => {
    abmelde_aufrufe.length = 0;
    warnSpion = jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.resetModules();
  });

  afterEach(() => {
    warnSpion.mockRestore();
    jest.unmock("@react-native-firebase/messaging");
  });

  it("wirft NICHT, wenn Firebase nicht verfuegbar ist", async () => {
    jest.doMock("@react-native-firebase/messaging", () => {
      throw new Error("Native Firebase-Seite fehlt");
    });
    // Der Logout haengt daran: wirft diese Zeile, laeuft `apiLogout` nie.
    await expect(ladePush().pushAbmelden()).resolves.toBeUndefined();
    expect(warnSpion).toHaveBeenCalled();
  });

  it("wirft NICHT, wenn getMessaging() wirft", async () => {
    jest.doMock("@react-native-firebase/messaging", () => ({
      getMessaging: () => {
        throw new Error("Firebase nicht initialisiert");
      },
      getToken: async () => "t",
    }));
    await expect(ladePush().pushAbmelden()).resolves.toBeUndefined();
  });

  it("meldet das Geraet ab, wenn Firebase da ist", async () => {
    jest.doMock("@react-native-firebase/messaging", () => ({
      getMessaging: () => ({}),
      getToken: async () => "geraete-token",
      onTokenRefresh: () => () => {},
    }));
    await ladePush().pushAbmelden();
    expect(abmelde_aufrufe).toHaveLength(1);
    expect(JSON.stringify(abmelde_aufrufe[0])).toContain("geraete-token");
  });

  it("reicht einen Fehler des SERVERAUFRUFS weiter (kein stilles Schlucken)", async () => {
    jest.doMock("@react-native-firebase/messaging", () => ({
      getMessaging: () => ({}),
      getToken: async () => "geraete-token",
      onTokenRefresh: () => () => {},
    }));
    jest.doMock("../api", () => ({
      call: async () => {
        throw new Error("Netzfehler");
      },
    }));
    // Bewusst NICHT gefangen: bleibt der Server-Eintrag stehen, muss der
    // Aufrufer das erfahren (Wurzel 5).
    await expect(ladePush().pushAbmelden()).rejects.toThrow("Netzfehler");
  });
});
