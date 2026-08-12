"use server";

// Reporting für Eigentümer: Server-Actions gegen den FastAPI-owner_reporting-
// Slice (/api/v1/owner-reporting).
//
// Drei Ebenen, in der Reihenfolge, in der der Betrieb sie benutzt:
//   1. Bericht   — Zeitraum × Objektauswahl × Währung. Seine Aufschlüsselungen
//                  kommen bei jedem Abruf frisch vom Server.
//   2. Zahlung   — die Auszahlung an EINEN Empfänger aus einem Bericht,
//                  gespeichert als Snapshot mit fünf Abschnitten.
//   3. Plan      — der Rhythmus, in dem Berichte automatisch entstehen.
//
// Business-Logik bleibt im Backend (PROJECT.md §2); hier steht nur der
// Transport. Insbesondere wird KEINE Summe im Browser nachgerechnet: der
// „bezahlte Prozentsatz", die Abschnittssummen und die Währungsumrechnung
// kommen fertig vom Server, sonst zeigte die Oberfläche eine andere Zahl als
// der Beleg.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

/** Welches Datum der Buchung über die Zugehörigkeit zum Zeitraum entscheidet. */
export type ReportBasis = "check_in" | "check_out" | "booked";

/** Die fünf Abschnitte einer Zahlung. `ausgaben` ist der einzige negative. */
export type Abschnitt =
  | "unterkunftspreis"
  | "gebuehren"
  | "steuern"
  | "ausgaben"
  | "andere";

export type Rhythmus = "woche" | "monat" | "quartal" | "jahr";
export type AmTag = "erste" | "letzte";
export type PlanZeitraum = "vergangener" | "laufender";
export type RecurringModus = "je_buchung" | "je_nacht" | "je_zeitraum";

export type WaehrungsBetrag = { currency: string; amount: number };

// -- Bericht ----------------------------------------------------------------

export type ReportListItem = {
  id: string;
  name: string;
  currency: string;
  period_from: string;
  period_to: string;
  property_count: number;
  /** Kam der Bericht aus einem Plan? Lodgify-Spalte „Automatisch generiert". */
  auto_generated: boolean;
  schedule_id: string | null;
  payment_count: number;
  created_at: string | null;
};

export type MietZeile = {
  property_id: string;
  property_name: string | null;
  bookings: number;
  nights: number;
  guests: number;
  rent: number;
  fees: number;
  addons: number;
  taxes: number;
  /** Was das PORTAL einbehält (Provision + ggf. Zahlungsgebühr). `null`,
   *  solange für einen Kanal dieser Zeile kein Provisionssatz hinterlegt ist —
   *  eine 0 behauptete, das Portal habe nichts einbehalten. */
  channel: number | null;
  income: number | null;
};

export type GebuehrZeile = {
  fee_type: string;
  label: string;
  count: number;
  average: number;
  total: number;
};

export type KanalZeile = {
  channel: string;
  ota_name: string | null;
  /** `null`, wenn für diesen Kanal kein Provisionssatz hinterlegt ist. */
  commission: number | null;
  income: number | null;
  outstanding: number;
};

export type ZahlungsartZeile = { method: string; total: number };

export type ReportSummary = {
  currency: string;
  /** `null`, sobald für eine Buchung des Zeitraums der Portal-Abzug fehlt. */
  income: number | null;
  rent: number;
  fees: number;
  addons: number;
  taxes: number;
  channel_commission: number | null;
  bookings: number;
  nights: number;
  guests: number;
};

export type ZahlungsUebersicht = {
  currency: string;
  payout: number;
  rent: number;
  fees: number;
  taxes: number;
  expenses: number;
  other: number;
  payment_count: number;
};

