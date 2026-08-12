"use server";

// Abrechnungs-Konfiguration: Server-Actions gegen den FastAPI-owner_billing-
// Slice (/api/v1/owner-billing). Zwei Konfigurationsebenen, die zusammen die
// Abrechnung eines Betriebs beschreiben:
//
//   * Gebühren-Klassifikation — wem eine Gebühr gehört (Betrieb/Eigentümer/
//     Durchlaufposten) und ob sie provisionspflichtig ist. Zwei UNABHÄNGIGE
//     Achsen: Nebenkosten sind „Eigentümer + provisionsfrei", die Miete
//     „Eigentümer + provisionspflichtig", die Reinigung „Betrieb".
//   * Abrechnungsvertrag — Provisionssatz, Mindestprovision und optionale
//     Pauschale je Eigentümer (optional je Objekt), MIT Zeitachse.
//
// Business-Logik bleibt im Backend (PROJECT.md §2); hier steht nur der
// Transport. Insbesondere wird KEINE Auflösung nachgebaut: welcher Vertrag an
// einem Stichtag gilt, entscheidet der Server — sonst käme der Kalender des
// Browsers ins Spiel und zwei Nutzer in verschiedenen Zeitzonen sähen
// verschiedene Sätze.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

/** Wem der Gebührenbetrag gehört (Achse 1). */
export type GehoertZu = "betrieb" | "eigentuemer" | "durchlauf";

/** Bezugsgröße der Pauschale je Buchung. */
export type PauschaleBasis = "je_buchung" | "je_nacht";

/**
 * Wann die Pauschale abgezogen wird.
 *
 * Keine Formalie: `vor_provision` verkleinert die Bemessungsgrundlage und
 * damit auch die Provision, `nach_provision` wird erst vom fertigen
 * Eigentümer-Betrag abgezogen. Dieselbe Pauschale ergibt je nach Zeitpunkt
 * zwei verschiedene Zahlen.
 */
export type PauschaleZeitpunkt = "vor_provision" | "nach_provision";

export type FeeClassification = {
  id: string;
  fee_type: string;
  /** null = Regel des Betriebs. Gesetzt = Ausnahme für genau dieses Objekt. */
  property_id: string | null;
  gehoert_zu: GehoertZu;
  provisionspflichtig: boolean;
  notiz: string | null;
  zugeordnet_von: string | null;
  zugeordnet_am: string;
  created_at: string;
  updated_at: string;
};

export type FeeTypeZuordnung = {
  fee_type: string;
  /** Deutsche Fachbezeichnung aus dem Server-Katalog — nicht hier nachgebaut. */
  label: string;
  /** Wie viele Gebühren-Zeilen dieser Art im Bestand stehen. */
  anzahl: number;
  /** Namen, wie der Betrieb die Gebühren genannt hat (Wiedererkennung). */
  beispiel_namen: string[];
  /** null = diese Art ist NOCH NICHT zugeordnet. */
  klassifikation: FeeClassification | null;
  ausnahmen: FeeClassification[];
};

export type FeeClassificationUebersicht = {
  items: FeeTypeZuordnung[];
  /**
   * Wie viele benutzte Arten noch unzugeordnet sind. Kommt vom Server und
   * wird NICHT aus `items` gezählt: die Regel, was als offen gilt (nur Arten
   * mit Bestandsgebühren), gehört an die Stelle, die sie kennt.
   */
  offen: number;
};

export type FeeClassificationInput = {
  fee_type: string;
  property_id?: string | null;
  gehoert_zu: GehoertZu;
  provisionspflichtig: boolean;
  notiz?: string | null;
};

