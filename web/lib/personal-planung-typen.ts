// Typen des Dienstplan-Ausbaus (Paket F1) — gespiegelt aus dem
// Schnittstellenvertrag docs/PERSONAL-AUSBAU-VERTRAG.md §1 und §2.
//
// Eigene Datei OHNE "use server", genau wie `personal-typen.ts`: ein
// Server-Action-Modul darf ausschliesslich async functions exportieren (ein
// `export const` legt die Seite beim Sammeln der Seitendaten mit 500 lahm).
// Typen, Konstanten und reine Helfer liegen deshalb hier daneben.
//
// `personal-typen.ts` gehoert niemandem und wird nicht angefasst (Vertrag §0);
// die Felder, die der Vertrag der bestehenden `WochenplanResponse` HINZUFUEGT,
// stehen darum hier als `WochenplanPlus` und werden im Dienstplan per
// Schnittmenge (`Wochenplan & WochenplanPlus`) verwendet. Sobald B1 die
// Basisdatei nachzieht, bleibt der Code unveraendert gueltig.
import type { Konflikt, PlanPerson, Schicht, Wochenplan } from "@/lib/personal-typen";

// --- Ansichten und Filter (reiner Frontend-Zustand, in der URL) --------------

export type Ansicht = "tag" | "woche" | "monat";
export type Darstellung = "grid" | "liste";

export const ANSICHTEN: readonly Ansicht[] = ["tag", "woche", "monat"];
export const DARSTELLUNGEN: readonly Darstellung[] = ["grid", "liste"];

/** Filterzustand der Leiste — vollstaendig aus der URL rekonstruierbar. */
export type Filterzustand = {
  arbeitsbereich_id: string;
  property_id: string;
  user_id: string;
  suche: string;
};

export const LEERER_FILTER: Filterzustand = {
  arbeitsbereich_id: "",
  property_id: "",
  user_id: "",
  suche: "",
};

// --- §1.3 Zusatzfelder der Wochenplan-Antwort --------------------------------

/** Aufgeloeste Wunsch-/Sperrzeit je Tag im Fenster (wiederkehrende expandiert). */
export type Verfuegbarkeitstag = {
  user_id: string;
  art: "wunsch" | "gesperrt";
  datum: string;
  zeit_von: string | null;
  zeit_bis: string | null;
  ganztags: boolean;
};

/** Wetter eines Tages (Open-Meteo, §1.6). */
export type Wettertag = {
  temp_min: number | null;
  temp_max: number | null;
  code: number | null;
  niederschlag_mm: number | null;
};

/** Verdienstgrenze einer Person — nur fuer die Leitung gefuellt. */
export type Verdienstgrenze = {
  minor: number;
  zeitraum: "monat" | "jahr";
  currency: string | null;
  verbraucht_minor: number;
  geplant_minor: number;
};

export type TauschStatus = "angefragt" | "angenommen" | "freigegeben" | "abgelehnt" | "verworfen";

export type TauschSchicht = {
  datum: string;
  start_at: string;
  end_at: string;
  arbeitsbereich_id: string | null;
  property_title: string | null;
};

export type Tausch = {
  id: string;
  schicht_id: string;
  von_user_id: string;
  von_name: string | null;
  an_user_id: string;
  an_name: string | null;
  gegen_schicht_id: string | null;
  status: TauschStatus;
  grund: string | null;
  kommentar: string | null;
  angenommen_am: string | null;
  entschieden_von: string | null;
  entschieden_am: string | null;
  created_at: string | null;
  schicht: TauschSchicht | null;
  /** Beim direkten Tausch die Gegenschicht — traegt die Zeit fuer das Label. */
  gegen_schicht: TauschSchicht | null;
};

/** Person mit den Feldern, die §1.3 der Wochenplan-Antwort hinzufuegt. */
export type PlanPersonPlus = PlanPerson & {
  geburtstag_am?: string | null;
  ist_schichtleitung?: boolean;
  azk_minuten?: number | null;
  guttage?: number | null;
  verdienstgrenze?: Verdienstgrenze | null;
  zuschlaege_minor?: number | null;
};

/** Schicht mit dem Tausch-Marker aus §1.3. */
export type SchichtPlus = Schicht & { tausch_status?: "angefragt" | "angenommen" | null };

/** Die Felder, die §1.3 der `WochenplanResponse` hinzufuegt. */
export type WochenplanPlus = {
  bis?: string;
  personen: PlanPersonPlus[];
  schichten: SchichtPlus[];
  verfuegbarkeiten?: Verfuegbarkeitstag[];
  wetter?: Record<string, Wettertag>;
  tausch?: Tausch[];
};

