"use server";

// Schreib-Actions des Partnerprogramms. Die Berechtigung prüft ausschließlich
// der Server (require_platform_write in FastAPI) — die UI blendet Aktionen für
// platform_support nur zusätzlich aus.
import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type {
  AblehnungsGrund,
  Auszahlung,
  Lead,
  LeadKategorie,
  LeadStatus,
  Material,
  Partner,
  Provision,
  Referral,
  VideoBeitrag,
} from "./partner";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; fehler: string };

async function call<T>(
  pfad: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
  fehlertext = "Aktion fehlgeschlagen.",
): Promise<Ergebnis<T>> {
  try {
    const data = await api<T>(pfad, { ...opts, cache: "no-store" });
    return { ok: true, data };
  } catch (exc) {
    return { ok: false, fehler: exc instanceof ApiError ? exc.message : fehlertext };
  }
}

function frisch(id?: string): void {
  revalidatePath("/partner");
  if (id) revalidatePath(`/partner/${id}`);
}

export async function partnerEntscheiden(
  id: string,
  decision: "approve" | "reject",
  reason: string,
): Promise<Ergebnis<Partner>> {
  const res = await call<Partner>(`/platform/affiliates/${id}/decision`, {
    method: "POST",
    body: { decision, reason: reason.trim() || null },
  });
  frisch(id);
  return res;
}

export async function partnerSperren(id: string, reason: string): Promise<Ergebnis<Partner>> {
  const res = await call<Partner>(`/platform/affiliates/${id}/suspend`, {
    method: "POST",
    body: { reason },
  });
  frisch(id);
  return res;
}

export async function partnerEntsperren(id: string): Promise<Ergebnis<Partner>> {
  const res = await call<Partner>(`/platform/affiliates/${id}/reactivate`, { method: "POST" });
  frisch(id);
  return res;
}

export async function referralStatusSetzen(
  affiliateId: string,
  referralId: string,
  status: "approved" | "held" | "rejected",
  note: string,
): Promise<Ergebnis<Referral>> {
  const res = await call<Referral>(`/platform/affiliates/referrals/${referralId}/status`, {
    method: "POST",
    body: { status, note },
  });
  frisch(affiliateId);
  return res;
}

export async function referralManuell(
  affiliateId: string,
  tenantId: string,
  note: string,
): Promise<Ergebnis<Referral>> {
  const res = await call<Referral>(`/platform/affiliates/referrals/manual`, {
    method: "POST",
    body: { affiliate_id: affiliateId, tenant_id: tenantId, note },
  });
  frisch(affiliateId);
  return res;
}

export async function korrekturBuchen(
  affiliateId: string,
  amount: string,
  currency: string,
  reason: string,
): Promise<Ergebnis<Provision>> {
  const res = await call<Provision>(`/platform/affiliates/${affiliateId}/adjustments`, {
    method: "POST",
    body: { amount, currency: currency.toUpperCase(), reason },
  });
  frisch(affiliateId);
  return res;
}

export async function rangSetzen(
  affiliateId: string,
  tierId: string,
  note: string,
): Promise<Ergebnis<Partner>> {
  const res = await call<Partner>(`/platform/affiliates/${affiliateId}/tier`, {
    method: "POST",
    body: { tier_id: tierId, note },
  });
  frisch(affiliateId);
  return res;
}

// --- Auszahlungen ------------------------------------------------------------

export async function auszahlungslaufStarten(): Promise<Ergebnis<Record<string, number>>> {
  const res = await call<Record<string, number>>(`/platform/affiliates/payouts/run`, {
    method: "POST",
  });
  revalidatePath("/partner/auszahlungen");
  return res;
}

export async function auszahlungBezahlt(
  payoutId: string,
  externalRef: string,
): Promise<Ergebnis<Auszahlung>> {
  const res = await call<Auszahlung>(`/platform/affiliates/payouts/${payoutId}/paid`, {
    method: "POST",
    body: { external_ref: externalRef },
  });
  revalidatePath("/partner/auszahlungen");
  return res;
}

export async function auszahlungFehlgeschlagen(
  payoutId: string,
  reason: string,
): Promise<Ergebnis<Auszahlung>> {
  const res = await call<Auszahlung>(`/platform/affiliates/payouts/${payoutId}/failed`, {
    method: "POST",
    body: { reason },
  });
  revalidatePath("/partner/auszahlungen");
  return res;
}

