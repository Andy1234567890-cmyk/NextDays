// Prüft die Aufbereitung der Aufgaben-Agenda: der TAG einer Aufgabe (lokal,
// start_at vor due_at), Zeitfenster ohne erfundene Werte, Tagesgruppen,
// Wochenstreifen und Monatsgrenzen.
import {
  aufgabenTag,
  gruppiereNachTag,
  istUeberfaellig,
  monatsGrenzen,
  monatLabel,
  tagLabel,
  tagPlus,
  uhrzeit,
  wochenTage,
  zaehleProTag,
  zeitfenster,
} from "@/lib/aufgaben-agenda";

// Ein Zeitstempel, der im lokalen Kalender auf `iso` fällt — unabhängig davon,
// in welcher Zone der Test läuft. Nur so ist die Erwartung stabil.
function lokal(iso: string, stunde = 9, minute = 0): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, stunde, minute).toISOString();
}

function task(over: Partial<Parameters<typeof zeitfenster>[0]> = {}) {
  return { start_at: null, end_at: null, due_at: null, ...over };
}

describe("aufgabenTag", () => {
  it("nimmt start_at", () => {
    expect(aufgabenTag({ start_at: lokal("2026-08-21"), due_at: lokal("2026-08-30") })).toBe(
      "2026-08-21",
    );
  });

  it("fällt auf due_at zurück, wenn kein Start gesetzt ist", () => {
    expect(aufgabenTag({ start_at: null, due_at: lokal("2026-08-30") })).toBe("2026-08-30");
  });

  it("ist null ohne jeden Zeitpunkt — kein Ersatzdatum", () => {
    expect(aufgabenTag({ start_at: null, due_at: null })).toBeNull();
  });

  it("rechnet LOKAL: 23:30 Ortszeit bleibt derselbe Tag", () => {
    expect(aufgabenTag({ start_at: lokal("2026-08-21", 23, 30), due_at: null })).toBe(
      "2026-08-21",
    );
  });
});

describe("zeitfenster", () => {
  it("nennt Anfang und Ende", () => {
    expect(
      zeitfenster(task({ start_at: lokal("2026-08-21", 8, 0), end_at: lokal("2026-08-21", 17, 45) })),
    ).toBe("8:00 – 17:45");
  });

  it("ab-Form bei fehlendem Ende", () => {
    expect(zeitfenster(task({ start_at: lokal("2026-08-21", 8, 5) }))).toBe("ab 8:05");
  });

  it("bis-Form bei fehlendem Anfang, erfindet keine Startzeit", () => {
    expect(zeitfenster(task({ end_at: lokal("2026-08-21", 12, 0) }))).toBe("bis 12:00");
  });

  it("greift auf die Fälligkeit zurück", () => {
    expect(zeitfenster(task({ due_at: lokal("2026-08-21", 12, 0) }))).toBe("fällig 12:00");
  });

  it("ist null, wenn nichts bekannt ist", () => {
    expect(zeitfenster(task())).toBeNull();
    expect(uhrzeit(null)).toBeNull();
  });

  it("zeigt eine Zeit, wenn Anfang und Ende gleich sind", () => {
    const z = lokal("2026-08-21", 8, 0);
    expect(zeitfenster(task({ start_at: z, end_at: z }))).toBe("8:00");
  });
});

describe("istUeberfaellig", () => {
  const gestern = { status: "open" as const, start_at: lokal("2026-08-20"), due_at: null };

  it("offen und vor heute", () => {
    expect(istUeberfaellig(gestern, "2026-08-21")).toBe(true);
  });

  it("erledigt ist nie überfällig", () => {
    expect(istUeberfaellig({ ...gestern, status: "done" }, "2026-08-21")).toBe(false);
    expect(istUeberfaellig({ ...gestern, status: "cancelled" }, "2026-08-21")).toBe(false);
  });

  it("ohne Termin nicht überfällig", () => {
    expect(
      istUeberfaellig({ status: "open", start_at: null, due_at: null }, "2026-08-21"),
    ).toBe(false);
  });
});

describe("gruppiereNachTag", () => {
  const a = { title: "A", start_at: lokal("2026-08-22", 10), due_at: null };
  const b = { title: "B", start_at: lokal("2026-08-21", 14), due_at: null };
  const c = { title: "C", start_at: lokal("2026-08-21", 8), due_at: null };
  const ohne = { title: "D", start_at: null, due_at: null };

  it("sortiert Tage aufsteigend und innerhalb des Tages nach Zeit", () => {
    const gruppen = gruppiereNachTag([a, b, c]);
    expect(gruppen.map((g) => g.iso)).toEqual(["2026-08-21", "2026-08-22"]);
    expect(gruppen[0].aufgaben.map((x) => x.title)).toEqual(["C", "B"]);
  });

  it("hängt Aufgaben ohne Termin als letzte Gruppe an, statt sie zu datieren", () => {
    const gruppen = gruppiereNachTag([ohne, a]);
    expect(gruppen[gruppen.length - 1].iso).toBeNull();
    expect(gruppen[gruppen.length - 1].aufgaben).toEqual([ohne]);
  });

  it("zählt je Tag für die Punktmarker", () => {
    const zaehler = zaehleProTag([a, b, c, ohne]);
    expect(zaehler.get("2026-08-21")).toBe(2);
    expect(zaehler.get("2026-08-22")).toBe(1);
    expect(zaehler.size).toBe(2);
  });
});

describe("Wochenstreifen", () => {
  it("beginnt montags — auch wenn der Anker ein Sonntag ist", () => {
    // 23.08.2026 ist ein Sonntag.
    expect(wochenTage("2026-08-23")[0]).toBe("2026-08-17");
    expect(wochenTage("2026-08-23")).toHaveLength(7);
    expect(wochenTage("2026-08-17")[0]).toBe("2026-08-17");
  });

  it("läuft über die Monatsgrenze", () => {
    expect(tagPlus("2026-08-31", 1)).toBe("2026-09-01");
    expect(tagPlus("2026-09-01", -1)).toBe("2026-08-31");
    expect(wochenTage("2026-09-01")).toContain("2026-08-31");
  });
});

describe("Beschriftungen", () => {
  it("markiert heute und morgen", () => {
    expect(tagLabel("2026-08-21", "2026-08-21")).toBe("Heute · Freitag, 21. August");
    expect(tagLabel("2026-08-22", "2026-08-21")).toBe("Morgen · Samstag, 22. August");
  });

  it("nennt das Jahr nur, wenn es nicht das laufende ist", () => {
    expect(tagLabel("2026-12-24", "2026-08-21")).toBe("Donnerstag, 24. Dezember");
    expect(tagLabel("2027-01-04", "2026-08-21")).toBe("Montag, 4. Januar 2027");
  });

  it("nennt Monat und Jahr für den Kalenderkopf", () => {
    expect(monatLabel("2026-08-21")).toBe("August 2026");
  });
});

describe("monatsGrenzen", () => {
  it("umfasst den ganzen Monat inklusive letztem Tag", () => {
    const { von, bis } = monatsGrenzen("2026-08-21");
    expect(von).toBe("2026-08-01T00:00:00.000Z");
    // Bis zum Ende des 31. — mit „2026-08-31T00:00:00" fiele jede Aufgabe des
    // letzten Tages aus dem String-Vergleich des Servers heraus.
    expect(bis).toBe("2026-08-31T23:59:59.000Z");
  });

  it("trifft auch den Februar eines Schaltjahres", () => {
    expect(monatsGrenzen("2028-02-10").bis).toBe("2028-02-29T23:59:59.000Z");
  });
});
