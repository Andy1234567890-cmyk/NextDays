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

  // Höhe: dieselbe Bauweise wie der Posteingang (components/inbox/inbox-list.tsx)
  // — das Padding des umgebenden `main` per negativem Margin herausziehen und
  // die volle Resthöhe unter der Topbar (h-16 = 4rem) einnehmen. Die Fläche
  // reicht damit exakt bis zur Unterkante.
  //
  // Vorher stand hier `max-h-[calc(100vh-9rem)]` (und dasselbe an der Liste):
  // Topbar + main-Padding belegen real nur 7rem, also blieben rund 2rem weiße
  // Fläche unter beiden Spalten stehen. `min-h-0` erlaubt den Kindern, im
  // Flex-Container zu schrumpfen und intern zu scrollen (min-height wäre sonst
  // `auto`).
  return (
    <div className="-m-4 flex h-[calc(100vh-4rem)] flex-col md:-m-6 lg:flex-row">
      <ReservationInboxSidebar activeId={id} properties={properties} />
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
        {children}
      </div>
    </div>
  );
}
