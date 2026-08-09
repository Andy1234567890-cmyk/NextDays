"use server";

// Auth-Server-Actions: rufen das FastAPI-Backend (auth-Slice) und verwalten die
// Session über httpOnly-Cookies. Die Business-Logik bleibt in FastAPI
// (PROJECT.md §2) — hier wird nur aufgerufen und das Token sicher abgelegt.
import { revalidatePath } from "next/cache";

import { clearSession, persistSession } from "@nextdays/auth/server";
import type { LoginResponse } from "@nextdays/auth/types";

import { ApiError, api, type MeResponse, type SessionResponse } from "@/lib/api";
import { currentToken, currentTokenStreng } from "@/lib/session-token";
import { createClient } from "@/lib/supabase/server";

// Cookie-Namen dieser App (Sicherheitsgrenze — pro App explizit, ADR-0017). web
// nutzt zusätzlich eine Supabase-OAuth-Welt (Google), die hier web-lokal bleibt.
const COOKIES = { access: "nd_access", refresh: "nd_refresh" } as const;

type LoginResult =
  | { ok: true }
  | { ok: false; error: string }
  | {
      ok: true;
      mfaRequired: true;
      /** Faktortypen dieses Kontos, wie GoTrue sie führt: 'totp' | 'phone' |
       *  'webauthn'. Steuert, welchen zweiten Schritt die UI anbietet. */
      mfaMethods: string[];
      /** Bei SMS: maskierte Zielnummer für die Anzeige („+49 ••• 9026"). */
      mfaPhoneMasked: string | null;
    };

/** Login-Schritt 1: E-Mail + Passwort.
 *
 *  Hat das Konto einen zweiten Faktor, kommt `mfaRequired` plus eine Session
 *  mit `aal1` zurück. Diese Session öffnet KEINE API-Route (der Guard
 *  antwortet 401 + `X-MFA-Required: challenge`) — sie dient allein dazu, die
 *  Faktor-Challenge gegen GoTrue zu fahren. Erst deren Antwort trägt `aal2`. */
export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  try {
    const res = await api<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    if (res.mfa_required) {
      // 2FA-Fall (0341, GoTrue-nativ): Das Backend liefert hier eine Session
      // mit `aal1`. Sie ist bewusst KEIN Freifahrtschein — der zentrale Guard
      // weist damit jede API-Route ab (401 + `X-MFA-Required: challenge`).
      // Ihr einziger Zweck ist, die Faktor-Challenge direkt gegen GoTrue
      // fahren zu können; erst deren Antwort trägt `aal2`.
      //
      // Sie wird trotzdem als Cookie gesetzt, weil der Browser-Client sie für
      // `setSession()` braucht. Ohne sie gäbe es keinen Weg, den zweiten
      // Faktor zu lösen.
      if (res.session) await persistSession(res.session, COOKIES);
      return {
        ok: true,
        mfaRequired: true,
        // Kein erfundener Default: liefert der Server keine Liste, bleibt sie
        // leer und die UI bietet nur den Wiederherstellungscode an.
        mfaMethods: res.mfa_methods ?? [],
        mfaPhoneMasked: res.mfa_phone_masked ?? null,
      };
    }
    if (!res.session) return { ok: false, error: "Login fehlgeschlagen." };
    await persistSession(res.session, COOKIES);
    return { ok: true };
  } catch (exc) {
    const error =
      exc instanceof ApiError ? exc.message : "Login fehlgeschlagen.";
    return { ok: false, error };
  }
}

/** Die Session nach einer bestandenen GoTrue-Challenge übernehmen.
 *
 *  Der zweite Faktor wird seit 0341 DIREKT gegen GoTrue gelöst (im Browser,
 *  lib/mfa-client.ts) — von dort kommt ein frisches Token mit `aal2`. Diese
 *  Aktion schreibt es in dieselben httpOnly-Cookies wie der normale Login,
 *  damit alle Server-Aufrufe danach das aal2-Token benutzen.
 *
 *  Ohne diesen Schritt bliebe das alte aal1-Cookie stehen und jede Route
 *  antwortete weiter 401 — der Nutzer käme trotz gelöstem Faktor nicht rein. */
