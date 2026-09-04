// Typen des Betriebs-Ausbaus (Paket F2) — gespiegelt aus dem
// Schnittstellenvertrag docs/PERSONAL-AUSBAU-VERTRAG.md §1.5, §2.2 und §3.
//
// Eigene Datei OHNE "use server", genau wie `personal-typen.ts`: ein
// Server-Action-Modul darf ausschliesslich async functions exportieren (ein
// `export const` legt die Seite beim Sammeln der Seitendaten mit 500 lahm).
// Typen, Konstanten und reine Helfer liegen deshalb hier daneben.
//
// `personal-typen.ts` gehoert niemandem und wird nicht angefasst (Vertrag §0);
// die Felder, die der Vertrag den bestehenden Formen HINZUFUEGT (`Regeln`,
// `Akte`, `Abwesenheit`), stehen darum hier als `*Plus` und werden per
// Schnittmenge verwendet. Sobald die Backend-Pakete die Basisdatei nachziehen,
// bleibt der Code unveraendert gueltig.
import type { Abwesenheit, AbwesenheitArt, Akte, Regeln, RegelnSet } from "@/lib/personal-typen";

// --- §1.1 Neue Regel-Felder --------------------------------------------------

/** Namen der KPI-Zeilen je Bereich (Regel `kennzahlen_zeilen`, Vertrag §1.1). */
export type KennzahlZeile =
  | "besetzung"
  | "stundenlimit"
  | "einsaetze"
  | "kosten"
  | "umsatz"
  | "produktivitaet"
  | "quote"
  | "budget";

export const KENNZAHL_ZEILEN: readonly KennzahlZeile[] = [
  "besetzung",
  "stundenlimit",
  "einsaetze",
  "kosten",
  "umsatz",
  "produktivitaet",
  "quote",
  "budget",
];

/**
 * Die Felder, die §1.1 dem bestehenden `RegelnSet` hinzufuegt.
 *
 * Alle optional: das Backend liefert sie mit DB-Defaults, ein alter Server
 * ohne 0544/0545 liefert sie gar nicht. Ein fehlendes Feld ist deshalb
 * „unbekannt" und wird beim Speichern weggelassen — nie durch einen
 * erfundenen Ersatzwert gefuellt (Wurzel 4).
 */
export type RegelnPlus = {
  jugendschutz_bis_alter?: number | null;
  jugendschutz_max_tagesstunden?: number | null;
  jugendschutz_nacht_von?: string | null;
  jugendschutz_nacht_bis?: string | null;
  zweistufige_genehmigung?: boolean;
  max_urlaub_zusammenhaengend_tage?: number | null;
  gps_pflicht?: boolean;
  gps_radius_m?: number;
  stempel_ab_schichtbeginn?: boolean;
  verspaetung_melden_min?: number | null;
  terminal_aktiv?: boolean;
  wetter_anzeigen?: boolean;
  ziel_umsatzproduktivitaet_minor?: number | null;
  ziel_personalkostenquote_pct?: number | null;
  kennzahlen_currency?: string | null;
  kennzahlen_zeilen?: string[];
};

/** `RegelnSet` inklusive der neuen Felder — der Rumpf von `PUT /regeln`. */
export type RegelnSetPlus = RegelnSet & RegelnPlus;

/** `Regeln` inklusive der neuen Felder — die Antwort von `GET /regeln`. */
export type RegelnVoll = Regeln & RegelnPlus;

// --- §1.5 Abwesenheit: zweistufige Genehmigung -------------------------------

/** Der zusaetzliche Status der zweistufigen Genehmigung (§1.5). */
export type AbwesenheitStatusPlus =
  | "beantragt"
  | "vorgenehmigt"
  | "genehmigt"
  | "abgelehnt"
  | "storniert";

export const ABWESENHEIT_STATUS_ALLE: readonly AbwesenheitStatusPlus[] = [
  "beantragt",
  "vorgenehmigt",
  "genehmigt",
  "abgelehnt",
  "storniert",
];