/** Wochenplan inklusive der Vertrags-Zusatzfelder. */
export type PlanDaten = Omit<Wochenplan, "personen" | "schichten"> & WochenplanPlus;

// --- §1.4 Mehrfachaktion, Woche leeren, Wochenvorlagen -----------------------

export type MehrfachAktion = "verschieben" | "loeschen" | "zuweisen" | "freigeben";

export type MehrfachRequest = {
  ids: string[];
  aktion: MehrfachAktion;
  tage?: number | null;
  user_id?: string | null;
  warnungen_akzeptieren?: boolean;
};

export type MehrfachErgebnis = {
  geaendert: number;
  konflikte: { schicht_id: string; konflikte: Konflikt[] }[];
};

export type LeerenErgebnis = { geloescht: number; abgesagt: number };

export type Wochenvorlage = {
  id: string;
  name: string;
  notiz: string | null;
  anzahl_schichten: number;
  created_at: string | null;
};

export type WochenvorlageSchicht = {
  id: string;
  wochentag: number;
  start_zeit: string;
  end_zeit: string;
  pause_min: number;
  arbeitsbereich_id: string | null;
  property_id: string | null;
  user_id: string | null;
  schichtvorlage_id: string | null;
  notiz: string | null;
};

export type WochenvorlageDetail = Wochenvorlage & { schichten: WochenvorlageSchicht[] };

/** Gemeinsame Antwort von „anwenden", „Prognose uebernehmen", „Autoplan uebernehmen". */
export type BedarfResponse = { angelegt: number; vorhanden: number };

// --- §2.1 Kennzahlen ---------------------------------------------------------

/** Namen der KPI-Zeilen je Bereich (Regel `kennzahlen_zeilen`). */
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

export type UmsatzQuelle = "buchungen" | "manuell" | "prognose";

export type KennzahlTag = {
  datum: string;
  feiertag: string | null;
  anreisen: number;
  abreisen: number;
  gaeste_im_haus: number;
  einheiten_belegt: number;
  einheiten_gesamt: number;
  belegung_pct: number | null;
  umsatz_ist_minor: number | null;
  umsatz_plan_minor: number | null;
  umsatz_quelle: UmsatzQuelle | null;
  plan_minuten: number;
  ist_minuten: number;
  einsaetze: number;
  personen: number;
  personalkosten_plan_minor: number | null;
  personalkosten_ist_minor: number | null;
  personalkostenquote_pct: number | null;
  produktivitaet_minor_je_stunde: number | null;
  ziel_produktivitaet_minor: number | null;
  stundenlimit_minuten: number | null;
  budget_stunden: number | null;
  budget_minor: number | null;
  abweichung_budget_pct: number | null;
};

export type KennzahlBereichTag = {
  datum: string;
  soll_anzahl: number;
  ist_anzahl: number;
  soll_minuten: number;
  ist_minuten: number;
  einsaetze: number;
  stundenlimit_minuten: number | null;
};

export type KennzahlBereich = {
  arbeitsbereich_id: string;
  tage: KennzahlBereichTag[];
};

export type KennzahlSumme = {
  anreisen: number;
  abreisen: number;
  gaeste_im_haus: number;
  plan_minuten: number;
  ist_minuten: number;
  einsaetze: number;
  umsatz_ist_minor: number | null;
  umsatz_plan_minor: number | null;
  personalkosten_plan_minor: number | null;
  personalkosten_ist_minor: number | null;
  personalkostenquote_pct: number | null;
  produktivitaet_minor_je_stunde: number | null;
  stundenlimit_minuten: number | null;
  budget_stunden: number | null;
  budget_minor: number | null;
};

export type Kennzahlen = {
  von: string;
  bis: string;
  currency: string | null;
  hinweise: string[];
  tage: KennzahlTag[];
  bereiche: KennzahlBereich[];
  summe: KennzahlSumme;
};

// --- §2.2 Bedarf -------------------------------------------------------------

export type BedarfQuelle = "manuell" | "prognose" | "vorlage";

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

// --- §2.3 KI ----------------------------------------------------------------

export type KiStatus = {
  konfiguriert: boolean;
  verbrauch_heute: number;
  tageslimit: number;
  solver: string;
};

export type PrognoseBereich = {
  arbeitsbereich_id: string;
  stunden: number;
  anzahl: number;
  basis: string;
  basis_wert: number;
};

export type PrognoseTag = {
  datum: string;
  bereiche: PrognoseBereich[];
  stundenlimit_minuten: number | null;
  hinweise: string[];
};

