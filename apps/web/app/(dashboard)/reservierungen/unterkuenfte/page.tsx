// Unterkünfte-Reiter der PM-Fläche (Lodgify „Unterkünfte"): Kachelliste der
// Objekte. Klick auf eine Kachel öffnet die Objektfläche mit den sechs Reitern
// (Kalender/Statistiken/Bilder/Warnungen/Gastmodul/Gästemappe).
import { PropertyGrid } from "@/components/reservierungen/property-grid";
import { Card } from "@/components/ui/card";
import { listProperties } from "@/lib/properties";

export default async function PmUnterkuenftePage() {
  const res = await listProperties();

  if (!res.ok) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl font-extrabold">Unterkünfte</h1>
        <Card className="p-5 text-sm text-destructive">
          Objekte konnten nicht geladen werden. Ist das Backend erreichbar?
        </Card>
      </div>
    );
  }

  const items = res.data.items.map((p) => ({
    id: p.id,
    title: p.title,
    city: p.city,
    photo: p.photos[0] ?? null,
  }));

  return <PropertyGrid items={items} />;
}