/** Die Felder, die §1.5 den Abwesenheits-Eintraegen hinzufuegt. */
export type AbwesenheitPlus = Omit<Abwesenheit, "status"> & {
  status: AbwesenheitStatusPlus;
  vorentschieden_von?: string | null;
  vorentschieden_am?: string | null;
};

/** Antwort von `POST /abwesenheiten/vorschau` — der Live-Zaehler des Antrags. */
export type AbwesenheitVorschau = {
  tage: number;
  rest_vorher: number | null;
  rest_nachher: number | null;
  sperre: { grund: string; von: string; bis: string } | null;
  schichten_betroffen: number;
  kollegen_abwesend: { user_id: string; full_name: string | null; art: AbwesenheitArt }[];
  fehler: string[];
};

export type VorschauRequest = {
  user_id?: string | null;
  art: AbwesenheitArt;
  von: string;
  bis: string;
  halbtag_start: boolean;
  halbtag_ende: boolean;
};

// --- §3.1 Akte: Verdienstgrenze, Terminal-Zugang, terminierte Aenderungen ----

export type VerdienstgrenzeZeitraum = "monat" | "jahr";

export const VERDIENSTGRENZE_ZEITRAEUME: readonly VerdienstgrenzeZeitraum[] = ["monat", "jahr"];

/** Die Felder, die §3.1 der bestehenden `Akte` hinzufuegt. */
export type AktePlus = Akte & {
  verdienstgrenze_minor?: number | null;
  verdienstgrenze_zeitraum?: VerdienstgrenzeZeitraum | null;
  stempel_id?: string | null;
  hat_terminal_pin?: boolean;
};

/** Terminierte Akte-Aenderung (§3.1). */
export type AkteAenderung = {
  id: string;
  gueltig_ab: string;
  felder: Record<string, unknown>;
  grund: string | null;
  angewendet_am: string | null;
  erstellt_von_name: string | null;
  created_at: string | null;
};

export type AkteAenderungInput = {
  gueltig_ab: string;
  felder: Record<string, unknown>;
  grund?: string | null;
};

/**
 * Akte-Felder, die eine terminierte Aenderung setzen darf.
 *
 * Nur Felder aus `AkteUpdate` (der Server wirft sonst 422 `feld_unbekannt`).
 * Die sensiblen Kennungen (Steuer-ID, SV-Nummer, IBAN) stehen bewusst NICHT
 * darin: sie werden verschluesselt gespeichert und gehoeren nicht in eine
 * Liste, die als Klartext-JSON monatelang wartet.
 */
export type AenderungFeldTyp = "text" | "zahl" | "geld" | "datum" | "beschaeftigungsart" | "firma";

export type AenderungFeld = { key: string; typ: AenderungFeldTyp };

export const AENDERUNG_FELDER: readonly AenderungFeld[] = [
  { key: "position", typ: "text" },
  { key: "beschaeftigungsart", typ: "beschaeftigungsart" },
  { key: "firma_id", typ: "firma" },
  { key: "eintritt", typ: "datum" },
  { key: "austritt", typ: "datum" },
  { key: "probezeit_bis", typ: "datum" },
  { key: "wochenstunden", typ: "zahl" },
  { key: "tagesstunden", typ: "zahl" },
  { key: "arbeitstage_je_woche", typ: "zahl" },
  { key: "stundenlohn_minor", typ: "geld" },
  { key: "gehalt_minor", typ: "geld" },
  { key: "urlaubsanspruch_tage", typ: "zahl" },
  { key: "arbeitgeber_aufschlag_pct", typ: "zahl" },
  { key: "verdienstgrenze_minor", typ: "geld" },
];

// --- §3.2 Terminals ----------------------------------------------------------

export type Terminal = {
  id: string;
  name: string;
  property_id: string | null;
  aktiv: boolean;
  letzter_kontakt_am: string | null;
  created_at: string | null;
};

/** Antwort von `POST /terminals` und `POST /terminals/{id}/token` — der Token
 *  ist NUR hier sichtbar und wird nie erneut ausgeliefert. */
export type TerminalMitToken = Terminal & { token: string };

