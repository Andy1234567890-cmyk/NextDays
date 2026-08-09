"use client";

// GoTrue-MFA im Browser: Enrollment, Challenge und Verify der drei ECHTEN
// Faktoren (totp, phone, webauthn).
//
// Warum direkt gegen GoTrue und nicht über die FastAPI: so schreibt es der
// Contract vor (docs/API.md) — „was GoTrue nativ kann, wird nicht nachgebaut,
// sonst gäbe es zwei Wahrheiten". WebAuthn ginge ohnehin nicht anders: die
// Credential-Erzeugung passiert zwingend im Browser (`navigator.credentials`),
// und die Challenge muss vom selben Server kommen, der sie später prüft.
//
// Sitzung: Der eigene Client (NICHT der geteilte aus lib/supabase/client) wird
// pro Vorgang mit den Tokens der laufenden Sitzung bestückt. `persistSession:
// false` sorgt dafür, dass nichts davon in localStorage landet — die Tokens
// leben nur in dieser einen Instanz, so lange die Einrichtung läuft.
import {
  type SupabaseClient,
  createClient as createSupabaseClient,
} from "@supabase/supabase-js";

import { mfaSessionTokens } from "@/lib/mfa";

export type MfaFehler = { ok: false; error: string };
export type MfaErfolg<T> = { ok: true; data: T };
export type MfaErgebnis<T> = MfaErfolg<T> | MfaFehler;

/** Frischer Client MIT Sitzung. Bewusst pro Vorgang neu: eine langlebige
 *  Instanz mit gesetzter Session wäre ein zweiter Ort, an dem Tokens liegen. */
async function mfaClient(): Promise<MfaErgebnis<SupabaseClient>> {
  const tokens = await mfaSessionTokens();
  if (!tokens.ok) return { ok: false, error: tokens.error };

  const client = createSupabaseClient(
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
  const { error } = await client.auth.setSession({
    access_token: tokens.data.access_token,
    refresh_token: tokens.data.refresh_token,
  });
  if (error) {
    // Fail-closed: ohne gültige Sitzung wird NICHT weitergemacht.
    return { ok: false, error: error.message };
  }
  return { ok: true, data: client };
}

/** Eigene UNVERIFIZIERTE Faktoren eines Typs entfernen.
 *
 *  Gegenzustand zu einer abgebrochenen Einrichtung (Wurzel 1): GoTrue legt den
 *  Faktor beim Enroll sofort an, auch wenn der Nutzer danach abbricht. Ein
 *  zweiter Versuch mit demselben `friendly_name` scheitert dann an
 *  422 `mfa_factor_name_conflict`. Verifizierte Faktoren werden NIE angefasst.
 */
async function unverifizierteAufraeumen(
  c: SupabaseClient,
  typ: "totp" | "phone" | "webauthn",
): Promise<void> {
  const { data, error } = await c.auth.mfa.listFactors();
  if (error) return;
  for (const f of data.all ?? []) {
    if (f.factor_type === typ && f.status !== "verified") {
      await c.auth.mfa.unenroll({ factorId: f.id });
    }
  }
}

// --- TOTP (Authenticator-App) ----------------------------------------------

export type TotpEnrollment = {
  factorId: string;
  /** SVG-Markup des QR-Codes (GoTrue liefert `totp.qr_code`). */
  qrCode: string;
  /** Base32-Secret zum manuellen Eintippen. */
  secret: string;
};

/** Schritt 1: unverifizierten TOTP-Faktor anlegen → QR + Secret. */
export async function totpEnrollen(
  friendlyName: string,
): Promise<MfaErgebnis<TotpEnrollment>> {
  const c = await mfaClient();
  if (!c.ok) return c;
  await unverifizierteAufraeumen(c.data, "totp");
  const { data, error } = await c.data.auth.mfa.enroll({
    factorType: "totp",
    friendlyName,
  });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    },
  };
}

/** Schritt 2: Faktor mit einem Code aus der App bestätigen.
 *  `challengeAndVerify` erzeugt die Challenge und löst sie in einem Zug ein. */
