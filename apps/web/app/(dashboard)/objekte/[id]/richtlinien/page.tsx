// Objekt → Richtlinien (wie Lodgify „Policies"): Storno/Zahlung/Kaution,
// Buchbarkeit, Check-in/out-Zeiten, Raten-Info, Mietvertrag. Server Component
// lädt das Objekt, der Client-Teil rendert die bearbeitbaren Blöcke.
import { PoliciesForm } from "@/components/objekte/policies-form";
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
    return (
      <div className="text-sm text-destructive">
        Objekt konnte nicht geladen werden: {res.error}
      </div>
    );
  }
  // Objekt-Währung aus dem Rate-Plan (kein €-Hardcode). Fehlt ein Rate-Plan,
  // bleibt sie null → Beträge ohne Symbol statt erfundenem Euro.
  const rates = await listRatePlans(id);
  const currency = rates.ok ? (rates.data.items[0]?.currency ?? null) : null;
  return <PoliciesForm initial={res.data} currency={currency} />;
}