// --- Terminal-Oberflaeche (ohne Nutzer-JWT, Header X-Terminal-Token) ---------

export type TerminalWetter = {
  temp_min: number | null;
  temp_max: number | null;
  code: number | null;
  niederschlag_mm: number | null;
};

export type TerminalInfo = {
  terminal: { name: string; property_title: string | null };
  betrieb: { name: string | null; zeitzone: string };
  wetter_heute: TerminalWetter | null;
};

export type TerminalSchicht = {
  start_at: string;
  end_at: string;
  arbeitsbereich_kurz: string | null;
};

/** Antwort von `POST /terminal/status`. */
export type TerminalStatus = {
  anzeige_name: string;
  offen: TerminalZeit | null;
  schicht_heute: TerminalSchicht | null;
};

/**
 * Die Zeiterfassung, wie das Terminal sie zurueckbekommt.
 *
 * Bewusst eine EIGENE, schmale Form statt `Zeiterfassung` aus
 * `personal-typen.ts`: die Terminal-Antwort tragt keine Personendaten, und die
 * Oberflaeche braucht nur Zustand und Uhrzeiten.
 */
export type TerminalZeit = {
  id: string;
  start_at: string;
  end_at: string | null;
  netto_minuten: number;
  pause_minuten: number;
  zustand: "laeuft" | "in_pause" | "beendet";
};

export type TerminalAktion = "start" | "pause" | "pause_ende" | "ende";

export const TERMINAL_AKTIONEN: readonly TerminalAktion[] = ["start", "pause", "pause_ende", "ende"];

// --- §3.4 Zeit-Listen --------------------------------------------------------

export type ZeitZusammenfassung = {
  user_id: string;
  full_name: string | null;
  arbeitstage: number;
  netto_minuten: number;
  soll_minuten: number | null;
  ueberstunden_minuten: number;
  krank_tage: number;
  urlaub_tage: number;
  unbestaetigt: number;
  verspaetungen: number;
};

export type ZeitUnbestaetigt = {
  user_id: string;
  full_name: string | null;
  unbestaetigt: number;
  verpasst: number;
  aelteste: string | null;
};

// --- §3.5 Ueberstunden & Guttage ---------------------------------------------

export type UeberstundenStatus = "beantragt" | "genehmigt" | "abgelehnt";

export type Ueberstundenantrag = {
  id: string;
  user_id: string;
  full_name: string | null;
  datum: string;
  minuten: number;
  grund: string;
  status: UeberstundenStatus;
  kommentar: string | null;
  zeiterfassung_id: string | null;
  entschieden_von: string | null;
  entschieden_am: string | null;
  created_at: string | null;
};

export type UeberstundenInput = {
  datum: string;
  minuten: number;
  grund: string;
  zeiterfassung_id?: string | null;
};

export type GuttageBuchung = {
  id: string;
  datum: string;
  tage: number;
  grund: string;
  notiz: string | null;
  abwesenheit_id: string | null;
  created_at: string | null;
};

export type Guttage = { saldo_tage: number; buchungen: GuttageBuchung[] };

export type GuttageInput = {
  user_id: string;
  datum: string;
  tage: number;
  grund: string;
  notiz?: string | null;
  abwesenheit_id?: string | null;
};

// --- §2.2 Produktivitaet, Budget, Umsatzbuch, Bedarfsvorlagen ---------------

/** Rechenbasis einer Produktivitaets-Annahme (Vertrag §2.3 Prognose-Rechnung). */
export type ProduktivitaetBasis =
  | "einheiten_belegt"
  | "abreisen"
  | "anreisen"
  | "gaeste"
  | "umsatz"
  | "fest";

export const PRODUKTIVITAET_BASEN: readonly ProduktivitaetBasis[] = [
  "einheiten_belegt",
  "abreisen",
  "anreisen",
  "gaeste",
  "umsatz",
  "fest",
];

export type ProduktivitaetZeile = {
  arbeitsbereich_id: string;
  basis: ProduktivitaetBasis;
  wert: number;
  min_stunden_tag: number | null;
  max_stunden_tag: number | null;
  notiz: string | null;
};

