// Öffentliche Bewertungen für den Bewertungs-Block der white-label Website.
// Quelle ist der guest_reviews-Slice (maskiert: Vorname statt Name, keine
// E-Mail, keine Gast-ID). Muster wie lib/inserate.ts: Same-Origin-Proxy, kurzes
// Zeitbudget, bei Ausfall null — der Block entfällt dann einfach.
//
// Nur eigene, verifizierte myBestDays-Bewertungen; Portal-Bewertungen erscheinen
// hier bewusst nicht.

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

export type OeffentlicheBewertung = {
  id: string;
  rating: number;
  text: string | null;
  host_reply: string | null;
  host_reply_at: string | null;
  author: string | null;
  scores: KategorieNoten;
  created_at: string;
};

export type ObjektBewertungen = {
  average: number | null;
  count: number;
  category_averages: KategorieNoten | null;
  reviews: OeffentlicheBewertung[];
};

const FETCH_TIMEOUT_MS = 8000;

export async function ladeBewertungen(
  ziel: { tenantId: string; propertyId: string | null },
  limit = 6,
): Promise<ObjektBewertungen | null> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const pfad = ziel.propertyId
    ? `property/${encodeURIComponent(ziel.propertyId)}`
    : `tenant/${encodeURIComponent(ziel.tenantId)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${base}/api/v1/guest-reviews/${pfad}?limit=${limit}`,
      { headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal },
    );
    if (!res.ok) return null;
    return (await res.json()) as ObjektBewertungen;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
