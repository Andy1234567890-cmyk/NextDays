// Domänen-Modul "Inserate" — Backend-Anbindung nach NextDays-Muster
// (wie apps/web/lib/<domäne>.ts: ruft den eigenen Origin-Proxy /api/v1/...,
// der server-seitig das Supabase-Token injiziert und an FastAPI weiterleitet).
//
// Stack: FastAPI (apps/api, Slice "plattform") + Supabase (Auth + Postgres, RLS).
// Aktuell entkoppelt → ohne gesetztes NEXT_PUBLIC_API_URL werden Platzhalter
// aus lib/listings.ts geliefert. Anbindung später: Backend-Slice + Migration
// bauen, NEXT_PUBLIC_API_URL setzen — dieser Code ruft dann automatisch FastAPI.
import type { Listing, Reihe } from "./listings";
import { LISTINGS, REIHEN, getListing } from "./listings";

const BACKEND_AKTIV = (process.env.NEXT_PUBLIC_API_URL ?? "").length > 0;

// Ruft den eigenen Origin-Proxy (app/api/v1/[...path]/route.ts), analog zum
// api-client in apps/web. Der Proxy injiziert das Supabase-Session-Token.
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api/v1/plattform/${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Backend ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export async function ladeReihen(): Promise<Reihe[]> {
  if (!BACKEND_AKTIV) return REIHEN; // Platzhalter bis Backend-Anbindung
  return get<Reihe[]>("reihen");
}

export async function ladeInserate(): Promise<Listing[]> {
  if (!BACKEND_AKTIV) return LISTINGS;
  return get<Listing[]>("inserate");
}

export async function ladeInserat(id: string): Promise<Listing | undefined> {
  if (!BACKEND_AKTIV) return getListing(id);
  return get<Listing>(`inserate/${id}`);
}
