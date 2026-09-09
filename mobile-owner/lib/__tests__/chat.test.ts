// Chat-Logik ohne native Krypto (0611, ADR-0029).
//
// WAS HIER NICHT GEPRÜFT WIRD und warum: Die eigentliche Ver- und
// Entschlüsselung läuft in `react-native-quick-crypto`, einem NATIVEN Modul.
// In Jest existiert es nicht, und ein Mock würde nur beweisen, dass der Mock
// funktioniert — genau die Art Test, die grün ist, während die Sache kaputt
// ist. Die Krypto-Kette wird deshalb auf dem GERÄT geprüft, nicht hier.
//
// Was hier sehr wohl geprüft wird, ist die Logik DRUMHERUM, in der die realen
// Fehler stecken: Wann gilt eine Nachricht als unlesbar? Wird der Absender
// richtig zugeordnet? Trifft die Tagesbeschriftung den lokalen Tag?
import { gegenueberVon, istLesbar, seiteIstEigene, tagesLabel } from "@/lib/chat-anzeige";

describe("Lesbarkeit einer Nachricht", () => {
  // Beides muss da sein: der für UNS verpackte Schlüssel und der öffentliche
  // Schlüssel des ABSENDERS. Fehlt eines, ist die Nachricht auf diesem Gerät
  // nicht zu öffnen — und das muss die Oberfläche sagen, statt eine leere
  // Blase zu zeigen (Wurzel 5).
  it("braucht beide Schlüssel", () => {
    const w = null; // kein Freigabe-Schlüssel — der Normalfall
    expect(istLesbar({ wrapped_key: "k", sender_key: "s", wrapper_key: w })).toBe(true);
    expect(istLesbar({ wrapped_key: null, sender_key: "s", wrapper_key: w })).toBe(false);
    expect(istLesbar({ wrapped_key: "k", sender_key: null, wrapper_key: w })).toBe(false);
    expect(istLesbar({ wrapped_key: null, sender_key: null, wrapper_key: w })).toBe(false);
  });

  it("behandelt leere Zeichenketten wie fehlende Schlüssel", () => {
    // Ein leerer String ist kein Schlüssel. Ohne diese Prüfung liefe die
    // Entschlüsselung an und schlüge mit einem Krypto-Fehler fehl, statt die
    // Nachricht sauber als unlesbar zu kennzeichnen.
    expect(istLesbar({ wrapped_key: "", sender_key: "s", wrapper_key: null })).toBe(
      false,
    );
    expect(istLesbar({ wrapped_key: "k", sender_key: "", wrapper_key: null })).toBe(
      false,
    );
  });
});

describe("Gegenüber einer Nachricht", () => {
  // Nach einer Freigabe hat ein DRITTES Gerät verpackt — dann ist nicht mehr
  // der Absender das Gegenüber. Blind gegen `sender_key` zu entpacken ergäbe
  // ein anderes Geheimnis, und die Nachricht ginge nie auf (Migration 0614).
  it("nimmt wrapper_key, wenn gesetzt", () => {
    expect(gegenueberVon({ sender_key: "absender", wrapper_key: "freigeber" })).toBe(
      "freigeber",
    );
  });

  it("nimmt sonst den Absender", () => {
    expect(gegenueberVon({ sender_key: "absender", wrapper_key: null })).toBe(
      "absender",
    );
  });

  it("ist null, wenn beides fehlt", () => {
    expect(gegenueberVon({ sender_key: null, wrapper_key: null })).toBeNull();
  });
});

describe("Absenderseite", () => {
  it("ordnet owner der eigenen Seite zu", () => {
    expect(seiteIstEigene("owner")).toBe(true);
    expect(seiteIstEigene("agency")).toBe(false);
  });

  it("ist bei unbekannter Seite NICHT eigen", () => {
    // Fail-closed in der Darstellung: eine fremde Nachricht rechts (als
    // eigene) anzuzeigen wäre eine Falschaussage darüber, wer etwas gesagt
    // hat — in einem Streit über eine Abrechnung ist das keine Kleinigkeit.
    expect(seiteIstEigene("")).toBe(false);
    expect(seiteIstEigene("system")).toBe(false);
  });
});

describe("Tagesbeschriftung", () => {
  const heute = new Date(2026, 8, 9, 14, 30);

  it("erkennt heute und gestern", () => {
    expect(tagesLabel(new Date(2026, 8, 9, 8, 0), heute)).toBe("heute");
    expect(tagesLabel(new Date(2026, 8, 8, 23, 59), heute)).toBe("gestern");
    expect(tagesLabel(new Date(2026, 8, 7, 12, 0), heute)).toBe("datum");
  });

  it("rechnet über den Monatswechsel", () => {
    const ersterOktober = new Date(2026, 9, 1, 9, 0);
    expect(tagesLabel(new Date(2026, 8, 30, 22, 0), ersterOktober)).toBe(
      "gestern",
    );
  });

  it("nimmt den LOKALEN Tag, nicht UTC", () => {
    // Der reale Fehler, den das verhindert: `toISOString()` verschiebt in
    // Kopenhagen um 1-2 Stunden. Eine Nachricht von 00:30 wäre damit „gestern"
    // — dieselbe Wurzel wie im Aufgaben-Kalender (Browser- statt Objektzone).
    const kurzNachMitternacht = new Date(2026, 8, 9, 0, 30);
    expect(tagesLabel(kurzNachMitternacht, heute)).toBe("heute");
  });

  it("beschriftet auch den Jahreswechsel richtig", () => {
    const neujahr = new Date(2027, 0, 1, 10, 0);
    expect(tagesLabel(new Date(2026, 11, 31, 20, 0), neujahr)).toBe("gestern");
  });
});
