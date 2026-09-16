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
import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { AuszahlungsEinstellung, PayoutInterval } from "./auszahlungen";
import {
  getAuszahlungsKontoId,
  getAuszahlungsStatus,
  getLandAnforderungen,
  type AuszahlungsStatus,
  type LandAnforderungen,
} from "./payments";
import type { Account } from "./konto";
import type { Unternehmensprofil } from "./unternehmen";
import { ausKontoErgaenzen } from "./vermieterdaten";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; fehler: string };

function fehlerAus(exc: unknown, standard: string): { ok: false; fehler: string } {
  // Die Backend-Meldung ist fachlich formuliert und für den Nutzer besser als
  // ein generischer Text — deshalb durchreichen statt ersetzen.
  return {
    ok: false,
    fehler: exc instanceof ApiError ? exc.message : standard,
  };
}

/**
 * Die GESPEICHERTEN Stammdaten erneut an den Zahlungsanbieter übertragen.
 *
 * Der Sync läuft sonst nur beim Speichern des Formulars. Scheitert er dort
 * (abgelehntes Feld, Anbieter kurz weg), stünden die Angaben bei uns, beim
 * Anbieter aber nicht — und die Karte verlangte Felder, die längst ausgefüllt
 * sind. Liefert das Profil samt `stripeSyncError` (null = alles angekommen).
 */
export async function synceStammdaten(): Promise<Ergebnis<Unternehmensprofil>> {
  try {
    const data = await api<Unternehmensprofil>(
      "/buchhaltung/companies/self/stripe-sync",
      { method: "POST" },
    );
    revalidatePath("/konto");
    return { ok: true, data };
  } catch (exc) {
    return fehlerAus(exc, "Übertragung an den Zahlungsanbieter fehlgeschlagen.");
  }
}

/**
 * Nutzungsbedingungen annehmen — schließt die Freischaltung ab.
 *
 * ERST die gespeicherten Stammdaten übertragen, DANN zustimmen: sonst ist die
 * Zustimmung da, aber die Angaben fehlen beim Anbieter, und der Account bleibt
 * eingeschränkt, obwohl der Nutzer alles ausgefüllt hat.
 */
export async function aktiviereAuszahlungen(
  kontoId: string,
): Promise<Ergebnis<AuszahlungsStatus> & { syncFehler?: string | null }> {
  const sync = await synceStammdaten();
  if (!sync.ok) return sync;
  try {
    const data = await api<AuszahlungsStatus>(
      `/payments/connect/accounts/${encodeURIComponent(kontoId)}/accept-tos`,
      { method: "POST" },
    );
    revalidatePath("/konto");
    return { ok: true, data, syncFehler: sync.data.stripeSyncError };
  } catch (exc) {
    return fehlerAus(exc, "Aktivierung fehlgeschlagen.");
  }
}

/** Live-Status neu laden (Polling der Karte, solange nicht freigeschaltet). */
export async function ladeAuszahlungsStatus(
  kontoId: string,
): Promise<Ergebnis<AuszahlungsStatus>> {
  const data = await getAuszahlungsStatus(kontoId);
  if (!data) {
    return { ok: false, fehler: "Status beim Zahlungsanbieter nicht abrufbar." };
  }
  return { ok: true, data };
}

/** Pflichtfelder des Zahlungsanbieters für ein Land (live, kein Hardcode). */
export async function ladeLandAnforderungen(
  land: string,
): Promise<Ergebnis<LandAnforderungen>> {
  const data = await getLandAnforderungen(land);
  if (!data) {
    return { ok: false, fehler: "Länderregeln des Zahlungsanbieters nicht abrufbar." };
  }
  return { ok: true, data };
}

/**
 * Eine Angabe DIREKT an den Zahlungsanbieter geben, ohne sie bei uns zu
 * speichern — für die persönliche Kennnummer (individual.id_number), die in
 * einigen Ländern Pflicht ist. Sie ist ein Ausweisdatum: der Anbieter liefert
 * sie nie zurück, und in tenant_billing_profile hat sie nichts verloren.
 */
