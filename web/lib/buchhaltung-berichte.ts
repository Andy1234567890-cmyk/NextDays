"use server";

// Buchhaltung → Berichte: Server-Actions gegen /api/v1/buchhaltung/reports/*.
// Nur Lesen. Zeitraum ist Pflicht und wird serverseitig geprüft (≤ 366 Tage,
// sonst 422) — hier wird nichts gerechnet, nur geholt.
//
// Ein "use server"-Modul darf AUSSCHLIESSLICH async functions exportieren;
// Typen und der Zeitraum-Helfer stehen deshalb in buchhaltung-berichte-typen.ts.
import { ApiError, api } from "@/lib/api";
import type {
  Aufschluesselung,
  BerichtResult,
  BwaResponse,
  Gruppierung,
  GuvResponse,
  OpenItemsResponse,
  OverviewResponse,
  RevenueResponse,
  SusaResponse,
} from "@/lib/buchhaltung-berichte-typen";
import { currentToken } from "@/lib/session-token";

async function call<T>(path: string): Promise<BerichtResult<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(`/buchhaltung/reports${path}`, { token });
    return { ok: true, data };
  } catch (exc) {
    const error = exc instanceof ApiError ? exc.message : "Bericht konnte nicht geladen werden.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

function zeitraumQuery(from: string, to: string): URLSearchParams {
  return new URLSearchParams({ from, to });
}

export async function getBerichtOverview(
  from: string,
  to: string,
): Promise<BerichtResult<OverviewResponse>> {
  return call(`/overview?${zeitraumQuery(from, to)}`);
}

export async function getBerichtRevenue(
  from: string,
  to: string,
  group: Gruppierung,
  by: Aufschluesselung | null,
): Promise<BerichtResult<RevenueResponse>> {
  const q = zeitraumQuery(from, to);
  q.set("group", group);
  if (by) q.set("by", by);
  return call(`/revenue?${q}`);
}

export async function getBerichtBwa(from: string, to: string): Promise<BerichtResult<BwaResponse>> {
  return call(`/bwa?${zeitraumQuery(from, to)}`);
}

export async function getBerichtSusa(
  from: string,
  to: string,
): Promise<BerichtResult<SusaResponse>> {
  return call(`/susa?${zeitraumQuery(from, to)}`);
}

export async function getBerichtGuv(year: number): Promise<BerichtResult<GuvResponse>> {
  return call(`/guv?${new URLSearchParams({ year: String(year) })}`);
}

export async function getOffenePosten(): Promise<BerichtResult<OpenItemsResponse>> {
  return call("/open-items");
}
