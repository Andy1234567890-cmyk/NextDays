// Objekt-Detail-Layout: Untermenü links (Rental details +
// Reservation setup) mit Objekt-Wähler oben, Inhalt rechts. Server Component
// lädt das Objekt für den Kopf; die Unterseiten rendern als {children}.
import { getTranslations } from "next-intl/server";

import { notFound } from "next/navigation";

import { PropertyRealtime } from "@/components/objekte/property-realtime";
import { PropertySubnav } from "@/components/objekte/property-subnav";
import { getMe } from "@/lib/auth";
import { getProperty } from "@/lib/properties";

export default async function ObjektLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [res, me] = await Promise.all([getProperty(id), getMe()]);
  const t = await getTranslations("objects");
  const isHotel = me?.accommodation_type === "hotel";
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
        isHotel={isHotel}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
