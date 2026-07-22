// Bewertungen (/api/v1/guest-reviews). Öffentliche Objekt-Bewertungen + eigene
// Bewertungen des Gastes zum Anlegen/Bearbeiten.
import { guestCall, type Result } from "./guest-api";

export type PublicReview = {
  id: string;
  rating: number;
  text: string | null;
  host_reply: string | null;
  author: string | null;
  created_at: string;
};

export type PropertyReviews = {
  property_id: string;
  average: number | null;
  count: number;
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
  created_at: string;
};

export async function ladeObjektBewertungen(
  propertyId: string,
): Promise<Result<PropertyReviews>> {
  return guestCall(`guest-reviews/property/${encodeURIComponent(propertyId)}`);
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
}): Promise<Result<MyReview>> {
  return guestCall("guest-reviews", { method: "POST", body: input });
}

export async function aktualisiereBewertung(
  reviewId: string,
  input: { rating?: number; text?: string },
): Promise<Result<MyReview>> {
  return guestCall(`guest-reviews/${encodeURIComponent(reviewId)}`, {
    method: "PATCH",
    body: input,
  });
}
