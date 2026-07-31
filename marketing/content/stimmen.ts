// Kundenstimmen der Landingpage.
//
// WICHTIG — bitte vor dem Befüllen lesen:
// Hier gehören AUSSCHLIESSLICH echte, freigegebene Zitate hinein. Erfundene
// Bewertungen mit Namen, Firma und Sternen sind auf einer öffentlichen Seite
// irreführende Werbung (UWG §5 / UGP-Richtlinie Anhang I Nr. 23b — gefälschte
// Bewertungen sind ausdrücklich verboten und abmahnfähig). Ein Design-Mock
// gehört in die Vorschau (`?vorschau=stimmen`), nicht in die Auslieferung.
//
// Solange `STIMMEN` leer ist, rendert die Sektion GAR NICHT — kein Skelett,
// keine Platzhalter-Namen, kein „Coming soon". Das ist Absicht: eine leere
// Vertrauens-Sektion ist ehrlicher als eine gefüllte, die niemandem gehört.
//
// Ablauf beim ersten echten Zitat:
//   1. schriftliche Freigabe der Person einholen (Name, Firma, Zitat, Foto)
//   2. Foto nach `public/marketing/stimmen/<slug>.jpg` legen (quadratisch)
//   3. Eintrag unten ergänzen — die Sektion erscheint dann automatisch

export type Stimme = {
  /** Eindeutiger Schlüssel (für React-keys und Dateinamen). */
  id: string;
  /** Angezeigter Name, so wie die Person freigegeben hat. */
  name: string;
  /** Betrieb/Rolle, z. B. „Ferienhaus Nordlicht, Sylt". */
  betrieb: string;
  /** Das Zitat selbst — wörtlich, nicht sinngemäß umgeschrieben. */
  zitat: string;
  /** Pfad unter /public. Fehlt es, zeigt die Karte die Initialen. */
  foto?: string;
  /**
   * Sternebewertung 1–5. NUR setzen, wenn die Person tatsächlich bewertet hat
   * — nie „5" als Deko ergänzen.
   */
  sterne?: 1 | 2 | 3 | 4 | 5;
};

/** Echte, freigegebene Stimmen. Leer = die Sektion bleibt unsichtbar. */
export const STIMMEN: Stimme[] = [];

/**
 * Gestaltungs-Vorschau: NUR zum Beurteilen des Layouts, nie im normalen
 * Seitenaufruf. Sichtbar ausschließlich über `/?vorschau=stimmen`, und die
 * Karten sind dort als Beispiel gekennzeichnet — damit ein Screenshot dieser
 * Vorschau nicht versehentlich als echte Referenz durchgeht.
 */
export const STIMMEN_VORSCHAU: Stimme[] = [
  {
    id: "beispiel-1",
    name: "Beispielname",
    betrieb: "Ferienwohnung, Ostsee",
    zitat:
      "Hier steht später das echte Zitat einer Gastgeberin — wörtlich und mit ihrer schriftlichen Freigabe.",
    sterne: 5,
  },
  {
    id: "beispiel-2",
    name: "Beispielname",
    betrieb: "Hotel garni, Schwarzwald",
    zitat:
      "Diese Karte zeigt nur das Layout: Foto, Name, Betrieb, Bewertung und ein Zitat von zwei bis vier Zeilen.",
    sterne: 5,
  },
  {
    id: "beispiel-3",
    name: "Beispielname",
    betrieb: "Agentur, Nordsee",
    zitat:
      "Sobald die ersten Betriebe seit dem Start am 1. September 2026 berichten, ersetzen ihre Worte diesen Text.",
    sterne: 4,
  },
];
