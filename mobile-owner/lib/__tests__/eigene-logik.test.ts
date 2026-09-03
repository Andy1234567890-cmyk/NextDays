// Die selbst geschriebene Logik dieser App. Alles, was aus mobile-nextdays
// übernommen wurde, ist dort geprüft; hier steht nur das Neue.
import { deckkraft } from "@/components/widgets/Ring";
import { statusName } from "@/screens/Abrechnungen";
import { zeitraumGrenzen } from "@/screens/Auszahlungen";
import { zeitraumPlausibel } from "@/screens/Sperrantrag";
import { kanalName, kanalTeile } from "@/screens/Ueberblick";
import { artName, heuteIso, zahlAus } from "@/screens/Zaehlerstand";

describe("deckkraft", () => {
  it("gibt bei EINEM Segment volle Deckung", () => {
    // Der Grund für den Sonderfall: `index / (laenge - 1)` wäre hier 0/0 =
    // NaN, und ein Segment mit strokeOpacity NaN ist unsichtbar.
    expect(deckkraft(0, 1)).toBe(1);
  });

  it("stuft vom ersten zum letzten Segment ab", () => {
    expect(deckkraft(0, 4)).toBe(1);
    expect(deckkraft(3, 4)).toBeCloseTo(0.3);
  });

  it("bleibt immer sichtbar", () => {
    for (let n = 1; n <= 8; n++) {
      for (let i = 0; i < n; i++) {
        expect(deckkraft(i, n)).toBeGreaterThanOrEqual(0.3);
        expect(deckkraft(i, n)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("kanalName", () => {
  it("nennt den eigenen Marktplatz beim Markennamen", () => {
    // CLAUDE.md: der eigene Marktplatz ist ein gleichrangiger Kanal und heißt
    // myBestDays — nicht „Portal" und nicht „Direkt".
    expect(kanalName("portal", null)).toBe("myBestDays");
  });

  it("bevorzugt den echten Portalnamen aus den Daten", () => {
    expect(kanalName("ota_other", "BookingCom")).toBe("Booking.com");
  });

  it("gibt einen unbekannten Code unverändert zurück, statt zu raten", () => {
    expect(kanalName("nagelneuer_kanal", null)).toBe("nagelneuer_kanal");
  });

  it("unterscheidet Website von Direkt", () => {
    expect(kanalName("website", null)).toBe("Eigene Website");
    expect(kanalName("direct", null)).toBe("Direkt");
  });
});

describe("zeitraumGrenzen", () => {
  const heute = new Date(2026, 8, 2); // 02.09.2026

  it("Dieses Jahr beginnt am 1. Januar", () => {
    expect(zeitraumGrenzen("Dieses Jahr", heute)).toEqual({
      von: "2026-01-01",
      bis: "2026-09-02",
    });
  });

  it("Letztes Jahr umfasst das ganze Vorjahr", () => {
    expect(zeitraumGrenzen("Letztes Jahr", heute)).toEqual({
      von: "2025-01-01",
      bis: "2025-12-31",
    });
  });

  it("Letzte 12 Monate startet am Monatsersten vor elf Monaten", () => {
    expect(zeitraumGrenzen("Letzte 12 Monate", heute)).toEqual({
      von: "2025-10-01",
      bis: "2026-09-02",
    });
  });

  it("rechnet über den Jahreswechsel", () => {
    const januar = new Date(2026, 0, 15);
    expect(zeitraumGrenzen("Letzte 12 Monate", januar).von).toBe("2025-02-01");
  });
});

describe("zeitraumPlausibel", () => {
  it("nimmt einen gültigen Zeitraum an", () => {
    expect(zeitraumPlausibel("2026-08-01", "2026-08-14")).toBe(true);
  });

  it("erlaubt eine einzelne Nacht", () => {
    expect(zeitraumPlausibel("2026-08-01", "2026-08-01")).toBe(true);
  });

  it("lehnt eine verdrehte Reihenfolge ab", () => {
    expect(zeitraumPlausibel("2026-08-14", "2026-08-01")).toBe(false);
  });

  it("lehnt falsche Formate ab, statt sie zu deuten", () => {
    expect(zeitraumPlausibel("01.08.2026", "14.08.2026")).toBe(false);
    expect(zeitraumPlausibel("", "2026-08-14")).toBe(false);
    expect(zeitraumPlausibel("2026-8-1", "2026-8-14")).toBe(false);
  });
});

describe("zahlAus", () => {
  it("nimmt das Komma der deutschen Tastatur an", () => {
    // Ohne die Umwandlung wurde „1234,5" zu NaN und die Ablesung still
    // verworfen.
    expect(zahlAus("1234,5")).toBe(1234.5);
  });

  it("nimmt auch den Punkt an", () => {
    expect(zahlAus("1234.5")).toBe(1234.5);
  });

  it("lehnt Text und negative Werte ab", () => {
    expect(zahlAus("abc")).toBeNull();
    expect(zahlAus("-5")).toBeNull();
    expect(zahlAus("")).toBeNull();
    expect(zahlAus("   ")).toBeNull();
  });

  it("erlaubt den Stand 0", () => {
    // Ein neuer Zähler steht auf 0 — das ist ein echter Wert, kein fehlender.
    expect(zahlAus("0")).toBe(0);
  });
});

describe("artName und statusName", () => {
  it("beschriftet bekannte Codes", () => {
    expect(artName("electricity")).toBe("Strom");
    expect(statusName("final")).toBe("Abgeschlossen");
  });

  it("gibt unbekannte Codes roh zurück, statt sie zu erfinden", () => {
    expect(artName("fernwaerme")).toBe("fernwaerme");
    expect(statusName("irgendwas")).toBe("irgendwas");
  });
});

describe("heuteIso", () => {
  it("bildet das lokale Datum", () => {
    expect(heuteIso(new Date(2026, 8, 2, 0, 15))).toBe("2026-09-02");
  });
});

describe("kanalTeile", () => {
  // Der reale Fall: AirSmil fuehrt Booking in zwei Schreibweisen.
  it("faltet mehrere Schreibweisen desselben Portals zu EINEM Teil", () => {
    const teile = kanalTeile([
      { channel: "booking", ota_name: "Booking.com", reservations: 206 },
      { channel: "booking", ota_name: "BookingCom", reservations: 88 },
    ]);
    expect(teile).toEqual([{ name: "Booking.com", wert: 294 }]);
  });

  it("vergibt eindeutige Namen — sonst kollidieren die React-Keys im Ring", () => {
    const teile = kanalTeile([
      { channel: "booking", ota_name: "BookingCom", reservations: 5 },
      { channel: "booking", ota_name: "Booking.com", reservations: 5 },
      { channel: "airbnb", ota_name: null, reservations: 3 },
      { channel: "portal", ota_name: null, reservations: 1 },
    ]);
    const namen = teile.map((t) => t.name);
    expect(new Set(namen).size).toBe(namen.length);
  });

  it("sortiert absteigend, damit der groesste Kanal zuerst steht", () => {
    const teile = kanalTeile([
      { channel: "portal", ota_name: null, reservations: 2 },
      { channel: "airbnb", ota_name: null, reservations: 9 },
      { channel: "website", ota_name: null, reservations: 5 },
    ]);
    expect(teile.map((t) => t.wert)).toEqual([9, 5, 2]);
  });

  it("gibt bei leerer Eingabe eine leere Liste — der Ring zeigt dann Strich", () => {
    expect(kanalTeile([])).toEqual([]);
  });
});
