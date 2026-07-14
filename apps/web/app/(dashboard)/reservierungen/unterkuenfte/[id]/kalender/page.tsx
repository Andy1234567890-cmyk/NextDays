// Objekt → Kalender: Monatsübersicht mit belegten Nächten
// dieses Objekts. Speist sich aus listReservations(propertyId) (Client) — live.
import { PropertyCalendar } from "@/components/reservierungen/property-calendar";

export default async function KalenderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PropertyCalendar propertyId={id} />;
}
