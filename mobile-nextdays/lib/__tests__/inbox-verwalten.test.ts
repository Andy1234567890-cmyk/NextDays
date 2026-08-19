// Tests der Verwaltungs-Anzeige (components/inbox/VerwaltenSheet.tsx).
//
// Geprüft wird die eine Rechnung darin, die man falsch machen kann: der Versatz
// einer Automation ist VORZEICHENBEHAFTET. „3 Tage davor" und „3 Tage danach"
// sind zwei verschiedene Nachrichten an einen echten Gast — eine vor der
// Anreise verschickte Abreise-Info ist kein Schönheitsfehler.
export {};

type Modul = typeof import("../../components/inbox/VerwaltenSheet");
const { versatzText }: Modul = require("../../components/inbox/VerwaltenSheet");

const basis = {
  id: "a1",
  name: "Test",
  trigger: "before_checkin",
  offset_days: 0,
  send_time: null,
  channels: [],
  template_id: null,
  message: null,
  is_active: true,
};

describe("versatzText", () => {
  it("nennt einen negativen Versatz als davor", () => {
    expect(versatzText({ ...basis, offset_value: -3, offset_unit: "days" })).toBe(
      "3 Tage davor",
    );
  });

  it("nennt einen positiven Versatz als danach", () => {
    expect(versatzText({ ...basis, offset_value: 2, offset_unit: "days" })).toBe(
      "2 Tage danach",
    );
  });

  it("versteht Stunden und Minuten", () => {
    expect(versatzText({ ...basis, offset_value: -4, offset_unit: "hours" })).toBe(
      "4 Std. davor",
    );
    expect(versatzText({ ...basis, offset_value: 30, offset_unit: "minutes" })).toBe(
      "30 Min. danach",
    );
  });

  it("fällt auf offset_days zurück, wenn offset_value fehlt", () => {
    // Ältere Automationen tragen nur `offset_days` (der Server leitet das neue
    // Paar daraus ab). Ohne diesen Rückfall stünde bei ihnen „am Stichtag".
    expect(versatzText({ ...basis, offset_days: -1 })).toBe("1 Tage davor");
  });

  it("sagt bei Versatz 0 am Stichtag", () => {
    expect(versatzText({ ...basis, offset_value: 0, offset_unit: "days" })).toBe(
      "am Stichtag",
    );
  });
});