export async function sessionUebernehmen(session: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!session?.access_token || !session?.refresh_token) {
    // Kein Schein-Erfolg: ohne vollständige Session wird nichts gesetzt.
    return { ok: false, error: "Unvollständige Sitzung erhalten." };
  }
  await persistSession(session, COOKIES);
  return { ok: true };
}

/** Login-Schritt 2 über einen WIEDERHERSTELLUNGSCODE.
 *
 *  Eigener Weg, weil GoTrue Wiederherstellungscodes nicht kennt: sie liegen in
 *  `public.mfa_recovery_code` und werden von der FastAPI eingelöst
 *  (`POST /auth/mfa/recovery-codes/redeem`).
 *
 *  STAND (live geprüft am 09.08.2026): Dieser Weg funktioniert im Login-Fall
 *  derzeit NICHT — nicht wegen dieses Codes, sondern wegen des Gates im
 *  Backend. `mfa_gate.mfa_zugang_pruefen` wirft im Zweig „Nutzer hat Faktoren"
 *  für JEDEN Pfad 401, ohne die Ausnahmeliste `ENROLLMENT_ERLAUBTE_PFADE`
 *  (die `/auth/mfa/` enthält) zu prüfen; die Variable `pfad` wird dort
 *  berechnet, aber nur geloggt. Damit ist der Endpunkt genau für die Gruppe
 *  gesperrt, für die er gedacht ist: Leute mit Faktor, die ihn nicht lösen
 *  können. Gegen die laufende API reproduziert: `redeem` mit aal1-Token →
 *  401 „Zweiter Faktor erforderlich." + `X-MFA-Required: challenge`.
 *
 *  Der Aufruf bleibt hier stehen und ist korrekt gebaut: sobald das Gate den
 *  Pfad durchlässt, wirkt er ohne Änderung. Bis dahin sieht der Nutzer die
 *  echte Fehlermeldung des Servers statt eines vorgetäuschten Erfolgs.
 *
 *  Der Endpunkt antwortet `204 No Content` — er VERBRAUCHT den Code, stellt
 *  aber KEINE Session aus (`code_einloesen(...) -> None`). Die Aufwertung auf
 *  `aal2` muss deshalb weiterhin über einen GoTrue-Faktor laufen. */
export async function loginMitWiederherstellungscode(
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    await api<void>("/auth/mfa/recovery-codes/redeem", {
      method: "POST",
      body: { code },
      token,
    });
    return { ok: true };
  } catch (exc) {
    // Backend-Meldung durchreichen: sie unterscheidet „ungültig" von
    // „bereits verbraucht" und „zu viele Versuche".
    const error = exc instanceof ApiError ? exc.message : "Code ist ungültig.";
    return { ok: false, error };
  }
}

/** Registrierung: legt im Backend Tenant + Owner an und meldet direkt an.
 *  Setzt dieselben httpOnly-Cookies wie login (das Backend gibt eine Session
 *  zurück). Business-Logik (Tenant/Owner/Channel-Manager-Group) bleibt in
 *  FastAPI (auth.register). */
export async function register(input: {
  email: string;
  password: string;
  fullName: string;
  tenantName: string;
  country: string;
  currency: string;
  businessType?: "agency" | "self_managed";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await api<SessionResponse>("/auth/register", {
      method: "POST",
      body: {
        email: input.email,
        password: input.password,
        full_name: input.fullName,
        tenant_name: input.tenantName,
        country: input.country,
        currency: input.currency,
        business_type: input.businessType ?? "agency",
      },
    });
    await persistSession(session, COOKIES);
    return { ok: true };
  } catch (exc) {
    const error =
      exc instanceof ApiError ? exc.message : "Registrierung fehlgeschlagen.";
    return { ok: false, error };
  }
}

/** Logout: beide Session-Arten beenden (FastAPI-Cookies + Supabase-Session). */
export async function logout(): Promise<void> {
  await clearSession(COOKIES);

  // Supabase-OAuth-Session (z. B. Google) ebenfalls beenden — ignoriert, wenn
  // gar keine Supabase-Session existiert.
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // keine Supabase-Session vorhanden — unkritisch
  }
}

