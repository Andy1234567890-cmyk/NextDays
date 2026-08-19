// Zwei-Faktor EINRICHTEN — GoTrue-nativ (0341).
//
// WARUM NICHT ÜBER UNSERE API: `POST /auth/totp/enroll` antwortet 410 GONE.
// Enrollment, Challenge und Verify laufen direkt gegen den Anmeldedienst; was
// GoTrue selbst kann, wird nicht durch die FastAPI gespiegelt, sonst gäbe es
// zwei Wahrheiten über den Zustand eines Faktors. Der ZUSTAND kommt dagegen aus
// `GET /auth/mfa/status` (lib/konto.ts) — dort liegt zusätzlich die Rollen-
// Pflicht, die GoTrue nicht kennt.
//
// EIGENER CLIENT, nicht der aus lib/realtime.ts: jener läuft bewusst mit
// `persistSession: false` und bekommt sein JWT pro Channel gesetzt. Für MFA
// braucht es eine echte Session (Access- UND Refresh-Token), und die darf nicht
// in den Realtime-Client geraten — sonst hängt eine Sitzung an einem Client,
// dessen Lebenszyklus an Kanälen hängt.
//
// AUF DEM TELEFON KEIN QR-CODE: Der QR ist dafür da, dass ein ZWEITES Gerät ihn
// scannt. Hier ist die Authenticator-App auf demselben Telefon — deshalb gibt
// diese Schicht die `otpauth://`-URI zurück (antippbar, öffnet die App direkt)
// und das Secret zum Abtippen. Ein QR-Bild wäre hier der unbequemere Weg.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { CONFIG } from "@/lib/config";
import { getRefreshTokenFuerMfa, getToken } from "@/lib/auth";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

let client: SupabaseClient | null = null;

function holeClient(): SupabaseClient {
  client ??= createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
    auth: {
      // Kein Speichern auf dem Gerät: die Sitzung liegt im Keychain
      // (lib/auth.ts) und wird hier nur für den Aufruf gesetzt.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return client;
}

/**
 * Die App-Sitzung in den GoTrue-Client übertragen. Ohne sie antwortet jeder
 * MFA-Aufruf mit „Auth session missing".
 */
async function sessionSetzen(): Promise<string | null> {
  const access = await getToken();
  const refresh = await getRefreshTokenFuerMfa();
  if (!access || !refresh) return "Nicht angemeldet.";
  const { error } = await holeClient().auth.setSession({
    access_token: access,
    refresh_token: refresh,
  });
  return error ? error.message : null;
}

/**
 * Einen TOTP-Faktor anlegen. Er ist danach `unverified` — erst
 * `totpBestaetigen` mit einem Code aus der App macht ihn gültig. Ein
 * abgebrochener Versuch hinterlässt einen unverifizierten Faktor; den räumt
 * GoTrue bzw. das Entfernen im Konto weg.
 */
export async function totpEinrichten(): Promise<
  Result<{ factorId: string; secret: string; uri: string }>
> {
  const fehler = await sessionSetzen();
  if (fehler) return { ok: false, error: fehler };
  const { data, error } = await holeClient().auth.mfa.enroll({
    factorType: "totp",
    // Der Name steht später in der Faktorliste — „iPhone" ist dort nützlicher
    // als eine leere Zeile.
    friendlyName: `Telefon ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error) return { ok: false, error: error.message };
  const secret = data.totp?.secret;
  const uri = data.totp?.uri;
  if (!secret || !uri) {
    // Ohne Secret gibt es nichts einzutragen — dann lieber klar scheitern als
    // eine leere Maske zeigen (Wurzel 4/5).
    return { ok: false, error: "Der Anmeldedienst hat keinen Schlüssel geliefert." };
  }
  return { ok: true, data: { factorId: data.id, secret, uri } };
}

/**
 * Den Faktor mit einem Code aus der Authenticator-App bestätigen. Erst danach
 * zählt er als zweiter Faktor (und die Sitzung wird auf `aal2` gehoben).
 */
export async function totpBestaetigen(
  factorId: string,
  code: string,
): Promise<Result<true>> {
  const fehler = await sessionSetzen();
  if (fehler) return { ok: false, error: fehler };
  const supabase = holeClient();
  const heraus = await supabase.auth.mfa.challenge({ factorId });
  if (heraus.error) return { ok: false, error: heraus.error.message };
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: heraus.data.id,
    code,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: true };
}
