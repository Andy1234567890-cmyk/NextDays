// Data-Layer Plattform-Posteingang (Betrieb-Seite) über den DAL. Das ist der Chat
// der EIGENEN Plattform (/plattform, guest_message_threads/guest_messages) —
// NICHT der Channel-Manager/OTA-inbox. Backend: host_messages-Slice.
import { api, ApiError } from "./api-server";

export interface HostThreadSummary {
  id: string;
  portal_guest_id: string;
  guest_name: string | null;
  guest_email: string | null;
  property_id: string | null;
  property_title: string | null;
  reservation_id: string | null;
  check_in: string | null;
  check_out: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  is_archived: boolean;
  is_blocked: boolean;
  created_at: string | null;
}

export interface HostMessage {
  id: string;
  sender: "guest" | "host";
  body: string;
  created_at: string | null;
}

export interface HostThreadDetail {
  id: string;
  portal_guest_id: string;
  guest_name: string | null;
  guest_email: string | null;
  property_id: string | null;
  property_title: string | null;
  reservation_id: string | null;
  is_archived: boolean;
  is_blocked: boolean;
  messages: HostMessage[];
}

export interface HostReservationDetail {
  property_id: string | null;
  property_title: string | null;
  property_photos: string[];
  city: string | null;
  country: string | null;
  guest_name: string | null;
  check_in: string | null;
  check_out: string | null;
  nights: number | null;
  num_guests: number | null;
  status: string | null;
  total_amount: number | null;
  paid_amount: number | null;
  currency: string | null;
  payment_status: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
}

export interface QuickReply {
  id: string;
  title: string;
  body: string;
  property_ids: string[];
}

type ThreadFilter = { unread?: boolean; archived?: boolean; q?: string };

/** Threads des Betriebs (oder null bei fehlendem Zugriff/Rolle). */
export async function getThreads(
  filter: ThreadFilter = {},
): Promise<HostThreadSummary[] | null> {
  const qs = new URLSearchParams();
  if (filter.unread) qs.set("unread", "true");
  if (filter.archived) qs.set("archived", "true");
  if (filter.q) qs.set("q", filter.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  try {
    const res = await api<{ threads: HostThreadSummary[] }>(
      `/host-messages${suffix}`,
    );
    return res.threads;
  } catch (exc) {
    if (exc instanceof ApiError) return null;
    throw exc;
  }
}

/** Ein Thread mit Nachrichten (markiert ihn als gelesen). */
export async function getThreadDetail(
  threadId: string,
): Promise<HostThreadDetail | null> {
  try {
    return await api<HostThreadDetail>(`/host-messages/${threadId}`);
  } catch (exc) {
    if (exc instanceof ApiError) return null;
    throw exc;
  }
}

/** Reservierungs-/Objektdetails für die rechte Spalte. */
export async function getReservationDetail(
  threadId: string,
): Promise<HostReservationDetail | null> {
  try {
    return await api<HostReservationDetail>(
      `/host-messages/${threadId}/reservation`,
    );
  } catch (exc) {
    if (exc instanceof ApiError) return null;
    throw exc;
  }
}

/** Quick Replies (Vorlagen) des Betriebs. */
export async function getQuickReplies(): Promise<QuickReply[] | null> {
  try {
    const res = await api<{ items: QuickReply[] }>("/host-messages/quick-replies");
    return res.items;
  } catch (exc) {
    if (exc instanceof ApiError) return null;
    throw exc;
  }
}
