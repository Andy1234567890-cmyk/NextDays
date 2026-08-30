// Tests der KI-Anbindung der App (lib/inbox.ts): Vorschlag, Eskalation und das
// Anlegen eines Wissensfaktes aus einer gemeldeten Luecke.
//
// Warum genau diese drei: sie sind der Weg, den die App seit dem KI-Ausbau
// geht, und jeder Schritt darin hat eine Stelle, an der ein Fehler NICHT
// auffaellt.
//
//  1. `getAiReply` liefert seit 0496/0498 mehr als Text und Quellen —
//     `fehlende_angabe` und `eskaliert` steuern, was die Oberflaeche zeigt.
//     Faellt eines davon aus der Antwort, verschwindet der Weg „der KI
//     beibringen" lautlos: es kommt weiterhin ein brauchbarer Vorschlag, nur
//     fuellt sich die Wissensdatenbank nie.
//  2. Die Eskalation wird PER VERLAUF erledigt (`/{thread_id}/erledigt`), nicht
//     per Eskalations-Id. Ein vertauschter Bezeichner trifft eine fremde oder
//     gar keine Zeile — und der Hinweis bleibt stehen, obwohl jemand ihn
//     abgehakt hat.
//  3. `createKnowledge` traegt jetzt `titel` und `kategorie` (0496). Fehlen
//     sie, legt der Server den Fakt trotzdem an — nur ohne Titel, also in der
//     Liste des Dashboards nicht auffindbar.
export {};

const gerufen: { pfad: string; opts?: { method?: string; body?: unknown } }[] = [];
// `mock`-Praefix ist Pflicht: jest.mock haengt die Fabrik nach oben, und
// nur so benannte Variablen darf sie von aussen sehen.
let mockAntwort: unknown = { ok: true, data: {} };

jest.mock("../api", () => ({
  call: jest.fn(
    async (pfad: string, opts?: { method?: string; body?: unknown }) => {
      gerufen.push({ pfad, opts });
      return mockAntwort;
    },
  ),
}));

function ladeInbox() {
  let modul: typeof import("../inbox");
  jest.isolateModules(() => {
    modul = require("../inbox");
  });
  // @ts-expect-error — in isolateModules zugewiesen.
  return modul;
}

beforeEach(() => {
  gerufen.length = 0;
  mockAntwort = { ok: true, data: {} };
});

describe("getAiReply", () => {
  it("reicht Luecke und Eskalation durch, nicht nur Text und Quellen", async () => {
    mockAntwort = {
      ok: true,
      data: {
        reply: "Das WLAN heisst Ferienhaus.",
        sources: ["Gaestemappe → WLAN", "Hausordnung (gekuerzt: 10508 auf 2476 Zeichen)"],
        fehlende_angabe: "die Endreinigungsgebuehr",
        eskaliert: true,
      },
    };
    const res = await ladeInbox().getAiReply("t-1");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.fehlende_angabe).toBe("die Endreinigungsgebuehr");
    expect(res.data.eskaliert).toBe(true);
    expect(res.data.sources).toHaveLength(2);
  });

  it("ruft POST auf dem Verlauf, ohne Nutzlast", async () => {
    await ladeInbox().getAiReply("t-1");
    expect(gerufen).toEqual([
      { pfad: "/inbox/t-1/ai-reply", opts: { method: "POST", body: {} } },
    ]);
  });
});

describe("Eskalation", () => {
  it("liest die offenen Eskalationen account-weit", async () => {
    await ladeInbox().listKiEskalationen();
    expect(gerufen[0].pfad).toBe("/inbox/ki-eskalationen");
    // Kein POST: das Lesen darf nichts veraendern.
    expect(gerufen[0].opts).toBeUndefined();
  });

  it("erledigt ueber die THREAD-Id, nicht die Eskalations-Id", async () => {
    await ladeInbox().eskalationErledigen("t-42");
    expect(gerufen[0].pfad).toBe("/inbox/ki-eskalationen/t-42/erledigt");
    expect(gerufen[0].opts?.method).toBe("POST");
  });
});

describe("createKnowledge", () => {
  it("schickt Titel und Kategorie mit — sonst ist der Fakt titellos", async () => {
    await ladeInbox().createKnowledge({
      property_id: null,
      titel: "die Endreinigungsgebuehr",
      fact: "Die Endreinigung kostet 60.",
      kategorie: "buchung",
    });
    expect(gerufen[0].pfad).toBe("/inbox/knowledge");
    expect(gerufen[0].opts?.body).toEqual({
      property_id: null,
      titel: "die Endreinigungsgebuehr",
      fact: "Die Endreinigung kostet 60.",
      kategorie: "buchung",
    });
  });

  it("laesst `property_id: null` stehen — das ist betriebsweit, kein fehlender Wert", async () => {
    await ladeInbox().createKnowledge({
      property_id: null,
      fact: "Check-in ab 16 Uhr.",
    });
    const body = gerufen[0].opts?.body as { property_id: string | null };
    expect(body.property_id).toBeNull();
    expect("property_id" in body).toBe(true);
  });
});

describe("WISSEN_KATEGORIEN", () => {
  it("deckt sich mit der Liste des Servers (ki_wissen.KATEGORIEN)", () => {
    expect([...ladeInbox().WISSEN_KATEGORIEN]).toEqual([
      "objekt",
      "anreise",
      "buchung",
      "umgebung",
      "stoerung",
      "ausstattung",
      "sonstiges",
    ]);
  });
});
