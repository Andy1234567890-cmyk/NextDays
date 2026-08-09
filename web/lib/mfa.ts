"use server";

// MFA-Server-Actions (GoTrue-nativ, 0341).
//
// Aufteilung, die der Contract vorgibt (docs/API.md „Zwei-Faktor-
// Authentifizierung (MFA/AAL2) — GoTrue-nativ"):
//   - Enrollment/Challenge/Verify der drei ECHTEN Faktoren (totp, phone,
//     webauthn) laufen DIREKT gegen GoTrue im Browser (lib/mfa-client.ts).
//     Sie werden bewusst NICHT durch die FastAPI gespiegelt — was GoTrue nativ
//     kann, wird nicht nachgebaut, sonst gäbe es zwei Wahrheiten.
//   - Status, Wiederherstellungscodes und das Entfernen eines Faktors laufen
//     über die FastAPI (/auth/mfa/*), weil dort die Pflicht-/Aussperr-Regeln
//     sitzen (letzter Faktor nur mit übrigen Recovery-Codes → 409).
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";
import { sessionTokens } from "@/lib/session-token";

/** Ein verifizierter Faktor aus `auth.mfa_factors` (MfaFactor im Contract). */
export type MfaFactor = {
  id: string;
  /** 'totp' | 'phone' | 'webauthn' — Werte kommen aus GoTrue. */
  factor_type: string;
  friendly_name: string | null;
  status: string;
  created_at: string | null;
};

/** GET /auth/mfa/status (MfaStatusResponse). */
export type MfaStatus = {
  factors: MfaFactor[];
  /** 'aal1' | 'aal2' — der Claim ist die einzige Wahrheit über den 2. Faktor. */
  aal: string;
  /** Rolle verlangt einen zweiten Faktor (admin/co_admin). */
  mfa_required: boolean;
  /** Mindestens ein verifizierter Faktor vorhanden. */
  mfa_enrolled: boolean;
  /** Ende der Übergangsfrist als ISO-Datum, sonst null. NIE selbst berechnen. */
  mfa_grace_until: string | null;
  recovery_codes_left: number;
  /** Kann dieser Server den SMS-Faktor ausliefern? Kommt vom Backend, wird hier
   *  NICHT geraten: ohne konfigurierten Anbieter antwortet GoTrue auf die
   *  Challenge mit 500, der Nutzer säße in einer Sackgasse. */
  sms_available: boolean;
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error =
      exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

/** Faktoren + Pflichtstatus des eigenen Kontos. */
export async function getMfaStatus(): Promise<Result<MfaStatus>> {
  return call<MfaStatus>("/auth/mfa/status");
}

/** Wiederherstellungscodes NEU erzeugen (ersetzt alle alten).
 *  Re-Auth: Passwort ODER ein aal2-Token — der Server entscheidet, was reicht. */
export async function createRecoveryCodes(
  currentPassword?: string,
): Promise<Result<{ codes: string[] }>> {
  return call<{ codes: string[] }>("/auth/mfa/recovery-codes", {
    method: "POST",
    body: { current_password: currentPassword ?? null },
  });
}

/** Faktor entfernen. Der Server lässt den LETZTEN Faktor eines Pflicht-Kontos
 *  nur zu, wenn noch Wiederherstellungscodes übrig sind (sonst 409) — diese
 *  Regel wird hier NICHT nachgebaut, nur die Antwort angezeigt. */
export async function deleteMfaFactor(
  factorId: string,
  currentPassword?: string,
): Promise<Result<unknown>> {
  return call<unknown>(`/auth/mfa/factors/${encodeURIComponent(factorId)}`, {
    method: "DELETE",
    body: { current_password: currentPassword ?? null },
  });
}

/** Wiederherstellungscode einlösen → Session mit aal2.
 *
 *  Der Endpunkt liefert laut Contract „Session mit aal2" zurück; das Setzen der
 *  Cookies übernimmt der Aufrufer in lib/auth.ts (dort liegt persistSession),
 *  damit es nur EINE Stelle gibt, die Sessions schreibt. */
export async function redeemRecoveryCodeRaw(
  code: string,
  token: string,
): Promise<Result<unknown>> {
  try {
    const data = await api<unknown>("/auth/mfa/recovery-codes/redeem", {
      method: "POST",
      body: { code },
      token,
    });
    return { ok: true, data };
  } catch (exc) {
    const error = exc instanceof ApiError ? exc.message : "Code ist ungültig.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

/** Access- UND Refresh-Token der laufenden Sitzung für den GoTrue-Browser-
 *  Client.
 *
 *  WARUM DAS NÖTIG IST: Enrollment/Verify der echten Faktoren laufen direkt
 *  gegen GoTrue (Contract). `supabase.auth.mfa.*` verlangt dafür eine echte
 *  Session IM BROWSER — unsere Sitzung liegt aber in httpOnly-Cookies, auf die
 *  JavaScript bewusst nicht zugreifen kann. Ohne diesen Weg gäbe es für
 *  Cookie-Login-Nutzer (der Normalfall) überhaupt keine Möglichkeit, einen
 *  Faktor einzurichten.
 *
 *  Warum das vertretbar ist: Es werden GENAU die Tokens der eigenen,
 *  bereits bestehenden Sitzung an die eigene Seite gereicht — kein fremdes
 *  Geheimnis, keine Rechteerweiterung. Der Aufrufer gibt sie ausschließlich an
 *  `supabase.auth.setSession()`; sie werden nicht geloggt, nicht in die URL
 *  geschrieben und nicht in localStorage abgelegt (der MFA-Client läuft mit
 *  `persistSession: false`). */
export async function mfaSessionTokens(): Promise<
  Result<{ access_token: string; refresh_token: string }>
> {
  const tokens = await sessionTokens();
  if (!tokens) return { ok: false, error: "Nicht angemeldet." };
  return { ok: true, data: tokens };
}
