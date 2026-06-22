"use server";

// Posteingang: Server-Actions gegen den FastAPI-inbox-Slice (/api/v1/inbox).
// Threads werden aus importierten OTA-Buchungen abgeleitet (Portal, Gast,
// Reservierungsbezug). Business-Logik im Backend.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type InboxThread = {
  id: string;
  ota_name: string | null;
  ota_reservation_code: string | null;
  guest_name: string | null;
  guest_email: string | null;
  status: string | null;
  arrival_date: string | null;
  departure_date: string | null;
  updated_at: string | null;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** OTA-Gäste-Threads des aktuellen Tenants. */
export async function listInboxThreads(): Promise<
  Result<{ items: InboxThread[]; total: number }>
> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<{ items: InboxThread[]; total: number }>("/inbox", {
      token,
    });
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Laden fehlgeschlagen.",
    };
  }
}
