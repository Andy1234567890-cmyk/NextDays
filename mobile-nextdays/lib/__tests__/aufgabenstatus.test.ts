// Prüft das Statusbild einer Aufgabe (Reihenfolge der Bedeutungen wie im Web).
import {
  AUFGABE_STATUS_LABEL,
  aufgabeTon,
  naechsterStatus,
  zurueckStatus,
} from "@/lib/aufgabenstatus";

function lokal(iso: string, stunde = 9): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, stunde).toISOString();
}

const HEUTE = "2026-08-21";

describe("aufgabeTon", () => {
  it("erledigt und abgebrochen gewinnen über alles", () => {
    expect(
      aufgabeTon({ status: "done", assignee_id: null, start_at: null, due_at: null }, HEUTE),
    ).toBe("done");
    expect(
      aufgabeTon(
        { status: "cancelled", assignee_id: null, start_at: lokal(HEUTE), due_at: null },
        HEUTE,
      ),
    ).toBe("cancelled");
  });

  it("heute faellig steht ueber niemand zugewiesen", () => {
    expect(
      aufgabeTon({ status: "open", assignee_id: null, start_at: lokal(HEUTE), due_at: null }, HEUTE),
    ).toBe("today");
  });

  it("offen ohne Zuständige ist die Warnung", () => {
    expect(
      aufgabeTon(
        { status: "open", assignee_id: null, start_at: lokal("2026-08-25"), due_at: null },
        HEUTE,
      ),
    ).toBe("unassigned");
  });

  it("offen und zugewiesen bleibt unauffällig", () => {
    expect(
      aufgabeTon(
        { status: "in_progress", assignee_id: "u1", start_at: lokal("2026-08-25"), due_at: null },
        HEUTE,
      ),
    ).toBe("plain");
  });

  it("nimmt denselben LOKALEN Tag wie die Gruppierung", () => {
    // 23:30 Ortszeit am 21.: UTC-Datum kann der 22. sein — der Ton muss dem
    // lokalen Tag folgen, sonst widerspricht er der Gruppe darüber.
    expect(
      aufgabeTon(
        { status: "open", assignee_id: "u1", start_at: lokal(HEUTE, 23), due_at: null },
        HEUTE,
      ),
    ).toBe("today");
  });

  it("hat für jeden Status eine Beschriftung — auch für accepted", () => {
    // Der Serverwert `accepted` (0360) fehlte hier komplett: eine angenommene
    // Aufgabe hatte in der App keine Beschriftung und keinen nächsten Schritt.
    expect(Object.keys(AUFGABE_STATUS_LABEL).sort()).toEqual([
      "accepted",
      "cancelled",
      "done",
      "in_progress",
      "open",
    ]);
  });

  it("führt die Arbeitskette offen → angenommen → in Arbeit → erledigt", () => {
    expect(naechsterStatus("open")).toBe("accepted");
    expect(naechsterStatus("accepted")).toBe("in_progress");
    expect(naechsterStatus("in_progress")).toBe("done");
    // Aus erledigt/abgebrochen führt kein „weiter" — das Zurücknehmen ist eine
    // eigene Entscheidung.
    expect(naechsterStatus("done")).toBeNull();
    expect(naechsterStatus("cancelled")).toBeNull();
  });

  it("bietet aus jedem Endzustand den Rueckweg nach offen", () => {
    // „Erledigt" war in der App eine Sackgasse: kein „weiter", kein „zurück",
    // der ganze Zustand-Abschnitt verschwand. Der Server erlaubt den Wechsel
    // (`_STATUS_WECHSEL`: done → open, cancelled → open) — nur die Oberfläche
    // bot ihn nicht an.
    expect(zurueckStatus("done")).toBe("open");
    expect(zurueckStatus("cancelled")).toBe("open");
  });

  it("bietet im laufenden Betrieb keinen Rueckweg an", () => {
    // Aus einer laufenden Aufgabe ist „offen" ein gewöhnlicher Schritt der
    // Statusleiste, kein Zurücknehmen — sonst stünden zwei Knöpfe für
    // dasselbe Ziel nebeneinander.
    expect(zurueckStatus("open")).toBeNull();
    expect(zurueckStatus("accepted")).toBeNull();
    expect(zurueckStatus("in_progress")).toBeNull();
  });
});
