// Startseiten-Kennzahlen der Agentur-Übersicht — gegen den FastAPI-Endpoint
// GET /api/v1/reservations/dashboard (dieselbe Quelle wie die Web-App:
// apps/web/lib/reservations.ts → getDashboard). Business-Logik/Aggregation
// bleibt im Backend. Typen exakt am Pydantic-Contract
// (apps/api/src/features/reservations/schemas.py → DashboardResponse) — nullable
// bleibt nullable (revenue_30d = null ohne Betrags-Sichtbarkeit, §4.2).
//
// Der Typ hier war bis August 2026 ein ALTER Ausschnitt des Contracts: die
// Antwort trug längst `im_haus`, `freigabe_noetig`, die ungedeckelten
// `*_gesamt`-Zahlen, `revenue_per_booking_30d` und den Objektbestand — die App
// kannte sie nicht und zeigte sie deshalb nicht an. Ein fehlendes Feld im Typ
// ist hier kein Kompilierfehler, sondern eine stille Lücke in der Oberfläche;
// deshalb steht der Contract jetzt vollständig da, auch wo ein Feld erst
// später ein Bildschirm-Element bekommt.
import { call, type Result } from "@/lib/api";

export type ReservationChannel =
  | "direct"
  // Eigene Website des Betriebs (0380) — provisionsfrei wie „direct", aber
  // getrennt auswertbar.
  | "website"
  | "portal"
  | "booking"
  | "airbnb"
  | "vrbo"
  | "ota_other";
export type ReservationStatus = "pending" | "confirmed" | "cancelled" | "completed";

// Eine gebuchte Zusatzleistung als Abzeichen an der Zeile. Ohne Betrag: die
// Übersicht sagt, WAS vorzubereiten ist, nicht was es kostet (der Preis müsste
// zusätzlich gegen die Betrags-Sicht gegatet werden, §4.2).
export type DashboardAddon = {
  // Mehrsprachig wie im Katalog (Locale → Text); die Sprachwahl trifft die
  // Oberfläche, nicht der Server.
  name: Record<string, string>;
  qty: number;
  paid: boolean;
};

// Eine Zeile in den Anreise-/Abreise-/Anstehend-Listen.
export type DashboardEntry = {
  reservation_id: string;
  guest_name: string;
  property_title: string;
  channel: ReservationChannel;
  ota_name: string | null;
  check_in: string;
  check_out: string;
  status: ReservationStatus;
  // Eigentümer-Aufenthalt (Migration 0241) — in den Listen sichtbar, aber
  // kein Umsatz.
  is_owner_stay: boolean;
  // Gebuchte Zusatzleistungen. Leere Liste heißt „keine gebucht", nicht
  // „nicht geladen".
  addons: DashboardAddon[];
  // Buchungszeitpunkt aus der QUELLE (Wurzel 5b), nie unser Feed-Eingang.
  // Trägt die Liste „Neu eingegangen"; in den nach Aufenthalt sortierten
  // Listen bleibt das Feld ungenutzt.
  booked_at: string | null;
  // Thread im Posteingang; null = keine Korrespondenz → kein Nachrichten-Weg.
  message_thread_id: string | null;
};

// Eine KPI-Kachel mit Vergleich zur Vorperiode. change_pct null = keine
// Vorperiode (kein erfundener 0-%-Wert).
export type DashboardKpi = {
  value: number;
  change_pct: number | null;
};

