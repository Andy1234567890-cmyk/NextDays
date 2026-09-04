// Typen des Personalbereichs — gespiegelt aus apps/api/src/features/personal/schemas.py.
//
// Eigene Datei OHNE "use server": ein Server-Action-Modul darf nur async
// functions exportieren (sonst 500 in „Collecting page data"); Typen und
// Konstanten liegen deshalb hier daneben.

export type Beschaeftigungsart = "vollzeit" | "teilzeit" | "aushilfe" | "extern";
export type Abrechnung = "je_einsatz" | "je_stunde";
export type Qualifikationsstufe = "lernend" | "selbststaendig" | "anleitend";
export type DokumentArt =
  | "vertrag"
  | "ausweis"
  | "arbeitserlaubnis"
  | "fuehrungszeugnis"
  | "gesundheitszeugnis"
  | "belehrung"
  | "zertifikat"
  | "attest"
  | "datenschutz"
  | "betriebsvereinbarung"
  | "sonstiges";
export type SchichtStatus = "entwurf" | "veroeffentlicht" | "bestaetigt" | "abgesagt";
export type SchichtQuelle = "manuell" | "vorlage" | "bedarf_aufgabe" | "abwesenheit" | "kopie";
export type AbwesenheitArt =
  | "urlaub"
  | "krank"
  | "kind_krank"
  | "unbezahlt"
  | "sonderurlaub"
  | "schulung"
  | "frei";
export type AbwesenheitStatus = "beantragt" | "genehmigt" | "abgelehnt" | "storniert";
export type VerfuegbarkeitArt = "wunsch" | "gesperrt";
export type ZeitStatus = "offen" | "abgeschlossen" | "bestaetigt";
export type ZeitZustand = "laeuft" | "in_pause" | "beendet";

export const BESCHAEFTIGUNGSARTEN: readonly Beschaeftigungsart[] = [
  "vollzeit",
  "teilzeit",
  "aushilfe",
  "extern",
];
export const DOKUMENT_ARTEN: readonly DokumentArt[] = [
  "vertrag",
  "ausweis",
  "arbeitserlaubnis",
  "fuehrungszeugnis",
  "gesundheitszeugnis",
  "belehrung",
  "zertifikat",
  "attest",
  "datenschutz",
  "betriebsvereinbarung",
  "sonstiges",
];
/** Dokument-Arten, die der Compliance-Reiter als Nachweis mit Status führt. */
export const COMPLIANCE_ARTEN: readonly DokumentArt[] = [
  "arbeitserlaubnis",
  "gesundheitszeugnis",
  "fuehrungszeugnis",
  "datenschutz",
  "betriebsvereinbarung",
  "belehrung",
];
export const ABWESENHEIT_ARTEN: readonly AbwesenheitArt[] = [
  "urlaub",
  "krank",
  "kind_krank",
  "unbezahlt",
  "sonderurlaub",
  "schulung",
  "frei",
];

export type Fremdfirma = {
  id: string;
  name: string;
  kontakt_name: string | null;
  kontakt_email: string | null;
  kontakt_telefon: string | null;
  abrechnung: Abrechnung;
  satz_minor: number | null;
  currency: string | null;
  notiz: string | null;
  archived_at: string | null;
  anzahl_personen: number;
};

export type Arbeitsbereich = {
  id: string;
  name: string;
  kurz: string;
  farbe: string;
  sort: number;
  archived_at: string | null;
};

export type Qualifikation = {
  id: string;
  user_id: string;
  arbeitsbereich_id: string;
  property_id: string | null;
  stufe: Qualifikationsstufe;
};

