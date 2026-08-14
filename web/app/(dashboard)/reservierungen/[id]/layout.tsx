// Buchungsdetail-Bereich (Lodgify-Posteingang-Struktur): links die Liste aller
// Buchungen, rechts das Detail der gewählten — Übersicht und Zeitleiste liegen
// beide in dieser Hülle, die Liste bleibt beim Wechsel stehen.
//
// Server Component, weil die Objekt-Titel (für Zeilen und Objektfilter) aus
// listProperties kommen; die Liste selbst ist ein Client-Teil mit Realtime.
// Schlägt das Laden fehl, rendert die Sidebar ohne Titel weiter statt die
// ganze Detailseite zu blockieren — die Buchung ist wichtiger als ihr
// Objekt-Label.
import { ReservationInboxSidebar } from "@/components/reservierungen/reservation-inbox-sidebar";
import { listProperties } from "@/lib/properties";

export default async function BookingDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await listProperties();
  // `photos[0]` ist das Titelbild: properties.photos spiegelt property_photos
  // mit dem Cover an Position 1 (properties/service.py). Speist das Thumbnail
  // je Zeile in der Liste links.
  const properties = res.ok
    ? res.data.items.map((p) => ({
        id: p.id,
        title: p.title,
        photo: p.photos[0] ?? null,
      }))
    : [];

  return (
    <div className="flex flex-col lg:-mt-2 lg:flex-row lg:gap-6">
      <ReservationInboxSidebar activeId={id} properties={properties} />
      <div className="min-w-0 flex-1 pt-5 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:pt-2">
        {children}
      </div>
    </div>
  );
}
