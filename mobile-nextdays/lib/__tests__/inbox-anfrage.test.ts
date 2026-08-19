// Tests der Anfrage-Hilfen (lib/inbox.ts) — die drei Regeln, an denen eine
// Anfrage-Oberfläche real Schaden anrichtet:
//
//  1. Der Präfix entscheidet, WELCHE Endpunkte ein Thread hat. Wird er falsch
//     erkannt, ruft die App `/anfrage` auf einer gewöhnlichen Buchung (404 bei
//     jedem Öffnen) oder `/reservation` auf einer Anfrage, die keine hat.
//  2. Die Ablehnungsgründe sind eine Allowlist des Portals — ein eigener Wert
//     ergibt 422, und der Gast wartet weiter.
//  3. Der Sonderpreis geht in MINOR UNITS raus. Ein Faktor-100-Fehler ist hier
//     kein Anzeigefehler, sondern ein falscher Preis beim Gast.
export {};

type Modul = typeof import("../inbox");

const {
  istAnfrageThread,
  istBuchungsThread,
  ABLEHNUNGSGRUENDE,
  nachAktivitaet,
  zeitWert,
}: Modul = require("../inbox");

type InboxThread = import("../inbox").InboxThread;

describe("istAnfrageThread", () => {
  it("erkennt Anfrage-Threads am Präfix des Servers", () => {
    expect(istAnfrageThread("anfrage:abc-123")).toBe(true);
  });

  it("hält eine gewöhnliche Buchung auseinander", () => {
    expect(istAnfrageThread("3f0c9d1e-1111-4111-8111-111111111111")).toBe(false);
    // Kein Teiltreffer irgendwo in der Mitte — nur der Präfix zählt.
    expect(istAnfrageThread("x-anfrage:abc")).toBe(false);
    expect(istAnfrageThread("")).toBe(false);
  });
});

describe("istBuchungsThread", () => {
  // Der Fehler, der diesen Test veranlasst hat: Für Marktplatz-, Übernahme- und
  // WhatsApp-Threads wurden `scheduled`/`attachments`/`reservation` gerufen. Die
  // hängen an einer `channex_booking`-Zeile, die es dort nicht gibt — das Sheet
  // blieb leer und sah aus wie „nichts vorhanden".
  it("erkennt eine echte OTA-Buchung (reine UUID)", () => {
    expect(istBuchungsThread("3f0c9d1e-1111-4111-8111-111111111111")).toBe(true);
  });

  it.each([
    ["anfrage:abc", "Portal-Anfrage"],
    ["mb:abc", "myBestDays-Marktplatz"],
    ["ue:abc", "übernommener Verlauf"],
    ["wa:abc", "WhatsApp"],
    ["wa:new:4712", "neuer WhatsApp-Chat"],
  ])("schliesst %s aus (%s)", (id) => {
    expect(istBuchungsThread(id)).toBe(false);
  });
});

describe("ABLEHNUNGSGRUENDE", () => {
  it("enthält genau die vier vom Portal erlaubten Gründe", () => {
    expect([...ABLEHNUNGSGRUENDE]).toEqual([
      "dates_not_available",
      "not_a_good_fit",
      "waiting_for_better_reservation",
      "not_comfortable",
    ]);
  });
});

describe("Sonderpreis in Minor Units", () => {
  // Dieselbe Umrechnung wie in components/inbox/AnfrageKarte.tsx. Hier als
  // reine Rechnung geprüft: ein Faktor-100-Fehler wäre am Gerät nicht zu sehen,
  // aber der Gast bekäme einen Preis, der um zwei Stellen daneben liegt.
  const minor = (eingabe: string) => Math.round(Number(eingabe.replace(",", ".")) * 100);

  it("rechnet Haupt- in Minor Units", () => {
    expect(minor("100")).toBe(10000);
    expect(minor("99.90")).toBe(9990);
  });

  it("nimmt das Komma als Dezimaltrennzeichen (deutsche Eingabe)", () => {
    expect(minor("1234,56")).toBe(123456);
  });

  it("rundet auf eine GANZE Zahl — der Server nimmt keine Bruchteile", () => {
    expect(minor("10,005")).toBe(1001);
    expect(Number.isInteger(minor("33,333"))).toBe(true);
  });
});

// --- Sortierung der Vorgangsliste (19.08.2026) ------------------------------
// Die Liste sortierte nach `updated_at` — UNSERER Schreibzeit. Holt der Feed
// mehrere Vorgänge in einem Rutsch, tragen alle dieselbe Sekunde und die
// Reihenfolge ist zufällig. Ein Airbnb-Änderungswunsch stand deshalb ganz
// unten, wurde nicht gefunden und lief an der App vorbei.
describe("nachAktivitaet", () => {
  const thread = (werte: Partial<InboxThread>): InboxThread =>
    ({ letzte_aktivitaet: null, updated_at: null, ...werte }) as InboxThread;

  it("stellt den jüngsten Portal-Zeitpunkt nach vorn", () => {
    const alt = thread({ letzte_aktivitaet: "2025-07-06T10:00:00+00:00" });
    const neu = thread({ letzte_aktivitaet: "2026-08-18T19:51:50.218Z" });
    expect([alt, neu].sort(nachAktivitaet)).toEqual([neu, alt]);
  });

  it("sortiert nicht nach unserer Schreibzeit", () => {
    // Beide vom Feed in derselben Sekunde geschrieben; der ÄLTERE Vorgang trägt
    // das spätere `updated_at`. Nach `updated_at` stünde er vorn.
    const frisch = thread({
      letzte_aktivitaet: "2026-08-18T19:51:50.218Z",
      updated_at: "2026-08-19T09:00:00+00:00",
    });
    const alt = thread({
      letzte_aktivitaet: "2025-07-06T10:00:00+00:00",
      updated_at: "2026-08-19T09:00:01+00:00",
    });
    expect([alt, frisch].sort(nachAktivitaet)).toEqual([frisch, alt]);
  });

  it("schiebt Vorgänge ohne Zeitpunkt ans Ende", () => {
    const ohne = thread({ letzte_aktivitaet: null });
    const mit = thread({ letzte_aktivitaet: "2025-07-06T10:00:00+00:00" });
    expect([ohne, mit].sort(nachAktivitaet)).toEqual([mit, ohne]);
  });

  it("vergleicht Zeitpunkte, nicht Zeichenketten", () => {
    // Identischer Prefix, Divergenz erst am Trennzeichen: „+" (0x2B) gegen
    // „Z" (0x5A). Der Zeichenvergleich hält den Portal-Wert für den späteren,
    // obwohl beide dieselbe Millisekunde meinen.
    const ausPostgrest = "2026-08-18T19:51:50.218+00:00";
    const ausPortal = "2026-08-18T19:51:50.218Z";
    expect(ausPostgrest < ausPortal).toBe(true);
    expect(zeitWert(ausPostgrest)).toBe(zeitWert(ausPortal));

    // Und der Fall, der die Reihenfolge kippt: der PostgREST-Wert ist eine
    // Sekunde später, verliert aber jeden String-Vergleich.
    const spaeter = thread({ letzte_aktivitaet: "2026-08-18T19:51:51+00:00" });
    const frueher = thread({ letzte_aktivitaet: "2026-08-18T19:51:50.999Z" });
    expect([frueher, spaeter].sort(nachAktivitaet)).toEqual([spaeter, frueher]);
  });
});
