// Objekt → Preise (wie Lodgify „Pricing", Etappe 1): Grundpreis, Mark-up je
// Kanal, Extra-Gast-/Kurzaufenthalts-Aufschlag, längenabhängige Preise. Dazu der
// Dynamic-Pricing-Bereich (regelbasiert, opt-in).
import { DynamicPricingSection } from "@/components/objekte/dynamic-pricing-section";
import { PricingForm } from "@/components/objekte/pricing-form";
import { getDpSettings } from "@/lib/dynamic-pricing";
import { getProperty } from "@/lib/properties";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [res, dp] = await Promise.all([getProperty(id), getDpSettings(id)]);
  if (!res.ok) {
    return (
      <div className="text-sm text-destructive">
        Objekt konnte nicht geladen werden: {res.error}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-10">
      <PricingForm initial={res.data} />
      {dp.ok && <DynamicPricingSection propertyId={id} initial={dp.data} />}
    </div>
  );
}
