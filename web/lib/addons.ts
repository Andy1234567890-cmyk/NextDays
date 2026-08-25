"use server";

// Zusatzleistungen/Upsells: Server-Actions gegen den FastAPI-addons-Slice
// (/api/v1/addons). Katalog-CRUD je Objekt + Medien-Upload. Business-Logik
// (Preis nach Basis, Verkaufsflächen, Zahlstatus) liegt im Backend.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type AddonBasis = "per_stay" | "per_night" | "per_guest" | "per_unit";
export type AddonSurface = "booking_engine" | "guest_portal" | "checkin";
export type AddonAvailability = "before_checkin" | "anytime";

export type Addon = {
  id: string;
  property_id: string;
  name: Record<string, string>;
  description: Record<string, string>;
  media: string[];
  price: number;
  basis: AddonBasis;
  mandatory: boolean;
  appears_in: AddonSurface[];
  available_until: AddonAvailability;
  tax_rate: number | null;
  active: boolean;
  sort_order: number;
};

export type AddonInput = {
  name?: Record<string, string>;
  description?: Record<string, string>;
  media?: string[];
  price?: number;
  basis?: AddonBasis;
  mandatory?: boolean;
  appears_in?: AddonSurface[];
  available_until?: AddonAvailability;
  tax_rate?: number | null;
  active?: boolean;
  sort_order?: number;
};

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
  /** Erstattung (0473). Eine erstattete Position ist gleichzeitig `cancelled` —
   *  ohne diese Felder wäre nicht unterscheidbar, ob nur storniert oder wirklich
   *  Geld zurückgezahlt wurde. Betrag in CENT, damit Öre-Beträge (DKK) genau die
   *  Zahl zeigen, die Stripe erstattet hat. */
  refunded_cents: number;
  refunded_at: string | null;
  refund_reason: string | null;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

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
    return { ok: false, error };
  }
}

/** Alle Zusatzleistungen eines Objekts (Katalog, inkl. inaktiver). `currency`
 *  ist die Objekt-Währung aus dem Rate-Plan (null = keine hinterlegt). */
export async function listAddons(
  propertyId: string,
): Promise<Result<{ items: Addon[]; total: number; currency: string | null }>> {
  return call(`/addons/properties/${propertyId}`);
}

export async function createAddon(
  propertyId: string,
  input: AddonInput,
): Promise<Result<Addon>> {
  return call(`/addons/properties/${propertyId}`, {
    method: "POST",
    body: input,
  });
}

export async function updateAddon(
  addonId: string,
  input: AddonInput,
): Promise<Result<Addon>> {
  return call(`/addons/${addonId}`, { method: "PATCH", body: input });
}

export async function deleteAddon(addonId: string): Promise<Result<null>> {
  return call(`/addons/${addonId}`, { method: "DELETE" });
}

/** Eine Zusatzleistung eines ANDEREN Objekts, übernehmbar auf dieses. */
export type AddonLibraryEntry = {
  addon: Addon;
  property_id: string;
  property_title: string | null;
};

/** Zusatzleistungen anderer Objekte, die auf DIESES übernehmbar sind
 *  („Bestehende Zusatzleistung übernehmen"). Nur gleiche Währung; was hier
 *  schon liegt, fehlt. `currency` null = am Objekt keine Währung hinterlegt,
 *  dann ist die Liste leer (kein €-Fallback). */
export async function listAddonLibrary(
  propertyId: string,
): Promise<
  Result<{ items: AddonLibraryEntry[]; currency: string | null }>
> {
  return call(`/addons/properties/${propertyId}/library`);
}

/** Dieselbe Zusatzleistung auf weitere eigene Objekte übertragen (Block „Zu
 *  anderen Objekten hinzufügen"). Kopie, keine Verknüpfung: spätere Änderungen
 *  an der Quelle wandern nicht mit. Erneutes Anwenden aktualisiert die
 *  vorhandene Zeile beim Ziel, statt eine Dublette anzulegen. */
export async function applyAddonToProperties(
  addonId: string,
  propertyIds: string[],
): Promise<Result<{ applied_to: string[] }>> {
  return call(`/addons/${addonId}/apply`, {
    method: "POST",
    body: { property_ids: propertyIds },
  });
}

