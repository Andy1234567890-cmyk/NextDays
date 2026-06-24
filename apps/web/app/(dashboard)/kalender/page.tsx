// Kalender-Übersicht (wie Lodgify): Timeline-Raster, Objekte als Zeilen, echte
// Verfügbarkeit pro Tag. Server Component lädt die Objekte; der Client-Teil
// holt die Verfügbarkeit und rendert das interaktive Raster.
import { CalendarBoard } from "@/components/kalender/calendar-board";
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

  return (
    <CalendarBoard
      properties={res.data.items.map((p) => ({
        id: p.id,
        title: p.title,
        type: p.property_type,
        photo: p.photos[0] ?? null,
        address: [p.street, p.house_number].filter(Boolean).join(" "),
        city: [p.postal_code, p.city].filter(Boolean).join(" "),
        maxGuests: p.max_guests,
        dynamicEnabled: dpEnabled.has(p.id),
      }))}
    />
  );
}