export type PrognoseEingabeTag = {
  datum: string;
  anreisen: number;
  abreisen: number;
  gaeste_im_haus: number;
  einheiten_belegt: number;
  einheiten_gesamt: number;
  feiertag: string | null;
};

export type Prognose = {
  id: string;
  woche_start: string;
  status: "fertig" | "fehler";
  eingaben: { tage: PrognoseEingabeTag[]; historie_wochen: number } | null;
  ausgabe: { tage: PrognoseTag[] } | null;
  erklaerung: string | null;
  content_origin: string | null;
  modell: string | null;
  region: string | null;
  dauer_ms: number | null;
  fehler: string | null;
  uebernommen_am: string | null;
  created_at: string | null;
};

/** Die sieben Planungstypen des Autoplans (Vertrag §2.3). */
export type Planungstyp =
  | "performer"
  | "alleskoenner"
  | "superfaire"
  | "zeitschwaermer"
  | "talentscout"
  | "faire"
  | "philanthrop";

export const PLANUNGSTYPEN: readonly Planungstyp[] = [
  "performer",
  "alleskoenner",
  "superfaire",
  "zeitschwaermer",
  "talentscout",
  "faire",
  "philanthrop",
];

export type VariantenKennzahlen = {
  stunden: number;
  kosten_minor: number | null;
  currency: string | null;
  fairness_pct: number;
  wunsch_erfuellt_pct: number;
  unbesetzt: number;
  konflikte: number;
};

export type PlanVariante = {
  name: string;
  schichten: {
    bedarf_id: string | null;
    user_id: string;
    start_at: string;
    end_at: string;
    pause_min: number;
    arbeitsbereich_id: string | null;
    property_id: string | null;
  }[];
  kennzahlen: VariantenKennzahlen;
};

export type Planungslauf = {
  id: string;
  woche_start: string;
  planungstyp: Planungstyp;
  status: string;
  solver: string | null;
  varianten: PlanVariante[];
  gewaehlte_variante: number | null;
  erklaerung: string | null;
  content_origin: string | null;
  dauer_ms: number | null;
  fehler: string | null;
  uebernommen_am: string | null;
  created_at: string | null;
};

export type AutoplanRequest = {
  planungstyp: Planungstyp;
  varianten: number;
  zeitlimit_s: number;
  nur_offene: boolean;
};

export type AssistentAntwort = {
  antwort: string;
  content_origin: string;
  quellen: string[];
};

// --- Reine Helfer ------------------------------------------------------------

/** WMO-Wettercode → ph-Icon. Gruppen nach dem WMO-4677-Schlüssel von Open-Meteo. */
export function wetterIcon(code: number | null | undefined): string {
  if (code === null || code === undefined) return "ph:cloud";
  if (code === 0) return "ph:sun";
  if (code <= 2) return "ph:cloud-sun";
  if (code === 3) return "ph:cloud";
  if (code <= 48) return "ph:cloud-fog";
  if (code <= 57) return "ph:cloud-rain";
  if (code <= 67) return "ph:cloud-rain";
  if (code <= 77) return "ph:cloud-snow";
  if (code <= 82) return "ph:cloud-rain";
  if (code <= 86) return "ph:cloud-snow";
  return "ph:cloud-lightning";
}

/** Kurzname der Wetterlage für den Tooltip (i18n-Schlüssel `wetter.<name>`). */
export function wetterName(code: number | null | undefined): string {
  if (code === null || code === undefined) return "unbekannt";
  if (code === 0) return "klar";
  if (code <= 2) return "heiter";
  if (code === 3) return "bedeckt";
  if (code <= 48) return "nebel";
  if (code <= 57) return "niesel";
  if (code <= 67) return "regen";
  if (code <= 77) return "schnee";
  if (code <= 82) return "schauer";
  if (code <= 86) return "schneeschauer";
  return "gewitter";
}

/** Erster Tag des Monats eines ISO-Datums. */
export function monatsErster(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Montag des Rasters einer Monatsansicht (6×7 Zellen ab dem Montag vor dem 1.). */
export function monatsRasterStart(iso: string): string {
  const erster = new Date(`${monatsErster(iso)}T00:00:00Z`);
  const tag = (erster.getUTCDay() + 6) % 7;
  erster.setUTCDate(erster.getUTCDate() - tag);
  return erster.toISOString().slice(0, 10);
}

/** Kalendertage zwischen zwei ISO-Tagen (inklusive Start, exklusive Ende). */
export function tageDiff(von: string, bis: string): number {
  return Math.round((Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) / 86400000);
}