/** Gekaufte Zusatzleistungen einer Reservierung (Dashboard-Sicht). `currency`
 *  kommt aus der Reservierung/dem Objekt (null = keine hinterlegt). */
export async function listReservationAddons(
  reservationId: string,
): Promise<
  Result<{
    items: ReservationAddon[];
    total: number;
    currency: string | null;
    /** Gästezahl der Buchung — Vorbelegung des Mengenfeldes bei „pro Gast". */
    guests: number | null;
  }>
> {
  return call(`/addons/reservations/${reservationId}`);
}

/** Aktive Katalog-Add-ons des Objekts dieser Reservierung (Schnell-Auswahl). */
export async function availableReservationAddons(
  reservationId: string,
): Promise<Result<{ items: Addon[]; total: number; currency: string | null }>> {
  return call(`/addons/reservations/${reservationId}/available`);
}

/** Schnelltaste: eine Zusatzleistung zu einer bestehenden Buchung hinzufügen
 *  (auch bei OTA-Buchungen, z. B. Booking — provisionsfrei am OTA vorbei).
 *
 *  `qty = 0` heißt „nicht angegeben": der Server setzt die Vorbelegung der
 *  Abrechnungsbasis ein (bei „pro Gast" die Gästezahl der Buchung, sonst 1).
 *  Eine übergebene Menge IST bei „pro Gast" die Personenzahl — nicht ein
 *  Faktor obendrauf. */
export async function addReservationAddon(
  reservationId: string,
  addonId: string,
  qty = 0,
): Promise<
  Result<{
    items: ReservationAddon[];
    total: number;
    currency: string | null;
    /** Gästezahl der Buchung — Vorbelegung des Mengenfeldes bei „pro Gast". */
    guests: number | null;
  }>
> {
  return call(`/addons/reservations/${reservationId}/addons`, {
    method: "POST",
    body: { addon_id: addonId, qty },
  });
}

/** Menge einer OFFENEN Zusatzleistung ändern; der Betrag wird serverseitig neu
 *  gerechnet. Der Fall: eine Buchung über 4 Personen bestellt nur 2
 *  Wäschepakete. 409, wenn bereits bezahlt, storniert oder abgerechnet. */
export async function changeReservationAddonQty(
  resAddonId: string,
  qty: number,
): Promise<Result<ReservationAddon>> {
  return call(`/addons/reservation-addons/${resAddonId}/qty`, {
    method: "PATCH",
    body: { qty },
  });
}

/** Eine gekaufte Zusatzleistung manuell als bezahlt markieren (ohne Payment-
 *  Provider: „zahlbar bei Anreise"). Nur aus „offen" — eine stornierte Position
 *  wird nicht überschrieben (409). */
export async function markReservationAddonPaid(
  resAddonId: string,
): Promise<Result<ReservationAddon>> {
  return call(`/addons/reservation-addons/${resAddonId}/mark-paid`, {
    method: "POST",
  });
}

/** Eine fälschlich gesetzte Bezahlt-Markierung zurücknehmen (→ wieder offen).
 *
 *  Für die FEHLEINGABE, nicht für eine Rückzahlung: Es ist kein Geld geflossen,
 *  es wurde nur der falsche Haken gesetzt. Der Grund ist Pflicht und wird am
 *  Vorgang sowie in der Buchungs-Zeitleiste protokolliert. 409, wenn die
 *  Position wirklich per Karte bezahlt wurde (dann erstatten) oder auf einer
 *  festgeschriebenen Rechnung steht. */
export async function unmarkReservationAddonPaid(
  resAddonId: string,
  reason: string,
): Promise<Result<ReservationAddon>> {
  return call(`/addons/reservation-addons/${resAddonId}/unmark-paid`, {
    method: "POST",
    body: { reason },
  });
}

