"use client";

// Zeitleiste als EIGENE Seite/Tab (.. „Buchung {ref} → Zeitleiste"). Zeigt
// den kompletten Ereignis-Flow. Kopf (Breadcrumb + Titel + Tab-Umschalter) wie
// auf der Übersichts-Detailseite; die Reservierung wird nur für Ref-Label +
// Währung geladen (die Ereignisse holt BookingTimeline selbst, live).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { BookingDetailTabs } from "@/components/reservierungen/booking-detail-tabs";
import { BookingTimeline } from "@/components/reservierungen/booking-timeline";
import { Card } from "@nextdays/ui/card";
import { useReservationDetail } from "@/lib/use-reservation-detail";

export function BookingTimelinePage({
  reservationId,
}: {
  reservationId: string;
}) {
  const t = useTranslations("reservations");
  const { data, error } = useReservationDetail(reservationId);
  const refLabel = data?.external_ref ?? reservationId.slice(0, 8);
  const currency = data?.currency ?? "";

  return (
    <div className="flex flex-col gap-5">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/reservierungen" className="hover:text-foreground hover:underline">
          {t("bookingTimelinePage.breadcrumbBookings")}
        </Link>
        <Icon icon="ph:caret-right" className="size-3.5" />
        <Link
          href={`/reservierungen/${reservationId}`}
          className="hover:text-foreground hover:underline"
        >
          {t("bookingTimelinePage.bookingRef", { ref: refLabel })}
        </Link>
        <Icon icon="ph:caret-right" className="size-3.5" />
        <span className="text-foreground">{t("bookingTimelinePage.breadcrumbTimeline")}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">
          {t("bookingTimelinePage.bookingRef", { ref: refLabel })}
        </h1>
        <BookingDetailTabs reservationId={reservationId} />
      </div>

      {error ? (
        <Card className="p-5 text-sm text-destructive">{error}</Card>
      ) : (
        <Card className="p-5">
          <BookingTimeline
            reservationId={reservationId}
            currency={currency}
            variant="tab"
          />
        </Card>
      )}
    </div>
  );
}
