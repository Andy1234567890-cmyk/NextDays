"use server";

// Co-Gastgeber verwalten (Schreiben). Jede Aktion läuft server-zu-server; die
// eigentlichen Regeln (max. 10, kein Vollzugriff durch Co-Gastgeber, nur eigene
// Objekte) erzwingt das Backend — hier wird nichts davon dupliziert.
import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type {
  Cohost,
  CohostAccess,
  CohostInviteResult,
  ShareKind,
} from "./cohosts";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; fehler: string };

function fehlerAus(exc: unknown, standard: string): { ok: false; fehler: string } {
  // Die Fehlermeldung des Backends ist fachlich formuliert („Ein Objekt kann
  // höchstens 10 Co-Gastgeber haben") und für den Nutzer besser als ein
  // generischer Text — deshalb durchreichen statt ersetzen.
  return {
    ok: false,
    fehler: exc instanceof ApiError ? exc.message : standard,
  };
}

/** Einen Co-Gastgeber einladen. Zugriff entsteht erst mit der Annahme. */
export async function ladeCohostEin(
  propertyId: string,
  email: string,
  access: CohostAccess,
  notiz: string | null,
): Promise<Ergebnis<CohostInviteResult>> {
  try {
    const data = await api<CohostInviteResult>(
      `/cohosts/property/${propertyId}/invite`,
      { method: "POST", body: { email, access, note: notiz } },
    );
    return { ok: true, data };
  } catch (exc) {
    return fehlerAus(exc, "Einladung fehlgeschlagen.");
  }
}

/**
 * Beteiligung eines Co-Gastgebers je Buchung festlegen.
 *
 * Kommt ZUSÄTZLICH zur festen Plattform-Gebühr und geht zulasten des
 * Gastgebers. Ob die Summe aufgeht, prüft das Backend — es kennt die
 * Plattform-Gebühr und die bereits vergebenen Anteile.
 */
export async function setzeCohostBeteiligung(
  propertyId: string,
  cohostId: string,
  beteiligung: {
    share_kind: ShareKind;
    share_bps?: number | null;
    share_fixed_cents?: number | null;
    share_currency?: string | null;
  },
): Promise<Ergebnis<Cohost>> {
  try {
    const data = await api<Cohost>(
      `/cohosts/property/${propertyId}/${cohostId}/share`,
      { method: "PATCH", body: beteiligung },
    );
    return { ok: true, data };
  } catch (exc) {
    return fehlerAus(exc, "Beteiligung konnte nicht gesetzt werden.");
  }
}

/** Zugriffsstufe eines Co-Gastgebers ändern. */
export async function aendereCohostZugriff(
  propertyId: string,
  cohostId: string,
  access: CohostAccess,
): Promise<Ergebnis<Cohost>> {
  try {
    const data = await api<Cohost>(
      `/cohosts/property/${propertyId}/${cohostId}`,
      { method: "PATCH", body: { access } },
    );
    return { ok: true, data };
  } catch (exc) {
    return fehlerAus(exc, "Änderung fehlgeschlagen.");
  }
}

/** Einem Co-Gastgeber den Zugriff entziehen. Wirkt sofort. */
export async function entferneCohost(
  propertyId: string,
  cohostId: string,
): Promise<Ergebnis<null>> {
  try {
    await api<null>(`/cohosts/property/${propertyId}/${cohostId}`, {
      method: "DELETE",
    });
    return { ok: true, data: null };
  } catch (exc) {
    return fehlerAus(exc, "Entfernen fehlgeschlagen.");
  }
}

/** Eine offene Einladung zurückziehen. */
export async function ziehEinladungZurueck(
  propertyId: string,
  invitationId: string,
): Promise<Ergebnis<null>> {
  try {
    await api<null>(
      `/cohosts/property/${propertyId}/invitations/${invitationId}`,
      { method: "DELETE" },
    );
    return { ok: true, data: null };
  } catch (exc) {
    return fehlerAus(exc, "Zurückziehen fehlgeschlagen.");
  }
}
