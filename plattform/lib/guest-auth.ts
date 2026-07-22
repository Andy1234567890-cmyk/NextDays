// Portal-Gast-Auth (Demand-Seite). Login/Register/Password-Reset sind PUBLIC —
// sie brauchen kein Bearer, laufen aber trotzdem über den Same-Origin-Proxy
// (der ohne nd_access-Cookie einfach keinen Bearer setzt). Nach erfolgreichem
// Login/Register ruft die aufrufende Client-Komponente setGuestSession(...).
import { guestCall, type Result } from "./guest-api";

export type GuestSession = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

export type GuestMe = {
  guest_id: string;
  email: string;
  name: string;
  phone: string | null;
  preferred_locale: string | null;
  preferred_currency: string | null;
  marketing_opt_in: boolean;
};

export async function guestLogin(
  email: string,
  password: string,
): Promise<Result<GuestSession>> {
  return guestCall<GuestSession>("guest-auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export async function guestRegister(input: {
  email: string;
  password: string;
  name: string;
  phone?: string;
  preferred_locale?: string;
  preferred_currency?: string;
}): Promise<Result<GuestSession>> {
  return guestCall<GuestSession>("guest-auth/register", {
    method: "POST",
    body: input,
  });
}

export async function guestPasswordReset(
  email: string,
): Promise<Result<{ message: string }>> {
  return guestCall<{ message: string }>("guest-auth/password-reset", {
    method: "POST",
    body: { email },
  });
}

export async function guestGetMe(): Promise<Result<GuestMe>> {
  return guestCall<GuestMe>("guest-auth/me");
}

export async function guestUpdateMe(input: {
  name?: string;
  phone?: string;
  preferred_locale?: string;
  preferred_currency?: string;
  marketing_opt_in?: boolean;
}): Promise<Result<GuestMe>> {
  return guestCall<GuestMe>("guest-auth/me", { method: "PATCH", body: input });
}
