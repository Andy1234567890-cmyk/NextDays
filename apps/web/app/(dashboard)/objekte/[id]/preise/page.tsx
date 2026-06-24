// Objekt → Preise (wie Lodgify „Pricing", Etappe 1): Grundpreis, Mark-up je
// Kanal, Extra-Gast-/Kurzaufenthalts-Aufschlag, längenabhängige Preise. Die
// automatische Preisanpassung liegt im eigenen Tab „Dynamic Pricing".
import { PricingForm } from "@/components/objekte/pricing-form";
import { getProperty } from "@/lib/properties";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await getProperty(id);
  if (!res.ok) {
    return (
      <div className="text-sm text-destructive">
        Objekt konnte nicht geladen werden: {res.error}
      </div>
    );
  }
  return <PricingForm initial={res.data} />;
}