export type OwnerBillingTerms = {
  id: string;
  owner_id: string;
  /** null = gilt für alle Objekte des Eigentümers. */
  property_id: string | null;
  gueltig_ab: string;
  /** null = unbefristet. Echter Zustand, kein fehlender Wert. */
  gueltig_bis: string | null;
  provisions_pct: number;
  min_provision_betrag: number | null;
  min_provision_currency: string | null;
  pauschale_betrag: number | null;
  pauschale_currency: string | null;
  pauschale_basis: PauschaleBasis | null;
  pauschale_zeitpunkt: PauschaleZeitpunkt | null;
  notiz: string | null;
  erstellt_von: string | null;
  created_at: string;
  updated_at: string;
  /** Gilt heute? Vom Server berechnet, nicht aus den Daten abgeleitet. */
  aktuell: boolean;
  /**
   * Was dieser Vertrag am VERKAUF geändert hat (0378). Vertrag und
   * Vermarktungsende sind ein Ereignis: eine Befristung nimmt das Objekt bei
   * Booking und Airbnb aus dem Verkauf, ein Anschlussvertrag gibt es wieder
   * frei. Das darf die Agentur nicht erst im Kalender entdecken.
   *
   * Leer beim Lesen der Historie, gefüllt nach Anlegen/Ändern.
   */
  vertragsende_wirkung?: VertragsendeWirkung[];
};

/** Je berührtes Objekt, was die Kopplung dort getan hat. */
export type VertragsendeWirkung = {
  property_id: string;
  /** Neues Vermarktungsende; null = kein Ende (Objekt bleibt verkäuflich). */
  ende?: string | null;
  ende_alt?: string | null;
  /** Zahl der gesperrten Nächte im 730-Tage-Horizont. */
  gesperrte_naechte?: number;
  /** Stand schon richtig — nichts geschrieben, nichts an die Portale. */
  unveraendert?: boolean;
  /**
   * Objekt ohne Abrechnungsvertrag: das Vermarktungsende kommt dort aus dem
   * Kündigungsantrag oder von Hand und wird nicht überschrieben (Wurzel 4).
   */
  uebersprungen?: string;
  /**
   * Das Datum steht, der Kalender nicht. `objekt_ohne_einheit` heißt: dem
   * Objekt fehlen `property_units` — ein Datenfehler am Objekt, kein
   * Kopplungsfehler.
   */
  fehler?: string;
};

export type OwnerBillingTermsInput = {
  property_id?: string | null;
  gueltig_ab: string;
  gueltig_bis?: string | null;
  provisions_pct: number;
  min_provision_betrag?: number | null;
  min_provision_currency?: string | null;
  pauschale_betrag?: number | null;
  pauschale_currency?: string | null;
  pauschale_basis?: PauschaleBasis | null;
  pauschale_zeitpunkt?: PauschaleZeitpunkt | null;
  notiz?: string | null;
};

/**
 * Änderungen an einem bestehenden Vertrag.
 *
 * Die drei `ohne_*`/`unbefristet`-Schalter sind kein Beiwerk: ein gesendetes
 * `null` ist in JSON nicht von „nicht gesendet" zu unterscheiden. Ohne sie
 * ließe sich eine einmal gesetzte Befristung, Mindestprovision oder Pauschale
 * nie wieder entfernen.
 */
export type OwnerBillingTermsUpdate = Partial<
  Omit<OwnerBillingTermsInput, "property_id">
