// Typen und Konstanten der Portal-Anfragen (0398).
//
// Diese Datei trägt BEWUSST kein `"use server"`: ein Server-Action-Modul darf
// ausschließlich async functions exportieren, sonst bricht der Produktionsbuild
// beim Sammeln der Seitendaten ("Server Actions must be async functions").
// `tsc --noEmit` und ESLint sehen diesen Verstoß NICHT — nur `next build`.
// Werte (`ABLEHNUNGSGRUENDE`), Typen und die reine Präfix-Prüfung gehören
// deshalb hierher, die Actions bleiben in `inbox.ts`. Gleiches Muster wie
// `portal-benachrichtigungen-typen.ts`.
//
// Der Contract ist `apps/api/src/features/inbox/anfragen.py`: der Präfix hier
// muss dessen `PREFIX` entsprechen, die Gründe dessen Allowlist.

/**
 * Eine offene Airbnb-Anfrage — Voranfrage, Buchungsanfrage oder
 * Änderungswunsch. Sie ist KEINE Buchung: der Gast wartet auf eine
 * Entscheidung, und Airbnb lehnt nach Ablauf der Frist selbst ab.
 */
export type AnfrageDetail = {
  thread_id: string;
  event_id: string;
  /** inquiry | reservation_request | alteration_request */
  art: string;
  /**
   * Die für GENAU DIESE Anfrageart erlaubten Aktionen. Die Oberfläche zeigt
   * nur sie — eine Voranfrage kennt kein "annehmen", ein Änderungswunsch
   * keinen Sonderpreis (die Formen sind bei Airbnb verschieden).
   */
  aktionen: string[];
  beantwortbar: boolean;
  /**
   * Warum nicht beantwortbar. Entweder der Status DES PORTALS ("accepted",
   * "declined", "expired", "withdrawn", "cancelled") oder — wenn das Portal
   * schweigt — unsere eigene Aussage ("beantwortet", "keine_channex_id").
   * Kürzel, kein Satz: die Worte macht die UI (24 Sprachen).
   */
  grund_gesperrt: string | null;
  /**
   * "portal" = Airbnb sagt es (System-Nachricht im Thread); "abgeleitet" =
   * wir schließen es aus dem Verlauf. Nie eine Ableitung als Auskunft des
   * Portals darstellen.
   */
  status_quelle: string;
  /**
   * Airbnbs `non_response_at`: wann die Anfrage von selbst abläuft. null =
   * das Portal nennt keine Frist — dann KEIN Countdown zeigen, statt 24
   * Stunden zu raten (die Frist ist Airbnbs Angabe, nicht unsere Rechnung).
   */
  frist: string | null;
  objekt: string | null;
  gastname: string | null;
  anreise: string | null;
  abreise: string | null;
  naechte: string | null;
  gaeste: string | null;
  erwachsene: string | null;
  kinder: string | null;
  kleinkinder: string | null;
  tiere: string | null;
  /**
   * Airbnbs `payout_amount` — der NETTO-Auszahlbetrag, NICHT der Gastpreis.
   * Nie als Umsatz beschriften.
   */
  payout_betrag: string | null;
  waehrung: string | null;
};

export type AnfrageAktion =
  | "annehmen"
  | "ablehnen"
  | "vorab_genehmigen"
  | "sonderpreis"
  | "alteration_annehmen"
  | "alteration_ablehnen"
  | "alteration_zuruecknehmen";

/** Die vier von Airbnb erlaubten Ablehnungsgründe — ein eigener wäre ein 422. */
export const ABLEHNUNGSGRUENDE = [
  "dates_not_available",
  "not_a_good_fit",
  "waiting_for_better_reservation",
  "not_comfortable",
] as const;

/** Thread-IDs von Anfragen tragen diesen Präfix (Server: `anfragen.PREFIX`). */
export function istAnfrageThread(threadId: string): boolean {
  return threadId.startsWith("anfrage:");
}
