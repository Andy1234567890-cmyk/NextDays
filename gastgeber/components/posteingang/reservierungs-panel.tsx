"use client";

// Rechte Spalte des Posteingangs (Airbnb „Reservation"): Objekt-Foto, Titel +
// Ort, Reservierungs-/Zahldetails (Nächte, Gäste, Status, Betrag, Zahlstatus,
// Stornogrund). Lädt beim Öffnen; fehlende Felder rendern „—" (kein Fake).
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { formatCurrency } from "@nextdays/currency";

import type { HostReservationDetail } from "@/lib/posteingang";
import { getReservationDetail } from "@/lib/posteingang";

// Die vier Reservierungsstatus des Backends; unbekannte Werte werden roh gezeigt.
const STATUS_KEYS = ["confirmed", "pending", "cancelled", "completed"] as const;

// Platzhalter für fehlende Werte — reines Satzzeichen, sprachunabhängig.
const LEER = "—";

export function ReservierungsPanel({
  threadId,
  onClose,
}: {
  threadId: string;
  onClose: () => void;
}) {
  const t = useTranslations("posteingang");
  const locale = useLocale();
  const [detail, setDetail] = useState<HostReservationDetail | null>(null);
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    let aktiv = true;
    setLaedt(true);
    void getReservationDetail(threadId).then((d) => {
      if (!aktiv) return;
      setDetail(d);
      setLaedt(false);
    });
    return () => {
      aktiv = false;
    };
  }, [threadId]);

  return (
    <aside className="hidden h-full w-[26rem] flex-col overflow-y-auto border-l border-border bg-background lg:flex">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-6 py-4">
        <h2 className="font-display text-[1.35rem] font-semibold tracking-tight">
          {t("detailsTitel")}
        </h2>
        <button
          type="button"
          aria-label={t("schliessen")}
          onClick={onClose}
          className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
        >
          <Icon icon="ph:x" className="size-4" />
        </button>
      </div>

      {laedt ? (
        <p className="px-6 py-8 text-sm text-muted-foreground">{t("laedt")}</p>
      ) : !detail ? (
        <p className="px-6 py-8 text-sm text-muted-foreground">
          {t("keineReservierungsdaten")}
        </p>
      ) : (
        <div className="px-6 py-6">
          {/* Foto */}
          {detail.property_photos.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={detail.property_photos[0]}
              alt={detail.property_title ?? t("objektFoto")}
              className="mb-4 h-52 w-full rounded-2xl object-cover"
            />
          ) : (
            <div className="mb-4 flex h-52 w-full items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Icon icon="ph:image" className="size-8" />
            </div>
          )}

          <h3 className="font-display text-xl font-semibold">
            {detail.property_title ?? LEER}
          </h3>
          {(detail.city || detail.country) && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[detail.city, detail.country].filter(Boolean).join(", ")}
            </p>
          )}

          <div className="mt-6 border-t border-border pt-6">
            <h4 className="mb-3 text-lg font-semibold">
              {t("reservierungsdetails")}
            </h4>
            <dl className="space-y-3 text-sm">
              <Zeile
                label={t("anreise")}
                wert={datum(detail.check_in, locale)}
              />
              <Zeile
                label={t("abreise")}
                wert={datum(detail.check_out, locale)}
              />
              <Zeile
                label={t("naechte")}
                wert={detail.nights != null ? String(detail.nights) : LEER}
              />
              <Zeile
                label={t("gaeste")}
                wert={
                  detail.num_guests != null ? String(detail.num_guests) : LEER
                }
              />
              <Zeile
                label={t("status")}
                wert={
                  detail.status
                    ? istBekannterStatus(detail.status)
                      ? t(`status_${detail.status}`)
                      : detail.status
                    : LEER
                }
              />
            </dl>
          </div>

          <div className="mt-6 border-t border-border pt-6">
            <h4 className="mb-3 text-lg font-semibold">{t("zahlung")}</h4>
            <dl className="space-y-3 text-sm">
              <Zeile
                label={t("gesamtbetrag")}
                wert={betrag(detail.total_amount, detail.currency)}
              />
              <Zeile
                label={t("bezahlt")}
                wert={betrag(detail.paid_amount, detail.currency)}
              />
              <Zeile
                label={t("zahlstatus")}
                wert={detail.payment_status ?? LEER}
              />
            </dl>
          </div>

          {detail.cancel_reason && (
            <div className="mt-6 border-t border-border pt-6">
              <h4 className="mb-1 text-lg font-semibold">
                {t("stornierung")}
              </h4>
              <p className="text-sm text-muted-foreground">
                {detail.cancel_reason}
              </p>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function Zeile({ label, wert }: { label: string; wert: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{wert}</dd>
    </div>
  );
}

// Datum in der aktiven UI-Sprache formatieren — kein festes de-DE, sonst
// bliebe das Datum deutsch, während die Oberfläche übersetzt ist.
function datum(iso: string | null, locale: string): string {
  if (!iso) return LEER;
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Betrag mit echter Objektwährung (kein €-Hardcode, Wurzel 4). Fehlt der Betrag,
// „—"; fehlt die Währung, rendert formatCurrency symbollos.
function betrag(amount: number | null, currency: string | null): string {
  if (amount == null) return LEER;
  return formatCurrency(amount, currency);
}

function istBekannterStatus(
  status: string,
): status is (typeof STATUS_KEYS)[number] {
  return (STATUS_KEYS as readonly string[]).includes(status);
}
