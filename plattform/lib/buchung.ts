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

/** Eine Zeile der Preisaufschlüsselung, wie sie der Gast sieht. */
export type AngebotsZeile = { label: string; amount: number; kind?: string | null };

export type Angebot = {
  property_id: string;
  nights: number;
  currency: string;
  lines: AngebotsZeile[];
  total: number;
  /** Hat der eingegebene Aktionscode WIRKLICH eine Aktion ausgelöst? False bei
   *  unbekanntem Code — auch dann kann ein Rabatt in den Zeilen stehen (eine
   *  automatische Aktion), er gehört aber nicht zum Code. Ohne diese Unterscheidung
   *  hielte der Gast einen falschen Code für gültig. */
  promo_code_applied: boolean;
  priceless: boolean;
  pets_allowed: boolean;
  max_guests: number;
};

/**
 * Verbindliche Preisaufschlüsselung vor der Buchung — dieselbe Rechnung, die
 * der Server bei der Buchung anstellt (Gebühren, Haustiergebühr, Abgaben).
 * Selbst rechnen (Nächte × Grundpreis) verschwiege genau diese Posten.
 */
export async function ladeAngebot(input: {
  property_id: string;
  check_in: string;
  check_out: string;
  guests: number;
  pets: number;
  /** Aktionscode des Gastes. Nur ein Filter auf die Aktionen des Objekts — den
   *  Rabatt rechnet der Server, nie der Browser. */
  promo_code?: string;
}): Promise<Result<Angebot>> {
  return call("quote", { method: "POST", body: input });
}

/** Gastbuchung anlegen. end (check_out) exklusiv. */
export async function bucheGast(input: {
  property_id: string;
  check_in: string;
  check_out: string;
  contact: GuestContact;
  total_amount: number;
  /** DERSELBE Aktionscode wie im Angebot — ohne ihn zahlte der Gast den Preis
   *  ohne seinen Rabatt, obwohl die Strecke ihn angezeigt hat. */
  promo_code?: string;
  /** Reisende und mitgebrachte Tiere. Beide sind preiswirksam (Gebühren „pro
   *  Gast" bzw. „pro Tier"); ohne Angabe rechnet der Server mit 1 Gast, 0 Tieren. */
  guests?: number;
  pets?: number;
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
