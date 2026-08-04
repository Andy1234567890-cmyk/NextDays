// Dynamic Pricing (Hostaway-Modell) — zentrale Objekt-Tabelle: pro Objekt
// Basispreis (+ Modus), Min/Max, Aktiv-Toggle, Bearbeiten-Slider und 30-Tage-
// Vorschau. Eine Preis-Wahrheit (Resolver); ein manueller Tagespreis im Kalender
// gewinnt immer. Server Component lädt die Übersicht; der Client-Teil bearbeitet.
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DynamicPricingTable } from "@/components/dynamic-pricing/dynamic-pricing-table";
import { ModulVerkaufsseite } from "@/components/erweiterungen/modul-verkaufsseite";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card } from "@nextdays/ui/card";
import { getDpOverview } from "@/lib/dynamic-pricing";
import { erweiterungFuerModul } from "@/lib/erweiterungen";

export const dynamic = "force-dynamic";

export default async function DynamicPricingPage() {
  const t = await getTranslations("nav");
  const res = await getDpOverview();
  // Vertriebs-/Preis-Fläche (manage_calendar). Fehlt sie, existiert die Seite
  // für diesen Nutzer nicht (Sidebar-Gate, Wurzel 3) — kein 403-Fehlerkasten.
  if (!res.ok && res.status === 403) notFound();
  // „Dynamische Preise" ist ein kostenpflichtiges Modul. Ohne Buchung rechnet
  // die Engine nicht (recompute-Gate) — dann zeigt die Fläche die Verkaufsseite
  // statt einer Tabelle mit Schaltern, die nichts bewirken. Die Auskunft kommt
  // von der Fläche selbst (`module_active`), nicht vom Abo-Endpunkt: der
  // verlangt MANAGE_BILLING, das ein reiner Vertriebs-Nutzer nicht hat.
  const modul = erweiterungFuerModul("dynamische_preise");
  if (res.ok && !res.data.module_active && modul) {
    return (
      <div className="flex w-full flex-col p-6">
        <ModulVerkaufsseite eintrag={modul} />
      </div>
    );
  }
  return (
    <div className="flex w-full flex-col gap-6 p-6">
      {/* Realtime-Pflicht: Toggle/Preise anderer Nutzer + neue Objekte live. */}
      <RealtimeRefresh tables={["dp_settings", "dynamic_prices", "properties"]} />
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-extrabold">{t("dynamicPricing")}</h1>
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
