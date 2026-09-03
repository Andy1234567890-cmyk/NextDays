"use server";

// Schreib-Actions des Partners: Profil, Steuer-/Auszahlungsdaten (mit
// Passwort-Rückfrage), Codes. Alle auf die eigene affiliate_id gescopet — der
// Server kennt keine fremde ID im Pfad.
import type { SocialKanal } from "./kanaele";
import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { Code, ConnectStand, Profil, TeamNachricht, TeamThread } from "./partner";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; fehler: string; status?: number };

async function call<T>(pfad: string, opts: { method: "POST" | "PATCH" | "PUT"; body: unknown }): Promise<Ergebnis<T>> {
  try {
    return { ok: true, data: await api<T>(pfad, opts) };
  } catch (exc) {
    if (exc instanceof ApiError) return { ok: false, fehler: exc.message, status: exc.status };
    return { ok: false, fehler: "service_unavailable", status: 503 };
  }
}

export async function profilAendern(daten: {
  full_name?: string;
  company?: string | null;
  language?: string;
  channels?: SocialKanal[];
}): Promise<Ergebnis<Profil>> {
  const res = await call<Profil>("/affiliates/me", { method: "PATCH", body: daten });
  revalidatePath("/profil");
  return res;
}

export async function steuerdatenSetzen(daten: {
  password: string;
  legal_form: "company" | "private";
  country: string;
  vat_id: string | null;
}): Promise<Ergebnis<Profil>> {
  const res = await call<Profil>("/affiliates/me/tax", { method: "PUT", body: daten });
  revalidatePath("/profil");
  return res;
}

export async function codeAnlegen(label: string | null, code: string | null): Promise<Ergebnis<Code>> {
  const res = await call<Code>("/affiliates/codes", { method: "POST", body: { label, code } });
  revalidatePath("/links");
  revalidatePath("/");
  return res;
}

// --- Team-Chat (0520) ---------------------------------------------------------

export async function teamThreadStarten(partnerId: string): Promise<Ergebnis<TeamThread>> {
  const res = await call<TeamThread>("/affiliates/team/threads", {
    method: "POST",
    body: { partner_id: partnerId },
  });
  revalidatePath("/team");
  return res;
}

export async function teamNachrichtSenden(threadId: string, body: string): Promise<Ergebnis<TeamNachricht>> {
  const res = await call<TeamNachricht>(`/affiliates/team/threads/${threadId}/messages`, {
    method: "POST",
    body: { body },
  });
  revalidatePath(`/team/${threadId}`);
  return res;
}

/** Neue Version der Partner-AGB annehmen (Version + Zeitstempel am Datensatz). */
export async function bedingungenAnnehmen(version: string): Promise<Ergebnis<Profil>> {
  const res = await call<Profil>("/affiliates/me/terms", { method: "POST", body: { terms_version: version } });
  revalidatePath("/", "layout");
  return res;
}

// --- Verbundkonto (Stripe Connect, 0522) -------------------------------------
// Einziger Auszahlungsweg. Der Server kennt keine fremde ID im Pfad — alles
// läuft über /affiliates/me/*, also immer das eigene Konto.

export async function connectAnlegen(): Promise<Ergebnis<ConnectStand>> {
  const res = await call<ConnectStand>("/affiliates/me/connect", { method: "POST", body: {} });
  revalidatePath("/profil");
  return res;
}

export async function connectDatenSenden(daten: {
  url: string;
  person: {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    dob: { day: number; month: number; year: number };
    address: { line1: string; line2?: string; postal_code: string; city: string; state?: string };
    nationality?: string;
    id_number?: string;
    title?: string;
  };
  company_name?: string;
  company_tax_id?: string;
  company_registration_number?: string;
  company_vat_id?: string;
  company_address?: { line1: string; line2?: string; postal_code: string; city: string; state?: string };
  company_phone?: string;
}): Promise<Ergebnis<ConnectStand>> {
  const res = await call<ConnectStand>("/affiliates/me/connect/data", { method: "PUT", body: daten });
  revalidatePath("/profil");
  return res;
}

export async function connectBankSetzen(daten: {
  iban: string;
  account_holder: string;
  currency: string;
}): Promise<Ergebnis<ConnectStand>> {
  const res = await call<ConnectStand>("/affiliates/me/connect/bank", { method: "PUT", body: daten });
  revalidatePath("/profil");
  return res;
}

export async function connectBedingungenAnnehmen(): Promise<Ergebnis<ConnectStand>> {
  const res = await call<ConnectStand>("/affiliates/me/connect/tos", {
    method: "POST",
    body: { akzeptiert: true },
  });
  revalidatePath("/profil");
  return res;
}

/** Einmal-Link zu Stripes Identitätsprüfung (Ausweis + Lebendnachweis).
 *
 * Diese beiden Nachweise kann unser eigenes Formular nicht einsammeln — der
 * Lebendnachweis verlangt Stripes eigene Strecke. Der Partner wird dafür
 * einmalig dorthin geschickt und kehrt danach ins Dashboard zurück. */
export async function connectIdentitaetsLink(): Promise<Ergebnis<{ url: string }>> {
  return call<{ url: string }>("/affiliates/me/connect/identity-link", {
    method: "POST",
    body: {},
  });
}
