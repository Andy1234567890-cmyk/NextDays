// Dynamic Pricing → 30-Tage-Vorschau eines Objekts (Hostaway „30-day preview“):
// read-only-Monatsraster mit dem empfohlenen Tagespreis (Resolver: Override >
// dynamisch > Wochentag > Basis). Manuelle Tagespreise setzt man im normalen
// Kalender (sie gewinnen immer). Server Component lädt 35 Tage Verfügbarkeit.
import Link from "next/link";
import { notFound } from "next/navigation";

import { DpPreviewGrid } from "@/components/dynamic-pricing/dp-preview-grid";
import { ModulVerkaufsseite } from "@/components/erweiterungen/modul-verkaufsseite";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card } from "@nextdays/ui/card";
import { getAvailability, getBoard } from "@/lib/calendar";
import { getDpOverview } from "@/lib/dynamic-pricing";
import { erweiterungFuerModul } from "@/lib/erweiterungen";
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
  const [prop, avail, board, overview] = await Promise.all([
    getProperty(id),
    getAvailability(id, start, end),
    // Objekt-Währung (aus dem Rate-Plan) für die Preisanzeige — kein €-Hardcode.
    getBoard([id], start, end),
    // Modul-Status: die Vorschau ist Teil des kostenpflichtigen Moduls. Ein
    // Direktaufruf dieser URL darf es nicht umgehen (gleicher Scope wie die
    // Liste, Wurzel 9) — ohne Buchung stünde hier ohnehin ein leeres Raster.
    getDpOverview(),
  ]);
  const modul = erweiterungFuerModul("dynamische_preise");
  if (overview.ok && !overview.data.module_active && modul) {
    return (
      <div className="flex w-full flex-col p-6">
        <ModulVerkaufsseite eintrag={modul} />
      </div>
    );
  }
  const currency =
    (board.ok ? board.data.items[0]?.currency : null) ?? null;
  if (!prop.ok) {
    // Nicht gefunden ODER keine Berechtigung (manage_calendar) → für diesen
    // Nutzer existiert die Vertriebs-Vorschau nicht (Wurzel 3), kein 403-Kasten.
    if (prop.status === 403 || prop.error.includes("nicht gefunden")) notFound();
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
      {/* Realtime-Pflicht: ALLE preis-speisenden Tabellen der Resolver-Kette live —
          ein manueller Tagespreis (price_overrides, gewinnt immer), ein geänderter
          Basispreis (rate_plans) oder Wochentagspreis (property_pricing_config)
          erscheint sofort, ohne dass die Seite manuell neu geladen werden muss. */}
      <RealtimeRefresh
        tables={[
          "price_overrides",
          "dynamic_prices",
          "property_pricing_config",
          "rate_plans",
          "availability",
          "dp_settings",
        ]}
      />
      <header className="flex flex-col gap-1">
        <Link
          href="/dynamic-pricing"
          className="text-sm text-accent hover:underline"
        >
          ← Dynamic Pricing
        </Link>
        <h1 className="font-display text-2xl font-extrabold">
          {prop.data.title} — Vorschau
        </h1>
        <p className="text-sm text-muted-foreground">
          Empfohlene Tagespreise der nächsten 35 Tage. Tagespreise manuell
          anpassen kannst du im Kalender — sie haben immer Vorrang.
        </p>
      </header>
      {avail.ok ? (
        <DpPreviewGrid days={avail.data} propertyId={id} currency={currency} />
      ) : (
        <Card className="p-5 text-sm text-destructive">
          Preise konnten nicht geladen werden: {avail.error}
        </Card>
      )}
    </div>
  );
}
