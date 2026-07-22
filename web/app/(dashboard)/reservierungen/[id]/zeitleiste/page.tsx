// Zeitleiste einer Buchung als eigene Seite/Tab (Buchung {ref} →
// Zeitleiste). Server Component reicht die id an den Client-Teil durch.
import { BookingTimelinePage } from "@/components/reservierungen/booking-timeline-page";

export default async function ReservationTimelineRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BookingTimelinePage reservationId={id} />;
}
