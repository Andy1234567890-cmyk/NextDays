import {
  alsAbreiseWaehlbar,
  alsSperrantrag,
  antragStatusName,
  aufenthaltNaechte,
  bereichFrei,
  bereichWaehlen,
  checkoutAus,
  gaesteText,
  istBevorstehend,
} from "@/lib/aufenthalt";
import { txt } from "@/lib/test-uebersetzer";
import type { PortalCalendarDay } from "@/lib/ownerPortal";

function tag(date: string, status: string, belegt = 0, gesamt = 1): PortalCalendarDay {
  return {
    date,
    status,
    price: null,
    owner_payout_per_night: null,
    currency: null,
    owner_payout_unknown_reason: null,
    guest_first_name: null,
    guest_last_name: null,
    guest_nationality: null,
    guest_country: null,
    num_guests: null,
    adults: null,
    children: null,
    pets: null,
    booking_source: null,
    bookings: [],
    units_booked: belegt,
    units_total: gesamt,
  };
}

const tage = new Map<string, PortalCalendarDay>([
  ["2026-08-22", tag("2026-08-22", "open")],
  ["2026-08-23", tag("2026-08-23", "open")],
  ["2026-08-24", tag("2026-08-24", "booked", 1)],
  ["2026-08-25", tag("2026-08-25", "open")],
  ["2026-08-26", tag("2026-08-26", "open", 1, 2)],
]);

describe("bereichWaehlen", () => {
  it("erster Tipp = Anreise, zweiter danach = Abreise", () => {
    const a = bereichWaehlen(null, "2026-08-22");
    expect(a).toEqual({ von: "2026-08-22", bis: null });
    expect(bereichWaehlen(a, "2026-08-24")).toEqual({ von: "2026-08-22", bis: "2026-08-24" });
  });
  it("Tipp davor oder auf denselben Tag setzt die Anreise neu", () => {
    const a = { von: "2026-08-22", bis: null };
    expect(bereichWaehlen(a, "2026-08-20")).toEqual({ von: "2026-08-20", bis: null });
    expect(bereichWaehlen(a, "2026-08-22")).toEqual({ von: "2026-08-22", bis: null });
  });
  it("mit vollem Bereich beginnt ein Tipp von vorn", () => {
    expect(bereichWaehlen({ von: "2026-08-22", bis: "2026-08-24" }, "2026-08-30")).toEqual({
      von: "2026-08-30",
      bis: null,
    });
  });
});

describe("Freiheit der Nächte", () => {
  it("Abreisetag darf belegt sein, die Nächte davor nicht", () => {
    expect(bereichFrei(tage, "2026-08-22", "2026-08-24")).toBe(true); // Nächte 22, 23
    expect(bereichFrei(tage, "2026-08-22", "2026-08-25")).toBe(false); // Nacht 24 belegt
  });
  it("eine freie Einheit von zwei zählt als frei", () => {
    expect(bereichFrei(tage, "2026-08-25", "2026-08-27")).toBe(true);
  });
  it("alsAbreiseWaehlbar verlangt einen Tag NACH der Anreise", () => {
    expect(alsAbreiseWaehlbar(tage, "2026-08-22", "2026-08-22")).toBe(false);
    expect(alsAbreiseWaehlbar(tage, "2026-08-22", "2026-08-24")).toBe(true);
    expect(alsAbreiseWaehlbar(tage, "2026-08-22", "2026-08-26")).toBe(false);
  });
});

describe("Umrechnung auf den Sperrantrag", () => {
  it("end_date ist der Tag vor der Abreise", () => {
    expect(alsSperrantrag("2026-08-22", "2026-08-26")).toEqual({
      start_date: "2026-08-22",
      end_date: "2026-08-25",
    });
    expect(checkoutAus("2026-08-25")).toBe("2026-08-26");
    expect(aufenthaltNaechte("2026-08-22", "2026-08-26")).toBe(4);
  });
  it("bevorstehend, solange der Check-out nach heute liegt", () => {
    expect(istBevorstehend("2026-08-25", "2026-08-26")).toBe(false);
    expect(istBevorstehend("2026-08-25", "2026-08-25")).toBe(true);
  });
});

describe("Texte", () => {
  it("gaesteText", () => {
    expect(gaesteText(txt, 1)).toBe("1 Erwachsener");
    expect(gaesteText(txt, 3)).toBe("3 Erwachsene");
    expect(gaesteText(txt, null)).toBe("Nicht angegeben");
  });
  it("antragStatusName kennt die Stati und lässt Fremdes roh", () => {
    expect(antragStatusName(txt, "pending")).toBe("Wird geprüft");
    expect(antragStatusName(txt, "approved")).toBe("Bestätigt");
    expect(antragStatusName(txt, "xyz")).toBe("xyz");
  });
});