/** Eine falsch gebuchte Zusatzleistung stornieren (status=cancelled). Kein
 *  Löschen: die Position bleibt als Beleg stehen, fällt aber aus Rechnung,
 *  Eigentümer-Abrechnung und Gast-Portal heraus.
 *
 *  Der Grund ist Pflicht (Protokoll am Vorgang + Zeitleiste). Auch eine manuell
 *  auf „bezahlt" gesetzte Position ist stornierbar; 409 nur bei echter
 *  Kartenzahlung oder festgeschriebener Rechnung. */
export async function cancelReservationAddon(
  resAddonId: string,
  reason: string,
): Promise<Result<ReservationAddon>> {
  return call(`/addons/reservation-addons/${resAddonId}/cancel`, {
    method: "POST",
    body: { reason },
  });
}

/** Eine per Karte bezahlte Zusatzleistung erstatten (0473).
 *
 *  Der Gast bekommt 100 % dessen, was er gezahlt hat; die Erstattung läuft im
 *  verbundenen Konto des Betriebs. Kein Betragsfeld: Ein Client-Betrag wäre eine
 *  zweite Wahrheit über eine Geldbewegung. Der Grund ist Pflicht und steht
 *  danach am Beleg und in der Buchungs-Zeitleiste.
 *
 *  Die Position wird dabei storniert — sie fällt aus Rechnung,
 *  Eigentümer-Abrechnung und Gast-Portal heraus. */
export async function refundReservationAddon(
  resAddonId: string,
  reason: string,
): Promise<Result<ReservationAddon>> {
  return call(`/addons/reservation-addons/${resAddonId}/refund`, {
    method: "POST",
    body: { reason },
  });
}

/** Ein Medium (Foto) hochladen (multipart) → aktualisiertes Add-on.
 *  JPEG/PNG/WebP, 10 KB–20 MB, max. 5 (serverseitig validiert). */
export async function uploadAddonMedia(
  addonId: string,
  file: File,
): Promise<Result<Addon>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };

  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch(`${base}/api/v1/addons/${addonId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      cache: "no-store",
    });
    if (!res.ok) {
      let detail = `Fehler ${res.status}`;
      try {
        const data = await res.json();
        if (typeof data?.detail === "string") detail = data.detail;
      } catch {
        // kein JSON-Body
      }
      return { ok: false, error: detail };
    }
    return { ok: true, data: (await res.json()) as Addon };
  } catch {
    return { ok: false, error: "Backend nicht erreichbar." };
  }
}

// --- Zahlungslink (Stripe) ---------------------------------------------------
//
// Der Gast bezahlt offene Zusatzleistungen über einen Stripe-Zahlungslink. Der
// Charge entsteht IM VERBUNDENEN KONTO des Betriebs (Direct Charge): Das Geld
// wird seinem Stripe-Saldo gutgeschrieben und von dort ausgezahlt
// (/konto/abrechnung); die Plattform behält ihren Anteil beim Charge ein.

export type Zahlungslink = {
  id: string;
  reservation_id: string;
  url: string;
  currency: string;
  amount_cents: number;
  application_fee_cents: number;
  fee_bps: number;
  status: "open" | "paid" | "cancelled" | "refunded" | "partially_refunded";
  positionen: number;
  paid_at: string | null;
  created_at: string | null;
};

/** Offener Zahlungslink der Buchung — `null`, wenn keiner offen ist.
 *  Gleicht serverseitig mit Stripe ab, ob inzwischen bezahlt wurde. */
export async function getZahlungslink(
  reservationId: string,
): Promise<Result<Zahlungslink | null>> {
  return call(`/addons/reservations/${reservationId}/zahlungslink`);
}

/** Zahlungslink über alle offenen Zusatzleistungen erstellen (idempotent:
 *  ein bestehender Link mit denselben Positionen wird zurückgegeben). */
export async function createZahlungslink(
  reservationId: string,
): Promise<Result<Zahlungslink>> {
  return call(`/addons/reservations/${reservationId}/zahlungslink`, {
    method: "POST",
  });
}

/** Offenen Zahlungslink zurückziehen (bei Stripe deaktivieren). */
export async function deleteZahlungslink(
  reservationId: string,
): Promise<Result<null>> {
  return call(`/addons/reservations/${reservationId}/zahlungslink`, {
    method: "DELETE",
  });
}
