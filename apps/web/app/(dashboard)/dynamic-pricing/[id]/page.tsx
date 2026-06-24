// Dynamic Pricing → 30-Tage-Vorschau eines Objekts (Hostaway „30-day preview“):
// read-only-Monatsraster mit dem empfohlenen Tagespreis (Resolver: Override >
// dynamisch > Wochentag > Basis). Manuelle Tagespreise setzt man im normalen
// Kalender (sie gewinnen immer). Server Component lädt 35 Tage Verfügbarkeit.
import { notFound } from "next/navigation";

import { DpPreviewGrid } from "@/components/dynamic-pricing/dp-preview-grid";
import { Card } from "@/components/ui/card";
import { getAvailability } from "@/lib/calendar";
import { getProperty } from "@/lib/properties";

export const dynamic = "force-dynamic";

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const start = isoDay(0);
  const end = isoDay(35); // exklusiv → 35 Tage Vorschau
  const [prop, avail] = await Promise.all([
    getProperty(id),
    getAvailability(id, start, end),
  ]);
  if (!prop.ok) {
    if (prop.error.includes("nicht gefunden")) notFound();
    return (
      <div className="mx-auto w-full max-w-5xl p-6">
        <Card className="p-5 text-sm text-destructive">
          Objekt konnte nicht geladen werden: {prop.error}
        </Card>
      </div>
    );
  }
  return (
    <div className="flex w-full flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <a
          href="/dynamic-pricing"
          className="text-sm text-accent hover:underline"
        >
          ← Dynamic Pricing
        </a>
        <h1 className="font-display text-2xl font-extrabold">
          {prop.data.title} — Vorschau
        </h1>
        <p className="text-sm text-muted-foreground">
          Empfohlene Tagespreise der nächsten 35 Tage. Tagespreise manuell
          anpassen kannst du im Kalender — sie haben immer Vorrang.
        </p>
      </header>
      {avail.ok ? (
        <DpPreviewGrid days={avail.data} />
      ) : (
        <Card className="p-5 text-sm text-destructive">
          Preise konnten nicht geladen werden: {avail.error}
        </Card>
      )}
    </div>
  );
}
