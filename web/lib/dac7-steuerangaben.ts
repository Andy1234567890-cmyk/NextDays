// Die Voraussetzungen der DAC7-Meldung: Steuerangaben des Betriebs und
// Grundbuchnummern je Objekt.
//
// Beide gehören zum taxpayer-Slice, sind aber KEIN Teil der Meldung selbst —
// sie werden einmal erfasst und selten geändert. Das DAC7-Modul liest sie
// nur, um vor dem Berechnen zu sagen, was noch fehlt: Ohne diese Prüfung
// bricht die Meldung mit „geht nicht" ab, ohne dass jemand weiß, woran es
// liegt.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type TaxpayerKind = "individual" | "entity";

export interface TaxpayerEntry {
  id: string;
  country: string;
  kind: TaxpayerKind;
  tin: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  birth_place_city: string | null;
  birth_place_country: string | null;
  legal_name: string | null;
  business_registration_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  confirmed_at: string | null;
  updated_at: string | null;
}

export interface TaxpayerOverview {
  eintraege: TaxpayerEntry[];
  /** Länder mit Objekten, für die noch keine Steuerangaben vorliegen. */
  fehlende_laender: string[];
  /** Nur zur Anzeige — gespeichert wird sie im Rechnungsprofil, nicht hier. */
  vat_id: string | null;
}

export interface ObjektAngabeStatus {
  property_id: string;
  title: string | null;
  city: string | null;
  country: string | null;
  /** BFE-Nummer: die dänische Kennung der Immobilie, aus der Objektkartei.
   *  Für eine dänische Meldung die maßgebliche Objektkennung
   *  (RS_ACT_DK_REAL_PROP_REG_NUM) — die Matrikelnummer daneben ist ein
   *  anderes Feld der Vorlage. */
  bfe_number: string | null;
  land_registration_number: string | null;
  /** Der Betrieb hat erklärt, dass es keine Nummer gibt. */
  land_registration_unavailable: boolean;
  /** Beleg der Erhebung — auch wenn das Ergebnis „keine Nummer" war. */
  confirmed_at: string | null;
}

/** Erhoben ist erhoben: eine Nummer ODER die Erklärung, dass keine existiert.
 *
 *  Die BFE-Nummer zählt mit — ein dänisches Objekt wird über sie gemeldet.
 *  Ohne diesen Zweig galten 18 gepflegte Objekte als „ohne Angabe". */
export function angabeErledigt(a: ObjektAngabeStatus): boolean {
  return Boolean(
    a.bfe_number ||
      a.land_registration_number ||
      a.land_registration_unavailable,
  );
}

/** Steuerangaben des Betriebs (null bei fehlendem Zugriff/Rolle — die UI
 *  zeigt dann eine Meldung, keinen Fantasie-Default). */
export async function getTaxpayerOverview(): Promise<TaxpayerOverview | null> {
  try {
    return await api<TaxpayerOverview>("/taxpayer", {
      token: (await currentToken()) ?? undefined,
    });
  } catch (exc) {
    if (exc instanceof ApiError) return null;
    throw exc;
  }
}

/** Stand der Grundbuchnummern je Objekt (null bei fehlendem Zugriff). */
export async function getObjektangaben(): Promise<
  ObjektAngabeStatus[] | null
> {
  try {
    return await api<ObjektAngabeStatus[]>("/taxpayer/objekte", {
      token: (await currentToken()) ?? undefined,
    });
  } catch (exc) {
    if (exc instanceof ApiError) return null;
    throw exc;
  }
}
