"use server";

// Login/Logout des Plattform-Backoffice.
//
// WICHTIG: Der Login läuft über denselben /auth/login-Endpunkt wie das
// Gastgeber-Dashboard — ein Backoffice-Nutzer ist ein ganz normaler Auth-User.
// Die BERECHTIGUNG entsteht nicht durch den Login, sondern durch den Eintrag in
// public.platform_admins, den der Server bei jedem Request frisch prüft
// (Wurzel 7). Ein erfolgreicher Login ohne diesen Eintrag führt hier bewusst
// NICHT ins Backoffice: direkt nach dem Login wird /platform/me abgefragt, und
// nur wenn das durchgeht, werden die Cookies überhaupt gesetzt.
import { redirect } from "next/navigation";

import { ApiError } from "@nextdays/auth/errors";
import {
  api as sharedApi,
  clearSession,
  persistSession,
} from "@nextdays/auth/server";
import type { LoginResponse, SessionResponse } from "@nextdays/auth/types";

import { ADMIN_COOKIES } from "./api-server";

export type LoginErgebnis = { ok: true } | { ok: false; fehler: string };

/** Meldung bei einer STÖRUNG (Backend/Anmeldedienst weg, 5xx).
 *
 * Ein Ausfall darf NIE wie eine Ablehnung der Zugangsdaten aussehen (Wurzel 5):
 * am 09.08.2026 lag der Auth-Stack, das Backoffice meldete „Anmeldung
 * fehlgeschlagen." — und der Betreiber suchte den Fehler stundenlang bei seinem
 * Passwort und seiner 2FA statt bei der Infrastruktur.
 *
 * Kein i18n-Key: das Backoffice ist bewusst ohne next-intl gebaut (siehe
 * admin/app/layout.tsx) und trägt durchgehend deutsche Literale.
 */
const STOERUNG_MELDUNG =
  "Anmeldedienst derzeit nicht erreichbar. Das liegt nicht an deinen " +
  "Zugangsdaten — bitte später erneut versuchen.";

/** Ist dieser Fehler eine Störung (→ ehrliche Meldung) statt einer Ablehnung?
 *
 * 5xx UND alles, was kein ApiError ist: `packages/auth/src/server.ts` wirft bei
 * einem Transportfehler bereits `ApiError(503, "Backend nicht erreichbar.")` —
 * diese Information wurde hier bisher weggeworfen. Nur 401/403 sind ein echtes
 * Urteil über die Zugangsdaten. */
function istStoerung(exc: unknown): boolean {
  return !(exc instanceof ApiError) || exc.status >= 500;
}

/**
 * Anmeldung am Backoffice. Zweistufig:
 *   1. /auth/login → Session (wie jeder andere Nutzer)
 *   2. /platform/me mit dem frischen Token → ist der Nutzer Backoffice-berechtigt?
 * Erst wenn Schritt 2 durchgeht, werden die Cookies gesetzt. So entsteht nie
 * eine „halb eingeloggte" Sitzung ohne Berechtigung.
 */
export async function anmelden(
  email: string,
  passwort: string,
): Promise<LoginErgebnis> {
  let session: SessionResponse;
  try {
    // /auth/login liefert LoginResponse — die Session steckt VERSCHACHTELT unter
    // `session` und fehlt, wenn das Konto einen zweiten Faktor verlangt.
    const res = await sharedApi<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password: passwort },
      isPublic: true,
    });
    if (res.mfa_required || !res.session) {
      // Der 2FA-Schritt ist im Backoffice noch nicht gebaut. Ehrlich benennen
      // statt still zu scheitern (Wurzel 5) — sonst sucht man den Fehler beim
      // Passwort.
      return {
        ok: false,
        fehler:
          "Dieses Konto verlangt einen zweiten Faktor. Die 2FA-Anmeldung ist " +
          "im Backoffice noch nicht verfügbar.",
      };
    }
    session = res.session;
  } catch (exc) {
    // Störung ehrlich benennen; nur eine echte Ablehnung (401/403) bekommt die
    // Meldung des Servers.
    return {
      ok: false,
      fehler: istStoerung(exc) ? STOERUNG_MELDUNG : (exc as ApiError).message,
    };
  }

  // Berechtigungsprüfung VOR dem Setzen der Cookies.
  try {
    await sharedApi("/platform/me", { token: session.access_token });
  } catch (exc) {
    if (istStoerung(exc)) {
      // Der Login selbst hat funktioniert — hier ist der Dienst weg. Das als
      // „Anmeldung fehlgeschlagen" auszugeben, war die Falschaussage: sie
      // beschuldigt die Zugangsdaten, die gerade nachweislich gestimmt haben.
      return { ok: false, fehler: STOERUNG_MELDUNG };
    }
    // Bewusst dieselbe neutrale Meldung wie bei falschem Passwort: kein Hinweis
    // darauf, dass die Zugangsdaten stimmten, aber die Rolle fehlt.
    return { ok: false, fehler: "Anmeldung fehlgeschlagen." };
  }

  await persistSession(session, ADMIN_COOKIES);
  return { ok: true };
}

/** Abmelden: Cookies löschen und zur Anmeldung. */
export async function abmelden(): Promise<never> {
  await clearSession(ADMIN_COOKIES);
  redirect("/anmelden");
}

/**
 * Passwort-Reset anfordern.
 *
 * Ohne Bearer-Token (wer sein Passwort vergessen hat, hat keine Sitzung). Die
 * Antwort des Servers ist IMMER dieselbe — deshalb gibt es hier auch keine
 * Fehler-Unterscheidung: die Meldung wird unverändert durchgereicht. Nur ein
 * Transportfehler (Server nicht erreichbar) ist ein echter Fehlerfall.
 */
export async function passwortResetAnfordern(
  email: string,
): Promise<{ ok: true; meldung: string } | { ok: false; fehler: string }> {
  try {
    const res = await sharedApi<{ message: string }>(
      "/platform/team/passwort-vergessen",
      { method: "POST", body: { email }, isPublic: true },
    );
    return { ok: true, meldung: res.message };
  } catch (exc) {
    return {
      ok: false,
      fehler:
        exc instanceof ApiError
          ? exc.message
          : "Anfrage konnte nicht gesendet werden.",
    };
  }
}

/**
 * Neues Passwort über den Link aus der Mail setzen.
 *
 * Der Einmal-Token aus dem Link IST die Berechtigung; geprüft wird er
 * ausschließlich serverseitig. Alle Fehlerfälle antworten gleich, damit die
 * Existenz eines Tokens nicht ableitbar ist — die Meldung wird deshalb nicht
 * „hilfreich" ausgeschmückt.
 */
export async function passwortNeuSetzen(
  token: string,
  passwort: string,
): Promise<LoginErgebnis> {
  try {
    await sharedApi("/platform/team/passwort-neu", {
      method: "POST",
      body: { token, password: passwort },
      isPublic: true,
    });
    return { ok: true };
  } catch (exc) {
    return {
      ok: false,
      fehler:
        exc instanceof ApiError
          ? exc.message
          : "Passwort konnte nicht gesetzt werden.",
    };
  }
}
