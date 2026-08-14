// Objekt-Sub-Layout der PM-Fläche: links die 6-Reiter-Navigation + Objektkopf,
// rechts der jeweilige Reiter-Inhalt. Server Component lädt das Objekt für den
// Kopf (notFound bei ungültiger/fremder ID — getProperty ist tenant-scoped).
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PropertyRealtime } from "@/components/objekte/property-realtime";
import { PropertyPmSubnav } from "@/components/reservierungen/property-pm-subnav";
import { getProperty } from "@/lib/properties";

export default async function PmPropertyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await getProperty(id);
  if (!res.ok) {
    if (res.error.includes("nicht gefunden")) notFound();
    const t = await getTranslations("reservations");
    return (
      <div className="p-2 text-sm text-destructive">
        {t("IdLayout.loadError", { error: res.error })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_1fr]">
      {/* Live-Abo der Objektzeile → Kopf/Status ohne Reload aktuell. */}
      <PropertyRealtime propertyId={id} />
      <PropertyPmSubnav
        id={id}
        title={res.data.title}
        photo={res.data.photos[0] ?? null}
        status={res.data.status}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
