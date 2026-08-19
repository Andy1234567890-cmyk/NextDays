// Zusatzleistungen einer Buchung — gegen den FastAPI-addons-Slice
// (/api/v1/addons), gespiegelt aus apps/web/lib/addons.ts. Hier NUR die Pfade
// der Buchungs-Sicht (gekaufte Positionen, Katalog des Objekts, buchen, Menge,
// bezahlt, stornieren). Der Katalog-CRUD je Objekt bleibt im Web — er ist
// Einrichtungsarbeit, keine Front-Desk-Arbeit am Telefon.
//
// Preislogik (Basis, Steuer, Summe) rechnet AUSSCHLIESSLICH das Backend. Die
// App schickt Auswahl und Menge und zeigt, was zurückkommt.
import { call, type Result } from "@/lib/api";

/** Abrechnungsbasis einer Leistung (Backend-Enum). */
export type AddonBasis = "per_stay" | "per_night" | "per_guest" | "per_unit";

/** Eine Katalog-Leistung des Objekts. */
export type Addon = {
  id: string;
  property_id: string;
  // Mehrsprachig (Locale → Text) wie im Katalog; die Sprachwahl trifft die
  // Oberfläche, nicht der Server.
  name: Record<string, string>;
  description: Record<string, string>;
  media: string[];
  price: number;
  basis: AddonBasis;
  mandatory: boolean;
  tax_rate: number | null;
  active: boolean;
  sort_order: number;
};

/** Eine zu einer Buchung gehörende Position. */
export type ReservationAddon = {
  id: string;
  reservation_id: string;
  addon_id: string | null;
  name: Record<string, string>;
  price: number;
  basis: AddonBasis;
  tax_rate: number | null;
  qty: number;
  total: number;
  status: "pending" | "paid" | "cancelled";
  charged_at: string | null;
  created_at: string | null;
  /** Grund für Storno bzw. Rücknahme der Bezahlt-Markierung (Pflicht auf dem
   *  Schreibpfad; null bei Bestandszeilen und Gast-Käufen). */
  cancel_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
};

/** Antwort der Buchungs-Sicht: Positionen + Währung + Gästezahl. */
export type ReservationAddonsAntwort = {
  items: ReservationAddon[];
  total: number;
  // null = für dieses Objekt ist keine Währung hinterlegt. Dann wird der Betrag
  // symbollos gerendert, NICHT mit einem erfundenen Zeichen (Wurzel 4).
  currency: string | null;
  /** Gästezahl der Buchung — Vorbelegung der Menge bei „pro Gast". */
  guests: number | null;
};

/** Gekaufte Zusatzleistungen einer Buchung. */
export async function listReservationAddons(
  reservationId: string,
): Promise<Result<ReservationAddonsAntwort>> {
  return call(`/addons/reservations/${encodeURIComponent(reservationId)}`);
}

/** Aktive Katalog-Leistungen des Objekts dieser Buchung (Schnell-Auswahl). */
export async function availableReservationAddons(
  reservationId: string,
): Promise<
  Result<{ items: Addon[]; total: number; currency: string | null }>
> {
  return call(
    `/addons/reservations/${encodeURIComponent(reservationId)}/available`,
  );
}

/**
 * Eine Zusatzleistung zur Buchung hinzufügen — auch bei einer OTA-Buchung
 * (provisionsfrei am Portal vorbei).
 *
 * `qty = 0` heißt „nicht angegeben": der Server setzt die Vorbelegung der
 * Abrechnungsbasis ein (bei „pro Gast" die Gästezahl der Buchung, sonst 1).
 * Eine übergebene Menge IST bei „pro Gast" die Personenzahl — kein Faktor
 * obendrauf.
 */
export async function addReservationAddon(
  reservationId: string,
  addonId: string,
  qty = 0,
): Promise<Result<ReservationAddonsAntwort>> {
  return call(
    `/addons/reservations/${encodeURIComponent(reservationId)}/addons`,
    { method: "POST", body: { addon_id: addonId, qty } },
  );
}

/**
 * Menge einer OFFENEN Position ändern; den Betrag rechnet der Server neu.
 * 409, wenn bereits bezahlt, storniert oder abgerechnet.
 */
export async function changeReservationAddonQty(
  resAddonId: string,
  qty: number,
): Promise<Result<ReservationAddon>> {
  return call(`/addons/reservation-addons/${encodeURIComponent(resAddonId)}/qty`, {
    method: "PATCH",
    body: { qty },
  });
}

/**
 * Position manuell als bezahlt markieren („zahlbar bei Anreise", ohne
 * Zahlungsdienst). Nur aus „offen" — eine stornierte wird nicht überschrieben.
 */
export async function markReservationAddonPaid(
  resAddonId: string,
): Promise<Result<ReservationAddon>> {
  return call(
    `/addons/reservation-addons/${encodeURIComponent(resAddonId)}/mark-paid`,
    { method: "POST" },
  );
}

/**
 * Eine fälschlich gesetzte Bezahlt-Markierung zurücknehmen (→ wieder offen).
 * Für die FEHLEINGABE, nicht für eine Rückzahlung. Grund ist Pflicht und wird
 * protokolliert. 409 bei echter Kartenzahlung oder festgeschriebener Rechnung.
 */
export async function unmarkReservationAddonPaid(
  resAddonId: string,
  reason: string,
): Promise<Result<ReservationAddon>> {
  return call(
    `/addons/reservation-addons/${encodeURIComponent(resAddonId)}/unmark-paid`,
    { method: "POST", body: { reason } },
  );
}

/**
 * Eine falsch gebuchte Position stornieren (status='cancelled'). Kein Löschen:
 * sie bleibt als Beleg stehen, fällt aber aus Rechnung, Eigentümer-Abrechnung
 * und Gast-Portal heraus. Grund ist Pflicht.
 */
export async function cancelReservationAddon(
  resAddonId: string,
  reason: string,
): Promise<Result<ReservationAddon>> {
  return call(
    `/addons/reservation-addons/${encodeURIComponent(resAddonId)}/cancel`,
    { method: "POST", body: { reason } },
  );
}

/**
 * Der Name einer Leistung in der Sprache der Oberfläche.
 *
 * Der Katalog ist mehrsprachig; die App läuft auf Deutsch, deshalb `de` zuerst.
 * Fehlt der deutsche Eintrag, steht der erste vorhandene da — ein vorhandener
 * fremdsprachiger Name sagt mehr als ein Strich.
 */
export function addonName(name: Record<string, string>): string {
  return name.de ?? Object.values(name)[0] ?? "Zusatzleistung";
}
