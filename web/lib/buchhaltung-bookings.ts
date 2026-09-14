"use server";

// „Rechnung aus Buchung" (Booking→Invoice-Brücke 0092): Server-Actions gegen
// den buchhaltung-Slice. Die Vorbefüllung kommt komplett vom Backend
// (reservation_invoice — dieselbe Positions-Logik wie die Check-out-Rechnung),
// damit es genau EINE Quelle der Wahrheit für Buchungsrechnungen gibt.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

// Abrechenbare Buchung (eingecheckt, nicht storniert, ohne aktive Rechnung).
export type BillableReservation = {
  id: string;
  guestName: string;
  propertyTitle: string;
  checkIn: string;
  checkOut: string;
  checkedInAt: string | null;
  currency: string;
  totalAmount: number | null;
};

// Vorbefüllung fürs Erstellformular. unitPrice ist NETTO (das Formular
// rechnet netto, priceInput='netto'); total ist der Brutto-Gastpreis.
export type InvoicePreviewItem = {
  description: string;
  quantity: number;
  unit: string;
  // Abrechnungsbasis (0698): Übernachtung je Nacht, Zusatzleistungen wie gekauft.
  basis?: 'per_stay' | 'per_night' | 'per_guest' | 'per_guest_night' | 'per_unit';
  unitPrice: number;
  taxRate: number;
  total: number;
  // Aufenthalt DIESER Zeile (0702): Objekt und Zeitraum stehen an der
  // Übernachtungsposition, nicht nur im Belegkopf.
  propertyId?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
};

export type InvoicePreview = {
  reservationId: string;
  // null = noch kein Debitor zum Gast (wird erst beim Speichern angelegt).
  customerId: string | null;
  customerName: string;
  // Gästemappen-Stammdaten fürs Empfänger-Formular (0046).
  customerFirstName: string;
  customerLastName: string;
  // Firmengast → Empfänger „Organisation" (+ USt-IdNr., falls gepflegt).
  company: string;
  companyVatId: string;
  address: {
    street: string;
    houseNo: string;
    postalCode: string;
    city: string;
    country: string;
  } | null;
  customerEmail: string;
  customerNumber: string;
  currency: string;
  propertyTitle: string;
  // Objekt der Buchung — vorbelegt die Objekt-Auswahl der Preisliste.
  propertyId?: string;
  stay: { from: string; to: string; nights: number };
  // Erwachsene + Kinder der Buchung — Vorbelegung „Personen" im Belegkopf.
  guestCount?: number;
  paidAmount: number;
  // Dokumentsprache = Gastsprache (doc_i18n, 24 EU-Locales; Fallback de).
  guestLanguage: string;
  items: InvoicePreviewItem[];
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(path: string): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { token });
    return { ok: true, data };
  } catch (exc) {
    const error =
      exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    return { ok: false, error };
  }
}

/** Abrechenbare Buchungen für den Buchungs-Picker (Suche: Gast/Objekt). */
export async function listBillableReservations(
  query = "",
): Promise<Result<BillableReservation[]>> {
  const qs = query ? `?query=${encodeURIComponent(query)}` : "";
  return call(`/buchhaltung/billable-reservations${qs}`);
}

/** Vorbefüllung „Rechnung aus Buchung" (Kunde + Positionen aus Aufenthalt und
 *  Upsells). 409, wenn bereits eine aktive Rechnung existiert. */
export async function getInvoicePreview(
  reservationId: string,
): Promise<Result<InvoicePreview>> {
  return call(
    `/buchhaltung/invoice-preview?reservation_id=${encodeURIComponent(reservationId)}`,
  );
}
