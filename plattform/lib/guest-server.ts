"use server";

// Serverseitige Gast-Loader (Server Components). Sprechen FastAPI direkt mit dem
// nd_access-Cookie als Bearer an (nicht über den Same-Origin-Proxy, der in
// Server-Components keinen absoluten Origin kennt) — analog zu lib/auth.getMe.
import { cookies } from "next/headers";

import type { GuestMe } from "./guest-auth";
import type { BookingListItem } from "./guest-bookings";
import type { MessageThread } from "./guest-messages";
import type { MyReview } from "./guest-reviews";
import type { WishlistSummary } from "./guest-wishlist";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const ACCESS = "nd_access";

async function backendGet<T>(path: string): Promise<T | null> {
  const jar = await cookies();
  const token = jar.get(ACCESS)?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND}/api/v1${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Profil des eingeloggten Gastes (Server Component). */
export async function serverGuestMe(): Promise<GuestMe | null> {
  return backendGet<GuestMe>("/guest-auth/me");
}

/** Summe ungelesener Nachrichten über alle Threads (für das Nav-Badge). */
export async function serverUnreadCount(): Promise<number> {
  const data = await backendGet<{ threads: MessageThread[] }>(
    "/guest-messages/threads",
  );
  if (!data?.threads) return 0;
  return data.threads.reduce((sum, t) => sum + (t.unread_count || 0), 0);
}

/** Buchungen eines Filters (Server Component, z. B. für die Konto-Übersicht). */
export async function serverBookings(
  status: "upcoming" | "past" | "cancelled",
): Promise<BookingListItem[]> {
  const data = await backendGet<{ items: BookingListItem[]; total: number }>(
    `/guest-bookings?status=${status}`,
  );
  return data?.items ?? [];
}

/** Alle Nachrichten-Threads des Gastes (Server Component). */
export async function serverThreads(): Promise<MessageThread[]> {
  const data = await backendGet<{ threads: MessageThread[] }>(
    "/guest-messages/threads",
  );
  return data?.threads ?? [];
}

async function backendPost<T>(
  path: string,
  body: unknown,
): Promise<T | null> {
  const jar = await cookies();
  const token = jar.get(ACCESS)?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND}/api/v1${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Für eine Reservierung den passenden Thread finden oder anlegen (idempotent
 *  über den Backend-POST). Gibt die Thread-ID oder null. */
export async function serverEnsureThread(
  reservationId: string,
): Promise<string | null> {
  const t = await backendPost<MessageThread>("/guest-messages/threads", {
    reservation_id: reservationId,
  });
  return t?.id ?? null;
}

/** Merklisten des Gastes (Server Component). */
export async function serverWishlists(): Promise<WishlistSummary[]> {
  const data = await backendGet<{ items: WishlistSummary[]; total: number }>(
    "/guest-wishlist",
  );
  return data?.items ?? [];
}

/** Eigene Bewertungen des Gastes (Server Component). */
export async function serverMyReviews(): Promise<MyReview[]> {
  const data = await backendGet<{ reviews: MyReview[] }>("/guest-reviews/mine");
  return data?.reviews ?? [];
}