export type Akte = {
  user_id: string;
  employee_number: string | null;
  beschaeftigungsart: Beschaeftigungsart;
  firma_id: string | null;
  firma_name: string | null;
  position: string | null;
  eintritt: string | null;
  austritt: string | null;
  probezeit_bis: string | null;
  wochenstunden: number | null;
  tagesstunden: number | null;
  arbeitstage_je_woche: number | null;
  stundenlohn_minor: number | null;
  gehalt_minor: number | null;
  currency: string | null;
  urlaubsanspruch_tage: number | null;
  geburtsdatum: string | null;
  geburtsort: string | null;
  staatsangehoerigkeit: string | null;
  strasse: string | null;
  hausnummer: string | null;
  plz: string | null;
  ort: string | null;
  land: string | null;
  notfall_name: string | null;
  notfall_beziehung: string | null;
  notfall_telefon: string | null;
  steuer_id_maskiert: string | null;
  sv_nummer_maskiert: string | null;
  iban_maskiert: string | null;
  krankenkasse: string | null;
  bic: string | null;
  bank_name: string | null;
  kontoinhaber: string | null;
  notiz: string | null;
  familienstand: Familienstand | null;
  kinder_anzahl: number | null;
  lohnmerkmale: Paar[];
  arbeitgeber_aufschlag_pct: number | null;
  updated_at: string | null;
};

export type Familienstand = "ledig" | "verheiratet" | "partnerschaft" | "geschieden" | "verwitwet";
export const FAMILIENSTAENDE: readonly Familienstand[] = [
  "ledig",
  "verheiratet",
  "partnerschaft",
  "geschieden",
  "verwitwet",
];
export type Paar = { schluessel: string; wert: string };

export type AkteUpdate = Partial<
  Omit<
    Akte,
    | "user_id"
    | "firma_name"
    | "steuer_id_maskiert"
    | "sv_nummer_maskiert"
    | "iban_maskiert"
    | "updated_at"
  >
> & {
  steuer_id?: string | null;
  sv_nummer?: string | null;
  iban?: string | null;
  geleert?: string[];
};

export type MitarbeiterListItem = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
  avatar_url: string | null;
  beschaeftigungsart: Beschaeftigungsart | null;
  firma_name: string | null;
  position: string | null;
  employee_number: string | null;
  eintritt: string | null;
  austritt: string | null;
  wochenstunden: number | null;
  arbeitsbereiche: string[];
  dokumente_faellig: number;
  akte_vorhanden: boolean;
  phone: string | null;
  kosten_monat_minor: number | null;
  kosten_currency: string | null;
};

export type KostenSumme = { currency: string; minor: number; personen: number };
export type MitarbeiterListe = {
  items: MitarbeiterListItem[];
  kosten_monat: KostenSumme[];
  kosten_hinweise: string[];
};

export type Dokument = {
  id: string;
  user_id: string;
  art: DokumentArt;
  titel: string;
  eingereicht: boolean;
  content_type: string | null;
  groesse_bytes: number | null;
  ablauf_am: string | null;
  angefragt_am: string | null;
  eingereicht_am: string | null;
  geprueft_am: string | null;
  notiz: string | null;
  dokument_nummer: string | null;
  ausgestellt_am: string | null;
  behoerde: string | null;
  zustand: "offen" | "abgelaufen" | "laeuft_ab" | "gueltig";
  download_url: string | null;
};

export type RegelnSet = {
  zeitzone: string;
  feiertage_region: string | null;
  ruhezeit_stunden: number;
  max_tagesstunden: number;
  max_wochenstunden: number;
  nacht_von: string;
  nacht_bis: string;
  zuschlag_nacht_pct: number;
  zuschlag_sonntag_pct: number;
  zuschlag_feiertag_pct: number;
  zuschlag_ueberstunden_pct: number;
  urlaubsjahr_start_monat: number;
  uebertrag_verfall_monat: number | null;
  uebertrag_max_tage: number | null;
  mindest_vorlauf_urlaub_tage: number;
  datev_berater_nr: string | null;
  datev_mandanten_nr: string | null;
  lohnarten: Record<string, string>;
};

export type Regeln = RegelnSet & {
  land: string;
  bestaetigt_am: string | null;
  bestaetigt_von: string | null;
};

export type RegelVorschlag = {
  land: string;
  vorhanden: boolean;
  werte: RegelnSet | null;
  quelle: string | null;
  hinweise: string[];
};

