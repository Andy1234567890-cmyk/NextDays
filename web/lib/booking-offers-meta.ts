// Typen und Wertelisten der Buchungsangebote (0586).
//
// WARUM EIGENE DATEI: `booking-offers.ts` trägt "use server" und darf
// ausschließlich async functions exportieren. Ein `export type` ist zwar
// zur Laufzeit nichts, aber ein `export const` (die Zustandsliste, die Farben)
// bricht die Seite erst in „Collecting page data" — deshalb liegen beide
// zusammen hier, in der Nachbardatei ohne Direktive.

/** Zustände eines Angebots — spiegelt `booking_offers.status` (0586) und
 *  `booking_offers/common.py:OFFER_STATUSES`. Ein neuer Backend-Wert MUSS hier
 *  und in `angebote.status.*` aller Sprachdateien landen, sonst rendert die
 *  Liste MISSING_MESSAGE. */
export const OFFER_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "paid",
  "declined",
  "expired",
  "cancelled",
] as const;

export type OfferStatus = (typeof OFFER_STATUSES)[number];

/** Zustände, in denen der Gast noch zusagen kann (Spiegel von `ANNEHMBAR`). */
export const OFFEN_STATUSES: readonly OfferStatus[] = ["sent", "viewed"];

/** Darstellung je Zustand. `ton` wählt die Badge-Variante der UI — die Farben
 *  selbst kommen aus dem Design-System, hier steht nur die Bedeutung. */
export const STATUS_TON: Record<OfferStatus, "neutral" | "offen" | "gut" | "aus"> = {
  draft: "neutral",
  sent: "offen",
  viewed: "offen",
  accepted: "offen",
  paid: "gut",
  declined: "aus",
  expired: "aus",
  cancelled: "aus",
};

export type OfferQuoteLine = {
  label: string;
  amount: number;
  kind?: string | null;
};

export type BookingOffer = {
  id: string;
  property_id: string;
  property_title?: string | null;
  unit_id?: string | null;
  check_in: string;
  check_out: string;
  nights: number;
  adults: number;
  children: number;
  pets: number;
  guest_name: string;
  guest_email: string;
  guest_phone?: string | null;
  language?: string | null;
  currency: string;
  total_amount: number;
  deposit_amount?: number | null;
  lines: OfferQuoteLine[];
  expires_at: string;
  status: OfferStatus;
  sent_at?: string | null;
  viewed_at?: string | null;
  accepted_at?: string | null;
  declined_at?: string | null;
  reservation_id?: string | null;
  internal_note?: string | null;
  created_at: string;
  updated_at: string;
};

export type BookingOfferList = {
  items: BookingOffer[];
  total: number;
};

export type BookingOfferCreate = {
  property_id: string;
  unit_id?: string | null;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  pets: number;
  guest_name: string;
  guest_email: string;
  guest_phone?: string | null;
  language?: string | null;
  gueltig_tage: number;
  deposit_amount?: number | null;
  internal_note?: string | null;
  rate_plan_id?: string | null;
};
