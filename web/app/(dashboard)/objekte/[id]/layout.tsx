// Objekt-Detail-Layout: Untermenü links (Rental details +
// Reservation setup) mit Objekt-Wähler oben, Inhalt rechts. Server Component
// lädt das Objekt für den Kopf; die Unterseiten rendern als {children}.
import { getTranslations } from "next-intl/server";

import { notFound } from "next/navigation";

import { PropertyRealtime } from "@/components/objekte/property-realtime";
import { PropertySubnav } from "@/components/objekte/property-subnav";
import { adressZeile } from "@/lib/property-address";
import { getProperty, listProperties } from "@/lib/properties";

export default async function ObjektLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Objekt und Objektliste parallel: die Liste speist den Umschalter im Kopf.
  const [res, alle] = await Promise.all([getProperty(id), listProperties()]);
  const t = await getTranslations("objects");
  if (!res.ok) {
    if (res.error.includes("nicht gefunden")) notFound();
    return (
      <div className="p-2 text-sm text-destructive">
        {t("IdLayout.loadError", { error: res.error })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_1fr]">
      {/* Live-Abo der Objektzeile → bei jeder Änderung Server-Components neu
          laden (Status/Stammdaten ohne Reload, auch bei externen Änderungen). */}
      <PropertyRealtime propertyId={id} />
      <PropertySubnav
        id={id}
        title={res.data.title}
        photo={res.data.photos[0] ?? null}
        status={res.data.status}
        // Scheitert die Liste, bleibt der Kopf eine Anzeige — kein Umschalter
        // mit leerer Auswahl.
        properties={
          alle.ok
            ? alle.data.items.map((p) => ({
                id: p.id,
                title: p.title,
                photo: p.photos[0] ?? null,
                status: p.status,
              }))
            : undefined
        }
        addresses={
          alle.ok
            ? Object.fromEntries(
                alle.data.items.map((p) => [p.id, adressZeile(p)]),
              )
            : undefined
        }
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
