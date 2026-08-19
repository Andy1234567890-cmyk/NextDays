// Tests des Posteingang-Zugriffsmodells (lib/inbox-access.ts).
//
// WARUM DAS GETESTET WIRD, obwohl der Server maskiert: Diese Datei entscheidet,
// welche AKTIONEN die App anbietet. Fällt sie zu großzügig aus, tippt ein
// Mitarbeiter eine Antwort, die der Server anschliessend abweist — die Arbeit
// ist weg und der Fehler kommt zum spätesten möglichen Zeitpunkt. Fällt sie zu
// streng aus, kann jemand nicht arbeiten, der dürfte.
//
// Zweiter Punkt: Die Werte müssen mit web/lib/inbox-access.ts übereinstimmen.
// Zwei Oberflächen, die „darf ich das?" verschieden beantworten, sind ein Bug,
// den niemand sieht, weil beide für sich plausibel wirken.
export {};

type Modul = typeof import("../inbox-access");
type Me = import("../../contexts/AuthContext").Me;

const { inboxAccessFor, firstNameOnly }: Modul = require("../inbox-access");

function me(role: Me["role"], permissions: string[]): Me {
  return {
    id: "u-1",
    email: "test@example.com",
    role,
    capabilities: [],
    permissions,
  } as unknown as Me;
}

describe("inboxAccessFor", () => {
  it("verweigert alles ohne angemeldeten Nutzer (fail-closed)", () => {
    const a = inboxAccessFor(null);
    expect(a.canAccess).toBe(false);
    expect(a.canReply).toBe(false);
    expect(a.canAssign).toBe(false);
    expect(a.canManageConfig).toBe(false);
    // Der engere Scope ist der Default: „assigned", nie „all".
    expect(a.scope).toBe("assigned");
  });

  it("gibt dem Admin alles — er trägt laut /auth/me alle Rechte", () => {
    // Der Server liefert einem Admin die vollständige Liste
    // (account_service._effective_perm_ids). Genau darauf baut diese Datei,
    // deshalb steht hier KEIN zusätzlicher Admin-Kurzschluss.
    const a = inboxAccessFor(
      me("admin", [
        "pm_chat",
        "inbox_view_all",
        "inbox_reply",
        "inbox_assign",
        "inbox_manage_config",
        "view_guest_name",
        "view_guest_contact",
        "pm_booking_total",
        "view_booking_source",
      ]),
    );
    expect(a).toEqual({
      canAccess: true,
      scope: "all",
      canReply: true,
      canAssign: true,
      canManageConfig: true,
      fullName: true,
      contact: true,
      amounts: true,
      source: true,
    });
  });

  it("beschränkt einen Mitarbeiter mit Leserecht auf seine Zuweisungen", () => {
    const a = inboxAccessFor(me("staff", ["pm_chat"]));
    expect(a.canAccess).toBe(true);
    expect(a.scope).toBe("assigned");
    // DER Fall, der die Oberfläche vorher falsch darstellte: mitlesen ja,
    // antworten nein — das Antwortfeld darf nicht erscheinen.
    expect(a.canReply).toBe(false);
    expect(a.canAssign).toBe(false);
  });

  it("hide_prices nimmt dem Mitarbeiter die Beträge, dem Admin nicht", () => {
    const staff = inboxAccessFor(
      me("staff", ["pm_chat", "pm_booking_total", "hide_prices"]),
    );
    expect(staff.amounts).toBe(false);

    const admin = inboxAccessFor(
      me("admin", ["pm_chat", "pm_booking_total", "hide_prices"]),
    );
    expect(admin.amounts).toBe(true);
  });

  it("ohne pm_booking_total keine Beträge, auch ohne hide_prices", () => {
    expect(inboxAccessFor(me("staff", ["pm_chat"])).amounts).toBe(false);
  });
});

describe("firstNameOnly", () => {
  it("kürzt auf den Vornamen", () => {
    expect(firstNameOnly("Gun Heibø")).toBe("Gun");
  });

  it("gibt null zurück, wenn nichts da ist — kein Ersatztext", () => {
    expect(firstNameOnly(null)).toBeNull();
    expect(firstNameOnly("   ")).toBeNull();
  });
});
