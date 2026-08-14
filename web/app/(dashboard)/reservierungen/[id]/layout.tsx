// Buchungsdetail-Bereich (Lodgify-Posteingang-Struktur): links die Liste aller
// Buchungen, rechts das Detail der gewählten — Übersicht und Zeitleiste liegen
// beide in dieser Hülle, die Liste bleibt beim Wechsel stehen.
//
// Server Component, weil die Objekt-Titel (für Zeilen und Objektfilter) aus
// listProperties kommen; die Liste selbst ist ein Client-Teil mit Realtime.
// Schlägt das Laden fehl, rendert die Sidebar ohne Titel weiter statt die
// ganze Detailseite zu blockieren — die Buchung ist wichtiger als ihr
// Objekt-Label.
import { Icon } from "@iconify/react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { ReservationInboxSidebar } from "@/components/reservierungen/reservation-inbox-sidebar";
import { listProperties } from "@/lib/properties";

/** Rückweg zur Buchungsliste — nur unterhalb von `lg`, wo die Liste fehlt. */
async function BackToListLink() {
  const t = await getTranslations("calendar");
  return (
    <Link
      href="/reservierungen"
      className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground lg:hidden"
    >
      <Icon icon="ph:caret-left" className="size-4" />
      {t("bookingsView.allBookings")}
    </Link>
  );
}

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
  //
  // MOBIL EIN BILDSCHIRM, NICHT ZWEI ÜBEREINANDER: Unterhalb von `lg` sind die
  // beiden Spalten gestapelt, und die Liste ist `shrink-0` mit voller Höhe —
  // das Detail lag damit UNTER dem sichtbaren Bereich und war auf dem Handy
  // gar nicht erreichbar (live bei 307px). Es half auch kein Scrollen: der
  // Container hat feste Höhe, gescrollt wird nur INNERHALB der Liste.
  //
  // Auf schmalen Geräten zeigt die Route deshalb genau EINE Fläche: das Detail
  // der geöffneten Buchung, mit einem Rückweg zur Liste. Das ist das übliche
  // Muster (Mail-Apps, Lodgify) und der einzige Weg, der ohne zweite Route
  // auskommt — ein `hidden lg:flex` an der Liste allein hätte den Rückweg
  // verschluckt.
  return (
    <div className="-m-4 flex h-[calc(100vh-4rem)] flex-col md:-m-6 lg:flex-row">
      {/* Liste: mobil aus, ab lg die feste linke Spalte. `shrink-0` gehört an
          DIESEN Wrapper — das `lg:w-[19rem]` der Sidebar wirkt sonst nicht, weil
          der Flex-Container sie zusammendrückt. */}
      <div className="hidden min-h-0 shrink-0 lg:flex">
        <ReservationInboxSidebar activeId={id} properties={properties} />
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
        {/* Rückweg zur Liste — nur dort, wo die Liste ausgeblendet ist. */}
        <BackToListLink />
        {children}
      </div>
    </div>
  );
}
