// Prüft die Aufbereitung der Aufgaben-Agenda: der TAG einer Aufgabe (lokal,
// start_at vor due_at), Zeitfenster ohne erfundene Werte, Tagesgruppen,
// Wochenstreifen und Monatsgrenzen.
import {
  aufgabenTag,
  aufgabenTage,
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
  const offen = "open" as const;
  const a = { title: "A", status: offen, start_at: lokal("2026-08-22", 10), due_at: null, end_at: null };
  const b = { title: "B", status: offen, start_at: lokal("2026-08-21", 14), due_at: null, end_at: null };
  const c = { title: "C", status: offen, start_at: lokal("2026-08-21", 8), due_at: null, end_at: null };
  const ohne = { title: "D", status: offen, start_at: null, due_at: null, end_at: null };

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

  it("zählt nur OFFENE — ein durchgearbeiteter Tag bekommt keinen Punkt", () => {
    // Beide Aufgaben des 21.08. sind abgeschlossen: der Tag verschwindet aus
    // der Zählung, statt wie ein Tag mit offener Arbeit auszusehen.
    const zaehler = zaehleProTag([
      { ...b, status: "done" as const },
      { ...c, status: "cancelled" as const },
      a,
    ]);
    expect(zaehler.get("2026-08-21")).toBeUndefined();
    expect(zaehler.get("2026-08-22")).toBe(1);
  });

  it("angenommen und in Arbeit sind offen — die Arbeit läuft noch", () => {
    const zaehler = zaehleProTag([
      { ...b, status: "accepted" as const },
      { ...c, status: "in_progress" as const },
    ]);
    expect(zaehler.get("2026-08-21")).toBe(2);
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
  it("umfasst den Monat plus eine Woche Rand auf jeder Seite", () => {
    const { von, bis } = monatsGrenzen("2026-08-21");
    // Eine Woche VOR dem Monat: die Woche des 1. August beginnt im Juli, und
    // der Wochenstreifen zeigt diese Tage — ohne Rand blieben sie leer.
    expect(von).toBe("2026-07-25T00:00:00.000Z");
    // Bis zum Ende des Randes hinter dem 31. — mit „2026-08-31T00:00:00" fiele
    // jede Aufgabe des letzten Tages aus dem String-Vergleich des Servers.
    expect(bis).toBe("2026-09-07T23:59:59.000Z");
  });

  it("trifft auch den Februar eines Schaltjahres", () => {
    // Der 29. ist der letzte Februartag 2028; der Rand reicht bis in den März.
    expect(monatsGrenzen("2028-02-10").bis).toBe("2028-03-07T23:59:59.000Z");
  });

  it("deckt jeden Tag des Wochenstreifens ab, auch über die Monatsgrenze", () => {
    // Der Fehler, den der Rand behebt: `wochenTage("2026-09-01")` enthält den
    // 31. August. Lädt der Screen nur den September, hat dieser Tag keine
    // Aufgaben und keinen Punkt — obwohl dort welche liegen.
    const { von, bis } = monatsGrenzen("2026-09-01");
    for (const tag of wochenTage("2026-09-01")) {
      expect(tag >= von.slice(0, 10)).toBe(true);
      expect(tag <= bis.slice(0, 10)).toBe(true);
    }
  });
});

describe("aufgabenTage", () => {
  it("nennt beide Tage, wenn die Aufgabe von einem Tag zum nächsten läuft", () => {
    // Der live gemeldete Fall: „Velk T" (Wechsel) läuft von einem Tag vor der
    // Anreise bis zur Anreise — 22.08. 18:00 bis 23.08. 18:00. Am 23. fiel sie
    // aus der Liste, weil nur der Starttag zählte.
    expect(
      aufgabenTage({
        start_at: lokal("2026-08-22", 18),
        end_at: lokal("2026-08-23", 18),
        due_at: lokal("2026-08-23", 18),
      }),
    ).toEqual(["2026-08-22", "2026-08-23"]);
  });

  it("bleibt bei einem Tag, wenn Anfang und Ende auf denselben fallen", () => {
    expect(
      aufgabenTage({
        start_at: lokal("2026-08-22", 10),
        end_at: lokal("2026-08-22", 12),
        due_at: null,
      }),
    ).toEqual(["2026-08-22"]);
  });

  it("nimmt ohne Anfang den Fälligkeitstag", () => {
    expect(
      aufgabenTage({ start_at: null, end_at: null, due_at: lokal("2026-08-30") }),
    ).toEqual(["2026-08-30"]);
  });

  it("ohne jeden Termin kein Tag", () => {
    expect(aufgabenTage({ start_at: null, end_at: null, due_at: null })).toEqual([]);
  });

  it("faellt bei absurder Dauer auf den Starttag zurueck", () => {
    // Eine Aufgabe über ein halbes Jahr ist keine Tagesaufgabe, sondern eine
    // Fehlkonfiguration — sie darf nicht 180 Tage mit Punkten fluten.
    expect(
      aufgabenTage({
        start_at: lokal("2026-08-22"),
        end_at: lokal("2027-02-22"),
        due_at: null,
      }),
    ).toEqual(["2026-08-22"]);
  });
});

describe("zaehleProTag mehrtaegig", () => {
  it("zaehlt eine zweitaegige Aufgabe an BEIDEN Tagen", () => {
    const zaehler = zaehleProTag([
      {
        status: "open" as const,
        start_at: lokal("2026-08-22", 18),
        end_at: lokal("2026-08-23", 18),
        due_at: lokal("2026-08-23", 18),
      },
    ]);
    expect(zaehler.get("2026-08-22")).toBe(1);
    expect(zaehler.get("2026-08-23")).toBe(1);
  });
});

describe("Tagesangabe ohne erfundene Uhrzeit", () => {
  it("zeigt keine Uhrzeit, wenn der Zeitstempel nur den Tag meint", () => {
    // Die Engine setzt 00:00 UTC, wenn die Buchung keine Check-in-Zeit kennt.
    // In Kopenhagen wären das „2:00" — eine Uhrzeit, die niemand gemeint hat.
    expect(uhrzeit("2026-08-23T00:00:00+00:00")).toBeNull();
    expect(
      zeitfenster({
        start_at: "2026-08-22T00:00:00+00:00",
        end_at: "2026-08-23T00:00:00+00:00",
        due_at: "2026-08-23T00:00:00+00:00",
      }),
    ).toBeNull();
  });

  it("zeigt eine echte Uhrzeit weiterhin", () => {
    // Über `lokal()` gebaut, nicht mit einem festen UTC-Zeitstempel: „16:00 UTC
    // ist 18:00" gilt nur in Kopenhagen. Der CI-Runner läuft in UTC — ein
    // solcher Test ist auf dem Entwicklerrechner grün und in der Pipeline rot.
    expect(uhrzeit(lokal("2026-08-22", 18))).toBe("18:00");
  });
});
