// Rechenlogik des Belegungskalenders: Aufenthalte, Segmente, Bahnen, Saisons.
// Sie entscheidet, WAS der Eigentümer als Chip sieht und mit WELCHEM Betrag —
// ein Fehler hier ist eine falsche Geldaussage, die im Bild plausibel aussieht.
import {
  aufenthalteBilden,
  bahnenVerteilen,
  grundText,
  saisonProTag,
  segmenteBilden,
  wochenBilden,
} from "@/lib/kalender-aufenthalte";
import type { PortalCalendarDay, PortalNightBooking } from "@/lib/ownerPortal";

function buchung(teil: Partial<PortalNightBooking> & { reservation_id: string }): PortalNightBooking {
  return {
    unit_id: null,
    owner_payout_per_night: 100,
    currency: "EUR",
    payout_unknown_reason: null,
    guest_first_name: "Anna",
    booking_source: "Booking.com",
    is_owner_stay: false,
    ...teil,
  };
}

function tag(date: string, bookings: PortalNightBooking[]): PortalCalendarDay {
  return {
    date,
    status: bookings.length ? "booked" : "open",
    price: null,
    owner_payout_per_night: null,
    currency: null,
    owner_payout_unknown_reason: null,
    guest_first_name: null,
    booking_source: null,
    bookings,
    units_booked: bookings.length,
    units_total: 1,
  };
}

describe("aufenthalteBilden", () => {
  it("fasst die Nächte einer Reservierung zu EINEM Aufenthalt zusammen", () => {
    const a = aufenthalteBilden([
      tag("2026-09-03", [buchung({ reservation_id: "r1" })]),
      tag("2026-09-02", [buchung({ reservation_id: "r1" })]),
      tag("2026-09-04", [buchung({ reservation_id: "r1" })]),
    ]);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ von: "2026-09-02", bis: "2026-09-04", naechte: 3, proNacht: 100 });
  });

  it("trennt zwei Einheiten derselben Reservierung in zwei Aufenthalte", () => {
    const a = aufenthalteBilden([
      tag("2026-09-02", [
        buchung({ reservation_id: "r1", unit_id: "u1" }),
        buchung({ reservation_id: "r1", unit_id: "u2" }),
      ]),
    ]);
    expect(a.map((x) => x.unitId).sort()).toEqual(["u1", "u2"]);
  });

  it("Eigennutzung: keine Lücke, kein Grund — es fehlt nichts", () => {
    const a = aufenthalteBilden([
      tag("2026-09-02", [
        buchung({
          reservation_id: "e1",
          is_owner_stay: true,
          owner_payout_per_night: null,
          currency: null,
          guest_first_name: null,
          booking_source: null,
        }),
      ]),
      tag("2026-09-03", [
        buchung({
          reservation_id: "e1",
          is_owner_stay: true,
          owner_payout_per_night: null,
          currency: null,
          guest_first_name: null,
          booking_source: null,
        }),
      ]),
    ]);
    expect(a[0]).toMatchObject({ eigennutzung: true, luecke: false, grund: null, naechte: 2 });
  });

  it("nennt den Grund, wenn eine Nacht keinen Betrag hat", () => {
    const a = aufenthalteBilden([
      tag("2026-09-02", [buchung({ reservation_id: "r1" })]),
      tag("2026-09-03", [
        buchung({ reservation_id: "r1", owner_payout_per_night: null, payout_unknown_reason: "provision" }),
      ]),
    ]);
    expect(a[0].luecke).toBe(true);
    expect(a[0].grund).toBe("provision");
    // Der Wert der ERSTEN Nacht bleibt der Chip-Wert.
    expect(a[0].proNacht).toBe(100);
  });

  it("bildet bei Saisonwechsel die Spanne, keinen Durchschnitt", () => {
    const a = aufenthalteBilden([
      tag("2026-09-02", [buchung({ reservation_id: "r1", owner_payout_per_night: 80 })]),
      tag("2026-09-03", [buchung({ reservation_id: "r1", owner_payout_per_night: 120 })]),
    ]);
    expect(a[0]).toMatchObject({ proNacht: 80, minProNacht: 80, maxProNacht: 120 });
  });

  it("verwirft den Betrag bei Währungswechsel und nennt den Grund", () => {
    const a = aufenthalteBilden([
      tag("2026-09-02", [buchung({ reservation_id: "r1", currency: "EUR" })]),
      tag("2026-09-03", [buchung({ reservation_id: "r1", currency: "DKK" })]),
    ]);
    expect(a[0]).toMatchObject({ proNacht: null, currency: null, luecke: true, grund: "betrag" });
  });
});

