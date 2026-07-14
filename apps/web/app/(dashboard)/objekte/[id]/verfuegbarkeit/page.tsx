// Objekt → Verfügbarkeit: Mindest-/Maximalaufenthalt, Vorbereitungszeit,
// Buchungsfenster, Vorlaufzeit, gesperrte Check-in/out-Tage — mit „Custom setup
// per channel" (NextDays / Airbnb / Booking.com / Google).
import { AvailabilityForm } from "@/components/objekte/availability-form";
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
  return (
    <div className="flex flex-col gap-6">
      <AvailabilityForm initial={res.data} />
    </div>
  );
}