export async function setzeKennnummer(
  kontoId: string,
  kennnummer: string,
): Promise<Ergebnis<AuszahlungsStatus>> {
  const wert = kennnummer.replace(/\s+/g, "");
  if (wert.length < 4) {
    return { ok: false, fehler: "Bitte die vollständige Kennnummer eingeben." };
  }
  try {
    const data = await api<AuszahlungsStatus>(
      `/payments/connect/accounts/${encodeURIComponent(kontoId)}`,
      { method: "PATCH", body: { fields: { individual: { id_number: wert } } } },
    );
    revalidatePath("/konto");
    return { ok: true, data };
  } catch (exc) {
    return fehlerAus(exc, "Kennnummer konnte nicht übermittelt werden.");
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

/**
 * Bankverbindung hinterlegen — auch dann, wenn es noch kein Auszahlungskonto
 * gibt.
 *
 * Bis zum 16.09.2026 war das eine Sackgasse: die IBAN geht zum Zahlungsanbieter
 * und braucht dort ein Konto, das Konto entstand aber nur beim Speichern der
 * Vermieterdaten. Wer die Bankverbindung eintragen wollte, las stattdessen
 * „trag erst woanders etwas ein" — und genau das darf ein Onboarding nicht.
 *
 * Fehlt das Konto, wird es hier angelegt, und zwar aus Angaben, die schon
 * vorliegen oder gerade eingegeben wurden — NICHTS wird geraten (Wurzel 4):
 *   * `land` ist das Land, das der Gastgeber im Bankformular gewählt hat. Es
 *     bestimmt Kontoland UND Auszahlungswährung; beim Anbieter ist es später
 *     nicht mehr änderbar, deshalb wird es gefragt und nicht aus der
 *     Wohnanschrift abgeleitet.
 *   * die E-Mail-Adresse ist die des eingeloggten Kontos, falls in den
 *     Vermieterdaten noch keine steht. Dieselbe Person, dieselbe Adresse.
 * Beides wird in die Vermieterdaten geschrieben, nicht nur an den Anbieter
 * gesendet — sonst stünde dort weiter „fehlt", während das Konto längst läuft.
 */
export async function hinterlegeBankverbindung(
  kontoId: string | null,
  iban: string,
  kontoinhaber: string,
  land: string,
): Promise<Ergebnis<AuszahlungsStatus>> {
  let id = kontoId;
  if (!id) {
    try {
      const [roh, konto] = await Promise.all([
        api<Unternehmensprofil>("/buchhaltung/companies/self", {
          cache: "no-store",
        }),
        api<Account>("/auth/account", { cache: "no-store" }),
      ]);
      // Dieselbe Ergänzung wie im Vermieterdaten-Reiter — eine Stelle, ein
      // Ergebnis. Bei einem privaten Vermieter stehen Anschrift, Telefon und
      // E-Mail in den persönlichen Informationen; hier gehen sie mit, damit
      // das Konto nicht mit halben Angaben entsteht.
      const profil = ausKontoErgaenzen(roh, konto);
      if (!profil.email) {
        return {
          ok: false,
          fehler:
            "Für das Auszahlungskonto fehlt eine E-Mail-Adresse. Trage sie in deinen Vermieterdaten ein.",
        };
      }
      await api<Unternehmensprofil>("/buchhaltung/companies/self", {
        method: "PATCH",
        // Vollständiger Stand plus das gewählte Land — ein Teil-Update würde
        // die übrigen Angaben beim Anbieter leeren (siehe unternehmen-actions).
        body: { ...profil, companyCountry: land.toUpperCase() },
      });
      id = await getAuszahlungsKontoId();
    } catch (exc) {
      return fehlerAus(exc, "Auszahlungskonto konnte nicht angelegt werden.");
    }
    if (!id) {
      return {
        ok: false,
        fehler: "Auszahlungskonto konnte nicht angelegt werden.",
      };
    }
  }
  const res = await setzeAuszahlungsKonto(id, iban, kontoinhaber, land);
  if (res.ok) revalidatePath("/konto");
  return res;
}
