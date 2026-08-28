// Tests des Dateiwaehlers (lib/datei.ts).
//
// DER ANLASS (28.08.2026): Die App konnte keine Dateien anhaengen — der
// Posteingang sagte „Hochladen geht derzeit nur im Dashboard". Der Bildwaehler
// allein reichte nicht: der Server nimmt auch PDF, und das ist im Betrieb der
// haeufigste Anhang (Rechnung, Grundriss, Anfahrtsskizze).
//
// Geprueft wird, was man an der Oberflaeche NICHT sieht:
//   1. Abbrechen ist kein Fehler. Das Paket WIRFT beim Abbruch — wer das nicht
//      trennt, zeigt eine Fehlermeldung, weil der Nutzer zurueckgetippt hat.
//   2. Zu grosse Dateien werden VOR dem Upload abgefangen. Sonst laedt das
//      Geraet im Mobilfunknetz Minuten lang hoch, um dann 413 zu bekommen.
//   3. Der Waehler bietet genau die Typen an, die der Server annimmt.
export {};

const mockPick = jest.fn();
const mockErrorCodes = {
  OPERATION_CANCELED: "OPERATION_CANCELED",
  IN_PROGRESS: "ASYNC_OP_IN_PROGRESS",
  UNABLE_TO_OPEN_FILE_TYPE: "UNABLE_TO_OPEN_FILE_TYPE",
  NULL_PRESENTER: "NULL_PRESENTER",
} as const;

jest.mock("@react-native-documents/picker", () => ({
  pick: (...a: unknown[]) => mockPick(...a),
  types: { images: "image/*", pdf: "application/pdf" },
  errorCodes: mockErrorCodes,
  isErrorWithCode: (e: unknown) =>
    typeof e === "object" && e !== null && "code" in e,
}));

function ladeDatei() {
  let modul: typeof import("../datei");
  jest.isolateModules(() => {
    modul = require("../datei");
  });
  // @ts-expect-error — in isolateModules zugewiesen.
  return modul;
}

function fehlerMitCode(code: string) {
  const e = new Error(code) as Error & { code: string };
  e.code = code;
  return e;
}

describe("dateiWaehlen", () => {
  beforeEach(() => {
    mockPick.mockReset();
  });

  it("bietet genau die Typen an, die der Server annimmt", async () => {
    mockPick.mockResolvedValue([
      { uri: "file:///a.pdf", name: "a.pdf", type: "application/pdf", size: 100, error: null },
    ]);
    await ladeDatei().dateiWaehlen();
    // Nicht `allFiles`: ein Waehler, der alles anbietet und dann 422 sagt,
    // ist eine Falle.
    expect(mockPick).toHaveBeenCalledWith({
      type: ["image/*", "application/pdf"],
      allowMultiSelection: false,
    });
  });

  it("gibt die gewaehlte Datei in der Form zurueck, die FormData braucht", async () => {
    mockPick.mockResolvedValue([
      { uri: "content://x/1", name: "Rechnung.pdf", type: "application/pdf", size: 2048, error: null },
    ]);
    const r = await ladeDatei().dateiWaehlen();
    expect(r).toEqual({
      art: "datei",
      datei: { uri: "content://x/1", name: "Rechnung.pdf", type: "application/pdf" },
    });
  });

  it("wertet Abbrechen NICHT als Fehler", async () => {
    mockPick.mockRejectedValue(fehlerMitCode(mockErrorCodes.OPERATION_CANCELED));
    expect(await ladeDatei().dateiWaehlen()).toEqual({ art: "abgebrochen" });
  });

  it("wertet einen Doppeltipp NICHT als Fehler", async () => {
    mockPick.mockRejectedValue(fehlerMitCode(mockErrorCodes.IN_PROGRESS));
    expect(await ladeDatei().dateiWaehlen()).toEqual({ art: "abgebrochen" });
  });

  it("lehnt eine zu grosse Datei VOR dem Upload ab", async () => {
    mockPick.mockResolvedValue([
      { uri: "file:///gross.pdf", name: "gross.pdf", type: "application/pdf", size: 11 * 1024 * 1024, error: null },
    ]);
    const r = await ladeDatei().dateiWaehlen();
    expect(r.art).toBe("fehler");
    if (r.art === "fehler") expect(r.text).toContain("10 MB");
  });

  it("laesst eine Datei knapp unter der Grenze durch", async () => {
    mockPick.mockResolvedValue([
      { uri: "file:///ok.pdf", name: "ok.pdf", type: "application/pdf", size: 10 * 1024 * 1024, error: null },
    ]);
    expect((await ladeDatei().dateiWaehlen()).art).toBe("datei");
  });

  it("meldet einen Lesefehler des Waehlers", async () => {
    mockPick.mockResolvedValue([
      { uri: "content://x/1", name: null, type: null, size: null, error: "kaputt" },
    ]);
    expect((await ladeDatei().dateiWaehlen()).art).toBe("fehler");
  });

  it("behandelt eine leere Auswahl als Abbruch", async () => {
    mockPick.mockResolvedValue([]);
    expect(await ladeDatei().dateiWaehlen()).toEqual({ art: "abgebrochen" });
  });

  it("erfindet keinen Dateinamen, wenn das System keinen liefert", async () => {
    mockPick.mockResolvedValue([
      { uri: "content://x/1", name: null, type: null, size: 10, error: null },
    ]);
    const r = await ladeDatei().dateiWaehlen();
    // Der Server saeubert und ergaenzt die Endung selbst (Wurzel 4: kein
    // ausgedachter Name, der eine Herkunft vortaeuscht).
    if (r.art === "datei") {
      expect(r.datei.name).toBe("anhang");
      expect(r.datei.type).toBe("application/octet-stream");
    } else {
      throw new Error("Datei erwartet");
    }
  });

  it("stuerzt NICHT ab, wenn das native Modul im Build fehlt", async () => {
    // Der reale Fall: ein Build ohne einkompiliertes Modul. Vor dem Umbau auf
    // `require` riss das beim App-START den ganzen Baum.
    jest.resetModules();
    jest.doMock("@react-native-documents/picker", () => {
      throw new Error("RNDocumentPicker could not be found");
    });
    const r = await ladeDatei().dateiWaehlen();
    expect(r.art).toBe("fehler");
  });
});
