// Zweiter LOGIN-Schritt (2FA) gegen GoTrue — das mobile Gegenstück zu
// `web/lib/mfa-login.ts`.
//
// WARUM GEGEN GOTRUE UND NICHT GEGEN UNSERE API: Seit Migration 0341 sind die
// zweiten Faktoren Supabase-NATIV. Die alte App-2FA (`user_mfa` +
// `/auth/login/totp` mit `mfa_token`) war über den GoTrue-Direktlogin
// umgehbar — wer `/auth/v1/token` mit dem anon-Key aufrief, übersprang den
// zweiten Faktor komplett (CLAUDE.md Wurzel 7). Ihr Enrollment ist abgeschaltet
// (410). Deshalb liefert `/auth/login` bei einem nativen Faktor KEINEN
// `mfa_token` mehr, sondern eine aal1-Session plus `mfa_methods`; die Challenge
// hängt an dieser Session. Ein Aufruf von `/auth/login/totp` würde hier ins
// Leere laufen.
//
// UNTERSCHIED ZUM WEB: Dort liegt die aal1-Session in httpOnly-Cookies und
// muss von dort geholt werden. Hier wird sie direkt übergeben — die App hält
// ihre Tokens im Keychain (`lib/auth.ts`) und ist damit der einfachere Fall.
//
// ABGRENZUNG ZUM REALTIME-CLIENT: bewusst ein EIGENER Client. Der Realtime-
// Client (`lib/realtime.ts`) hat genau EINE Tokenquelle und darf sie nicht
// wechseln (`realtimeTokenQuelleSetzen` wirft beim zweiten Aufruf). Dieser
// Client hier ist kurzlebig, hält keine Session (`persistSession: false`) und
// wird nach dem Lösen des Faktors nicht weiterverwendet.
import { type SupabaseClient, createClient } from "@supabase/supabase-js";

import { CONFIG } from "@/lib/config";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; error: string };

/** Die Session, die nach bestandenem Faktor gilt (aal2). */
export type Aal2Session = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

/** Client mit der aal1-Sitzung aus dem Passwort-Schritt. Sie öffnet keine
 *  API-Route, ist aber genau das, was GoTrue für die Challenge verlangt. */
async function client(
  aal1: { access_token: string; refresh_token: string },
): Promise<Ergebnis<SupabaseClient>> {
  const c = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { error } = await c.auth.setSession({
    access_token: aal1.access_token,
    refresh_token: aal1.refresh_token,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: c };
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

/** Die factor_id je Faktortyp aus der laufenden Sitzung.
 *
 *  Challenge und Verify brauchen die ID; der Login-Endpunkt liefert nur die
 *  TYPEN (`mfa_methods`). `listFactors()` liest sie aus der Sitzung — es wird
 *  nichts geraten und nichts zwischengespeichert. */
export async function faktorenDerSitzung(aal1: {
  access_token: string;
  refresh_token: string;
}): Promise<Ergebnis<Record<string, string>>> {
  const c = await client(aal1);
  if (!c.ok) return c;
  const { data, error } = await c.data.auth.mfa.listFactors();
  if (error) return { ok: false, error: error.message };
  const alle = [...(data.totp ?? []), ...(data.phone ?? [])];
  const ids: Record<string, string> = {};
  for (const f of alle) {
    // Nur verifizierte Faktoren taugen zum Anmelden.
    if (f.status === "verified" && !ids[f.factor_type]) {
      ids[f.factor_type] = f.id;
    }
  }
  return { ok: true, data: ids };
}

/** TOTP- oder SMS-Code lösen (Challenge + Verify) → aal2-Session.
 *
 *  Recovery-Codes gehen hier NICHT durch: GoTrue kennt sie nicht, sie liegen in
 *  `public.mfa_recovery_code`. Ein Weg dafür ist hier ABSICHTLICH nicht gebaut —
 *  er funktioniert auch im Web nicht (dort dokumentiert in `web/lib/auth.ts`,
 *  live geprüft am 09.08.2026): `mfa_gate.mfa_zugang_pruefen` wirft im Zweig
 *  „Nutzer hat Faktoren" für JEDEN Pfad 401, ohne die Ausnahmeliste
 *  `ENROLLMENT_ERLAUBTE_PFADE` zu prüfen — genau für die Gruppe, für die der
 *  Endpunkt gedacht ist. Zudem antwortet er 204 und stellt KEINE Session aus,
 *  die Aufwertung auf aal2 bräuchte also ohnehin einen GoTrue-Faktor. Einen
 *  Knopf anzubieten, der sicher 401 liefert, wäre schlechter als keiner.
 *  Wer sein Telefon verloren hat, braucht den Admin-Reset
 *  (`POST /auth/mfa/admin/reset`). */
export async function faktorLoesen(
  aal1: { access_token: string; refresh_token: string },
  factorId: string,
  code: string,
): Promise<Ergebnis<Aal2Session>> {
  const c = await client(aal1);
  if (!c.ok) return c;
  const { data, error } = await c.data.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });
  if (error) return { ok: false, error: error.message };
  return alsSession(data);
}

/** SMS-Code anfordern (Challenge ohne Verify) — GoTrue verschickt die SMS. */
export async function smsCodeAnfordern(
  aal1: { access_token: string; refresh_token: string },
  factorId: string,
): Promise<Ergebnis<null>> {
  const c = await client(aal1);
  if (!c.ok) return c;
  const { error } = await c.data.auth.mfa.challenge({ factorId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