export async function faktorBestaetigen(
  factorId: string,
  code: string,
): Promise<MfaErgebnis<null>> {
  const c = await mfaClient();
  if (!c.ok) return c;
  const { error } = await c.data.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// --- SMS (phone) ------------------------------------------------------------

/** Schritt 1: unverifizierten Telefon-Faktor anlegen (E.164 erzwingt GoTrue).
 *  GoTrue verschickt den Code erst bei der Challenge, nicht schon hier. */
export async function smsEnrollen(
  friendlyName: string,
  phone: string,
): Promise<MfaErgebnis<{ factorId: string }>> {
  const c = await mfaClient();
  if (!c.ok) return c;
  await unverifizierteAufraeumen(c.data, "phone");
  const { data, error } = await c.data.auth.mfa.enroll({
    factorType: "phone",
    friendlyName,
    phone,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { factorId: data.id } };
}

/** Schritt 2: Challenge auslösen → GoTrue schickt die SMS. */
export async function smsCodeAnfordern(
  factorId: string,
): Promise<MfaErgebnis<{ challengeId: string }>> {
  const c = await mfaClient();
  if (!c.ok) return c;
  const { data, error } = await c.data.auth.mfa.challenge({ factorId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { challengeId: data.id } };
}

/** Schritt 3: den per SMS erhaltenen Code gegen die Challenge prüfen. */
export async function smsCodeBestaetigen(
  factorId: string,
  challengeId: string,
  code: string,
): Promise<MfaErgebnis<null>> {
  const c = await mfaClient();
  if (!c.ok) return c;
  const { error } = await c.data.auth.mfa.verify({
    factorId,
    challengeId,
    code,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// --- Passkey (WebAuthn) -----------------------------------------------------

/** Fehlerschlüssel einer gescheiterten Zeremonie.
 *
 *  Bewusst KEIN roher Browser-Text: `DOMException.message` ist englisch,
 *  technisch und je Browser anders formuliert. Der Aufrufer übersetzt diesen
 *  Schlüssel über `account.security.twoFactor.passkey.errors.*`. */
export type PasskeyFehlerCode =
  /** Der Nutzer hat abgebrochen, zu lange gewartet, oder das Gerät hat die
   *  Bestätigung verweigert. Häufigster Fall — und KEIN Systemfehler. */
  | "abgebrochen"
  /** rpId passt nicht zur aufgerufenen Herkunft (falsche Domain/kein HTTPS). */
  | "herkunftPasstNicht"
  /** Der Browser/das Gerät kann diese Art Passkey nicht erzeugen. */
  | "nichtUnterstuetzt"
  /** Für dieses Konto existiert auf dem Gerät bereits ein Passkey. */
  | "schonVorhanden"
  /** Es läuft bereits eine Zeremonie in diesem Tab. */
  | "laeuftBereits"
  /** Die Zeremonie kam nicht innerhalb der Frist zum Abschluss. */
  | "zeitUeberschritten"
  /** Alles andere — inklusive Server-/Netzfehler. */
  | "unbekannt";

/** Frist, nach der die Zeremonie von uns abgebrochen wird (ms).
 *
 *  WARUM DAS SEIN MUSS: `publicKey.timeout` aus der GoTrue-Challenge ist laut
 *  W3C nur ein HINWEIS — Chrome und Safari setzen ihn nicht durch. Gibt es auf
 *  dem Gerät keinen nutzbaren Authenticator (headless, kein Touch ID, kein
 *  Sicherheitsschlüssel), löst sich das Promise von
 *  `navigator.credentials.create()` NIE auf: kein Erfolg, kein Fehler.
 *  Ohne diese Frist bleibt der Knopf dauerhaft auf „Wird erstellt …" stehen —
 *  live reproduziert am 09.08.2026 (Beleg: ein zweiter Aufruf im selben Tab
 *  antwortete „A request is already pending", die erste Zeremonie lief also
 *  noch). Der Wert liegt bewusst über der Bedenkzeit eines Menschen am
 *  Systemdialog, aber weit unter „gefühlt kaputt". */
const PASSKEY_FRIST_MS = 90_000;

/** Browser-/Bibliotheksfehler auf einen unserer Schlüssel abbilden.
 *
 *  Fail-closed (Wurzel 5): Was nicht sicher zuzuordnen ist, wird `unbekannt` —
 *  NIE stillschweigend als Erfolg behandelt. */
function passkeyFehlerDeuten(fehler: unknown): PasskeyFehlerCode {
  const name =
    typeof fehler === "object" && fehler !== null && "name" in fehler
      ? String((fehler as { name: unknown }).name)
      : "";
  const text =
    typeof fehler === "object" && fehler !== null && "message" in fehler
      ? String((fehler as { message: unknown }).message)
      : String(fehler ?? "");

  // „A request is already pending" meldet Chrome als OperationError — es ist
  // aber kein Defekt, sondern eine noch laufende Zeremonie im selben Tab.
  if (/already pending/i.test(text)) return "laeuftBereits";
  if (name === "NotAllowedError") return "abgebrochen";
  if (name === "SecurityError") return "herkunftPasstNicht";
  if (name === "InvalidStateError") return "schonVorhanden";
  if (name === "NotSupportedError" || name === "ConstraintError") {
    return "nichtUnterstuetzt";
  }
  if (name === "AbortError" || name === "TimeoutError") {
    return "zeitUeberschritten";
  }
  return "unbekannt";
}

/** Vollständige Registrierungs-Zeremonie: Enroll + Challenge +
 *  `navigator.credentials.create()` + Verify in einem Aufruf.
 *
 *  `register()` von supabase-js macht genau diese vier Schritte; rpId und
 *  rpOrigins leitet es aus der aktuellen Herkunft ab. Sie werden hier bewusst
 *  NICHT überschrieben — ein selbst gesetztes rpId, das nicht zur Domain passt,
 *  lässt der Browser ohnehin nicht zu, und ein erfundener Wert wäre genau die
 *  Art Hardcode, die Wurzel 4 verbietet. GoTrue übernimmt die vom Client
 *  gemeldete rpId (live geprüft: von `localhost` aufgerufen liefert die
 *  Challenge `rp.id = "localhost"`), die Server-Variable `WEBAUTHN_RP_ID` ist
 *  dabei die Vorgabe für die Produktivdomäne, nicht der lokale Blocker.
 *
 *  VORHER AUFRÄUMEN (Wurzel 1 — jede Aktion hat einen Gegenzustand):
 *  Bricht der Nutzer den Systemdialog ab oder scheitert die Zeremonie, bleibt
 *  bei GoTrue ein UNVERIFIZIERTER Faktor stehen. Beim zweiten Versuch lehnt
 *  GoTrue denselben `friendly_name` dann mit 422 `mfa_factor_name_conflict`
 *  ab — die Einrichtung wäre für den Nutzer dauerhaft kaputt, ohne dass er den
 *  Grund sehen könnte. Live reproduziert am 09.08.2026.
 *  Deshalb werden eigene unverifizierte webauthn-Faktoren vor dem Start
 *  entfernt. Verifizierte bleiben unangetastet: sie sind aktiver Schutz.
 *
 *  Rückgabe im Fehlerfall ist ein SCHLÜSSEL, kein fertiger Satz — die
 *  Übersetzung passiert in der Oberfläche. */
export async function passkeyRegistrieren(
  friendlyName: string,
): Promise<MfaErgebnis<null> | { ok: false; code: PasskeyFehlerCode }> {
  const c = await mfaClient();
  if (!c.ok) return c;

  await unverifizierteAufraeumen(c.data, "webauthn");

  // Eigener AbortController: nur so lässt sich die Zeremonie überhaupt
  // beenden. supabase-js reicht `signal` bis an `navigator.credentials.create()`
  // durch; ohne ihn gäbe es kein Mittel gegen ein hängendes Promise.
  const abbruch = new AbortController();
  let abgelaufen = false;
  const uhr = setTimeout(() => {
    abgelaufen = true;
    abbruch.abort(new DOMException("Passkey-Frist abgelaufen", "TimeoutError"));
  }, PASSKEY_FRIST_MS);

  try {
    const { error } = await c.data.auth.mfa.webauthn.register({
      friendlyName,
      webauthn: { signal: abbruch.signal },
    });
    if (error) {
      // Nach eigenem Abbruch meldet die Bibliothek einen AbortError — für den
      // Nutzer ist das eine überschrittene Frist, kein mysteriöser Defekt.
      return {
        ok: false,
        code: abgelaufen ? "zeitUeberschritten" : passkeyFehlerDeuten(error),
      };
    }
    return { ok: true, data: null };
  } catch (fehler) {
    // Wurzel 5: nichts verschlucken. Auch ein unerwarteter Wurf beendet den
    // Ladezustand mit einer benennbaren Ursache.
    return {
      ok: false,
      code: abgelaufen ? "zeitUeberschritten" : passkeyFehlerDeuten(fehler),
    };
  } finally {
    // Der Timer wird IMMER abgeräumt — auch bei Erfolg und bei Wurf.
    clearTimeout(uhr);
  }
}

/** Anmeldung mit einem vorhandenen Passkey (zweiter Login-Schritt):
 *  Challenge + `navigator.credentials.get()` + Verify. */
export async function passkeyAnmelden(
  factorId: string,
): Promise<MfaErgebnis<null>> {
  const c = await mfaClient();
  if (!c.ok) return c;
  const { error } = await c.data.auth.mfa.webauthn.authenticate({ factorId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

/** Fähigkeiten des Browsers — ehrliche Erkennung, keine Vermutung. */
export type PasskeyFaehigkeit =
  | "fehlt"          // kein WebAuthn
  | "ohnePlattform"  // WebAuthn ja, aber kein eingebauter Authenticator
  | "bereit";

export async function passkeyFaehigkeitPruefen(): Promise<PasskeyFaehigkeit> {
  if (
    typeof window === "undefined" ||
    !window.PublicKeyCredential ||
    !navigator.credentials?.create
  ) {
    return "fehlt";
  }
  try {
    const plattform =
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return plattform ? "bereit" : "ohnePlattform";
  } catch {
    return "fehlt";
  }
}
