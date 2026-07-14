// Objekt → Saisonpreise: benannte Saisons auf einem Jahres-Kalender (Drag&Drop).
// Schreibt price_overrides und überträgt die Preise an alle Buchungsportale (Channex).
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
    return (
      <div className="text-sm text-destructive">
        Objekt konnte nicht geladen werden: {res.error}
      </div>
    );
  }
  // Objekt-Währung aus dem Rate-Plan (kein €-Hardcode). Ohne Rate-Plan null →
  // Betrag ohne Symbol statt erfundenem Euro.
  const rates = await listRatePlans(id);
  const currency = rates.ok ? (rates.data.items[0]?.currency ?? null) : null;
  return <SeasonCalendar initial={res.data} currency={currency} />;
}
