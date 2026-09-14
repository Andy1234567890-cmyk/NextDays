// Typen des Bereichs Buchhaltung → Berichte (Antworten von /buchhaltung/reports/*).
// Beträge kommen als Decimal-Strings vom Backend (kein float-Rauschen);
// gerechnet wird NICHT hier — nur angezeigt.

export type Gruppierung = "month" | "quarter" | "year";
export type Aufschluesselung = "customer" | "property" | "channel";
export type Berichtsart = "overview" | "revenue" | "bwa" | "susa" | "guv" | "open-items";
export type BwaGruppe = "material" | "personal" | "raum" | "sonstige";
export type Bucket = "nicht_faellig" | "0-30" | "31-60" | "61-90" | ">90" | "ohne_faelligkeit";

export type Zeitraum = { von: string; bis: string; tage: number };

export type Fremdwaehrung = {
  currency: string;
  anzahl: number;
  netto: string;
  brutto: string;
};

export type TopKunde = {
  customerId: string | null;
  name: string;
  anzahl: number;
  netto: string;
  brutto: string;
};

export type OverviewResponse = {
  zeitraum: Zeitraum;
  currency: string;
  umsatzNetto: string;
  umsatzBrutto: string;
  offeneForderungen: string;
  ueberfaellig: string;
  ueberfaelligAnzahl: number;
  ausgabenNetto: string;
  ausgabenBrutto: string;
  ergebnis: string;
  anzahlBelege: number;
  anzahlStorni: number;
  anzahlAusgaben: number;
  topKunden: TopKunde[];
  fremdwaehrungen: Fremdwaehrung[];
  ausgabenVerfuegbar: boolean;
};

export type ZeitpunktWert = { periode: string; netto: string; brutto: string; anzahl: number };

export type Zeitreihe = {
  key: string;
  label: string;
  punkte: ZeitpunktWert[];
  summeNetto: string;
  summeBrutto: string;
};

export type RevenueResponse = {
  zeitraum: Zeitraum;
  currency: string;
  gruppierung: Gruppierung;
  aufschluesselung: Aufschluesselung | null;
  perioden: string[];
  reihen: Zeitreihe[];
  fremdwaehrungen: Fremdwaehrung[];
};

export type BwaZeile = {
  key: string;
  label: string;
  aktuell: string;
  vergleich: string;
  veraenderungProzent: string | null;
  prozentVomUmsatz: string | null;
};

export type BwaResponse = {
  zeitraum: Zeitraum;
  vergleichszeitraum: Zeitraum;
  currency: string;
  erloese: BwaZeile;
  aufwand: BwaZeile[];
  aufwandGesamt: BwaZeile;
  ergebnis: BwaZeile;
  fremdwaehrungen: Fremdwaehrung[];
  ausgabenVerfuegbar: boolean;
  kontenVerfuegbar: boolean;
};

export type SusaZeile = {
  accountId: string | null;
  nummer: string | null;
  name: string;
  typ: string | null;
  soll: string;
  haben: string;
  saldo: string;
  anzahl: number;
};

export type SusaResponse = {
  zeitraum: Zeitraum;
  currency: string;
  zeilen: SusaZeile[];
  summeSoll: string;
  summeHaben: string;
  saldo: string;
  fremdwaehrungen: Fremdwaehrung[];
  ausgabenVerfuegbar: boolean;
  kontenVerfuegbar: boolean;
};

export type GuvMonat = { monat: string; erloese: string; aufwand: string; ergebnis: string };

export type GuvResponse = {
  jahr: number;
  zeitraum: Zeitraum;
  currency: string;
  erloeseNetto: string;
  aufwand: BwaZeile[];
  aufwandGesamt: string;
  ergebnis: string;
  monate: GuvMonat[];
  fremdwaehrungen: Fremdwaehrung[];
  ausgabenVerfuegbar: boolean;
};

export type OffenerPosten = {
  invoiceId: string;
  invoiceNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  issueDate: string | null;
  dueDate: string | null;
  alterTage: number | null;
  bucket: Bucket;
  grossAmount: string;
  paidAmount: string;
  offen: string;
  currency: string;
  status: string;
};

export type BucketSumme = { bucket: Bucket; anzahl: number; offen: string };

export type OpenItemsResponse = {
  stichtag: string;
  currency: string;
  posten: OffenerPosten[];
  buckets: BucketSumme[];
  summeOffen: string;
  anzahl: number;
  fremdwaehrungen: Fremdwaehrung[];
};

export type BerichtResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

/** Zeitraum aus den Such-Parametern; Standard = die letzten zwölf Monate
 *  (Monatsanfang vor elf Monaten bis heute, damit die Grenze von 366 Tagen
 *  nie reißt). Ungültige Werte fallen auf den Standard zurück — sichtbar,
 *  weil der Wähler den Standard dann anzeigt. */
export function zeitraumAusParams(params: {
  from?: string | string[];
  to?: string | string[];
}): { from: string; to: string } {
  const heute = new Date();
  const start = new Date(Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth() - 11, 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const einzel = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const from = einzel(params.from);
  const to = einzel(params.to);
  const gueltig = (v: string | undefined): v is string =>
    !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
  if (gueltig(from) && gueltig(to) && from <= to) {
    const tage = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
    if (tage <= 366) return { from, to };
  }
  return { from: iso(start), to: iso(heute) };
}
