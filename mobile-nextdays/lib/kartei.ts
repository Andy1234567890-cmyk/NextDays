// Objektkartei (Dossier) der Mobile-App — gegen den FastAPI-Slice
// `/api/v1/property-dossier`, dieselben Daten wie der Stepper im Web
// (web/components/objekte/kartei/dossier-stepper.tsx).
//
// WOFÜR DIE APP SIE BRAUCHT: die Agentur steht beim Kunden VOR ORT und legt
// ihn dort an. Genau dann liegen die Angaben vor, nach denen später niemand
// mehr sucht — wo der Schlüssel hängt, welcher Elektriker kommt, ab welchem
// Betrag ohne Rückfrage repariert werden darf. Am Schreibtisch fehlt das.
//
// Bewusst NICHT gespiegelt: Stufe 1 zeigt die Eigentümer-Bankverbindung
// (IBAN, CPR, Steuernummer). Sie wird hier nicht geladen — auf einem Gerät,
// das beim Kunden auf dem Tisch liegt, hat sie nichts zu suchen, und die App
// braucht sie für nichts. Wer sie pflegt, tut das im Web unter /eigentuemer.
//
// Lesen UND Schreiben verlangen serverseitig `manage_properties` — dieselbe
// Fähigkeit, die schon die Zusatzfelder gaten. Die App prüft sie über
// `can(me, "manage_properties")`, damit gar nicht erst ein Formular erscheint,
// das der Server danach mit 403 abweist; die echte Kontrolle bleibt der Server.
import { call, type Result } from "@/lib/api";

// --- Stufe 2: Prozess & Vertrag ---------------------------------------------
// Alle Felder sind Datumsangaben im ISO-Format (YYYY-MM-DD) oder null. null
// heißt „noch nicht passiert" — nie durch das heutige Datum ersetzen, das wäre
// eine Falschaussage über einen Vorgang (Wurzel 5b).
export type ProzessDaten = {
  first_meeting_at: string | null;
  contract_sent_at: string | null;
  contract_signed_at: string | null;
  onboarding_invoice_sent_at: string | null;
  onboarding_invoice_paid_at: string | null;
};

// --- Stufe 3: Zugang & Technik ----------------------------------------------
export type ZugangDaten = {
  // agency_extra = die Agentur hat einen Zweitschlüssel; owner_only = nur der
  // Eigentümer. null = nicht erfasst.
  key_status: string | null;
  key_placement: string | null;
};

// --- Stufe 4: Servicevereinbarungen (1:n) -----------------------------------
export type Servicevereinbarung = {
  id: string;
  service_type: string;
  frequency: string | null;
  price: number | null;
  // Währung kommt IMMER aus den Daten. Fehlt sie, wird der Betrag symbollos
  // gerendert — nie ein € erfinden (Wurzel 4).
  currency: string | null;
  notes: string | null;
};

// --- Stufe 5: Handwerker (1:n) + Notfall-Vollmacht ---------------------------
export type Handwerker = {
  id: string;
  trade: string;
  name: string | null;
  phone: string | null;
  notes: string | null;
};

export type NotfallVollmacht = {
  // up_to_amount = bis zu einem Betrag ohne Rückfrage; always_owner = immer
  // fragen. null = nicht erfasst, also im Zweifel fragen.
  authority_mode: string | null;
  authority_limit: number | null;
  currency: string | null;
};

// --- Stufe 6: Marketing ------------------------------------------------------
export type MarketingDaten = {
  photographer_booked_at: string | null;
  media_received_at: string | null;
  site_walkthrough_at: string | null;
  defects_list_sent_at: string | null;
};

// --- Stufe 7: Hausmappe ------------------------------------------------------
export type HausmappeDaten = {
  welcome_text_status: string | null;
  physical_folder_placed: boolean;
  // Geheimtipps des Eigentümers (0582) — genau das, was vor Ort erzählt wird
  // und sonst verloren geht. Der Server begrenzt auf 5000 Zeichen.
  secret_tips: string | null;
};

// --- Stufe 8: Plattform-Starts (1:n) ----------------------------------------
export type PlattformStart = {
  id: string;
  platform: string;
  launch_at: string | null;
  status: string | null;
};

/** Das Aggregat, das die Kartei-Übersicht speist (GET .../full). */
export type KarteiGesamt = {
  process: ProzessDaten;
  access: ZugangDaten;
  service_agreements: Servicevereinbarung[];
  tradespeople: Handwerker[];
  emergency_authority: NotfallVollmacht;
  marketing: MarketingDaten;
  housebook: HausmappeDaten;
  platform_launches: PlattformStart[];
};

export async function getKartei(propertyId: string): Promise<Result<KarteiGesamt>> {
  return call(`/property-dossier/${propertyId}/full`);
}

// --- Schreibwege --------------------------------------------------------------
// PUT, nicht PATCH: der Server ersetzt den Stufen-Datensatz vollständig. Der
// Aufrufer schickt deshalb IMMER das komplette Objekt (Bestand + Änderung),
// sonst leert er stillschweigend die Felder, die er nicht mitsendet.

export async function putProzess(
  propertyId: string,
  daten: ProzessDaten,
): Promise<Result<ProzessDaten>> {
  return call(`/property-dossier/${propertyId}/process`, { method: "PUT", body: daten });
}

export async function putZugang(
  propertyId: string,
  daten: ZugangDaten,
): Promise<Result<ZugangDaten>> {
  return call(`/property-dossier/${propertyId}/access`, { method: "PUT", body: daten });
}

export async function putHausmappe(
  propertyId: string,
  daten: HausmappeDaten,
): Promise<Result<HausmappeDaten>> {
  return call(`/property-dossier/${propertyId}/housebook`, { method: "PUT", body: daten });
}

export async function putNotfallVollmacht(
  propertyId: string,
  daten: NotfallVollmacht,
): Promise<Result<NotfallVollmacht>> {
  return call(`/property-dossier/${propertyId}/emergency-authority`, {
    method: "PUT",
    body: daten,
  });
}

export async function putMarketing(
  propertyId: string,
  daten: MarketingDaten,
): Promise<Result<MarketingDaten>> {
  return call(`/property-dossier/${propertyId}/marketing`, { method: "PUT", body: daten });
}

// Handwerker: die Liste, die vor Ort wirklich entsteht.
export async function addHandwerker(
  propertyId: string,
  eintrag: Omit<Handwerker, "id">,
): Promise<Result<Handwerker>> {
  return call(`/property-dossier/${propertyId}/tradespeople`, {
    method: "POST",
    body: eintrag,
  });
}

export async function deleteHandwerker(
  propertyId: string,
  itemId: string,
): Promise<Result<void>> {
  return call(`/property-dossier/${propertyId}/tradespeople/${itemId}`, { method: "DELETE" });
}

export async function addServicevereinbarung(
  propertyId: string,
  eintrag: Omit<Servicevereinbarung, "id">,
): Promise<Result<Servicevereinbarung>> {
  return call(`/property-dossier/${propertyId}/service-agreements`, {
    method: "POST",
    body: eintrag,
  });
}

export async function deleteServicevereinbarung(
  propertyId: string,
  itemId: string,
): Promise<Result<void>> {
  return call(`/property-dossier/${propertyId}/service-agreements/${itemId}`, {
    method: "DELETE",
  });
}