> & {
  unbefristet?: boolean;
  ohne_min_provision?: boolean;
  ohne_pauschale?: boolean;
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT"; body?: unknown } = {},
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

// -- Gebühren-Klassifikation ------------------------------------------------

export async function getFeeClassification(): Promise<
  Result<FeeClassificationUebersicht>
> {
  return call("/owner-billing/fee-classification");
}

/**
 * Zuordnungen setzen. PUT, weil die Maske den Stand als Ganzes bestätigt.
 *
 * Der Server prüft alles, bevor er das Erste schreibt — eine abgelehnte Zeile
 * hinterlässt also keine halb gespeicherte Maske.
 */
export async function setFeeClassification(
  items: FeeClassificationInput[],
): Promise<Result<FeeClassificationUebersicht>> {
  return call("/owner-billing/fee-classification", {
    method: "PUT",
    body: { items },
  });
}

export async function deleteFeeClassification(
  id: string,
): Promise<Result<FeeClassificationUebersicht>> {
  return call(`/owner-billing/fee-classification/${id}`, { method: "DELETE" });
}

// -- Abrechnungsvertrag -----------------------------------------------------

/** Die vollständige HISTORIE, nicht nur der aktuell gültige Vertrag. */
export async function listOwnerBillingTerms(
  ownerId: string,
): Promise<Result<{ items: OwnerBillingTerms[] }>> {
  return call(`/owner-billing/owners/${ownerId}/terms`);
}

export async function createOwnerBillingTerms(
  ownerId: string,
  input: OwnerBillingTermsInput,
): Promise<Result<OwnerBillingTerms>> {
  return call(`/owner-billing/owners/${ownerId}/terms`, {
    method: "POST",
    body: input,
  });
}

export async function updateOwnerBillingTerms(
  termsId: string,
  input: OwnerBillingTermsUpdate,
): Promise<Result<OwnerBillingTerms>> {
  return call(`/owner-billing/terms/${termsId}`, {
    method: "PATCH",
    body: input,
  });
}

export async function deleteOwnerBillingTerms(
  termsId: string,
): Promise<Result<void>> {
  return call(`/owner-billing/terms/${termsId}`, { method: "DELETE" });
}

// -- Portal-Abzugssätze (0364) ----------------------------------------------

/**
 * Was ein Vertriebsportal je Buchung einbehält.
 *
 * ZWEI Sätze, weil zwei verschiedene Abzüge: Booking.com nimmt 15 %
 * Vermittlungsprovision UND 1,5 % Zahlungsgebühr (zusammen die 16,5 %, mit
 * denen die Buchhaltung rechnet); Airbnb nimmt 15,5 % und keine
 * Zahlungsgebühr. `zahlungsgebuehr_pct: null` heißt „erhebt keine" — etwas
 * anderes als eine vereinbarte 0.
 */
export type PortalAbzugssatz = {
  id: string;
  kanal: string;
  /** null = gilt für alle Objekte des Betriebs. */
  property_id: string | null;
  provision_pct: number;
  zahlungsgebuehr_pct: number | null;
  gueltig_ab: string;
  /** null = unbefristet. Echter Zustand, kein fehlender Wert. */
  gueltig_bis: string | null;
  notiz: string | null;
  created_at: string;
  updated_at: string;
  /** Gilt heute? Vom Server berechnet, nicht aus den Daten abgeleitet. */
  aktuell: boolean;
  /** provision + zahlungsgebuehr — vom Server addiert, damit die Oberfläche
   *  die Zahlungsgebühr nicht vergisst. */
  gesamt_pct: number;
};

export type PortalAbzugssatzInput = {
  kanal: string;
  provision_pct: number;
  zahlungsgebuehr_pct?: number | null;
  gueltig_ab: string;
  gueltig_bis?: string | null;
  property_id?: string | null;
  notiz?: string | null;
};

export type PortalAbzugssatzUpdate = {
  provision_pct?: number;
  zahlungsgebuehr_pct?: number;
  /** Ausdrücklich „erhebt keine Zahlungsgebühr mehr" — ohne dieses Flag wäre
   *  ein weggelassenes Feld nicht von „nicht ändern" zu unterscheiden. */
  ohne_zahlungsgebuehr?: boolean;
  gueltig_ab?: string;
  gueltig_bis?: string;
  ohne_gueltig_bis?: boolean;
  notiz?: string | null;
};

/** Alle Sätze des Betriebs MIT Historie — eine alte Abrechnung ist sonst
 *  nicht nachvollziehbar. */
export async function listPortalAbzugssaetze(): Promise<
  Result<{ items: PortalAbzugssatz[] }>
> {
  return call("/owner-billing/portal-saetze");
}

export async function createPortalAbzugssatz(
  input: PortalAbzugssatzInput,
): Promise<Result<PortalAbzugssatz>> {
  return call("/owner-billing/portal-saetze", { method: "POST", body: input });
}

export async function updatePortalAbzugssatz(
  satzId: string,
  input: PortalAbzugssatzUpdate,
): Promise<Result<PortalAbzugssatz>> {
  return call(`/owner-billing/portal-saetze/${satzId}`, {
    method: "PATCH",
    body: input,
  });
}

export async function deletePortalAbzugssatz(
  satzId: string,
): Promise<Result<void>> {
  return call(`/owner-billing/portal-saetze/${satzId}`, { method: "DELETE" });
}
