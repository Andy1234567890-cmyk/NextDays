// Objekt → Verfügbarkeit (wie Lodgify „Availability"): Mindest-/Maximalaufenthalt,
// Vorbereitungszeit, Buchungsfenster, Vorlaufzeit, gesperrte Check-in/out-Tage —
// mit „Custom setup per channel" (NextDays / Airbnb / Booking.com / Google).
// Externe Kalender (iCal-Umzug) liegen NICHT hier, sondern zentral im
// Konto-Tab „Umzug" (/konto/umzug) — dort verbindet der Kunde alle Objekte.
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
