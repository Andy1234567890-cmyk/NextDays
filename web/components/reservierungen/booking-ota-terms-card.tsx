"use client";

// Konditionen des Portals zu EINER Buchung (0384).
//
// Warum das eine eigene Karte ist und nicht in „Buchungskonditionen" gehört:
// Für eine OTA-Buchung gilt die Staffel, die Booking.com bzw. Airbnb dem Gast
// zugesagt hat — nicht die Kondition unseres Betriebs. Wer am Telefon sagt „bis
// zum 25. Juni kostenfrei", muss die Zusage DES PORTALS lesen. Beides in einer
// Karte zu mischen wäre die Stelle, an der jemand die falsche Frist nennt.
//
// Alles hier kommt aus dem Portal-Payload (Wurzel 4: keine Interpretation).
// Fehlt etwas, bleibt die Zeile weg — leere Angaben sind kein Inhalt.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";

import { Card } from "@nextdays/ui/card";
import { formatCurrency } from "@/lib/currency";
import type { ReservationDetail } from "@/lib/reservations";

/** Beträge kommen aus dem Portal-JSON als String („4268.00") oder als Zahl. */
function betrag(wert: string | number | null): number | null {
  if (wert == null) return null;
  const zahl = typeof wert === "number" ? wert : Number.parseFloat(wert);
  return Number.isFinite(zahl) ? zahl : null;
}

export function BookingOtaTermsCard({ data }: { data: ReservationDetail }) {
  const t = useTranslations("reservations");
  const locale = useLocale();

  const staffel = data.ota_cancel_penalties ?? [];
  const details = (data.ota_details ?? {}) as {
    rooms?: { policies?: string; meal_plan?: string; children_ages?: number[] }[];
    guest_labels?: string[];
    arrival_hour?: string;
  };
  const raum = details.rooms?.[0];
  const hatInhalt =
    staffel.length > 0 ||
    !!data.ota_notes ||
    !!raum?.policies ||
    !!raum?.meal_plan ||
    (details.guest_labels?.length ?? 0) > 0;

  if (!hatInhalt) return null;

  const zeitpunkt = (iso: string) =>
    new Date(iso).toLocaleString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold">
          {t("otaTerms.title")}
        </h2>
        <span className="text-sm text-muted-foreground">
          {data.ota_name ?? ""}
        </span>
      </div>

      {staffel.length > 0 && (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-semibold">{t("otaTerms.cancellation")}</p>
          {staffel.map((stufe, i) => {
            const wert = betrag(stufe.amount);
            return (
              <div
                key={i}
                className="flex flex-wrap items-baseline justify-between gap-2 text-muted-foreground"
              >
                <span>
                  {t("otaTerms.fromDate", { date: zeitpunkt(stufe.from) })}
                </span>
                <span className="font-semibold tabular-nums text-foreground">
                  {wert == null
                    ? "—"
                    : wert === 0
                      ? t("otaTerms.free")
                      : formatCurrency(
                          wert,
                          stufe.currency || data.currency,
                        )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {raum?.meal_plan && (
        <p className="text-sm">
          <span className="font-semibold">{t("otaTerms.mealPlan")}: </span>
          <span className="text-muted-foreground">{raum.meal_plan}</span>
        </p>
      )}

      {(details.guest_labels?.length ?? 0) > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          {details.guest_labels?.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium"
            >
              <Icon icon="ph:seal-check" className="size-3.5" />
              {label}
            </span>
          ))}
        </p>
      )}

      {data.ota_notes && (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-semibold">{t("otaTerms.notes")}</p>
          {/* Klartext des Portals — bewusst unverändert, inklusive
              Prepaid-Hinweis und Provisionsangabe. */}
          <p className="whitespace-pre-wrap text-muted-foreground">
            {data.ota_notes}
          </p>
        </div>
      )}

      {raum?.policies && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">
            {t("otaTerms.policies")}
          </summary>
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
            {raum.policies}
          </p>
        </details>
      )}
    </Card>
  );
}
