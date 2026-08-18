// Wettbewerbspreise für die Vergleichstabelle der Preisseite.
//
// EINZIGE QUELLE dieser Zahlen. Sie standen zuvor als unbenutzter Block im
// Tarifrechner des Dashboards (`web/components/konto/tarif-rechner.tsx`); da
// sie hier GERENDERT werden, liegen sie hier — zwei Datensätze recherchierter
// Fremdpreise wären der klassische Drift-Fall (einer wird gepflegt, der andere
// bleibt stehen und behauptet öffentlich Falsches).
//
// REGELN FÜR JEDEN EINTRAG (eine öffentliche Seite behauptet hier etwas über
// einen Mitbewerber — vergleichende Werbung ist nur mit nachprüfbaren Angaben
// zulässig):
//  • Jede Zahl trägt ihre Quelle (die offizielle Preisseite) und ist am
//    genannten Stand dort SELBST abgelesen — nicht aus einem Testbericht.
//  • Verglichen wird der Tarif, der UNSEREN Funktionsumfang abdeckt: bei
//    Lodgify ist das Ultimate (Aufgaben und Eigentümer-Abrechnungen stecken
//    erst dort), nicht der Einstiegstarif ohne diese Funktionen.
//  • Genannt wird der MONATSPREIS ohne Jahresbindung, weil unser Tarif monatlich
//    kündbar ist. Wo ein Anbieter mit dem rabattierten Jahrespreis wirbt, steht
//    dieser im Hinweis — nicht in der Preisspalte (sonst vergleicht man
//    Jahresbindung gegen monatlich).
//  • Wer keine Preise veröffentlicht, bekommt `preis20: null` und den Grund.
//    KEIN geschätzter Betrag (Wurzel 4).
//
// Stand aller Angaben: 18.08.2026, live abgelesen.

/** Objektzahl, für die verglichen wird. Ein Vergleich braucht einen Fixpunkt. */
export const VERGLEICH_OBJEKTE = 20;

/**
 * Tag der Ablesung (ISO). Steht HIER und nicht in den 24 Sprachdateien: sonst
 * müsste bei jeder Nachrecherche das Datum 24-mal geändert werden — und eine
 * vergessene Datei behauptete einen falschen Stand.
 */
export const WETTBEWERB_STAND = "2026-08-18";

export type Wettbewerber = {
  name: string;
  /** Tarifname des Anbieters, der unseren Umfang abdeckt. */
  tarif: string;
  /** EUR je Monat bei VERGLEICH_OBJEKTE Objekten; null = nicht veröffentlicht. */
  preis20: number | null;
  /** Wie der Betrag zustande kommt — der Nachvollzug gehört sichtbar dazu. */
  rechnung: string;
  /** Offizielle Preisseite (ohne Protokoll, wird als Text gezeigt). */
  quelle: string;
};

export const WETTBEWERB: readonly Wettbewerber[] = [
  {
    name: "Smoobu",
    tarif: "Professional",
    preis20: 210.4,
    rechnung: "28 € + 19 × 9,60 €",
    quelle: "smoobu.com/de/preise",
  },
  {
    name: "Lodgify",
    tarif: "Ultimate",
    preis20: 352,
    rechnung: "281 € mit Jahresbindung",
    quelle: "lodgify.com/de/preise",
  },
  {
    name: "Sirvoy",
    tarif: "Pro",
    preis20: 109,
    rechnung: "Zimmerpreis-Rechner: 1 Zimmer 44 €, 20 Zimmer 109 €",
    quelle: "sirvoy.com/pricing",
  },
  {
    name: "Apaleo",
    tarif: "PMS",
    preis20: 400,
    rechnung: "8 € je Zimmer, Mindestpreis 400 €",
    quelle: "apaleo.com/pricing",
  },
  {
    name: "Hostaway",
    tarif: "—",
    preis20: null,
    rechnung: "Preisseite ist ein Anfrageformular",
    quelle: "hostaway.com/pricing",
  },
  {
    name: "Cloudbeds",
    tarif: "—",
    preis20: null,
    rechnung: "„Request a quote“ je Tarif",
    quelle: "cloudbeds.com/pricing",
  },
];
