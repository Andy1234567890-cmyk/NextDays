"use server";

// Eigentümer-Verwaltung: Server-Actions gegen den FastAPI-owners-Slice
// (/api/v1/owners). Die Agentur verwaltet Objekte für fremde Eigentümer —
// Stammdaten, Auszahlungs-/Provisions-Konfig, Objekt-Zuordnung. Business-Logik
// bleibt im Backend (PROJECT.md §2).
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type StatementFrequency = "none" | "monthly";

export type OwnerPropertyLink = {
  property_id: string;
  ownership_share: number;
  commission_override_pct: number | null;
};

export type Owner = {
  id: string;
  tenant_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  // Sprache, in der dieser Eigentümer seine E-Mails bekommt (ISO-639-1, eine
  // der 24 Locales aus i18n/locales.ts). null = noch nicht erfasst.
  //
  // Der Wert hängt bewusst am EIGENTÜMER-Stammdatensatz, nicht am Login: ein
  // Eigentümer bekommt Abrechnungsmails (owner_statements), auch wenn er gar
  // keinen Zugang hat (`user_id` = null). Ein Sprachfeld nur am Login würde
  // genau diese Empfänger nicht erreichen.
  //
  // FELDNAME: `language` — so heißt die Spalte (`owners.language`, 0335) und so
  // heißt das Feld im Contract (`OwnerBase.language`, owners/schemas.py).
  //
  // Vorher stand hier `preferred_language`, geraten nach dem Muster von
  // `users.preferred_language`. Das Backend kennt kein Pydantic-Alias und
  // verbietet Extra-Felder nicht: die gewählte Sprache wurde deshalb bei JEDEM
  // Speichern still verworfen — kein 422, keine Meldung, der Wert kam nie in
  // der DB an. Der Feldname folgt dem Server, nicht dem Nachbar-Slice.
  language: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  tax_id: string | null;
  vat_id: string | null;
  iban: string | null;
  bic: string | null;
  bank_name: string | null;
  account_holder: string | null;
  /** Standard-Provisionssatz. `null` = noch nicht vereinbart — NICHT 0 %.
   *  Ohne Satz weist die Abrechnung die Auszahlungen als „—" aus, statt dem
   *  Eigentümer stillschweigend 100 % zuzuschlagen (Wurzel 4). */
  default_commission_pct: number | null;
  default_payout_method: string | null;
  statement_frequency: StatementFrequency;
  notes: string | null;
  // Der verknüpfte Portal-Login (`owners.user_id`). null = dieser Eigentümer
  // bekommt Abrechnungsmails, hat aber keinen Zugang zum Portal. Ohne diesen
  // Link sieht ein eingeloggter Eigentümer KEINE Abrechnungen —
  // owner_statements löst seine owner_id genau darüber auf.
  user_id: string | null;
  // True, wenn im selben Aufruf ein Portalzugang eingerichtet UND die
  // Einladungsmail zugestellt wurde. Nur eine Rückmeldung auf genau diesen
  // Vorgang, keine Aussage über frühere Einladungen.
  einladung_versendet?: boolean;
  properties: OwnerPropertyLink[];
  created_at: string | null;
  updated_at: string | null;
};

export type OwnerListItem = Omit<Owner, "properties"> & {
  property_count: number;
  // Effektive Provisions-Spanne über die Objekte (Override je Objekt, sonst
  // Owner-Default). null = noch keine Objekte zugeordnet.
  commission_min: number | null;
  commission_max: number | null;
  /** Wie viele zugeordnete Objekte KEINEN Satz haben. > 0 heisst: die Spanne
   *  oben beschreibt nur einen Teil. */
  commission_missing_count: number;
};

export type OwnerInput = Partial<
  Omit<Owner, "id" | "tenant_id" | "properties" | "created_at" | "updated_at">
> & { name?: string };

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error =
      exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

export async function listOwners(): Promise<
  Result<{ items: OwnerListItem[]; total: number }>
> {
  return call("/owners");
}

export async function getOwner(id: string): Promise<Result<Owner>> {
  return call(`/owners/${id}`);
}

export async function createOwner(
  input: OwnerInput & {
    /**
     * Portalzugang gleich mit einrichten: legt zusätzlich einen Login-Nutzer
     * mit der Rolle `owner` an, verschickt die Einladungsmail (in der unter
     * `language` gewählten Sprache) und verknüpft `owners.user_id`.
     *
     * Ohne `email` weist das Backend das mit 422 ab — der Einmal-Link braucht
     * ein Postfach. Die UI deaktiviert die Option deshalb, solange kein
     * gültiges Feld ausgefüllt ist.
     */
    portalzugang?: boolean;
    /**
     * Objekte, die diesem Eigentümer SOFORT gehören sollen — im selben Aufruf,
     * nicht als Folge-Request. Scheitert eine der Zuordnungen (fremdes Objekt,
     * inzwischen anderweitig vergeben), wird der Eigentümer gar nicht erst
     * angelegt: sonst bliebe er ohne seine Objekte in der Liste stehen.
     *
     * Leer ist der Normalfall und erlaubt — ein Eigentümer darf vor seinem
     * Objekt erfasst werden.
     */
    property_ids?: string[];
  },
): Promise<Result<Owner>> {
  return call("/owners", { method: "POST", body: input });
}