export type ReportDetail = {
  id: string;
  tenant_id: string;
  name: string;
  currency: string;
  period_from: string;
  period_to: string;
  basis: ReportBasis;
  reservation_statuses: string[];
  property_ids: string[];
  auto_generated: boolean;
  schedule_id: string | null;
  summary: ReportSummary;
  payments_summary: ZahlungsUebersicht;
  rent_rows: MietZeile[];
  fee_rows: GebuehrZeile[];
  commission_rows: KanalZeile[];
  payment_method_rows: ZahlungsartZeile[];
  net_income_rows: KanalZeile[];
  outstanding_total: number;
  /** Objekte im Scope ohne Buchung im Zeitraum — als Zeile mit „—" zeigen,
   *  nicht weglassen: sonst sähe der Bericht aus, als wären sie nie
   *  ausgewählt worden. */
  empty_property_ids: string[];
  /** Warum eine Buchung nicht gerechnet werden konnte. Anzeigen, nicht
   *  verschlucken — eine fehlende Zeile ergäbe eine zu niedrige, aber
   *  nummerierte Summe (Wurzel 5). */
  warnungen: string[];
  /** Kanäle ohne hinterlegten Provisionssatz — die UI verlinkt damit direkt in
   *  die erweiterten Einstellungen. */
  channels_without_commission: string[];
  created_at: string | null;
  updated_at: string | null;
};

export type BuchungPosten = { kind: string; label: string; amount: number };

export type BuchungZeile = {
  reservation_id: string;
  property_id: string;
  property_name: string | null;
  check_in: string;
  check_out: string;
  nights: number;
  guests: number;
  guest_name: string | null;
  reference: string | null;
  channel: string;
  ota_name: string | null;
  currency: string;
  items: BuchungPosten[];
  gross: number;
  /** `null`, wenn für den Kanal dieser Buchung kein Provisionssatz hinterlegt
   *  ist und das Portal keinen Betrag gemeldet hat. */
  channel_commission: number | null;
  income: number | null;
};

export type BuchungsAufschluesselung = {
  report_id: string;
  currency: string;
  rows: BuchungZeile[];
  warnungen: string[];
  channels_without_commission: string[];
};

export type ReportInput = {
  name: string;
  currency: string;
  period_from: string;
  period_to: string;
  basis?: ReportBasis;
  reservation_statuses?: string[];
  property_ids: string[];
};

export type ReportUpdate = Partial<ReportInput>;

// -- Zahlung ----------------------------------------------------------------

export type PaymentItem = {
  id: string;
  abschnitt: Abschnitt;
  label: string;
  reservation_id: string | null;
  property_id: string | null;
  betrag: number;
  currency: string;
  position: number;
};

export type PaymentPart = {
  id: string;
  betrag: number;
  currency: string;
  bezahlt_am: string;
  notiz: string | null;
  created_at: string | null;
};

export type PaymentListItem = {
  id: string;
  report_id: string;
  report_name: string;
  owner_id: string;
  owner_name: string | null;
  betrag: number;
  currency: string;
  /** Summe der Teilzahlungen / Betrag × 100 — vom Server gerechnet. */
  bezahlt_pct: number;
  bezahlt_am: string | null;
  has_invoice: boolean;
  statement_id: string | null;
  created_at: string | null;
};

export type PaymentDetail = {
  id: string;
  tenant_id: string;
  report_id: string;
  report_name: string;
  period_from: string;
  period_to: string;
  owner_id: string;
  owner_name: string | null;
  owner_email: string | null;
  rechtliche_information: string | null;
  empfaenger_information: string | null;
  rechnungs_fusszeile: string | null;
  currency: string;
  summe_unterkunftspreis: number;
  summe_gebuehren: number;
  summe_steuern: number;
  summe_ausgaben: number;
  summe_andere: number;
  betrag: number;
  bezahlt_pct: number;
  bezahlt_am: string | null;
  notiz: string | null;
  statement_id: string | null;
  items: PaymentItem[];
  parts: PaymentPart[];
  created_at: string | null;
  updated_at: string | null;
};

// -- Empfänger + wiederkehrende Posten --------------------------------------

export type EmpfaengerZeile = {
  owner_id: string;
  name: string;
  email: string | null;
  payment_count: number;
  /** Je Währung getrennt — Beträge verschiedener Währungen werden nicht
   *  addiert. Eine Mischsumme wäre eine Zahl, die es nicht gibt. */
  payment_total: WaehrungsBetrag[];
  property_count: number;
  /** Ohne gültigen Abrechnungsvertrag ist keine Zahlung berechenbar. */
  hat_vertrag: boolean;
};

