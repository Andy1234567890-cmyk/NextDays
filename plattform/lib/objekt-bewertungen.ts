// Öffentliche Bewertungen eines Objekts für die Inserat-Detailseite.
//
// Getrennt von lib/guest-reviews.ts (Client-Insel mit Gast-Token): dieser Pfad
// ist ÖFFENTLICH — Bewertungen sind Produktdaten und werden ohne Login gelesen.
// Muster wie lib/inserate.ts: Same-Origin-Proxy, kurzes Zeitbudget, bei Ausfall
// null statt eines Absturzes (der Abschnitt entfällt dann einfach).
import type { PropertyReviews } from "./guest-reviews";

const FETCH_TIMEOUT_MS = 8000;

export async function ladeOeffentlicheBewertungen(
  propertyId: string,
  limit = 10,
): Promise<PropertyReviews | null> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${base}/api/v1/guest-reviews/property/${encodeURIComponent(propertyId)}?limit=${limit}`,
      { headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal },
    );
    if (!res.ok) return null;
    return (await res.json()) as PropertyReviews;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
