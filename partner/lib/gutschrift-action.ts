"use server";

// Eigene Gutschrift als Text laden. Der Server scopet auf (payout_id,
// affiliate_id) — eine fremde ID ist ein 404, nie ein fremdes Dokument.
import { readToken } from "@nextdays/auth/server";

import { PARTNER_COOKIES } from "./api-server";

export async function gutschriftLesen(payoutId: string): Promise<{ ok: true; data: string } | { ok: false }> {
  const token = await readToken(PARTNER_COOKIES.access);
  if (!token) return { ok: false };
  const basis = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${basis}/api/v1/affiliates/payouts/${encodeURIComponent(payoutId)}/statement`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false };
    return { ok: true, data: await res.text() };
  } catch {
    return { ok: false };
  }
}
