// Auswertung → Preise & Markt: die Auswertung des Dynamic Pricing.
//
// Eigene Unterseite (Wunsch des Betreibers, 05.09.2026: „unter Auswertung
// mehr Berichte als separate Unterseite"). Sie liest je OBJEKT und kennt
// keinen Zeitraum — der Horizont ist der Push-Horizont der Automatik. Deshalb
// passt sie nicht in die Reiter der Hauptseite, die alle EINEN Zeitraum
// teilen.
//
// Zugang wie die Auswertung (view_finances) UND das Modul „Dynamische
// Preise": ohne Modul gäbe es keinen Bericht, nur ein leeres Gerüst.
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PreisMarktBericht } from "@/components/auswertung/preis-markt-bericht";
import { ModulVerkaufsseite } from "@/components/erweiterungen/modul-verkaufsseite";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card } from "@nextdays/ui/card";
import { getMe } from "@/lib/auth";
import { getDpOverview } from "@/lib/dynamic-pricing";
import { erweiterungFuerModul } from "@/lib/erweiterungen";

export const dynamic = "force-dynamic";

export default async function PreiseMarktPage() {
  const t = await getTranslations("analysis");
  const [me, overview] = await Promise.all([getMe(), getDpOverview()]);
  // Dieselbe Hürde wie /auswertung (Wurzel 9): Preise sind Vertriebsdaten.
  if (!me?.capabilities.includes("view_finances")) notFound();

  const modul = erweiterungFuerModul("dynamische_preise");
  if (overview.ok && !overview.data.module_active && modul) {
    return (
      <div className="flex w-full flex-col p-6">
        <ModulVerkaufsseite eintrag={modul} />
      </div>
    );
  }
  if (!overview.ok) {
    return <Card className="p-5 text-sm text-destructive">{overview.error}</Card>;
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Neue Marktzeilen und neu berechnete Preise erscheinen ohne Reload. */}
      <RealtimeRefresh tables={["dynamic_prices", "dp_settings", "dp_ki_entscheidungen"]} />
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-extrabold">{t("prices.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("prices.subtitle")}</p>
      </header>
      <PreisMarktBericht
        objekte={overview.data.items
          .filter((i) => i.enabled)
          .map((i) => ({ id: i.property_id, title: i.title, currency: i.currency }))}
      />
    </div>
  );
}
