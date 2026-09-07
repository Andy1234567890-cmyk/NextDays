// Auszahlungen an den Betrieb (Booking-Modell).
//
// Die Plattform hält das Geld bis zur ABREISE — nicht bis zum Zahlungseingang.
// Ein Storno vor der Auszahlung fließt gar nicht erst; einer danach wird als
// Verrechnungsposten von der nächsten Auszahlung einbehalten.
import { api, ApiError } from "./api-server";

export type PayoutInterval = "daily" | "weekly" | "monthly";

export type PayoutStatus =
  | "scheduled"
  | "due"
  | "held"
  | "paid"
  | "withheld"
  | "failed";

export interface AuszahlungsEinstellung {
  interval: PayoutInterval;
  paused: boolean;
  paused_reason: string | null;
  /**
   * Prüffrist in Tagen nach der Abreise, bevor die Auszahlung fällig wird
   * (Backend 0411). Setzt die Plattform, nicht der Betrieb — deshalb nur
   * lesend: `setzeAuszahlungsRhythmus` schickt sie bewusst nicht mit.
   *
   * Wird im Tab als `azKarenzHinweis` angezeigt; die Rhythmus-Hinweise
   * beziehen sich deshalb auf die FREIGABE (Ende der Frist), nicht auf die
   * Abreise. Vorher stand dort "Einen Tag nach der Abreise", während der
   * Verlauf daneben das `due_at` mit Frist zeigte — vier Tage später.
   */
  karenz_tage: number;
}

export interface AuszahlungsZeile {
  id: string;
  reservation_id: string;
  gross_amount_cents: number;
  platform_fee_cents: number;
  donation_cents: number;
  cohost_cents: number;
  net_amount_cents: number;
  currency: string;
  status: PayoutStatus;
  due_at: string;
  paid_at: string | null;
  /** Buchung dahinter — damit die Zeile ohne UUID-Vergleich zuzuordnen ist.
   *  Leer, wenn die Buchung nicht (mehr) gefunden wird (nichts erfunden). */
  property_title: string | null;
  guest_name: string | null;
  check_in: string | null;
  check_out: string | null;
  channel: string | null;
  ota_name: string | null;
  /**
   * Wie die Zahlung geflossen ist. `destination` = der Betrag ging beim
   * Kassieren direkt auf das Verbundkonto des Betriebs; eine solche Zeile wird
   * NIE ausgezahlt (der Lauf filtert auf `separate`) und ihr `due_at` tritt
   * nie ein. Die Oberfläche zeigt dafür „direkt ausgezahlt" statt „geplant".
   */
  charge_modell: "separate" | "destination" | null;
}

/** Ein Verrechnungsposten — wird von der nächsten Auszahlung einbehalten. */
export interface Verrechnungsposten {
  id: string;
  reservation_id: string | null;
  kind: "refund" | "chargeback" | "cancellation_fee" | "correction";
  amount_cents: number;
  settled_cents: number;
  currency: string;
  note: string | null;
  created_at: string;
}

export interface AuszahlungsSumme {
  currency: string;
  pending_amount_cents: number;
  paid_amount_cents: number;
  count: number;
}

export interface AuszahlungsUebersicht {
  settings: AuszahlungsEinstellung;
  summary: AuszahlungsSumme[];
  recent: AuszahlungsZeile[];
  adjustments: Verrechnungsposten[];
}

/**
 * Alles für die Auszahlungsansicht in einem Aufruf.
 *
 * Wirft nicht: Ein Ladefehler darf den Zahlungsbereich nicht blockieren — der
 * Reiter zeigt dann einen Hinweis statt die Seite scheitern zu lassen.
 */
export async function getAuszahlungsUebersicht(): Promise<AuszahlungsUebersicht | null> {
  try {
    return await api<AuszahlungsUebersicht>("/payouts", { cache: "no-store" });
  } catch {
    return null;
  }
}

// --- Guthaben auf dem verbundenen Stripe-Konto ------------------------------

export interface StripeSaldoPosten {
  currency: string;
  amount_cents: number;
}

export interface StripeAuszahlung {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  /** true = von Stripe nach Rhythmus ausgelöst, false = vom Betrieb beantragt. */
  automatic: boolean;
  created: string | null;
  arrival_date: string | null;
  failure_message: string | null;
}

/**
 * Was auf dem Stripe-Konto des Gastgebers liegt: verfügbar, ausstehend
 * (Abwicklungsfrist), zurückgehalten (Sicherheitseinlage) und die letzten
 * Überweisungen auf die Bank. Zweiter Topf neben dem Plattform-Ledger
 * (`AuszahlungsUebersicht`): dort steht, was myBestDays je Buchung noch
 * verwahrt; hier, was davon schon beim Gastgeber angekommen ist.
 */
export interface StripeGuthaben {
  konto_verbunden: boolean;
  stripe_account_id: string | null;
  payouts_enabled: boolean;
  interval: string;
  verfuegbar: StripeSaldoPosten[];
  ausstehend: StripeSaldoPosten[];
  einlage: StripeSaldoPosten[];
  auszahlbar: StripeSaldoPosten[];
  einlage_frei_ab: string | null;
  letzte_auszahlungen: StripeAuszahlung[];
}

export type GuthabenErgebnis =
  | { ok: true; data: StripeGuthaben }
  | { ok: false; fehler: string };

/**
 * Stripe-Guthaben. Ein Abruffehler kommt als Text zurück, nicht als „0" —
 * ein leerer Saldo wäre eine Falschaussage über das Geld des Gastgebers
 * (Wurzel 4/5).
 */
export async function getStripeGuthaben(): Promise<GuthabenErgebnis> {
  try {
    const data = await api<StripeGuthaben>("/payouts/guthaben", { cache: "no-store" });
    return { ok: true, data };
  } catch (exc) {
    if (exc instanceof ApiError) return { ok: false, fehler: exc.message };
    throw exc;
  }
}