export type RecurringItem = {
  id: string;
  owner_id: string;
  label: string;
  abschnitt: Abschnitt;
  modus: RecurringModus;
  betrag: number;
  currency: string;
  property_id: string | null;
  aktiv: boolean;
  notiz: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type RecurringInput = {
  label: string;
  abschnitt: Abschnitt;
  modus: RecurringModus;
  betrag: number;
  currency: string;
  property_id?: string | null;
  aktiv?: boolean;
  notiz?: string | null;
};

export type RecurringUpdate = Partial<Omit<RecurringInput, "property_id">> & {
  property_id?: string | null;
  /** Ausdrücklich „gilt wieder für alle Objekte" — ohne dieses Flag wäre ein
   *  weggelassenes `property_id` nicht von „nicht ändern" zu unterscheiden. */
  fuer_alle_objekte?: boolean;
};

// -- Geplante Berichte ------------------------------------------------------

export type ScheduleListItem = {
  id: string;
  name: string;
  rhythmus: Rhythmus;
  currency: string;
  property_count: number;
  recipient_count: number;
  aktiv: boolean;
  zuletzt_erzeugt_fuer: string | null;
};

export type Schedule = {
  id: string;
  name: string;
  name_mit_datum: boolean;
  aktiv: boolean;
  rhythmus: Rhythmus;
  am_tag: AmTag;
  zeitraum: PlanZeitraum;
  currency: string;
  basis: ReportBasis;
  property_ids: string[];
  recipient_ids: string[];
  zuletzt_erzeugt_fuer: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ScheduleInput = {
  name: string;
  name_mit_datum?: boolean;
  aktiv?: boolean;
  rhythmus?: Rhythmus;
  am_tag?: AmTag;
  zeitraum?: PlanZeitraum;
  currency: string;
  basis?: ReportBasis;
  property_ids: string[];
  recipient_ids?: string[];
};

// -- Statistik --------------------------------------------------------------

export type StatPunkt = { period: string; amount: number };
export type StatKategorie = { abschnitt: Abschnitt; amount: number };

export type Statistik = {
  currency: string;
  total: number;
  /** `null` = die Vorperiode war 0. Als „—" rendern, nie als „+100 %". */
  change_pct: number | null;
  points: StatPunkt[];
  categories: StatKategorie[];
  other_currencies: WaehrungsBetrag[];
};

// ---------------------------------------------------------------------------

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: {
    method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
    body?: unknown;
  } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error =
      exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

const BASE = "/owner-reporting";

// -- Berichte ---------------------------------------------------------------

export async function listReports(): Promise<
  Result<{ items: ReportListItem[]; total: number }>
> {
  return call(`${BASE}/reports`);
}

export async function getReport(id: string): Promise<Result<ReportDetail>> {
  return call(`${BASE}/reports/${id}`);
}

export async function createReport(
  input: ReportInput,
): Promise<Result<ReportDetail>> {
  return call(`${BASE}/reports`, { method: "POST", body: input });
}

export async function updateReport(
  id: string,
  input: ReportUpdate,
): Promise<Result<ReportDetail>> {
  return call(`${BASE}/reports/${id}`, { method: "PATCH", body: input });
}

export async function deleteReport(id: string): Promise<Result<void>> {
  return call(`${BASE}/reports/${id}`, { method: "DELETE" });
}

export async function getReportBookings(
  id: string,
): Promise<Result<BuchungsAufschluesselung>> {
  return call(`${BASE}/reports/${id}/bookings`);
}

// -- Zahlungen --------------------------------------------------------------

export async function createPayment(
  reportId: string,
  ownerId: string,
): Promise<Result<PaymentDetail>> {
  return call(`${BASE}/reports/${reportId}/payments`, {
    method: "POST",
    body: { owner_id: ownerId },
  });
}

export async function listPayments(opts?: {
  nurOffene?: boolean;
  ownerId?: string;
}): Promise<Result<{ items: PaymentListItem[]; total: number }>> {
  const q = new URLSearchParams();
  if (opts?.nurOffene) q.set("nur_offene", "true");
  if (opts?.ownerId) q.set("owner_id", opts.ownerId);
  const suffix = q.toString() ? `?${q}` : "";
  return call(`${BASE}/payments${suffix}`);
}

export async function getPayment(id: string): Promise<Result<PaymentDetail>> {
  return call(`${BASE}/payments/${id}`);
}

export async function updatePayment(
  id: string,
  notiz: string | null,
): Promise<Result<PaymentDetail>> {
  return call(`${BASE}/payments/${id}`, { method: "PATCH", body: { notiz } });
}

/**
 * Als vollständig bezahlt markieren.
 *
 * Ohne `bezahltAm` nimmt der SERVER seinen Tag — nicht die Uhr des Browsers:
 * zwei Nutzer in verschiedenen Zeitzonen buchten denselben Vorgang sonst auf
 * zwei verschiedene Tage.
 */
export async function markPaymentPaid(
  id: string,
  bezahltAm?: string,
): Promise<Result<PaymentDetail>> {
  const suffix = bezahltAm ? `?bezahlt_am=${bezahltAm}` : "";
  return call(`${BASE}/payments/${id}/mark-paid${suffix}`, { method: "POST" });
}

export async function addPaymentPart(
  id: string,
  input: { betrag: number; bezahlt_am: string; notiz?: string | null },
): Promise<Result<PaymentDetail>> {
  return call(`${BASE}/payments/${id}/parts`, { method: "POST", body: input });
}

export async function deletePaymentPart(
  partId: string,
): Promise<Result<PaymentDetail>> {
  return call(`${BASE}/parts/${partId}`, { method: "DELETE" });
}

export async function deletePayment(id: string): Promise<Result<void>> {
  return call(`${BASE}/payments/${id}`, { method: "DELETE" });
}

// -- Empfänger --------------------------------------------------------------

export async function listRecipients(): Promise<
  Result<{ items: EmpfaengerZeile[]; total: number }>
> {
  return call(`${BASE}/recipients`);
}

export async function listRecurring(
  ownerId: string,
): Promise<Result<{ items: RecurringItem[] }>> {
  return call(`${BASE}/recipients/${ownerId}/recurring`);
}

export async function createRecurring(
  ownerId: string,
  input: RecurringInput,
): Promise<Result<RecurringItem>> {
  return call(`${BASE}/recipients/${ownerId}/recurring`, {
    method: "POST",
    body: input,
  });
}

export async function updateRecurring(
  id: string,
  input: RecurringUpdate,
): Promise<Result<RecurringItem>> {
  return call(`${BASE}/recurring/${id}`, { method: "PATCH", body: input });
}

export async function deleteRecurring(id: string): Promise<Result<void>> {
  return call(`${BASE}/recurring/${id}`, { method: "DELETE" });
}

// -- Geplante Berichte ------------------------------------------------------

export async function listSchedules(): Promise<
  Result<{ items: ScheduleListItem[] }>
> {
  return call(`${BASE}/schedules`);
}

export async function getSchedule(id: string): Promise<Result<Schedule>> {
  return call(`${BASE}/schedules/${id}`);
}

export async function createSchedule(
  input: ScheduleInput,
): Promise<Result<Schedule>> {
  return call(`${BASE}/schedules`, { method: "POST", body: input });
}

export async function updateSchedule(
  id: string,
  input: Partial<ScheduleInput>,
): Promise<Result<Schedule>> {
  return call(`${BASE}/schedules/${id}`, { method: "PATCH", body: input });
}

export async function deleteSchedule(id: string): Promise<Result<void>> {
  return call(`${BASE}/schedules/${id}`, { method: "DELETE" });
}

// -- Statistik --------------------------------------------------------------

export async function getStatistik(opts: {
  von: string;
  bis: string;
  currency?: string;
  ownerIds?: string[];
}): Promise<Result<Statistik>> {
  const q = new URLSearchParams({ von: opts.von, bis: opts.bis });
  if (opts.currency) q.set("currency", opts.currency);
  for (const id of opts.ownerIds ?? []) q.append("owner_id", id);
  return call(`${BASE}/statistics?${q}`);
}
