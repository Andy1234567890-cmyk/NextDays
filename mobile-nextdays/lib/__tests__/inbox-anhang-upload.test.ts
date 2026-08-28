// Tests des Anhang-Uploads (lib/inbox.ts, `uploadAttachment`).
//
// DER ANLASS (28.08.2026): Die Anhang-Ansicht der App sagte „Hochladen geht
// derzeit nur im Dashboard — der App fehlt die Dateiauswahl". Das stimmte, war
// aber keine fehlende Faehigkeit: Auswahl, Endpunkt und Multipart-Muster gab es
// laengst, es fehlte nur die Verbindung.
//
// Festgehalten werden hier die drei Dinge, an denen ein Datei-Upload real
// scheitert und die man an der Oberflaeche NICHT sieht:
//   1. `filename` muss in die QUERY — der Server liest `query_params`, nicht
//      das Formularfeld. Falsch platziert heisst: jede Datei heisst „anhang".
//   2. Das Formular muss ein `FormData` sein und darf NICHT serialisiert
//      werden (`lib/api.ts` erkennt das und laesst den Content-Type weg, damit
//      die Laufzeit die Boundary setzt).
//   3. React Native schickt `{uri, name, type}` statt eines `Blob`.
export {};

const gerufen: { pfad: string; opts: { method?: string; body?: unknown } }[] = [];

jest.mock("../api", () => ({
  call: jest.fn(async (pfad: string, opts: { method?: string; body?: unknown }) => {
    gerufen.push({ pfad, opts });
    return { ok: true, data: { id: "a1", filename: "bild.jpg" } };
  }),
}));

function ladeInbox() {
  let modul: typeof import("../inbox");
  jest.isolateModules(() => {
    modul = require("../inbox");
  });
  // @ts-expect-error — in isolateModules zugewiesen.
  return modul;
}

const DATEI = { uri: "file:///tmp/bild.jpg", name: "bild.jpg", type: "image/jpeg" };

describe("uploadAttachment", () => {
  beforeEach(() => {
    gerufen.length = 0;
  });

  it("schickt den Dateinamen in der QUERY, nicht im Formular", async () => {
    await ladeInbox().uploadAttachment("t-1", DATEI);
    expect(gerufen).toHaveLength(1);
    expect(gerufen[0].pfad).toContain("filename=bild.jpg");
    expect(gerufen[0].pfad.startsWith("/inbox/t-1/attachments?")).toBe(true);
  });

  it("schickt ein FormData, kein JSON", async () => {
    await ladeInbox().uploadAttachment("t-1", DATEI);
    expect(gerufen[0].opts.body).toBeInstanceOf(FormData);
    expect(gerufen[0].opts.method).toBe("POST");
  });

  it("haengt die Begleitnachricht an, wenn es eine gibt", async () => {
    await ladeInbox().uploadAttachment("t-1", DATEI, "Hier der Grundriss");
    // Leerzeichen werden in einer Query als `+` kodiert — das ist korrekt und
    // wird serverseitig zurueckgelesen. Geprueft wird deshalb der WERT, nicht
    // die rohe Zeichenkette.
    const query = new URLSearchParams(gerufen[0].pfad.split("?")[1]);
    expect(query.get("message")).toBe("Hier der Grundriss");
  });

  it("laesst `message` weg, wenn keine da ist", async () => {
    await ladeInbox().uploadAttachment("t-1", DATEI);
    expect(gerufen[0].pfad).not.toContain("message=");
  });

  it("kodiert Sonderzeichen im Dateinamen", async () => {
    await ladeInbox().uploadAttachment(
      "t-1",
      { ...DATEI, name: "Grundriss & Maße.jpg" },
      "Anbei",
    );
    // Der springende Punkt: ein ROHES `&` wuerde die Query zerreissen — der
    // Server bekaeme `filename=Grundriss ` und einen erfundenen Parameter
    // ` Maße.jpg`, und die Begleitnachricht ginge verloren.
    expect(gerufen[0].pfad).toContain("%26");
    const query = new URLSearchParams(gerufen[0].pfad.split("?")[1]);
    expect(query.get("filename")).toBe("Grundriss & Maße.jpg");
    // Der Beweis, dass nichts zerrissen wurde: `message` steht noch.
    expect(query.get("message")).toBe("Anbei");
  });
});