/** Aktuellen Nutzer aus FastAPI holen (null, wenn nicht eingeloggt).
 *  Nutzt currentToken() → funktioniert für BEIDE Login-Wege: FastAPI-Cookie
 *  (nd_access) UND Supabase-OAuth-Session (Google). So kommen Rolle +
 *  Berechtigungen auch bei OAuth in die Sidebar (UI-Gating).
 *
 *  `null` heißt hier „keine verwertbare Sitzung" — für die vielen Aufrufer, die
 *  nur Rolle/Rechte fürs UI-Gating brauchen, ist das die richtige Antwort.
 *  Wer über An-/Abmeldung ENTSCHEIDET, muss den Unterschied kennen und nimmt
 *  `getSession()` (unten). */
export async function getMe(): Promise<MeResponse | null> {
  return (await getSession()).me;
}

/** Sitzungsprüfung MIT Unterscheidung: nicht angemeldet ≠ Fehler.
 *
 *  Wurzel 5: Ein blankes `catch` machte aus jedem technischen Fehler ein
 *  „nicht angemeldet". Ein kurzer 503, ein 500 oder ein Timeout sah damit aus
 *  wie eine abgelaufene Sitzung, und der Layout-Guard warf den eingeloggten
 *  Nutzer mitten in der Arbeit auf /login (bei laufendem Dev-Reload
 *  reproduzierbar). Abmelden darf nur, wessen Token wirklich ungültig ist:
 *  401/403.
 *
 *  `abgemeldet: true` → wirklich keine Sitzung (kein Token oder 401/403).
 *  `fehler` gesetzt → technisches Problem, die Sitzung gilt weiter. */
export async function getSession(): Promise<{
  me: MeResponse | null;
  abgemeldet: boolean;
  fehler: string | null;
}> {
  try {
    // currentToken() innerhalb des try: die Token-Erneuerung wirft bei
    // technischen Fehlern (429/503/Timeout) weiter, damit hier `fehler` statt
    // `abgemeldet` herauskommt. Vorher verschluckte sie jeden Fehler zu `null`
    // — ein kurzer Backend-Aussetzer sah damit aus wie eine abgelaufene
    // Sitzung und warf den Nutzer auf /login.
    const token = await currentTokenStreng();
    if (!token) return { me: null, abgemeldet: true, fehler: null };
    const me = await api<MeResponse>("/auth/me", { token });
    return { me, abgemeldet: false, fehler: null };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      return { me: null, abgemeldet: true, fehler: null };
    }
    return {
      me: null,
      abgemeldet: false,
      fehler: e instanceof Error ? e.message : "Backend nicht erreichbar.",
    };
  }
}

/** Beherbergungsart des Mandanten umstellen (nur Admin, Capability
 *  manage_tenant). Steuert die Dashboard-Navigation (FeWo vs. Hotel). */
export async function setAccommodationType(
  value: "vacation_rental" | "hotel",
): Promise<{ ok: true; data: MeResponse } | { ok: false; error: string }> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<MeResponse>("/auth/tenant/accommodation-type", {
      token,
      method: "PATCH",
      body: { accommodation_type: value },
    });
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : "Unbekannter Fehler." };
  }
}

/** Standardsprache des Betriebs setzen (nur Admin, Capability manage_tenant).
 *
 *  Zweite Stufe der Mail-Sprachkette: sie greift für jeden Empfänger ohne
 *  eigene Sprachwahl — Eigentümer ohne Login, neu eingeladene Mitarbeiter.
 *  Ohne sie fällt die Kette sofort auf Englisch durch.
 *
 *  `null` ist ein gültiger Wert und heißt „nicht erfasst" (→ Englisch); der
 *  Server weist einen nicht unterstützten Code mit 422 ab, statt ihn still zu
 *  verwerfen. */
export async function setDefaultLanguage(
  value: string | null,
): Promise<{ ok: true; data: MeResponse } | { ok: false; error: string }> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<MeResponse>("/auth/tenant/default-language", {
      token,
      method: "PATCH",
      body: { default_language: value },
    });
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : "Unbekannter Fehler." };
  }
}
