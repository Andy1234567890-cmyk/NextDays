// Die Cookie-Liste je Zweck — Name, Host, Dauer, Art, Beschreibung.
//
// WARUM ALS DATEN UND NICHT ALS PROSA: Eine informierte Einwilligung setzt
// voraus, dass der Besucher weiß, wer die Daten bekommt, wozu, wie lange und ob
// sie die EU verlassen (Art. 4 Nr. 11 i. V. m. Art. 13 DSGVO). Stünde das im
// Fließtext, wäre es in 24 Sprachen 24-mal unterschiedlich vollständig — und
// die fehlende Angabe fällt niemandem auf, weil ein Absatz nie „leer" aussieht.
//
// Als Struktur ist jede fehlende Angabe eine Lücke, die auffällt: das Feld ist
// da oder nicht. Die Beschriftungen kommen aus der Sprachdatei
// (`einwilligung.angaben.*`, `einwilligung.dauer.*`, `einwilligung.zweck.*`),
// die WERTE stehen hier — Cookie-Name, Host und Anbieter sind keine Übersetzung,
// sondern Tatsachen.
//
// Die Liste ist pro COOKIE aufgebaut, nicht pro Dienst: die zweite Ebene des
// Dialogs zeigt sie als Tabelle, so wie Booking.com, Cookiebot und
// Usercentrics es tun. Ein Zweck kann mehrere Cookies haben (die
// Reichweitenmessung hat zwei), und dann muss jedes einzeln auffindbar sein.
//
// Neues Cookie im Browser → hier eintragen UND in die Cookie-Richtlinie
// (`content/legal/cookies/*.ts`). Fehlt der Eintrag hier, zeigt die Liste den
// Zweck ohne Cookies; das ist der sichtbare Mangel, der zum Nachtragen zwingt,
// statt still eine unvollständige Einwilligung einzuholen.
import type { OptionaleKategorie } from "@/lib/einwilligung";

export type CookieAngabe = {
  /** Name, wie er im Browser steht. */
  name: string;
  /** Domain, auf der das Cookie liegt. */
  host: string;
  /**
   * Laufzeit als Übersetzungs-SCHLÜSSEL unter `einwilligung.dauer.*` —
   * „bis zu zwei Jahre" ist ein Satz, keine Zahl, und muss übersetzt werden.
   */
  dauerSchluessel: string;
  /** Erst- oder Drittanbieter — entscheidet, wessen Domain das Cookie trägt. */
  art: "erst" | "dritt";
  /** Zweck als Übersetzungs-SCHLÜSSEL unter `einwilligung.zweck.*`. */
  zweckSchluessel: string;
};

export type DienstAngaben = {
  /** Verantwortlicher Anbieter, wie er im Vertrag steht. */
  anbieter: string;
  /**
   * Verlassen die Daten die EU? `true` verlangt zwingend die Nennung der
   * Grundlage in der Datenschutzerklärung (Art. 44 ff. DSGVO).
   */
  drittland: boolean;
  /** Die Cookies dieses Zwecks. Leer wäre ein Zweck ohne Speicherzugriff. */
  cookies: readonly CookieAngabe[];
};

export const DIENST_ANGABEN: Record<OptionaleKategorie, DienstAngaben> = {
  funktional: {
    anbieter: "Google Ireland Limited",
    drittland: true,
    cookies: [
      {
        // Hier stand zuerst „keine Cookies" mit der Begründung, der Dienst
        // arbeite tokenbasiert je Absenden. Das ist die halbe Wahrheit und im
        // Einwilligungsdialog damit eine Falschaussage: reCAPTCHA setzt für
        // seine Risikoanalyse ein eigenes Cookie, sobald das Skript ausgeführt
        // wird (Google nennt es selbst „a necessary cookie … for the purpose of
        // providing its risk analysis"). Eine Angabe, die ein gesetztes Cookie
        // verschweigt, macht die Einwilligung angreifbar — und niemandem fällt
        // sie auf, weil das Feld gefüllt aussieht.
        name: "_GRECAPTCHA",
        // Drittanbieter: das Cookie liegt auf Googles Domain, nicht auf
        // unserer. Nachgeprüft — es wird auf `.google.com` gesetzt und aus dem
        // Drittanbieter-Kontext gelesen.
        host: "www.google.com",
        // Google veröffentlicht die Laufzeit nicht verbindlich, und die
        // Cookie-Datenbanken widersprechen sich (sechs Monate / 179 Tage / ein
        // Jahr). Deshalb „von Google festgelegt, bis zu sechs Monate" statt
        // einer erfundenen exakten Zahl: eine Präzision zu behaupten, die
        // niemand belegen kann, wäre schlechter als die benannte Unschärfe
        // (Wurzel 4).
        dauerSchluessel: "bisSechsMonateGoogle",
        art: "dritt",
        zweckSchluessel: "grecaptcha",
      },
    ],
  },
  analytisch: {
    anbieter: "Google Ireland Limited",
    drittland: true,
    cookies: [
      {
        name: "_ga",
        // Erstanbieter: gesetzt wird es von Googles Skript, aber auf UNSERER
        // Domain — deshalb überlebt es auch das Ende der Drittanbieter-Cookies.
        host: "mynextdays.com",
        dauerSchluessel: "zweiJahre",
        art: "erst",
        zweckSchluessel: "ga",
      },
      {
        name: "_ga_<ID>",
        host: "mynextdays.com",
        dauerSchluessel: "zweiJahre",
        art: "erst",
        zweckSchluessel: "gaSitzung",
      },
    ],
  },
  marketing: {
    // Mehrere Anbieter in einem Zweck — deshalb steht der Anbieter hier
    // gesammelt. Je Cookie sagt der Host, wohin es wirklich geht.
    anbieter: "Meta Platforms Ireland, LinkedIn Ireland, Google Ireland Limited",
    drittland: true,
    cookies: [
      {
        name: "_fbp",
        host: "mynextdays.com",
        dauerSchluessel: "dreiMonate",
        art: "erst",
        zweckSchluessel: "fbp",
      },
      {
        name: "_gcl_au",
        host: "mynextdays.com",
        dauerSchluessel: "dreiMonate",
        art: "erst",
        zweckSchluessel: "gclAu",
      },
      {
        name: "li_gc",
        host: "linkedin.com",
        dauerSchluessel: "sechsMonate",
        art: "dritt",
        zweckSchluessel: "liGc",
      },
      {
        name: "bcookie",
        host: "linkedin.com",
        dauerSchluessel: "einJahr",
        art: "dritt",
        zweckSchluessel: "bcookie",
      },
    ],
  },
};
