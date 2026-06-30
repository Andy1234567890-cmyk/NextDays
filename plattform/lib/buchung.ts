// Buchungs-Anbindung der Plattform an den öffentlichen booking_engine-Slice
// (/api/v1/booking-engine). Liest die Verfügbarkeit und legt Gastbuchungen an.
// Der Buchungskalender im Backend ist die oberste Wahrheit: Doppelbuchungen
// werden serverseitig mit 409 abgelehnt, belegte Tage sofort an OTAs gesperrt.

export type PublicDay = { date: string; available: boolean };

export type GuestContact = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<Result<T>> {
  try {
    const res = await fetch(`/api/v1/booking-engine/${path}`, {
      method: opts.method ?? "GET",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      const msg =
        res.status === 409
          ? "Dieser Zeitraum ist leider nicht mehr verfügbar."
          : (detail?.detail ?? `Fehler ${res.status}`);
      return { ok: false, error: String(msg) };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, error: "Verbindung fehlgeschlagen." };
  }
}

/** Tagesverfügbarkeit einer Property im Zeitraum [start, end). */
export async function ladeVerfuegbarkeit(
  propertyId: string,
  start: string,
  end: string,
): Promise<Result<{ property_id: string; days: PublicDay[] }>> {
  const qs = new URLSearchParams({ property_id: propertyId, start, end });
  return call(`availability?${qs.toString()}`);
}

/** Gastbuchung anlegen. end (check_out) exklusiv. */
export async function bucheGast(input: {
  property_id: string;
  check_in: string;
  check_out: string;
  contact: GuestContact;
  total_amount: number;
}): Promise<
  Result<{ id: string; property_id: string; check_in: string; check_out: string; status: string }>
> {
  return call("reservations", { method: "POST", body: input });
}

// --- Online-Zahlung (Stripe) ------------------------------------------------

export type BookingIntent = {
  client_secret: string;
  payment_id: string;
  publishable_key: string;
};

/**
 * Stripe-PaymentIntent für eine bereits angelegte Reservierung holen. Tenant +
 * Betrag bestimmt das Backend serverseitig aus der Reservierung (keine
 * client-seitigen Beträge). Liefert client_secret + publishable_key fürs
 * Payment Element. 409 = Online-Zahlung für dieses Objekt (noch) nicht möglich.
 */
export async function ladeZahlungsIntent(
  reservationId: string,
): Promise<Result<BookingIntent>> {
  try {
    const res = await fetch(
      `/api/v1/payments/booking/${reservationId}/intent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      const msg =
        res.status === 409
          ? "Online-Zahlung ist für diese Unterkunft derzeit nicht möglich."
          : (detail?.detail ?? `Fehler ${res.status}`);
      return { ok: false, error: String(msg) };
    }
    return { ok: true, data: (await res.json()) as BookingIntent };
  } catch {
    return { ok: false, error: "Verbindung fehlgeschlagen." };
  }
}
