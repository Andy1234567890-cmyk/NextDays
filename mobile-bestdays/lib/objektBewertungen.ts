// Öffentliche Bewertungen eines Objekts (guest_reviews-Slice, /api/v1/guest-reviews).
// Kein Token: Bewertungen sind Produktdaten und werden maskiert ausgeliefert
// (Vorname statt Name, keine E-Mail, keine Gast-ID).
//
// Nur eigene, verifizierte myBestDays-Bewertungen — Portal-Bewertungen
// (Booking.com/Airbnb) erscheinen hier bewusst nicht.
//
// Wurzel 4: `average`/`category_averages` bleiben null, wenn es keine
// veröffentlichte Bewertung gibt — die UI zeigt dann nichts, NIE eine 0.
import { publicCall, type Result } from "@/lib/guestApi";

/** Die 6 Kategorien (Booking-Modell, je 1..5). null = nicht bewertet. */
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
  category_averages: KategorieNoten | null;
  reviews: PublicReview[];
};

export async function ladeObjektBewertungen(
  propertyId: string,
  limit = 10,
): Promise<Result<PropertyReviews>> {
  return publicCall(
    `/guest-reviews/property/${encodeURIComponent(propertyId)}?limit=${limit}`,
  );
}
