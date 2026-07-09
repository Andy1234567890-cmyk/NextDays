// Objekt → Warnungen (Lodgify „Warnungen"): aus den Buchungen dieses Objekts
// abgeleitete Hinweise (fehlende Zahlung, bereits abgereist ohne Check-out).
import { PropertyWarnings } from "@/components/reservierungen/property-warnings";

export default async function WarnungenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PropertyWarnings propertyId={id} />;
}