/** CSV-Export als Text — der Browser bekommt ihn als Download über die Seite. */
export async function auszahlungenExport(
  format: "wise" | "sepa" | "paypal",
  ids: string[],
): Promise<Ergebnis<string>> {
  try {
    const { readToken } = await import("@nextdays/auth/server");
    const { ADMIN_COOKIES } = await import("./api-server");
    const token = await readToken(ADMIN_COOKIES.access);
    const basis = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const res = await fetch(
      `${basis}/api/v1/platform/affiliates/payouts/export?format=${format}&ids=${encodeURIComponent(ids.join(","))}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" },
    );
    if (!res.ok) return { ok: false, fehler: `Export fehlgeschlagen (${res.status}).` };
    revalidatePath("/partner/auszahlungen");
    return { ok: true, data: await res.text() };
  } catch {
    return { ok: false, fehler: "Backend nicht erreichbar." };
  }
}

export async function gutschriftLesen(payoutId: string): Promise<Ergebnis<string>> {
  try {
    const { readToken } = await import("@nextdays/auth/server");
    const { ADMIN_COOKIES } = await import("./api-server");
    const token = await readToken(ADMIN_COOKIES.access);
    const basis = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${basis}/api/v1/platform/affiliates/payouts/${payoutId}/statement`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, fehler: `Gutschrift nicht abrufbar (${res.status}).` };
    return { ok: true, data: await res.text() };
  } catch {
    return { ok: false, fehler: "Backend nicht erreichbar." };
  }
}

// --- Werbematerial ------------------------------------------------------------

export type MaterialEingabe = {
  kind: Material["kind"];
  title: string;
  description: string | null;
  language: string | null;
  url: string | null;
  body: string | null;
  sort: number;
  active: boolean;
};

export async function materialAnlegen(eingabe: MaterialEingabe): Promise<Ergebnis<Material>> {
  const res = await call<Material>("/platform/affiliates/assets", { method: "POST", body: eingabe });
  if (res.ok) revalidatePath("/partner/material");
  return res;
}

export async function materialAendern(
  id: string,
  aenderung: Partial<MaterialEingabe>,
): Promise<Ergebnis<Material>> {
  const res = await call<Material>(`/platform/affiliates/assets/${id}`, {
    method: "PATCH",
    body: aenderung,
  });
  if (res.ok) revalidatePath("/partner/material");
  return res;
}

export async function materialLoeschen(id: string): Promise<Ergebnis<null>> {
  const res = await call<null>(`/platform/affiliates/assets/${id}`, { method: "DELETE" });
  if (res.ok) revalidatePath("/partner/material");
  return res;
}

// --- Team (0520) --------------------------------------------------------------

export async function sponsorSetzen(
  id: string,
  sponsorAffiliateId: string | null,
  note: string,
  clearFlags = false,
): Promise<Ergebnis<Partner>> {
  const res = await call<Partner>(`/platform/affiliates/${id}/sponsor`, {
    method: "POST",
    body: { sponsor_affiliate_id: sponsorAffiliateId, note: note.trim(), clear_flags: clearFlags },
  });
  if (res.ok) frisch(id);
  return res;
}

/** Video freigeben oder ablehnen (0523).
 *
 * Freigabe → der Partnerlink entsteht. Ablehnung nach einer Freigabe ist ein
 * WIDERRUF: der Link ist sofort tot, die bereits verdiente Provision bleibt. */
export async function videoEntscheiden(
  postId: string,
  frei: boolean,
  note: string | null,
  reasonCode: AblehnungsGrund | null = null,
): Promise<Ergebnis<VideoBeitrag>> {
  const res = await call<VideoBeitrag>(
    `/platform/affiliates/videos/${postId}/decision`,
    { method: "POST", body: { frei, note, reason_code: reasonCode } },
    "Entscheidung fehlgeschlagen.",
  );
  revalidatePath("/partner/videos");
  return res;
}

// --- Leads (0526) -------------------------------------------------------------
export interface LeadEingabe {
  name: string;
  organisation: string | null;
  category: LeadKategorie;
  channels: { platform: string; url: string; handle: string | null; followers: number | null }[];
  reach: number | null;
  country: string | null;
  language: string | null;
  status: LeadStatus;
  next_step: string | null;
  next_step_at: string | null;
  notes: string | null;
  affiliate_id?: string | null;
}

export async function leadAnlegen(eingabe: LeadEingabe): Promise<Ergebnis<Lead>> {
  const res = await call<Lead>("/platform/affiliates/leads", { method: "POST", body: eingabe });
  revalidatePath("/partner/leads");
  return res;
}

export async function leadAendern(id: string, eingabe: Partial<LeadEingabe>): Promise<Ergebnis<Lead>> {
  const res = await call<Lead>(`/platform/affiliates/leads/${id}`, { method: "PATCH", body: eingabe });
  revalidatePath("/partner/leads");
  return res;
}

export async function leadLoeschen(id: string): Promise<Ergebnis<null>> {
  const res = await call<null>(`/platform/affiliates/leads/${id}`, { method: "DELETE" });
  revalidatePath("/partner/leads");
  return res;
}

export async function leadsImportieren(
  csv: string,
): Promise<Ergebnis<{ angelegt: number; fehler: string[] }>> {
  const res = await call<{ angelegt: number; fehler: string[] }>("/platform/affiliates/leads/import", {
    method: "POST",
    body: { csv },
  });
  revalidatePath("/partner/leads");
  return res;
}