describe("wochenBilden / segmenteBilden", () => {
  const woche1 = ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"];
  const woche2 = ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13"];

  it("füllt eine angefangene Woche auf sieben Felder auf", () => {
    const w = wochenBilden([null, null, "2026-09-01", "2026-09-02"]);
    expect(w).toHaveLength(1);
    expect(w[0]).toHaveLength(7);
    expect(w[0][6]).toBeNull();
  });

  it("schneidet einen Aufenthalt an der Wochengrenze — nur ECHTE Kanten sind rund", () => {
    const [a] = aufenthalteBilden(
      ["2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08"].map((d) =>
        tag(d, [buchung({ reservation_id: "r1" })]),
      ),
    );
    const s1 = segmenteBilden(woche1, [a]);
    const s2 = segmenteBilden(woche2, [a]);
    expect(s1[0]).toMatchObject({ spalte: 5, breite: 2, echterAnfang: true, echtesEnde: false });
    expect(s2[0]).toMatchObject({ spalte: 0, breite: 2, echterAnfang: false, echtesEnde: true });
  });

  it("liefert kein Segment für Wochen ohne Nacht des Aufenthalts", () => {
    const [a] = aufenthalteBilden([tag("2026-09-02", [buchung({ reservation_id: "r1" })])]);
    expect(segmenteBilden(woche2, [a])).toEqual([]);
  });
});

describe("bahnenVerteilen", () => {
  const woche = ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13"];

  it("legt Überlappendes auf getrennte Bahnen und fasst ab der dritten zu +n zusammen", () => {
    const tage = ["2026-09-08", "2026-09-09"].map((d) =>
      tag(d, [
        buchung({ reservation_id: "r1", unit_id: "u1", owner_payout_per_night: 100 }),
        buchung({ reservation_id: "r2", unit_id: "u2", owner_payout_per_night: 50 }),
        buchung({ reservation_id: "r3", unit_id: "u3", owner_payout_per_night: 25 }),
      ]),
    );
    const seg = segmenteBilden(woche, aufenthalteBilden(tage));
    const { sichtbar, ueberlauf } = bahnenVerteilen(seg);
    expect(sichtbar).toHaveLength(2);
    expect(new Set(sichtbar.map((b) => b.bahn))).toEqual(new Set([0, 1]));
    // „+1" je Spalte, mit dem Nachtwert der zusammengefassten Einheit.
    expect([...ueberlauf.keys()].sort()).toEqual([1, 2]);
    expect(ueberlauf.get(1)).toMatchObject({ anzahl: 1, summe: 25, currency: "EUR" });
  });

  it("zählt eine Eigennutzung im Überlauf mit, ohne die Summe zu kippen", () => {
    // Bei gleicher Spalte und Breite entscheidet der Schlüssel alphabetisch,
    // wer eine Bahn bekommt. Die Eigennutzung heißt darum `z1`: sie soll hier
    // gezielt im Überlauf landen, zusammen mit r3.
    const tage = [
      tag("2026-09-08", [
        buchung({ reservation_id: "r1", unit_id: "u1" }),
        buchung({ reservation_id: "r2", unit_id: "u2" }),
        buchung({ reservation_id: "r3", unit_id: "u3", owner_payout_per_night: 40 }),
        buchung({
          reservation_id: "z1",
          unit_id: "u4",
          is_owner_stay: true,
          owner_payout_per_night: null,
          currency: null,
        }),
      ]),
    ];
    const { ueberlauf } = bahnenVerteilen(segmenteBilden(woche, aufenthalteBilden(tage)));
    expect(ueberlauf.get(1)).toMatchObject({ anzahl: 2, summe: 40, currency: "EUR", grund: null });
  });
});

describe("saisonProTag", () => {
  it("färbt jeden Tag des Zeitraums inklusive beider Enden, letzte Zuweisung gewinnt", () => {
    const map = saisonProTag([
      { id: "s1", name: "Neben", color: "#111111", assignments: [{ start_date: "2026-09-01", end_date: "2026-09-30" }] },
      { id: "s2", name: "Hoch", color: "#222222", assignments: [{ start_date: "2026-09-10", end_date: "2026-09-12" }] },
    ]);
    expect(map.get("2026-09-01")?.id).toBe("s1");
    expect(map.get("2026-09-30")?.id).toBe("s1");
    expect(map.get("2026-09-11")?.id).toBe("s2");
    expect(map.get("2026-10-01")).toBeUndefined();
  });
});

describe("grundText", () => {
  it("fällt bei unbekanntem Grund auf die allgemeine Aussage zurück, nie auf den Slug", () => {
    expect(grundText("irgendwas_neues")).toBe("Nicht ausweisbar");
    expect(grundText(null)).toBe("Nicht ausweisbar");
    expect(grundText("betrag")).toBe("Zu dieser Buchung fehlt der Gesamtbetrag.");
  });
});
