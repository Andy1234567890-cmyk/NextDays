// Co-Gastgeber eines Objekts (Lesen).
//
// Ein Co-Gastgeber ist eine Person mit EIGENEM Konto, die auf einem fremden
// Objekt mithilft — nicht zu verwechseln mit Mitarbeitern im eigenen Betrieb.
// Drei Zugriffsstufen, entsprechend Airbnb (Hilfeartikel 1534).
import { api } from "./api-server";

export type CohostAccess = "full" | "calendar_messaging" | "calendar";
export type CohostStatus = "pending" | "active" | "declined" | "revoked";

/**
 * Art der Beteiligung je Buchung.
 *
 * WICHTIG: Diese Beteiligung kommt ZUSÄTZLICH zur festen Plattform-Gebühr und
 * geht zulasten des Gastgebers — sie schmälert nicht die Gebühr.
 */
export type ShareKind = "none" | "percent" | "fixed";

export interface Cohost {
  id: string;
  property_id: string;
  user_id: string;
  access: CohostAccess;
  status: CohostStatus;
  note: string | null;
  created_at: string;
  accepted_at: string | null;
  full_name: string | null;
  email: string | null;
  share_kind: ShareKind;
  /** Basispunkte (500 = 5 %). Nur bei share_kind='percent'. */
  share_bps: number | null;
  /** Fixer Betrag in Cent. Nur bei share_kind='fixed'. */
  share_fixed_cents: number | null;
  share_currency: string | null;
}

/** Stand des Auszahlungskontos eines Co-Gastgebers. */
export interface CohostStripeStatus {
  verbunden: boolean;
  payouts_enabled: boolean;
  charges_enabled: boolean;
  offene_anforderungen: string[];
  onboarding_url: string | null;
}

export interface CohostInvitation {
  id: string;
  property_id: string;
  email: string;
  access: CohostAccess;
  note: string | null;
  expires_at: string;
  created_at: string;
}

export interface CohostInviteResult {
  id: string;
  email: string;
  access: CohostAccess;
  expires_at: string;
  /** Einladungslink zum Weitergeben (solange kein Mailversand existiert). */
  link: string;
}

/** Co-Gastgeber eines Objekts (aktiv und angenommen). */
export async function getCohosts(propertyId: string): Promise<Cohost[]> {
  return api<Cohost[]>(`/cohosts/property/${propertyId}`, { cache: "no-store" });
}

/**
 * Feste Plattform-Gebühr des Betriebs in Basispunkten (800 = 8 %).
 *
 * Für die Beispielrechnung im Beteiligungs-Dialog. Kommt aus dem Backend, nie
 * hartkodiert — der Satz kann je Konto abweichen (Wurzel 4).
 */
export async function getPlattformGebuehr(): Promise<number> {
  const res = await api<{ platform_fee_bps: number }>("/cohosts/platform-fee", {
    cache: "no-store",
  });
  return res.platform_fee_bps;
}

/** Offene Einladungen eines Objekts. */
export async function getCohostInvitations(
  propertyId: string,
): Promise<CohostInvitation[]> {
  return api<CohostInvitation[]>(`/cohosts/property/${propertyId}/invitations`, {
    cache: "no-store",
  });
}
