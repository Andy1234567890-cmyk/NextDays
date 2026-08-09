"use client";

// Zweiter LOGIN-Schritt gegen GoTrue.
//
// Unterschied zu lib/mfa-client.ts (Einrichtung): Dort ist die Sitzung schon
// vollwertig und das Ergebnis nur „Faktor verifiziert". HIER entsteht die neue
// Sitzung — die Antwort von GoTrue trägt `aal2` und muss zurück in die
// httpOnly-Cookies, sonst bleibt die API zu. Deshalb geben diese Funktionen
// die Session HERAUS, statt sie selbst zu setzen: Cookies schreibt
// ausschliesslich lib/auth.ts (`sessionUebernehmen`), damit es dafür eine
// einzige Stelle gibt.
import {
  type SupabaseClient,
  createClient as createSupabaseClient,
} from "@supabase/supabase-js";

import { mfaSessionTokens } from "@/lib/mfa";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; error: string };

/** Die Session, die nach bestandenem Faktor gilt (aal2). */
export type Aal2Session = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

/** Client mit der aal1-Sitzung aus dem Passwort-Schritt. Sie öffnet keine
 *  API-Route, ist aber genau das, was GoTrue für die Challenge verlangt. */
async function client(): Promise<Ergebnis<SupabaseClient>> {
  const tokens = await mfaSessionTokens();
  if (!tokens.ok) return { ok: false, error: tokens.error };
  const c = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  const { error } = await c.auth.setSession({
    access_token: tokens.data.access_token,
    refresh_token: tokens.data.refresh_token,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: c };
}

/** Die factor_id je Faktortyp aus der laufenden Sitzung.
 *
 *  Challenge und Verify brauchen die ID; der Login-Endpunkt liefert nur die
 *  TYPEN (`mfa_methods`). `listFactors()` liest sie aus der Sitzung — es wird
 *  nichts geraten und nichts zwischengespeichert. */
export async function faktorenDerSitzung(): Promise<
  Ergebnis<Record<string, string>>
> {
  const c = await client();
  if (!c.ok) return c;
  const { data, error } = await c.data.auth.mfa.listFactors();
  if (error) return { ok: false, error: error.message };
  const alle = [...(data.totp ?? []), ...(data.phone ?? []), ...(data.webauthn ?? [])];
  const ids: Record<string, string> = {};
  for (const f of alle) {
    // Nur verifizierte Faktoren taugen zum Anmelden.
    if (f.status === "verified" && !ids[f.factor_type]) {
      ids[f.factor_type] = f.id;
    }
  }
  return { ok: true, data: ids };
}

function alsSession(data: {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}): Ergebnis<Aal2Session> {
  if (!data?.access_token || !data?.refresh_token) {
    // Kein Schein-Erfolg: ohne Tokens gilt der Faktor als nicht gelöst.
    return { ok: false, error: "Keine Sitzung erhalten." };
  }
  return {
    ok: true,
    data: {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in ?? 3600,
    },
  };
}

/** TOTP- oder SMS-Code lösen (Challenge + Verify) → aal2-Session. */
export async function faktorLoesen(
  factorId: string,
  code: string,
): Promise<Ergebnis<Aal2Session>> {
  const c = await client();
  if (!c.ok) return c;
  const { data, error } = await c.data.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });
  if (error) return { ok: false, error: error.message };
  return alsSession(data);
}

/** SMS-Code anfordern (Challenge ohne Verify) — GoTrue verschickt die SMS. */
export async function smsLoginCodeAnfordern(
  factorId: string,
): Promise<Ergebnis<null>> {
  const c = await client();
  if (!c.ok) return c;
  const { error } = await c.data.auth.mfa.challenge({ factorId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

/** Passkey lösen: Challenge + `navigator.credentials.get()` + Verify. */
export async function passkeyAnmeldenMitSession(
  factorId: string,
): Promise<Ergebnis<Aal2Session>> {
  const c = await client();
  if (!c.ok) return c;
  const { data, error } = await c.data.auth.mfa.webauthn.authenticate({
    factorId,
  });
  if (error) return { ok: false, error: error.message };
  return alsSession(data as { access_token?: string; refresh_token?: string });
}
