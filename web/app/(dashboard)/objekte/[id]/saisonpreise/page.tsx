// Objekt → Saisonpreise: benannte Saisons auf einem Jahres-Kalender (Drag&Drop).
// Schreibt price_overrides und überträgt die Preise an alle Buchungsportale (Channex).
import { getTranslations } from "next-intl/server";

import { SeasonCalendar } from "@/components/objekte/season-calendar";
import { getProperty } from "@/lib/properties";
import { listRatePlans } from "@/lib/rates";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await getProperty(id);
  if (!res.ok) {
    const t = await getTranslations("seasons");
    return (
      <div className="text-sm text-destructive">
        {t("loadFailed", { error: res.error })}
      </div>
    );
  }
  // Währung UND Basispreis kommen aus dem Rate-Plan — das ist die Quelle, mit
  // der auch der Server die Prozent-Saisons materialisiert (rate_plans.base_price).
  // Ohne Rate-Plan bleibt beides null: Betrag ohne Symbol bzw. %-Label ohne
  // Vorschau statt erfundenem Euro/0,00 (Wurzel 4).
  const rates = await listRatePlans(id);
  const ratePlan = rates.ok ? (rates.data.items[0] ?? null) : null;
  return (
    <SeasonCalendar
      initial={res.data}
      currency={ratePlan?.currency ?? null}
      basePrice={ratePlan?.base_price ?? null}
    />
  );
}