/** Ein Objekt in der Mehrfachauswahl (Anlege-Dialog und Detailseite). */
export type FreieObjektOption = {
  id: string;
  title: string;
  subtitle?: string;
  photo?: string;
};

/**
 * Portalzugang für einen BESTEHENDEN Eigentümer nachträglich einrichten.
 *
 * Zweiter Weg zum selben Ziel: wer beim Anlegen noch keine Adresse hatte,
 * kommt hierüber — ohne dieselbe Person unter /konto/nutzer ein zweites Mal
 * anzulegen. Idempotent: gibt es zu der Adresse schon einen Login im Betrieb,
 * wird dieser verknüpft statt ein zweiter angelegt.
 */
export async function inviteOwnerPortal(
  ownerId: string,
): Promise<Result<Owner>> {
  return call(`/owners/${ownerId}/portalzugang`, { method: "POST" });
}

/**
 * Die Zugangs-Einladung an einen BEREITS eingeladenen Eigentümer erneut senden.
 *
 * Für den Fall, dass die erste Mail nie ankam oder der Sieben-Tage-Token
 * abgelaufen ist. Setzt einen Portalzugang voraus (`owner.user_id`); ohne ihn
 * antwortet der Server mit 409 — dann ist `inviteOwnerPortal` der richtige Weg.
 *
 * Der alte Link wird dabei ENTWERTET: es gilt immer nur der neueste, sonst
 * wüchse mit jedem Klick die Zahl gültiger Zugänge zu demselben Konto.
 *
 * Antwort ist 204 ohne Inhalt — an den Stammdaten ändert sich nichts.
 */
export async function resendOwnerInvite(
  ownerId: string,
): Promise<Result<null>> {
  return call(`/owners/${ownerId}/portalzugang/erneut-senden`, {
    method: "POST",
  });
}

export async function updateOwner(
  id: string,
  input: OwnerInput,
): Promise<Result<Owner>> {
  return call(`/owners/${id}`, { method: "PATCH", body: input });
}

export async function deleteOwner(id: string): Promise<Result<null>> {
  return call(`/owners/${id}`, { method: "DELETE" });
}

/**
 * Objekte, die diesem Eigentümer zugeordnet werden dürfen: frei (keinem Owner
 * zugeordnet) oder bereits dieser Owner. Objekte anderer Eigentümer fehlen —
 * ein Objekt gehört genau einem Eigentümer.
 */
export async function getAvailableProperties(
  ownerId: string,
): Promise<Result<{ items: FreieObjektOption[] }>> {
  return call(`/owners/${ownerId}/available-properties`);
}

/**
 * Objekte OHNE Eigentümer — die Auswahl beim ANLEGEN eines Eigentümers.
 *
 * `getAvailableProperties` geht dafür nicht: es braucht eine owner_id, um
 * „frei ODER schon seins" zu prüfen, und die gibt es vor dem Anlegen noch
 * nicht. Serverseitig ist es derselbe Filter mit leerer zweiter Hälfte.
 */
export async function getFreeProperties(): Promise<
  Result<{ items: FreieObjektOption[] }>
> {
  return call("/owners/free-properties");
}

/**
 * Mehrere Objekte auf einmal zuordnen (Mehrfachauswahl der Detailseite).
 *
 * Ein Aufruf statt n: alle genannten Objekte werden serverseitig gegen den
 * Mandanten geprüft, bevor eines geschrieben wird. Ist eines inzwischen
 * anderweitig vergeben, scheitert der ganze Aufruf mit 409 und NENNT das
 * Objekt — kein stilles Überspringen.
 */
export async function assignOwnerProperties(
  ownerId: string,
  propertyIds: string[],
): Promise<Result<Owner>> {
  return call(`/owners/${ownerId}/properties/batch`, {
    method: "POST",
    body: { property_ids: propertyIds },
  });
}

/** Objekt zuordnen oder Anteil/Provisions-Override aktualisieren. */
export async function assignOwnerProperty(
  ownerId: string,
  input: {
    property_id: string;
    ownership_share?: number;
    commission_override_pct?: number | null;
  },
): Promise<Result<Owner>> {
  return call(`/owners/${ownerId}/properties`, { method: "POST", body: input });
}

export async function unassignOwnerProperty(
  ownerId: string,
  propertyId: string,
): Promise<Result<Owner>> {
  return call(`/owners/${ownerId}/properties/${propertyId}`, {
    method: "DELETE",
  });
}
