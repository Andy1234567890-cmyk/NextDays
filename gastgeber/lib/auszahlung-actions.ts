"use server";

// Auszahlungen: Konto aktivieren und Rhythmus wählen.
//
// Es gibt bewusst KEINEN manuellen Anlege-Schritt für das Auszahlungskonto:
// Es entsteht automatisch beim Speichern der Stammdaten. Hier bleibt nur die
// ausdrückliche Zustimmung — der eine Schritt, der eine echte
// Willenserklärung verlangt und deshalb nicht automatisiert werden darf.
//
// Die Nutzer-IP für den Nachweis ermittelt das Backend selbst aus dem Request
// (kein Body) — käme sie vom Client, wäre der Nachweis wertlos.
import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { AuszahlungsEinstellung, PayoutInterval } from "./auszahlungen";
import type { AuszahlungsStatus } from "./payments";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; fehler: string };

function fehlerAus(exc: unknown, standard: string): { ok: false; fehler: string } {
  // Die Backend-Meldung ist fachlich formuliert und für den Nutzer besser als
  // ein generischer Text — deshalb durchreichen statt ersetzen.
  return {
    ok: false,
    fehler: exc instanceof ApiError ? exc.message : standard,
  };
}

/** Nutzungsbedingungen annehmen — schließt die Freischaltung ab. */
export async function aktiviereAuszahlungen(
  kontoId: string,
): Promise<Ergebnis<AuszahlungsStatus>> {
  try {
    const data = await api<AuszahlungsStatus>(
      `/payments/connect/accounts/${encodeURIComponent(kontoId)}/accept-tos`,
      { method: "POST" },
    );
    return { ok: true, data };
  } catch (exc) {
    return fehlerAus(exc, "Aktivierung fehlgeschlagen.");
  }
}

/**
 * Auszahlungskonto hinterlegen oder ändern.
 *
 * Nur IBAN und Kontoinhaber — einen BIC verlangt unser Zahlungsdienst nicht,
 * die Bankkennung steckt bereits in der IBAN. Die Auszahlungswährung ergibt
 * sich aus dem Land des Kontos und wird serverseitig ermittelt, nie geraten.
 */
export async function setzeAuszahlungsKonto(
  kontoId: string,
  iban: string,
  kontoinhaber: string,
  land: string,
): Promise<Ergebnis<AuszahlungsStatus>> {
  try {
    const data = await api<AuszahlungsStatus>(
      `/payments/connect/accounts/${encodeURIComponent(kontoId)}/bank`,
      {
        method: "PUT",
        body: {
          // Leerzeichen sind in der Anzeige üblich, in der Übertragung nicht.
          iban: iban.replace(/\s+/g, ""),
          account_holder: kontoinhaber.trim(),
          country: land.toUpperCase(),
        },
      },
    );
    return { ok: true, data };
  } catch (exc) {
    return fehlerAus(exc, "Bankverbindung konnte nicht gespeichert werden.");
  }
}

/** Auszahlungsrhythmus ändern (täglich, wöchentlich, monatlich). */
export async function setzeAuszahlungsRhythmus(
  interval: PayoutInterval,
): Promise<Ergebnis<AuszahlungsEinstellung>> {
  try {
    const data = await api<AuszahlungsEinstellung>("/payouts/settings", {
      method: "PUT",
      body: { interval },
    });
    return { ok: true, data };
  } catch (exc) {
    return fehlerAus(exc, "Rhythmus konnte nicht gespeichert werden.");
  }
}
