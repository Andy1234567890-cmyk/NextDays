// Protokoll des Portal-Verbindens — jeder Zustandswechsel wird festgehalten.
//
// WARUM ES DAS GIBT (29.08.2026): Im Onboarding stand
//
//     „Keine Bestätigung von Airbnb erhalten. Das passiert vor allem, wenn in
//      deinem Airbnb-Konto bereits eine andere Software verbunden ist …"
//
// obwohl niemand je auf „Jetzt verbinden" geklickt hatte. Die Suche nach der
// Ursache dauerte drei Anläufe, weil im Browser NICHTS ablesbar war:
//
//   1. Verdacht Zeitablauf (3-Minuten-Poll)  → falsch, aber plausibel
//   2. Verdacht fehlender Klick              → richtig, aber nicht die Ursache
//   3. Wahrheit: der Statusabruf antwortete 404 („noch keine Verbindung"),
//      und JEDER Fehler setzte `oauthAufgegeben` — also sofort die
//      Ablehnungsmeldung, ohne eine Sekunde zu warten.
//
// Zwei Zustände sehen von außen gleich aus — „noch nichts passiert" und „das
// Portal hat abgelehnt" — und beide zeigen KEINEN Kanal. Wer das nicht ablesen
// kann, rät. Dieses Protokoll macht die Unterscheidung sichtbar: WANN wurde der
// Link geholt, WANN geöffnet, WAS antwortete jeder Statusabruf, und WARUM
// wurde aufgegeben.
//
// Das Gegenstück im Backend ist `channex_channel_connection.oauth_versuch_at`
// (Migration 0487) — es deckt die Zeit ab, in der es bereits eine Zeile gibt.
// Dieses Protokoll deckt die Zeit davor ab, in der es noch keine gibt.

/** Was im Verbinde-Vorgang passiert ist. `art` ist der Ankerpunkt beim Lesen. */
export type OAuthEreignis = {
  /** Wann — Uhrzeit des BROWSERS, bewusst nicht die des Servers. */
  zeit: string;
  /** Was ist passiert. */
  art:
    | "link_geholt"
    | "link_fehlgeschlagen"
    | "link_geoeffnet"
    | "link_kopiert"
    | "status_abgefragt"
    | "status_404"
    | "status_fehler"
    | "verbunden"
    | "aufgegeben_zeit"
    | "aufgegeben_fehler"
    | "ruecksprung"
    | "inserate_geholt"
    | "inserate_fehlgeschlagen";
  /** Portal-Code (AirBNB, BookingCom …). */
  portal?: string;
  /** Freitext: der GRUND, nicht nur die Tatsache. */
  detail?: string;
  /** HTTP-Status, wo einer anfiel. */
  status?: number;
};

const SCHLUESSEL = "nd_oauth_protokoll";
/** Mehr braucht niemand: ein Vorgang erzeugt gut ein Dutzend Zeilen. */
const MAX = 100;

/** Ist das Protokoll aktiv? In Produktion aus (es nennt Portal-Interna). */
export function protokollAktiv(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_OAUTH_DEBUG === "1"
  );
}

/** Ein Ereignis festhalten — im localStorage UND in der Konsole.
 *
 *  Beides, weil beide Leser verschieden sind: die Konsole zeigt den Verlauf
 *  live beim Zusehen, der Speicher überlebt den Sprung zu Airbnb und zurück
 *  (genau die Stelle, an der die Konsole geleert wird). */
export function oauthProtokoll(
  art: OAuthEreignis["art"],
  daten: Omit<OAuthEreignis, "zeit" | "art"> = {},
): void {
  if (!protokollAktiv()) return;
  const ereignis: OAuthEreignis = {
    zeit: new Date().toISOString(),
    art,
    ...daten,
  };
  // eslint-disable-next-line no-console -- genau dafür ist dieses Modul da
  console.info(
    `[oauth] ${art}`,
    daten.portal ?? "",
    daten.status ?? "",
    daten.detail ?? "",
  );
  try {
    const alt = oauthProtokollLesen();
    localStorage.setItem(
      SCHLUESSEL,
      JSON.stringify([...alt, ereignis].slice(-MAX)),
    );
  } catch {
    // Privater Modus, gesperrte Site-Daten: das Protokoll ist eine Hilfe,
    // kein Pflichtweg — es darf den Verbinde-Vorgang nie kippen.
  }
}

/** Der bisherige Verlauf, älteste zuerst. Leer, wenn nichts (mehr) da ist. */
export function oauthProtokollLesen(): OAuthEreignis[] {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    if (!roh) return [];
    const gelesen: unknown = JSON.parse(roh);
    return Array.isArray(gelesen) ? (gelesen as OAuthEreignis[]) : [];
  } catch {
    return [];
  }
}

/** Verlauf verwerfen (Knopf im Panel). */
export function oauthProtokollLeeren(): void {
  try {
    localStorage.removeItem(SCHLUESSEL);
  } catch {
    // siehe oben
  }
}
