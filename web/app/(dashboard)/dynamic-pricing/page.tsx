// Dynamic Pricing (Hostaway-Modell) — zentrale Objekt-Tabelle: pro Objekt
// Basispreis (+ Modus), Min/Max, Aktiv-Toggle, Bearbeiten-Slider und 30-Tage-
// Vorschau. Eine Preis-Wahrheit (Resolver); ein manueller Tagespreis im Kalender
// gewinnt immer. Server Component lädt die Übersicht; der Client-Teil bearbeitet.
import { notFound } from "next/navigation";

import { DynamicPricingTable } from "@/components/dynamic-pricing/dynamic-pricing-table";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card } from "@nextdays/ui/card";
import { getDpOverview } from "@/lib/dynamic-pricing";

export const dynamic = "force-dynamic";

export default async function DynamicPricingPage() {
  const res = await getDpOverview();
  // Vertriebs-/Preis-Fläche (manage_calendar). Fehlt sie, existiert die Seite
  // für diesen Nutzer nicht (Sidebar-Gate, Wurzel 3) — kein 403-Fehlerkasten.
  if (!res.ok && res.status === 403) notFound();
  return (
    <div className="flex w-full flex-col gap-6 p-6">
      {/* Realtime-Pflicht: Toggle/Preise anderer Nutzer + neue Objekte live. */}
      <RealtimeRefresh tables={["dp_settings", "dynamic_prices", "properties"]} />
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-extrabold">Dynamic Pricing</h1>
        <p className="text-sm text-muted-foreground">
          Lass myNextDays die Nachtpreise automatisch nach Saison, Wochenende,
          Auslastung, Vorlaufzeit und Markt anpassen. Aktiviere es pro Objekt und
          lege Basispreis-Strategie sowie Mindest-/Höchstpreis fest. Ein manuell
          gesetzter Tagespreis im Kalender hat immer Vorrang.
        </p>
      </header>
      {res.ok ? (
        <DynamicPricingTable items={res.data.items} />
      ) : (
        <Card className="p-5 text-sm text-destructive">
          Objekte konnten nicht geladen werden: {res.error}
        </Card>
      )}
    </div>
  );
}
