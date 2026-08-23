// Tests der Eigentümer-Flächen (lib/owner-flaechen.ts).
//
// WARUM DAS GETESTET WIRD, obwohl der Server jeden Endpunkt selbst bewacht:
// Diese Datei entscheidet, was die App überhaupt ANBIETET. Ist sie zu
// großzügig, tippt ein Eigentümer auf eine Zeile und bekommt einen 403-Screen —
// der Fehler kommt zum spätesten möglichen Zeitpunkt. Ist sie zu streng, fehlt
// ein Bereich, für den das Recht längst vergeben wurde, und niemand merkt es,
// weil nichts kaputt aussieht.
//
// Die vier Rechte sind bewusst EINZELN geprüft: sie werden auch einzeln
// vergeben (granular_permissions.py). Ein Test, der sie zusammen setzt, würde
// eine Verwechslung untereinander nicht bemerken.
export {};

type Modul = typeof import("../owner-flaechen");
type Me = import("../../contexts/AuthContext").Me;

const { ownerFlaechenFor }: Modul = require("../owner-flaechen");

function me(role: Me["role"], permissions: string[]): Me {
  return {
    user_id: "u-1",
    email: "eigentuemer@example.com",
    tenant_id: "t-1",
    role,
    capabilities: [],
    permissions,
    accommodation_type: null,
    is_demo: false,
  } as unknown as Me;
}

describe("ownerFlaechenFor", () => {
  it("verweigert alles ohne geladenes Konto (fail-closed)", () => {
    expect(ownerFlaechenFor(null)).toEqual({
      objektbereich: false,
      objektbilder: false,
      fotoalbum: false,
      statistiken: false,
    });
  });

  it("gibt einem Eigentümer ohne die vier Rechte keine der Flächen", () => {
    // Ein Eigentümer, dem nur die alten Portal-Rechte zugewiesen sind.
    const f = ownerFlaechenFor(me("owner", ["pm_calendar", "pm_earnings"]));
    expect(f).toEqual({
      objektbereich: false,
      objektbilder: false,
      fotoalbum: false,
      statistiken: false,
    });
  });

  it("schaltet jede Fläche nur mit IHREM Recht frei", () => {
    expect(ownerFlaechenFor(me("owner", ["pm_property_area"]))).toEqual({
      objektbereich: true,
      objektbilder: false,
      fotoalbum: false,
      statistiken: false,
    });
    expect(ownerFlaechenFor(me("owner", ["pm_view_property_images"]))).toEqual({
      objektbereich: false,
      objektbilder: true,
      fotoalbum: false,
      statistiken: false,
    });
    expect(ownerFlaechenFor(me("owner", ["pm_photo_album"]))).toEqual({
      objektbereich: false,
      objektbilder: false,
      fotoalbum: true,
      statistiken: false,
    });
    expect(ownerFlaechenFor(me("owner", ["pm_nonrevenue_charts"]))).toEqual({
      objektbereich: false,
      objektbilder: false,
      fotoalbum: false,
      statistiken: true,
    });
  });

  it("öffnet mit allen vier Rechten alle vier Flächen", () => {
    const f = ownerFlaechenFor(
      me("owner", [
        "pm_property_area",
        "pm_view_property_images",
        "pm_photo_album",
        "pm_nonrevenue_charts",
      ]),
    );
    expect(f).toEqual({
      objektbereich: true,
      objektbilder: true,
      fotoalbum: true,
      statistiken: true,
    });
  });

  it("gibt einem Mitarbeiter ohne diese Rechte nichts (§4.3)", () => {
    // staff/cleaner landen gar nicht im Eigentümer-Erlebnis; sollte diese
    // Datei je woanders benutzt werden, darf sie trotzdem nichts aufmachen.
    const f = ownerFlaechenFor(me("cleaner", ["view_own_tasks"]));
    expect(Object.values(f).every((v) => v === false)).toBe(true);
  });
});