export type Pausenmodell = {
  id: string;
  arbeitsbereich_id: string | null;
  ab_minuten: number;
  pause_minuten: number;
};

export type Schichtvorlage = {
  id: string;
  name: string;
  kurz: string;
  start_zeit: string;
  end_zeit: string;
  pause_min: number;
  farbe: string;
  arbeitsbereich_id: string | null;
  sort: number;
  archived_at: string | null;
};

export type Konflikt = {
  art: string;
  schwere: "warnung" | "fehler";
  werte: Record<string, number | string>;
};

export type Schicht = {
  id: string;
  user_id: string | null;
  datum: string;
  start_at: string;
  end_at: string;
  pause_min: number;
  arbeitsbereich_id: string | null;
  property_id: string | null;
  property_title: string | null;
  vorlage_id: string | null;
  status: SchichtStatus;
  quelle: SchichtQuelle;
  task_id: string | null;
  abwesenheit_id: string | null;
  bestaetigt_am: string | null;
  notiz: string | null;
  netto_minuten: number;
  konflikte: Konflikt[];
  bewerbungen: number;
  eigene_bewerbung: "offen" | "angenommen" | "abgelehnt" | null;
};

export type PlanPerson = {
  user_id: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
  beschaeftigungsart: Beschaeftigungsart | null;
  wochenstunden_soll: number | null;
  arbeitsbereiche: string[];
};

export type Abwesenheit = {
  id: string;
  user_id: string;
  art: AbwesenheitArt;
  von: string;
  bis: string;
  halbtag_start: boolean;
  halbtag_ende: boolean;
  tage_berechnet: number;
  status: AbwesenheitStatus;
  grund: string | null;
  kommentar_entscheidung: string | null;
  entschieden_von: string | null;
  entschieden_am: string | null;
  attest_dokument_id: string | null;
  created_at: string | null;
  schichten_im_zeitraum: number;
  urlaubssperre: boolean;
};

export type Wochenplan = {
  woche_start: string;
  zeitzone: string;
  personen: PlanPerson[];
  schichten: Schicht[];
  abwesenheiten: Abwesenheit[];
  feiertage: Record<string, string>;
  veroeffentlicht_am: string | null;
  lesebestaetigungen: Record<string, string>;
  minuten_je_person: Record<string, number>;
  regeln_bestaetigt: boolean;
};

export type SchichtCreate = {
  user_id?: string | null;
  start_at: string;
  end_at: string;
  pause_min?: number;
  arbeitsbereich_id?: string | null;
  property_id?: string | null;
  vorlage_id?: string | null;
  notiz?: string | null;
  warnungen_akzeptieren?: boolean;
};

export type SchichtUpdate = {
  user_id?: string | null;
  user_id_leeren?: boolean;
  start_at?: string;
  end_at?: string;
  pause_min?: number;
  arbeitsbereich_id?: string | null;
  property_id?: string | null;
  notiz?: string | null;
  warnungen_akzeptieren?: boolean;
};

export type AbwesenheitListe = { items: Abwesenheit[]; personen: PlanPerson[] };

export type Urlaubskonto = {
  user_id: string;
  jahr: number;
  anspruch: number;
  uebertrag: number;
  korrektur: number;
  korrektur_grund: string | null;
  verfall_am: string | null;
  genommen: number;
  geplant: number;
  rest: number;
  anteilig: boolean;
  konto_vorhanden: boolean;
};

export type Urlaubssperre = {
  id: string;
  von: string;
  bis: string;
  grund: string;
  arbeitsbereich_id: string | null;
};

export type Verfuegbarkeit = {
  id: string;
  user_id: string;
  art: VerfuegbarkeitArt;
  wiederkehrend_wochentag: number | null;
  datum_von: string | null;
  datum_bis: string | null;
  zeit_von: string | null;
  zeit_bis: string | null;
  ganztags: boolean;
  notiz: string | null;
  aktiv: boolean;
};

export type Krankenstand = {
  user_id: string;
  full_name: string | null;
  tage_krank: number;
  faelle: number;
};