export type BudgetZeile = {
  id?: string;
  wochentag: number | null;
  datum: string | null;
  stunden: number | null;
  betrag_minor: number | null;
  currency: string | null;
  notiz: string | null;
};

export type BudgetDaten = { vorlagen: BudgetZeile[]; tage: BudgetZeile[] };

export type UmsatzQuelle = "buchungen" | "manuell" | "prognose";

export type UmsatzbuchZeile = {
  datum: string;
  arbeitsbereich_id: string | null;
  plan_minor: number | null;
  ist_minor: number | null;
  currency: string | null;
  quelle: UmsatzQuelle | null;
  buchungen_ist_minor: number | null;
  notiz: string | null;
};

export type UmsatzbuchInput = {
  datum: string;
  arbeitsbereich_id: string | null;
  plan_minor: number | null;
  ist_minor: number | null;
  currency: string | null;
  notiz: string | null;
};

export type BedarfQuelle = "manuell" | "prognose" | "vorlage";

/**
 * Bedarfs-Huelle (Vertrag §2.2). Dieselbe Form wie im Bedarf-Editor von F1 —
 * die Einstellungen pflegen ausschliesslich die WOCHENTAG-Vorlagen
 * (`PUT /bedarf/vorlagen`), die Tages-Uebersteuerung bleibt am Dienstplan.
 */
export type BedarfZeile = {
  id?: string;
  arbeitsbereich_id: string;
  property_id: string | null;
  wochentag: number | null;
  datum: string | null;
  zeit_von: string;
  zeit_bis: string;
  anzahl: number;
  quelle: BedarfQuelle;
  notiz: string | null;
};

export type BedarfDaten = { vorlagen: BedarfZeile[]; tage: BedarfZeile[] };

// --- Reine Helfer ------------------------------------------------------------

/** Wochentage 0 = Montag … 6 = Sonntag (dieselbe Zaehlung wie `personal_bedarf`). */
export const WOCHENTAGE: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

/** Erster Tag des Monats eines ISO-Datums. */
export function monatsErster(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Letzter Tag des Monats eines ISO-Datums. */
export function monatsLetzter(iso: string): string {
  const jahr = Number(iso.slice(0, 4));
  const monat = Number(iso.slice(5, 7));
  const d = new Date(Date.UTC(jahr, monat, 0));
  return d.toISOString().slice(0, 10);
}

/** Erster/letzter Tag des Jahres eines ISO-Datums. */
export function jahresErster(iso: string): string {
  return `${iso.slice(0, 4)}-01-01`;
}
export function jahresLetzter(iso: string): string {
  return `${iso.slice(0, 4)}-12-31`;
}

/** Anzahl Kalendertage zwischen zwei ISO-Daten (inklusive beider Enden). */
export function tageZwischen(von: string, bis: string): number {
  const a = Date.parse(`${von}T00:00:00Z`);
  const b = Date.parse(`${bis}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Alle Kalendertage eines Fensters als ISO-Liste (harte Obergrenze: 400). */
export function tageListe(von: string, bis: string): string[] {
  const aus: string[] = [];
  const ende = Date.parse(`${bis}T00:00:00Z`);
  let t = Date.parse(`${von}T00:00:00Z`);
  if (!Number.isFinite(t) || !Number.isFinite(ende)) return aus;
  while (t <= ende && aus.length < 400) {
    aus.push(new Date(t).toISOString().slice(0, 10));
    t += 86_400_000;
  }
  return aus;
}

/** Minuten als „7:30" (ohne Einheit) — dieselbe Form wie `stunden()`. */
export function minutenAlsStunden(minuten: number): string {
  const vorzeichen = minuten < 0 ? "−" : "";
  const abs = Math.abs(minuten);
  return `${vorzeichen}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}

/** Laufende Dauer einer offenen Stempelung als „h:mm:ss". */
export function laufzeit(sekunden: number): string {
  const s = Math.max(0, Math.floor(sekunden));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
