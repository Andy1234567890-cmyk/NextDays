"use client";

// Buchungs-Popup im Aufgaben-Kalender (Klick auf einen Buchungs-Balken).
// Zeigt Buchung-ID, Zeitraum, Erwachsene/Kinder, Buchungsquelle. Aktionen:
// „Ansehen" (zur Buchungsdetailseite) + „Aufgabe erstellen" (verknüpft mit
// dieser Buchung). Keine Beträge/Gast-PII (§4.3).
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { CHANNEL_META } from "@/lib/calendar-channels";
import type { AvailabilitySource } from "@/lib/calendar";
import type { CalendarBooking } from "@/lib/tasks";

export function BookingPopover({
  booking,
  adults,
  children,
  onClose,
  onCreateTask,
}: {
  booking: CalendarBooking;
  adults: number;
  children: number;
  onClose: () => void;
  onCreateTask: () => void;
}) {
  const meta =
    CHANNEL_META[booking.channel as AvailabilitySource] ?? CHANNEL_META.direct;
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="absolute left-1/2 top-1/2 w-72 -translate-x-1/2 -translate-y-1/2 rounded-(--radius) border bg-card p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <p className="mb-3 text-sm text-muted-foreground">
          Buchung {booking.id.slice(0, 8)}
        </p>
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="font-medium">Von:</dt>
            <dd>{fmt(booking.check_in)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium">Bis:</dt>
            <dd>{fmt(booking.check_out)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium">Erwachsene:</dt>
            <dd>{adults}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium">Kinder:</dt>
            <dd>{children}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium">Buchungsquelle:</dt>
            <dd>{booking.ota_name ?? meta.label}</dd>
          </div>
        </dl>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/reservierungen/${booking.id}`}>Ansehen</Link>
          </Button>
          <Button size="sm" onClick={onCreateTask}>
            Aufgabe erstellen
          </Button>
        </div>
      </div>
    </div>
  );
}