export type PausenEintrag = { start: string; end: string | null };

export type Zeiterfassung = {
  id: string;
  user_id: string;
  start_at: string;
  end_at: string | null;
  pausen: PausenEintrag[];
  // "terminal" seit 0544: Stempelung am Wandgerät per Stempel-ID und PIN.
  // Der Wert fehlte hier, während der Server ihn längst liefert — eine Zeile
  // vom Terminal wäre in TypeScript nicht typisierbar gewesen.
  quelle: "web" | "app" | "korrektur" | "import" | "terminal";
  schicht_id: string | null;
  task_id: string | null;
  property_id: string | null;
  property_title: string | null;
  standort_start: Record<string, number> | null;
  standort_ende: Record<string, number> | null;
  status: ZeitStatus;
  bestaetigt_von: string | null;
  bestaetigt_am: string | null;
  notiz: string | null;
  netto_minuten: number;
  pause_minuten: number;
  plan_abweichung_min: number | null;
  korrekturen: number;
  zustand: ZeitZustand;
  // Welches Terminal gestempelt hat (null = Browser oder App) und wie viele
  // Minuten nach dem geplanten Schichtbeginn (0544). Beides liefert der
  // Server; ohne die Felder hier konnte die Liste sie nicht anzeigen.
  terminal_id?: string | null;
  verspaetung_min?: number | null;
};

export type ZeitListe = { items: Zeiterfassung[]; personen: PlanPerson[] };

export type AzkBuchung = {
  id: string;
  user_id: string;
  datum: string;
  minuten: number;
  grund: string;
  notiz: string | null;
  created_at: string | null;
};

export type Arbeitszeitkonto = { user_id: string; saldo_minuten: number; buchungen: AzkBuchung[] };

export type Monatsabschluss = {
  user_id: string;
  jahr: number;
  monat: number;
  soll_minuten: number;
  ist_minuten: number;
  saldo_minuten: number;
  zuschlaege: Record<string, unknown>;
  freigegeben_am: string | null;
  freigegeben: boolean;
};

export type PersonAuswertung = {
  user_id: string;
  full_name: string | null;
  beschaeftigungsart: Beschaeftigungsart | null;
  firma_name: string | null;
  soll_minuten: number;
  plan_minuten: number;
  ist_minuten: number;
  nacht_minuten: number;
  sonntag_minuten: number;
  feiertag_minuten: number;
  ueberstunden_minuten: number;
  abwesenheit_tage: Record<string, number>;
  kosten_minor: number | null;
  currency: string | null;
};

export type ObjektKosten = {
  property_id: string | null;
  property_title: string | null;
  minuten: number;
  kosten_minor: number;
  currency: string | null;
  fremd_minor: number;
};

export type Auswertung = {
  von: string;
  bis: string;
  personen: PersonAuswertung[];
  objekte: ObjektKosten[];
  hinweise: string[];
};

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; details?: Record<string, unknown> };

/** Montag der Woche eines ISO-Datums (yyyy-MM-dd), rein kalendarisch. */
export function montagVon(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const tag = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - tag);
  return d.toISOString().slice(0, 10);
}

