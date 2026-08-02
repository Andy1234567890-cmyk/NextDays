// Bewertungen (/api/v1/guest-reviews). Öffentliche Objekt-Bewertungen + eigene
// Bewertungen des Gastes zum Anlegen/Bearbeiten.
import { guestCall, type Result } from "./guest-api";

/** Die 6 Kategorien (Booking-Modell, je 1..5). Alle optional: Alt-Bewertungen
 *  tragen nur die Gesamtnote — null bleibt null, nichts wird ersetzt. */
export type KategorieNoten = {
  cleanliness: number | null;
  communication: number | null;
  location: number | null;
  value: number | null;
  accuracy: number | null;
  checkin: number | null;
};

export const KATEGORIEN: { key: keyof KategorieNoten; label: string }[] = [
  { key: "cleanliness", label: "Sauberkeit" },
  { key: "communication", label: "Kommunikation" },
  { key: "location", label: "Lage" },
  { key: "value", label: "Preis-Leistung" },
  { key: "accuracy", label: "Genauigkeit" },
  { key: "checkin", label: "Check-in" },
];

export type PublicReview = {
  id: string;
  rating: number;
  text: string | null;
  host_reply: string | null;
  host_reply_at: string | null;
  author: string | null;
  scores: KategorieNoten;
  created_at: string;
};

export type PropertyReviews = {
  property_id: string;
  average: number | null;
  count: number;
  /** Durchschnitt je Kategorie. null, wenn keine Bewertung Kategorien trägt. */
  category_averages: KategorieNoten | null;
  reviews: PublicReview[];
};

export type MyReview = {
  id: string;
  property_id: string;
  reservation_id: string;
  rating: number;
  text: string | null;
  host_reply: string | null;
  host_reply_at: string | null;
  scores: KategorieNoten;
  /** Zwei-Wege-Sichtbarkeit: null = noch verdeckt (Gegenseite fehlt, Frist
   *  läuft). Der Gast sieht seine eigene Bewertung immer. */
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
};

export async function ladeObjektBewertungen(
  propertyId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<Result<PropertyReviews>> {
  const qs = new URLSearchParams();
  if (opts.limit != null) qs.set("limit", String(opts.limit));
  if (opts.offset != null) qs.set("offset", String(opts.offset));
  const suffix = qs.size ? `?${qs.toString()}` : "";
  return guestCall(
    `guest-reviews/property/${encodeURIComponent(propertyId)}${suffix}`,
  );
}

export async function ladeMeineBewertungen(): Promise<
  Result<{ reviews: MyReview[] }>
> {
  return guestCall("guest-reviews/mine");
}

export async function erstelleBewertung(input: {
  reservation_id: string;
  rating: number;
  text?: string;
  scores?: Partial<KategorieNoten>;
}): Promise<Result<MyReview>> {
  return guestCall("guest-reviews", { method: "POST", body: input });
}

export async function aktualisiereBewertung(
  reviewId: string,
  input: { rating?: number; text?: string; scores?: Partial<KategorieNoten> },
): Promise<Result<MyReview>> {
  return guestCall(`guest-reviews/${encodeURIComponent(reviewId)}`, {
    method: "PATCH",
    body: input,
  });
}
