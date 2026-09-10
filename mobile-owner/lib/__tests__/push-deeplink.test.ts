// Sprungziele der Eigentuemer-App.
//
// Bis zum 09.09.2026 stand hier die kopierte Tabelle der PMS-App: Schema
// `mynextdays://` statt `mynextdaysowner://`, und Routen (`reservierungen`,
// `aufgaben`, `inbox`), die diese App nicht hat. Kein einziges Serverziel traf
// zu, jeder Tap auf eine Meldung lief in die Rejection von `openURL` — ohne
// dass irgendwo ein Fehler sichtbar wurde.
//
// Diese Tests prüfen gegen die Ziele, die der SERVER wirklich schickt
// (`/portal/...`), nicht gegen eine erfundene Liste.
import { zielAlsDeepLink } from "@/lib/push";

const SCHEMA = "mynextdaysowner://";

describe("zielAlsDeepLink", () => {
  it("gibt ohne Ziel null", () => {
    expect(zielAlsDeepLink(undefined)).toBeNull();
    expect(zielAlsDeepLink("")).toBeNull();
  });

  it("benutzt AUSSCHLIESSLICH das Schema dieser App", () => {
    for (const ziel of [
      "/portal",
      "/portal/sperrungen",
      "/portal/buchungen",
      "/portal/dienstleistungen",
      "/portal/abrechnungen/a-1",
      "/portal/aufgaben",
    ]) {
      const link = zielAlsDeepLink(ziel);
      expect(link).not.toBeNull();
      expect(link!.startsWith(SCHEMA)).toBe(true);
      // Das Schema der PMS-App darf hier nie auftauchen.
      expect(link!.startsWith("mynextdays://")).toBe(false);
    }
  });

  it("bildet die echten Serverziele ab", () => {
    expect(zielAlsDeepLink("/portal/sperrungen")).toBe(`${SCHEMA}aufenthalte`);
    expect(zielAlsDeepLink("/portal/buchungen")).toBe(`${SCHEMA}aufenthalte`);
    expect(zielAlsDeepLink("/portal")).toBe(`${SCHEMA}objekte`);
    expect(zielAlsDeepLink("/portal/abrechnungen/a-7")).toBe(
      `${SCHEMA}abrechnungen/a-7`,
    );
    // Aufgaben an den Eigentuemer als Zustaendigen — beim ersten Anlauf
    // uebersehen, weil der Screen zwar existierte, aber keinen Linking-Pfad
    // hatte. Beide Haelften fehlten (09.09.2026).
    expect(zielAlsDeepLink("/portal/aufgaben")).toBe(`${SCHEMA}aufgaben`);
  });

  it("nimmt den Pfad mit und ohne fuehrenden Schraegstrich", () => {
    expect(zielAlsDeepLink("portal/sperrungen")).toBe(
      zielAlsDeepLink("/portal/sperrungen"),
    );
  });

  it("gibt bei unbekanntem Ziel null statt zu raten", () => {
    // Laufen Server und App auseinander, ist Nichtstun ehrlicher als ein
    // geratener Screen (Wurzel 4).
    expect(zielAlsDeepLink("/portal/voellig-neu")).toBeNull();
    expect(zielAlsDeepLink("/kalender/sperrantraege")).toBeNull();
    // Ziele der PMS-App gehoeren NICHT hierher.
    expect(zielAlsDeepLink("/posteingang/eig:t-1")).toBeNull();
    expect(zielAlsDeepLink("/reservierungen/r-1")).toBeNull();
  });
});
