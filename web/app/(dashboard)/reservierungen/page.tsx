// Buchungen-Hauptseite der PM-Fläche (Buchungen): Reiter Belegt /
// Ankünfte / Abfahrten / Zukunft / Vergangen über der vollständigen Buchungs-
// tabelle. Server Component lädt die Objekte (für Titel + Objekt-Filter); der
// Client-Teil holt die Reservierungen und rendert die gefilterten Reiter.
import { BookingsBoard } from "@/components/reservierungen/bookings-board";
import { Card } from "@nextdays/ui/card";
import { listProperties } from "@/lib/properties";

export default async function ReservierungenPage() {
  const res = await listProperties();

  if (!res.ok) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl font-extrabold">Buchungen</h1>
        <Card className="p-5 text-sm text-destructive">
          Objekte konnten nicht geladen werden. Ist das Backend erreichbar?
        </Card>
      </div>
    );
  }

  // `photos[0]` ist das Titelbild: die Reihenfolge des Arrays folgt dem
  // is_cover-/sort_order-Rang aus property_photos, das Cover steht auf Position
  // 1 (photos-manager.tsx). Gleicher Weg wie die Schwesterseite
  // /reservierungen/unterkuenfte — kein zweiter Abruf je Objekt.
  const properties = res.data.items.map((p) => ({
    id: p.id,
    title: p.title,
    property_type: p.property_type,
    photo: p.photos[0] ?? null,
  }));

  return <BookingsBoard properties={properties} />;
}
