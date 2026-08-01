// Buchungen des eingeloggten Portal-Gastes (/api/v1/guest-bookings).
// Serverseitig auf guest_id gescopet — die App filtert NICHTS selbst.
// Contract: guest_bookings/schemas.py. Beträge sind nullable (maskiert/fehlend
// → null): die UI rendert dann „—", nie 0 (Wurzel 4).
import { guestCall, type Result } from "@/lib/guestApi";

export type BookingStatusFilter = "upcoming" | "past" | "cancelled";

export type BookingProperty = {
  id: string;
  title: string;
  photo: string | null;
  address: string | null;
  currency: string;
};

export type GuestBookingSummary = {
  id: string;
  property: BookingProperty;
  check_in: string;
  check_out: string;
  num_guests: number;
  status: string;
  payment_status: string | null;
  channel: string;
  total_amount: number | null;
  paid_amount: number | null;
  currency: string;
};

export type QuoteItem = { label?: string; amount?: number | null; quantity?: number | null };

export type GuestBookingDetail = GuestBookingSummary & {
  adults: number;
  children: number;
  balance_due: number | null;
  checkin_time: string | null;
  checkout_time: string | null;
  note: string | null;
  quote_items: QuoteItem[];
  checked_in_at: string | null;
  checked_out_at: string | null;
  cancelled_at: string | null;
  can_cancel: boolean;
};

export type TimelineEvent = {
  kind: string;
  created_at: string;
  detail: Record<string, unknown>;
};

export async function listGuestBookings(
  status: BookingStatusFilter,
): Promise<Result<{ items: GuestBookingSummary[]; total: number }>> {
  return guestCall(`/guest-bookings?status=${encodeURIComponent(status)}`);
}

export async function getGuestBooking(id: string): Promise<Result<GuestBookingDetail>> {
  return guestCall(`/guest-bookings/${encodeURIComponent(id)}`);
}

export async function getGuestBookingTimeline(
  id: string,
): Promise<Result<{ items: TimelineEvent[] }>> {
  return guestCall(`/guest-bookings/${encodeURIComponent(id)}/timeline`);
}

export async function cancelGuestBooking(
  id: string,
  reason: string,
): Promise<Result<{ id: string; status: string }>> {
  return guestCall(`/guest-bookings/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    body: { reason },
  });
}

// Deutsche Labels der Buchungsstatus (Spiegel der reservations-Status).
const STATUS_LABEL: Record<string, string> = {
  requested: "Angefragt",
  confirmed: "Bestätigt",
  checked_in: "Eingecheckt",
  checked_out: "Abgereist",
  cancelled: "Storniert",
  no_show: "Nicht erschienen",
};

export function bookingStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}
