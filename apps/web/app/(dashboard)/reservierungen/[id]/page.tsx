// Buchungsdetail als eigene Vollseite (Lodgify „Buchung {ref}"). Server
// Component reicht nur die id an den Client-Teil durch; alle Detaildaten holt
// die Client-Komponente maskierungskonform über getReservationDetail().
import { BookingDetail } from "@/components/reservierungen/booking-detail";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BookingDetail reservationId={id} />;
}
