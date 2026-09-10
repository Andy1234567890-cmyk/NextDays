// Tests für die Anlage-Nutzlast (lib/properties.ts · anlageNutzlast).
//
// DER ANLASS: Die Agentur legt das Objekt beim Kunden VOR ORT an, und dort ist
// selten alles bekannt. Genau dann entscheidet sich, ob ein leer gelassenes
// Feld als „nicht erfasst" in der Datenbank landet — oder als leere
// Zeichenkette, die später niemand mehr von einer echten Angabe unterscheiden
// kann (Wurzel 4). Das ist kein sichtbarer Fehler: die Anlage gelingt, und
// erst beim Portal-Sync fällt auf, dass die Adresse aus leeren Feldern
// besteht.
export {};

type Modul = typeof import("../properties");
const { anlageNutzlast }: Modul = require("../properties");

const basis = {
  titel: "Ferienhaus Kornblomst",
  typ: "ferienhaus",
  gaeste: "4",
  strasse: "",
  hausnummer: "",
  plz: "",
  ort: "",
};

describe("anlageNutzlast", () => {
  it("sendet leer gelassene Adressfelder GAR NICHT, statt sie zu leeren", () => {
    const nutzlast = anlageNutzlast(basis);
    expect(nutzlast).toEqual({
      title: "Ferienhaus Kornblomst",
      property_type: "ferienhaus",
      max_guests: 4,
    });
    // Der Kern: die Schlüssel fehlen, sie sind nicht "" oder null.
    expect("street" in nutzlast).toBe(false);
    expect("city" in nutzlast).toBe(false);
  });

  it("nimmt die Adresse mit, sobald sie ausgefüllt ist, und trimmt sie", () => {
    expect(
      anlageNutzlast({
        ...basis,
        strasse: "  Strandvejen ",
        hausnummer: " 12 ",
        plz: " 8300 ",
        ort: " Odder ",
      }),
    ).toEqual({
      title: "Ferienhaus Kornblomst",
      property_type: "ferienhaus",
      max_guests: 4,
      street: "Strandvejen",
      house_number: "12",
      postal_code: "8300",
      city: "Odder",
    });
  });

  it("lässt max_guests weg, statt eine ungültige Zahl zu schicken", () => {
    // Der Server lehnt <1 und Kommazahlen mit 422 ab. Die ganze Anlage daran
    // scheitern zu lassen, wäre die falsche Reaktion auf einen Tippfehler in
    // einem OPTIONALEN Feld.
    for (const gaeste of ["", "0", "-3", "2,5", "2.5", "abc"]) {
      expect("max_guests" in anlageNutzlast({ ...basis, gaeste })).toBe(false);
    }
  });

  it("hält den Namen getrimmt — er ist das einzige Pflichtfeld", () => {
    expect(anlageNutzlast({ ...basis, titel: "  Suite Nord  " }).title).toBe("Suite Nord");
  });
});
