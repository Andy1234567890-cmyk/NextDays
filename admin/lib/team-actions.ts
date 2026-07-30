"use server";

// Backoffice-Team: Zugänge lesen, einladen, ändern — und die Annahme der
// Einladung.
//
// Alle Aufrufe laufen serverseitig, weil das Bearer-Token im httpOnly-Cookie
// liegt. Ausnahme ist `einladungAnnehmen`: dort gibt es noch keine Sitzung —
// der Einmal-Token aus dem Link IST die Berechtigung, geprüft vom Backend.
import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { TeamInviteResult, TeamList, TeamMember } from "./backoffice";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; fehler: string };

async function call<T>(
  pfad: string,
  opts: {
    method?: "GET" | "POST" | "PATCH";
    body?: unknown;
    isPublic?: boolean;
  } = {},
  fehlertext = "Aktion fehlgeschlagen.",
): Promise<Ergebnis<T>> {
  try {
    const data = await api<T>(pfad, { ...opts, cache: "no-store" });
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      fehler: exc instanceof ApiError ? exc.message : fehlertext,
    };
  }
}

/** Alle Backoffice-Zugänge (auch entzogene). */
export async function team(): Promise<Ergebnis<TeamList>> {
  return call<TeamList>("/platform/team", {}, "Team konnte nicht geladen werden.");
}

/** Kolleg:in einladen oder ein bestehendes Konto freischalten. */
export async function einladen(
  email: string,
  rolle: "platform_admin" | "platform_support",
  notiz?: string,
): Promise<Ergebnis<TeamInviteResult>> {
  return call<TeamInviteResult>(
    "/platform/team",
    {
      method: "POST",
      body: { email, platform_role: rolle, note: notiz || null },
    },
    "Einladung fehlgeschlagen.",
  );
}

/** Rolle, Notiz oder Aktiv-Status eines Zugangs ändern. */
export async function zugangAendern(
  userId: string,
  felder: {
    platform_role?: "platform_admin" | "platform_support";
    active?: boolean;
    note?: string;
  },
): Promise<Ergebnis<TeamMember>> {
  return call<TeamMember>(
    `/platform/team/${userId}`,
    { method: "PATCH", body: felder },
    "Änderung fehlgeschlagen.",
  );
}

/**
 * Einladung annehmen und eigenes Passwort setzen.
 *
 * Bewusst OHNE Bearer-Token: die eingeladene Person hat noch keine Sitzung.
 * Das Backend prüft den Einmal-Token (72 h, einmal verwendbar) und antwortet
 * bei jedem Fehlerfall gleich — daher wird die Meldung hier unverändert
 * durchgereicht und nicht „hilfreich" ausgeschmückt.
 */
export async function einladungAnnehmen(
  token: string,
  passwort: string,
): Promise<Ergebnis<{ ok: boolean }>> {
  return call<{ ok: boolean }>(
    "/platform/team/accept",
    { method: "POST", body: { token, password: passwort }, isPublic: true },
    "Einladung konnte nicht angenommen werden.",
  );
}