export type Dashboard = {
  today: string;
  checkouts_today: DashboardEntry[];
  checkins_today: DashboardEntry[];
  upcoming: DashboardEntry[];
  // Was zuletzt hereinkam, sortiert nach BUCHUNGS-Zeitpunkt (nicht nach
  // Aufenthalt).
  neu_eingegangen: DashboardEntry[];
  // Wer heute im Haus ist; der Abreisetag zählt nicht mit (der steht bei den
  // Abreisen und wäre sonst doppelt).
  im_haus: DashboardEntry[];
  // Angefragt, noch nicht entschieden, Aufenthalt noch nicht vorbei.
  freigabe_noetig: DashboardEntry[];
  // Die ECHTEN Anzahlen: die Listen darüber schneiden bei 50 ab, `length` wäre
  // dort das Limit und nicht der Bestand (Wurzel 4).
  upcoming_gesamt: number;
  im_haus_gesamt: number;
  neu_gesamt: number;
  freigabe_gesamt: number;
  checkins_30d: DashboardKpi;
  // null, wenn der Nutzer keine Beträge sehen darf (§4.2) — Umsatz-Kachel wird
  // dann nicht gerendert (kein erfundener 0-Betrag).
  revenue_30d: DashboardKpi | null;
  // Umsatz je zahlender Buchung; dieselbe Sichtbarkeitsregel wie revenue_30d.
  // NICHT aus revenue/checkins rechnen — der Nenner ist ein anderer
  // (Eigentümer-Aufenthalte zählen als Check-in, aber nicht als Umsatz).
  revenue_per_booking_30d: DashboardKpi | null;
  confirmed_30d: DashboardKpi;
  currency: string;
  objekte_gesamt: number;
  objekte_inaktiv: number;
  objekte_entwurf: number;
};

/** Übersicht: heutige An-/Abreisen + KPIs (Belegung/Umsatz). */
export async function getDashboard(): Promise<Result<Dashboard>> {
  return call("/reservations/dashboard");
}

/** Welche KPI-Kachel nachgeladen wird (Backend-Enum DashboardKpiMetrik). */
export type DashboardKpiMetrik =
  | "checkins"
  | "revenue"
  | "revenue_per_booking"
  | "confirmed";

/** Die wählbaren Auswertungszeiträume (Backend: core.zeitraum.ZEITRAEUME). */
export type Zeitraum = "7d" | "30d" | "3m" | "12m";

export type DashboardKpiAntwort = {
  metrik: DashboardKpiMetrik;
  zeitraum: string;
  tage: number;
  // null = diesen Wert gibt es für diesen Nutzer/diese Daten nicht (Beträge
  // maskiert, gemischte Währungen, keine zahlende Buchung im Fenster).
  kpi: DashboardKpi | null;
  currency: string;
};

/** Welche Listen-Karte nachgeladen wird (Backend-Enum DashboardListe). */
export type DashboardListe =
  | "checkouts"
  | "checkins"
  | "freigabe"
  | "upcoming"
  | "im_haus";

/** Zeitfenster einer Listen-Karte, gerechnet ab heute (Backend-Enum). */
export type DashboardFenster = "heute" | "7d" | "30d" | "alle";

export type DashboardListeAntwort = {
  liste: DashboardListe;
  fenster: DashboardFenster;
  // Die ungedeckelte Anzahl — der Block zeigt sie; `items` schneidet bei 50 ab.
  gesamt: number;
  items: DashboardEntry[];
};

/**
 * EINE Listen-Karte für ein gewähltes Zeitfenster nachladen.
 *
 * Eigener Aufruf statt eines Neuladens der ganzen Übersicht: ein Umschalten
 * soll nicht Kennzahlen, Nachrichten und Objektzahlen mitziehen.
 */
export async function getDashboardListe(
  liste: DashboardListe,
  fenster: DashboardFenster,
): Promise<Result<DashboardListeAntwort>> {
  return call(`/reservations/dashboard/liste?liste=${liste}&fenster=${fenster}`);
}

/** EINE Kennzahl für einen gewählten Zeitraum nachladen. */
export async function getDashboardKpi(
  metrik: DashboardKpiMetrik,
  zeitraum: Zeitraum,
): Promise<Result<DashboardKpiAntwort>> {
  return call(`/reservations/dashboard/kpi?metrik=${metrik}&zeitraum=${zeitraum}`);
}
