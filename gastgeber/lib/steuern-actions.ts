"use server";

// Schreib-Actions Steuern (Server Actions über den Host-Cookie-DAL).
// Die fachliche Prüfung liegt beim Backend (Pydantic + DB-Constraint aus 0226);
// hier wird die Backend-Meldung 1:1 durchgereicht, damit der Nutzer erfährt,
// welches Feld fehlt — kein generisches „Fehler" (Wurzel 5).
import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { TaxpayerEntry, TaxpayerInput, TaxpayerOverview } from "./steuern";

type Ergebnis =
  | { ok: true; uebersicht: TaxpayerOverview }
  | { ok: false; error: string };

async function frischeUebersicht(): Promise<TaxpayerOverview> {
  return api<TaxpayerOverview>("/taxpayer");
}

/** Steuerangaben für ein Land anlegen oder ersetzen (Selbstauskunft). */
export async function speichereSteuerangaben(
  daten: TaxpayerInput,
): Promise<Ergebnis> {
  try {
    await api<TaxpayerEntry>("/taxpayer", { method: "PUT", body: daten });
    const uebersicht = await frischeUebersicht();
    revalidatePath("/konto");
    return { ok: true, uebersicht };
  } catch (exc) {
    return {
      ok: false,
      error:
        exc instanceof ApiError
          ? exc.message
          : "Steuerangaben konnten nicht gespeichert werden.",
    };
  }
}

/** Steuerangaben eines Landes entfernen. */
export async function loescheSteuerangaben(country: string): Promise<Ergebnis> {
  try {
    await api(`/taxpayer/${encodeURIComponent(country)}`, { method: "DELETE" });
    const uebersicht = await frischeUebersicht();
    revalidatePath("/konto");
    return { ok: true, uebersicht };
  } catch (exc) {
    return {
      ok: false,
      error:
        exc instanceof ApiError
          ? exc.message
          : "Steuerangaben konnten nicht entfernt werden.",
    };
  }
}

/** USt-IdNr. gegen VIES prüfen (offizieller EU-Prüfdienst).
 *
 *  Bewusst nur PRÜFEN, nicht speichern: die USt-IdNr. gehört ins Rechnungs-
 *  profil (Unternehmen-Tab), nicht in die Steuerzahler-Angaben. Zwei
 *  Speicherorte für denselben Wert wären ein Datenfehler (Wurzel 4). */
export async function pruefeUstId(
  vatId: string,
): Promise<
  | { ok: true; gueltig: boolean; name: string | null; adresse: string | null }
  | { ok: false; error: string }
> {
  try {
    const res = await api<{
      vatId: string;
      valid: boolean;
      name: string | null;
      address: string | null;
    }>(`/buchhaltung/vat-check?vat_id=${encodeURIComponent(vatId)}`);
    return {
      ok: true,
      gueltig: res.valid,
      name: res.name,
      adresse: res.address,
    };
  } catch (exc) {
    return {
      ok: false,
      error:
        exc instanceof ApiError
          ? exc.message
          : "Die Prüfung ist derzeit nicht möglich.",
    };
  }
}
