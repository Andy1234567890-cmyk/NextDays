"use server";

// Spendenanteil festlegen (Schreiben). Läuft server-zu-server; die Regeln
// (Obergrenze, Empfänger muss aktiv sein, Auszahlungskonto nötig, Zustimmung)
// erzwingt das Backend — hier wird nichts davon dupliziert.
import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { SpendenEinstellung } from "./spenden";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; fehler: string };

/**
 * Spendensatz setzen oder ändern.
 *
 * `shareBps` = 0 schaltet die Spende ab; dann sind Empfänger und Zustimmung
 * nicht nötig.
 */
export async function setzeSpendenAnteil(
  shareBps: number,
  recipientId: string | null,
  akzeptiert: boolean,
): Promise<Ergebnis<SpendenEinstellung>> {
  try {
    const data = await api<SpendenEinstellung>("/donations/settings", {
      method: "PUT",
      body: {
        share_bps: shareBps,
        recipient_id: recipientId,
        accept_terms: akzeptiert,
      },
    });
    return { ok: true, data };
  } catch (exc) {
    // Die Backend-Meldung nennt die konkrete Grenze („höchstens 2,00 %") und
    // ist für den Nutzer besser als ein generischer Text.
    return {
      ok: false,
      fehler:
        exc instanceof ApiError
          ? exc.message
          : "Spendenanteil konnte nicht gespeichert werden.",
    };
  }
}
