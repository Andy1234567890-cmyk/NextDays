// Data-Layer Steuerzahler-Angaben (Server Component) über den DAL.
// GET /taxpayer liefert die Einträge je Land, die noch fehlenden Länder (vom
// Server aus den Objekten abgeleitet) und die USt-IdNr. aus dem Rechnungsprofil.
//
// Hintergrund: Als Plattform müssen wir nach DAC7/PStTG Angaben über unsere
// Anbieter erheben und jährlich melden — je Land, in dem der Betrieb ansässig
// ist oder Objekte hat.
import { api, ApiError } from "./api-server";

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

/** Steuerangaben des Betriebs (oder null bei fehlendem Zugriff/Rolle —
 *  die UI zeigt dann eine Meldung, keinen Fantasie-Default). */
export async function getTaxpayerOverview(): Promise<TaxpayerOverview | null> {
  try {
    return await api<TaxpayerOverview>("/taxpayer");
  } catch (exc) {
    if (exc instanceof ApiError) return null;
    throw exc;
  }
}

/** Eingabedaten des Wizards. Welche Felder Pflicht sind, prüft der Server
 *  (und zusätzlich ein DB-Constraint) — die UI führt nur durch die Schritte. */
export interface TaxpayerInput {
  country: string;
  kind: TaxpayerKind;
  tin?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  birth_place_city?: string | null;
  birth_place_country?: string | null;
  legal_name?: string | null;
  business_registration_number?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
}

// --- § 14 Abs. 4 Nr. 6 PStTG: Grundbuchnummer je Objekt ---------------------
//
// Es ist bewusst nur EIN erfassbares Feld: Die Anschrift (Nr. 1) steht schon am
// Objekt, Vergütung und Vermietungstage (Nr. 2/3/5) rechnet der Server aus den
// Buchungen, die Art (Nr. 4) leitet er aus dem Objekttyp ab.
//
// Genauso lösen es Airbnb ("Katasternummer … für jede Unterkunft") und Booking
// ("separately for each property in the Extranet"): Steuerdaten am Konto,
// Grundbuchnummer am Objekt.

export interface ObjektAngabeStatus {
  property_id: string;
  title: string | null;
  city: string | null;
  country: string | null;
  land_registration_number: string | null;
  /** Der Gastgeber hat erklärt, dass es keine Nummer gibt. */
  land_registration_unavailable: boolean;
  /** Beleg der Erhebung — auch wenn das Ergebnis „keine Nummer" war. */
  confirmed_at: string | null;
}

/** Erhoben ist erhoben: eine Nummer ODER die Erklärung, dass keine existiert. */
export function angabeErledigt(a: ObjektAngabeStatus): boolean {
  return Boolean(a.land_registration_number || a.land_registration_unavailable);
}

/** Stand der Grundbuchnummern je Objekt (null bei fehlendem Zugriff). */
export async function getObjektangaben(): Promise<ObjektAngabeStatus[] | null> {
  try {
    return await api<ObjektAngabeStatus[]>("/taxpayer/objekte");
  } catch (exc) {
    if (exc instanceof ApiError) return null;
    throw exc;
  }
}

// --- Meldedatensatz (§ 6 Abs. 7 + § 14 Abs. 4) ------------------------------

export interface Meldeeinheit {
  anschrift: string;
  country: string | null;
  /** Mehrere Objekte, wenn sie nach § 6 Abs. 7 eine Einheit bilden. */
  property_ids: string[];
  art: string | null;
  land_registration_number: string | null;
  /** Schlüssel 1..4 — § 14 Abs. 4 Nr. 2 verlangt die Quartalsaufteilung. */
  verguetung_je_quartal: Record<string, string>;
  verguetung_gesamt: string;
  anzahl_taetigkeiten: number;
  vermietete_tage: number;
  currency: string | null;
  /** false = eine Pflichtangabe fehlt, die Einheit ist so nicht meldbar. */
  meldefaehig: boolean;
}

export interface MeldeUebersicht {
  jahr: number;
  einheiten: Meldeeinheit[];
  nicht_meldefaehig: number;
}

/** Der Meldedatensatz eines Kalenderjahres (null bei fehlendem Zugriff). */
export async function getMeldung(
  jahr: number,
): Promise<MeldeUebersicht | null> {
  try {
    return await api<MeldeUebersicht>(`/taxpayer/meldung/${jahr}`);
  } catch (exc) {
    if (exc instanceof ApiError) return null;
    throw exc;
  }
}

// --- Landesregeln (weltweit) ------------------------------------------------
//
// Welche Nummer ein Land erwartet, ob der Geburtsort sie ersetzen darf und was
// eine fehlende Nummer kostet, entscheidet der SERVER (tax_country_rules).
// Der Client hält keine zweite Kopie: die Sätze sind geldwirksam (Mexiko
// 4 % → 20 %, Indien 0,1 % → 5 %) und ändern sich per Gesetz.

export interface LandRegel {
  country: string;
  /** oecd_dpi | us_irs | national | registration | id_collection_prohibited | none */
  regime: string;
  reporting_authority: string | null;
  /** Erwartete Identifikatoren (tin/ssn/rfc/pan …). Leer = keiner. */
  required_ids: string[];
  /** Nur im OECD-Raum: Geburtsort darf die fehlende Steuer-ID ersetzen. */
  birthplace_substitutes_id: boolean;
  erhebt_steuerangaben: boolean;
  /** Die Erhebung der Personen-ID ist rechtlich unzulässig (CH, JP). */
  id_erhebung_verboten: boolean;
  /** Basispunkte: 10 = 0,1 %. Als Prozent-Integer wäre 0,1 % nicht darstellbar. */
  host_tax_bps_with_id: number | null;
  host_tax_bps_without_id: number | null;
  legal_basis: string | null;
  notes: string | null;
}

/** Alle Länder mit hinterlegter Steuerregel (null bei fehlendem Zugriff). */
export async function getLaenderRegeln(): Promise<LandRegel[] | null> {
  try {
    return await api<LandRegel[]>("/taxpayer/laender");
  } catch (exc) {
    if (exc instanceof ApiError) return null;
    throw exc;
  }
}
