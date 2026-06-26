// Kalender-Übersicht (wie Lodgify): Timeline-Raster + vier Zusatzansichten
// (Liste, An-/Abreisen, Monatsgitter, Auslastung) über einen Top-Level-Umschalter.
// Server Component lädt die Objekte; der Client-Teil holt die Verfügbarkeit und
// rendert die jeweils aktive Ansicht.
import { Suspense } from "react";

import { CalendarViews } from "@/components/kalender/calendar-views";
import { Card } from "@/components/ui/card";
import { getDpOverview } from "@/lib/dynamic-pricing";
import { listProperties } from "@/lib/properties";

export default async function KalenderPage() {
  // Objekte + Dynamic-Pricing-Status parallel laden, damit der Kalender pro
  // Objekt anzeigen kann, ob Dynamic Pricing aktiv ist (Blitz-Markierung).
  const [res, dp] = await Promise.all([listProperties(), getDpOverview()]);
  // Set der Objekte mit aktivem DP (best-effort: scheitert der Call, kein Blitz).
  const dpEnabled = new Set(
    dp.ok ? dp.data.items.filter((i) => i.enabled).map((i) => i.property_id) : [],
  );

  if (!res.ok) {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="font-display text-2xl font-extrabold">Kalender</h2>
        <Card className="p-5 text-sm text-destructive">
          Objekte konnten nicht geladen werden. Ist das Backend erreichbar?
        </Card>
      </div>
    );
  }

  const properties = res.data.items.map((p) => ({
    id: p.id,
    title: p.title,
    type: p.property_type,
    photo: p.photos[0] ?? null,
    address: [p.street, p.house_number].filter(Boolean).join(" "),
    city: [p.postal_code, p.city].filter(Boolean).join(" "),
    maxGuests: p.max_guests,
    dynamicEnabled: dpEnabled.has(p.id),
  }));

  // CalendarViews liest die aktive Ansicht aus der URL (?view=) → Suspense-Grenze
  // (Next.js verlangt sie für useSearchParams in einer Server-gerenderten Seite).
  return (
    <Suspense fallback={null}>
      <CalendarViews properties={properties} />
    </Suspense>
  );
}
