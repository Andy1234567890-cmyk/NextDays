// Objekt → Saisonpreise: Tagespreise je Zeitraum (Hoch-/Nebensaison). Schreibt
// price_overrides und überträgt die Preise an alle Buchungsportale (Channex).
import { SeasonPriceForm } from "@/components/objekte/season-price-form";
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
  return <SeasonPriceForm initial={res.data} />;
}
