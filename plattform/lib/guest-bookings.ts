// Buchungen des eingeloggten Gastes (/api/v1/guest-bookings, auth via Cookie).
// Der Gast sieht ausschließlich seine eigenen Buchungen (serverseitig gescopt).
import { guestCall, type Result } from "./guest-api";

export type BookingStatusFilter = "upcoming" | "past" | "cancelled";

// channel: interner Vertriebskanal — "platform" = eigener Marktplatz, sonst OTA
// (booking/airbnb/expedia …). Wird in der UI klar als solcher gelabelt.
export type BookingChannel = string;

export type BookingListItem = {
  id: string;
  property: {
    id: string;
    title: string;
    photo: string | null;
    address: string | null;
    currency: string | null;
  };
  check_in: string;
  check_out: string;
  num_guests: number;
  status: string;
  payment_status: string;
  channel: BookingChannel;
  total_amount: number | null;
  paid_amount: number | null;
  currency: string | null;
};

export type QuoteItem = {
  label: string;
  amount: number | null;
  quantity?: number | null;
};

export type BookingDetail = BookingListItem & {
  adults: number | null;
  children: number | null;
  balance_due: number | null;
  checkin_time: string | null;
  checkout_time: string | null;
  note: string | null;
  quote_items: QuoteItem[];
  checked_in_at: string | null;
  cancelled_at: string | null;
  can_cancel: boolean;
};

export type TimelineItem = {
  kind: string;
  created_at: string;
  detail: string | null;
};

export async function ladeBuchungen(
  status: BookingStatusFilter,
): Promise<Result<{ items: BookingListItem[]; total: number }>> {
  const qs = new URLSearchParams({ status });
  return guestCall(`guest-bookings?${qs.toString()}`);
}

export async function ladeBuchung(
  id: string,
): Promise<Result<BookingDetail>> {
  return guestCall(`guest-bookings/${encodeURIComponent(id)}`);
}

export async function ladeTimeline(
  id: string,
): Promise<Result<{ items: TimelineItem[] }>> {
  return guestCall(`guest-bookings/${encodeURIComponent(id)}/timeline`);
}

export async function storniereBuchung(
  id: string,
  reason: string,
): Promise<Result<{ id: string; status: string }>> {
  return guestCall(`guest-bookings/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    body: { reason },
  });
}
