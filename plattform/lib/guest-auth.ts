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
  /** Ausweisprüfung (Stripe Identity). „verified" ist der EINZIGE Wert, der als
   *  geprüft gilt — „processing" heißt in Prüfung, nicht geprüft. */
  identity_status: "unverified" | "processing" | "requires_input" | "verified";
  identity_verified_at: string | null;
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

/** Neues Passwort mit dem CODE aus der Reset-Mail setzen und anmelden.
 *
 *  Der Code und nicht der Link: der Link zeigte auf
 *  `{API_EXTERNAL_URL}/verify?token=…`, und weil jene GoTrue-Variable die
 *  Kong-Basis OHNE `/auth/v1` ist, endete er in Kongs „no Route matched"
 *  (gemessen 03.09.2026). Der Marktplatz versprach dem Gast einen „Link zum
 *  Zurücksetzen", der ins Nichts führte.
 *
 *  Gibt dieselbe Session zurück wie `guestLogin` — der Gast ist nach dem
 *  Setzen angemeldet. */
export async function guestPasswortNeu(
  email: string,
  code: string,
  password: string,
): Promise<Result<GuestSession>> {
  return guestCall<GuestSession>("guest-auth/password-neu", {
    method: "POST",
    body: { email, code, password },
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


// --- Ausweisprüfung des Gastes ---------------------------------------------
//
// Ein Gastgeber kann seine Sofortbuchung auf Gäste mit geprüfter Identität
// beschränken (Airbnb `guests_with_verified_identity`). Wer die Prüfung nicht
// hat, wird nicht abgewiesen — aus seiner Buchung wird eine Anfrage. Die
// Prüfung nimmt ihm also Wartezeit ab, sie ist keine Pflicht.

/** Prüfung starten. Gibt die Hosted-URL von Stripe zurück (24 h gültig,
 *  wird nirgends gespeichert). */
export async function guestIdentityStarten(
  returnUrl: string,
): Promise<Result<{ url: string }>> {
  return guestCall<{ url: string }>("guest-auth/identity/verification-session", {
    method: "POST",
    body: { return_url: returnUrl },
  });
}

/** Den Stand live beim Anbieter nachfragen.
 *
 *  Der Normalweg ist der Webhook. Dieser hier ist der Weg zurück, wenn er
 *  ausbleibt — sonst stünde „Wird geprüft …" für immer da. */
export async function guestIdentityAbgleichen(): Promise<
  Result<{ identity_status: string }>
> {
  return guestCall<{ identity_status: string }>("guest-auth/identity/sync", {
    method: "POST",
  });
}