export function tagePlus(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function heuteIso(): string {
  const d = new Date();
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Minuten als „7:30 h" — für Fußzeilen und Konten. */
export function stunden(minuten: number): string {
  const vorzeichen = minuten < 0 ? "−" : "";
  const abs = Math.abs(minuten);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${vorzeichen}${h}:${String(m).padStart(2, "0")}`;
}

// --- Kartei (0543) ------------------------------------------------------------

export type VertragArt =
  | "arbeitsvertrag"
  | "aenderung"
  | "verschwiegenheit"
  | "wettbewerbsverbot"
  | "bonus"
  | "zielvereinbarung"
  | "sonstiges";
export const VERTRAG_ARTEN: readonly VertragArt[] = [
  "arbeitsvertrag",
  "aenderung",
  "verschwiegenheit",
  "wettbewerbsverbot",
  "bonus",
  "zielvereinbarung",
  "sonstiges",
];
export type VertragStatus = "entwurf" | "aktiv" | "abgelaufen" | "beendet";
export const VERTRAG_STATUS: readonly VertragStatus[] = ["entwurf", "aktiv", "abgelaufen", "beendet"];
export type MassnahmeArt = "ermahnung" | "abmahnung" | "letzte_abmahnung" | "freistellung" | "kuendigung";
export const MASSNAHME_ARTEN: readonly MassnahmeArt[] = [
  "ermahnung",
  "abmahnung",
  "letzte_abmahnung",
  "freistellung",
  "kuendigung",
];
export type VorfallArt = "unfall" | "fehlverhalten" | "regelverstoss" | "leistung" | "sonstiges";
export const VORFALL_ARTEN: readonly VorfallArt[] = ["unfall", "fehlverhalten", "regelverstoss", "leistung", "sonstiges"];
export type VorfallSchwere = "gering" | "mittel" | "hoch" | "kritisch";
export const VORFALL_SCHWEREN: readonly VorfallSchwere[] = ["gering", "mittel", "hoch", "kritisch"];
export type GespraechArt = "feedback" | "jahresgespraech" | "probezeit" | "zielgespraech" | "sonstiges";
export const GESPRAECH_ARTEN: readonly GespraechArt[] = ["feedback", "jahresgespraech", "probezeit", "zielgespraech", "sonstiges"];
export type NachweisArt = "ausbildung" | "zertifikat" | "sprache" | "faehigkeit" | "erfahrung";
export const NACHWEIS_ARTEN: readonly NachweisArt[] = ["ausbildung", "zertifikat", "sprache", "faehigkeit", "erfahrung"];
export type AblaufZustand = "gueltig" | "laeuft_ab" | "abgelaufen" | "ohne_ablauf";

export type Aenderung = { feld: string; alt: string; neu: string };

export type Nachtrag = {
  id: string;
  vertrag_id: string;
  datum: string;
  beschreibung: string;
  grund: string | null;
  aenderungen: Aenderung[];
  autorisiert_von: string | null;
  autorisiert_von_name: string | null;
  created_at: string | null;
};

export type Vertrag = {
  id: string;
  user_id: string;
  art: VertragArt;
  titel: string;
  beschreibung: string | null;
  status: VertragStatus;
  version: string | null;
  unterzeichnet_am: string | null;
  gueltig_ab: string | null;
  gueltig_bis: string | null;
  unterzeichner: string[];
  bedingungen: Paar[];
  verlaengerung: string | null;
  kuendigung: string | null;
  dokument_id: string | null;
  dokument_titel: string | null;
  nachtraege: Nachtrag[];
  created_at: string | null;
  updated_at: string | null;
};

export type VertragInput = {
  art: VertragArt;
  titel: string;
  beschreibung?: string | null;
  status?: VertragStatus;
  version?: string | null;
  unterzeichnet_am?: string | null;
  gueltig_ab?: string | null;
  gueltig_bis?: string | null;
  unterzeichner?: string[];
  bedingungen?: Paar[];
  verlaengerung?: string | null;
  kuendigung?: string | null;
  dokument_id?: string | null;
  geleert?: string[];
};

export type Massnahme = {
  id: string;
  user_id: string;
  art: MassnahmeArt;
  datum: string;
  grund: string;
  beschreibung: string | null;
  ausgestellt_von: string | null;
  ausgestellt_von_name: string | null;
  zeuge: string | null;
  stellungnahme: string | null;
  folgetermin: string | null;
  geloest: boolean;
  geloest_am: string | null;
  loesung: string | null;
  dokument_id: string | null;
  dokument_titel: string | null;
  created_at: string | null;
};

export type MassnahmeInput = {
  art?: MassnahmeArt;
  datum?: string;
  grund?: string;
  beschreibung?: string | null;
  zeuge?: string | null;
  stellungnahme?: string | null;
  folgetermin?: string | null;
  geloest?: boolean;
  geloest_am?: string | null;
  loesung?: string | null;
  dokument_id?: string | null;
  geleert?: string[];
};

export type Vorfall = {
  id: string;
  user_id: string;
  datum: string;
  art: VorfallArt;
  schwere: VorfallSchwere;
  ort: string | null;
  beschreibung: string;
  zeugen: string[];
  massnahmen: string | null;
  praevention: string | null;
  gemeldet_von: string | null;
  gemeldet_von_name: string | null;
  folge_noetig: boolean;
  created_at: string | null;
};

export type VorfallInput = {
  datum?: string;
  art?: VorfallArt;
  schwere?: VorfallSchwere;
  ort?: string | null;
  beschreibung?: string;
  zeugen?: string[];
  massnahmen?: string | null;
  praevention?: string | null;
  folge_noetig?: boolean;
  geleert?: string[];
};

export type Gespraech = {
  id: string;
  user_id: string;
  datum: string;
  art: GespraechArt;
  bewertung: number | null;
  notizen: string | null;
  ziele: string[];
  erfolge: string[];
  entwicklung: string[];
  gefuehrt_von: string | null;
  gefuehrt_von_name: string | null;
  naechstes_am: string | null;
  created_at: string | null;
};

export type GespraechInput = {
  datum?: string;
  art?: GespraechArt;
  bewertung?: number | null;
  notizen?: string | null;
  ziele?: string[];
  erfolge?: string[];
  entwicklung?: string[];
  naechstes_am?: string | null;
  geleert?: string[];
};

export type Nachweis = {
  id: string;
  user_id: string;
  art: NachweisArt;
  titel: string;
  stelle: string | null;
  stufe: string | null;
  von: string | null;
  bis: string | null;
  ablauf_am: string | null;
  kennung: string | null;
  notiz: string | null;
  dokument_id: string | null;
  dokument_titel: string | null;
  zustand: AblaufZustand;
  created_at: string | null;
};

export type NachweisInput = {
  art?: NachweisArt;
  titel?: string;
  stelle?: string | null;
  stufe?: string | null;
  von?: string | null;
  bis?: string | null;
  ablauf_am?: string | null;
  kennung?: string | null;
  notiz?: string | null;
  dokument_id?: string | null;
  geleert?: string[];
};

export type Schulung = {
  id: string;
  user_id: string;
  titel: string;
  trainer: string | null;
  abgeschlossen_am: string;
  gueltig_bis: string | null;
  notiz: string | null;
  dokument_id: string | null;
  dokument_titel: string | null;
  zustand: AblaufZustand;
  created_at: string | null;
};

export type SchulungInput = {
  titel?: string;
  trainer?: string | null;
  abgeschlossen_am?: string;
  gueltig_bis?: string | null;
  notiz?: string | null;
  dokument_id?: string | null;
  geleert?: string[];
};

export type KommendeSchicht = {
  id: string;
  datum: string;
  start_at: string;
  end_at: string;
  property_title: string | null;
  arbeitsbereich_id: string | null;
  status: SchichtStatus;
};

export type EinladungStand = "keine" | "offen" | "abgelaufen" | "angenommen";

export type PersonUebersicht = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  letzter_login: string | null;
  einladung: EinladungStand | null;
  einladung_am: string | null;
  eingeladen_von_name: string | null;
  konto_seit: string | null;
  vertraege: number;
  massnahmen_offen: number;
  vorfaelle: number;
  gespraeche: number;
  nachweise: number;
  schulungen: number;
  faellig: number;
  monat_soll_minuten: number | null;
  monat_plan_minuten: number;
  monat_ist_minuten: number;
  kommende_schichten: KommendeSchicht[];
  offene_antraege: number;
  azk_saldo_minuten: number | null;
  urlaub_rest: number | null;
  urlaub_anspruch: number | null;
  kosten_monat_minor: number | null;
  kosten_currency: string | null;
  kosten_hinweis: string | null;
};

export type KarteiBereich = "vertraege" | "massnahmen" | "vorfaelle" | "gespraeche" | "nachweise" | "schulungen";
