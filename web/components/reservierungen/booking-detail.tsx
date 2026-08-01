"use client";

// Buchungsdetail-Vollseite (.. „Buchung {ref}"-Layout): zweispaltig —
// links Aufenthalt/Zahlungen/Anmerkungen, rechts Kostenaufteilung/Kundendaten/
// Aufgaben/Fotos. Die gesamte Business-Logik (Laden, Realtime, Check-in/out,
// Storno, Rechnungs-Dialog) kommt aus useReservationDetail — geteilt mit dem
// Kalender-Slider, kein Doppelcode. Beträge/Kontakt kommen maskiert aus dem
// Backend (null → weggelassen/„—", kein erfundener Wert).
import { Icon } from "@iconify/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useState } from "react";

import { ReservationAddonsSection } from "@/components/kalender/reservation-addons-section";
import { BookingDetailTabs } from "@/components/reservierungen/booking-detail-tabs";
import { BookingTasksSection } from "@/components/reservierungen/booking-tasks-section";
import { CheckoutPaymentDialog } from "@/components/reservierungen/checkout-payment-dialog";
import { PropertyLocation } from "@/components/reservierungen/property-location";
import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import type { AvailabilitySource } from "@/lib/calendar";
import { useCalendarLabels } from "@/lib/use-calendar-labels";
import { channelMeta } from "@/lib/calendar-channels";
import { STATUS_META, displayStatus } from "@/lib/calendar-status";
import { formatCurrency } from "@/lib/currency";
import { dateKey } from "@/lib/calendar-views";
import { useReservationDetail } from "@/lib/use-reservation-detail";

const SendDocumentModal = dynamic(
  () =>
    import("@/components/finance/SendDocumentModal").then(
      (m) => m.SendDocumentModal,
    ),
  { ssr: false },
);

export function BookingDetail({ reservationId }: { reservationId: string }) {
  const t = useTranslations("reservations");
  const { channelLabel, statusLabel } = useCalendarLabels();
  const locale = useLocale();
  const d = useReservationDetail(reservationId);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [earlyConfirm, setEarlyConfirm] = useState(false);

  const todayKey = dateKey(new Date());
  const { data, error } = d;

  const money = (v: number | null | undefined, currency: string) =>
    v == null ? "—" : formatCurrency(v, currency);

  const fmtDate = (s: string) =>
    new Date(`${s}T00:00:00`).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <Breadcrumb refLabel={reservationId.slice(0, 8)} t={t} />
        <Card className="p-5 text-sm text-destructive">{error}</Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <Breadcrumb refLabel="…" t={t} />
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t("bookingDetail.loading")}
        </Card>
      </div>
    );
  }

  const status = displayStatus(
    data.status,
    data.check_in,
    data.check_out,
    todayKey,
    data.checked_in_at,
    data.checked_out_at,
  );
  const meta = channelMeta(data.channel as AvailabilitySource);
  const isCancelled = data.status === "cancelled";
  const isOta = data.channel !== "direct";
  const refLabel = data.external_ref ?? data.id.slice(0, 8);

  // Zahlungs-Fortschritt (..-Balken). Nur mit sichtbaren Beträgen; sonst
  // kein Balken (kein 0-Fallback, kein erfundener Prozentsatz).
  const total = data.total_amount;
  const paid = data.paid_amount;
  const paidPct =
    total != null && paid != null && total > 0
      ? Math.min(100, Math.round((paid / total) * 100))
      : null;

  const submitCancel = async () => {
    const ok = await d.submitCancel(reason);
    if (ok) {
      setCancelOpen(false);
      setReason("");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumb refLabel={refLabel} t={t} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold">
            {t("bookingDetail.bookingHeading", { ref: refLabel })}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
              <span className={`size-2 rounded-full ${STATUS_META[status].dotBg}`} />
              {statusLabel(status)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
              <Icon
                icon={meta.logo.kind === "icon" ? meta.logo.icon : "ph:globe"}
                className="size-3"
              />
              {data.ota_name ?? channelLabel(data.channel as AvailabilitySource)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {data.external_url && (
            <a
              href={data.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
            >
              <Icon icon="ph:arrow-square-out" className="size-4" />
              {t("bookingDetail.openInPortal")}
            </a>
          )}
          <BookingDetailTabs reservationId={reservationId} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ===== Linke Spalte: Aufenthalt / Zahlungen / Anmerkungen ===== */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          {/* Objekt + Aufenthalt */}
          <Card className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-extrabold">
                  {data.property_title || t("bookingDetail.propertyFallback")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("bookingDetail.guestsCount", { count: data.num_guests })}
                  {data.adults || data.children || data.infants || data.pets
                    ? ` (${[
                      data.adults &&
                        t("bookingDetail.guestsAdults", { count: data.adults }),
                      data.children &&
                        t("bookingDetail.guestsChildren", { count: data.children }),
                      data.infants &&
                        t("bookingDetail.guestsInfants", { count: data.infants }),
                      data.pets &&
                        t("bookingDetail.guestsPets", { count: data.pets }),
                    ]
                      .filter(Boolean)
                      .join(", ")})`
                    : ""}
                </p>
              </div>
              {data.created_at && (
                <div className="rounded-(--radius) border bg-secondary/40 px-3 py-1.5 text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("bookingDetail.createdOn")}
                  </p>
                  <p className="text-sm font-bold">
                    {fmtDate(data.created_at.slice(0, 10))}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius) border bg-secondary/40 p-3">
              <div className="flex items-center gap-2">
                <div className="rounded-(--radius) bg-card px-3 py-1.5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("bookingDetail.arrival")}
                  </p>
                  <p className="text-sm font-bold">{fmtDate(data.check_in)}</p>
                  {data.checkin_time && (
                    <p className="text-xs text-muted-foreground">
                      {t("bookingDetail.fromTime", { time: data.checkin_time })}
                    </p>
                  )}
                </div>
                <Icon icon="ph:arrow-right" className="size-4 text-muted-foreground" />
                <div className="rounded-(--radius) bg-card px-3 py-1.5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("bookingDetail.departure")}
                  </p>
                  <p className="text-sm font-bold">{fmtDate(data.check_out)}</p>
                  {data.checkout_time && (
                    <p className="text-xs text-muted-foreground">
                      {t("bookingDetail.untilTime", { time: data.checkout_time })}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl font-extrabold">
                  {money(data.total_amount, data.currency)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("bookingDetail.nightsCount", { count: data.nights })}
                </p>
              </div>
            </div>

            {(data.checked_in_at || data.checked_out_at) && (
              <p className="text-xs text-muted-foreground">
                {data.checked_in_at &&
                  t("bookingDetail.checkedInSince", {
                    time: fmtDateTime(data.checked_in_at),
                  })}
                {data.checked_out_at &&
                  ` · ${t("bookingDetail.checkedOutOn", {
                    time: fmtDateTime(data.checked_out_at),
                  })}`}
              </p>
            )}

            {/* Check-in / Check-out (Front-Desk-Aktionen) */}
            {!isCancelled && !d.checkoutResult && (
              <div className="flex flex-col gap-2">
                {!data.checked_in_at && data.status === "confirmed" && (
                  <>
                    {!earlyConfirm ? (
                      <Button
                        type="button"
                        disabled={d.actionBusy}
                        onClick={() =>
                          todayKey < data.check_in
                            ? setEarlyConfirm(true)
                            : d.doCheckIn()
                        }
                      >
                        <Icon icon="ph:door-open" className="size-4" />
                        {d.actionBusy
                          ? t("bookingDetail.checkingIn")
                          : t("bookingDetail.checkInGuest")}
                      </Button>
                    ) : (
                      <div className="flex flex-col gap-2 rounded-(--radius) border border-warning/40 bg-warning/10 p-3 text-sm">
                        <p>
                          {t("bookingDetail.earlyCheckInPrompt", {
                            date: fmtDate(data.check_in),
                          })}
                        </p>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEarlyConfirm(false)}
                            disabled={d.actionBusy}
                          >
                            {t("bookingDetail.cancel")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={d.doCheckIn}
                            disabled={d.actionBusy}
                          >
                            {d.actionBusy
                              ? t("bookingDetail.checkingIn")
                              : t("bookingDetail.confirmCheckIn")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {data.checked_in_at &&
                  !data.checked_out_at &&
                  (todayKey >= data.check_out ? (
                    <Button
                      type="button"
                      disabled={d.actionBusy}
                      onClick={() => setPaymentOpen(true)}
                    >
                      <Icon icon="ph:flag-checkered" className="size-4" />
                      {d.actionBusy
                        ? t("bookingDetail.checkingOut")
                        : t("bookingDetail.checkOutFinalInvoice")}
                    </Button>
                  ) : (
                    <p className="rounded-(--radius) border bg-secondary/40 p-3 text-sm text-muted-foreground">
                      <Icon
                        icon="ph:flag-checkered"
                        className="mr-1.5 inline size-4 align-text-bottom"
                      />
                      {t("bookingDetail.checkOutAvailableFrom", {
                        date: fmtDate(data.check_out),
                      })}
                    </p>
                  ))}
                {d.actionError && (
                  <p className="rounded-(--radius) border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {d.actionError}
                  </p>
                )}
              </div>
            )}

            {/* Ergebnis-Panel nach erfolgreichem Check-out */}
            {d.checkoutResult && (
              <div className="flex flex-col gap-2 rounded-(--radius) border border-success/40 bg-success/10 p-3 text-sm">
                <p className="font-semibold">
                  <Icon icon="ph:check-circle" className="mr-1 inline size-4" />
                  {d.checkoutResult.invoice_already_existed
                    ? t("bookingDetail.checkoutInvoiceReused", {
                      number: d.checkoutResult.invoice_number ?? "",
                    })
                    : t("bookingDetail.checkoutInvoiceCreated", {
                      number: d.checkoutResult.invoice_number ?? "",
                    })}
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={d.invoiceDocBusy}
                  onClick={() => void d.openInvoiceDialog(d.checkoutResult!.invoice_id)}
                >
                  <Icon
                    icon={d.invoiceDocBusy ? "ph:spinner" : "ph:paper-plane-tilt"}
                    className={"size-4 " + (d.invoiceDocBusy ? "animate-spin" : "")}
                  />
                  {t("bookingDetail.viewAndSendInvoice")}
                </Button>
              </div>
            )}
          </Card>

          {/* Zahlungen (..-Fortschrittsbalken) */}
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="font-display text-lg font-bold">
              {t("bookingDetail.payments")}
            </h2>
            {total == null ? (
              <p className="text-sm text-muted-foreground">
                {t("bookingDetail.noAmountAccess")}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span>
                    {t("bookingDetail.booking")}{" "}
                    <span className="font-semibold">
                      {money(total, data.currency)}
                    </span>
                    {paidPct != null && (
                      <span className="text-muted-foreground"> · {paidPct}%</span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {t("bookingDetail.stillDue", {
                      amount: money(data.due_amount, data.currency),
                    })}{" "}
                    ·{" "}
                    {t("bookingDetail.paidAmount", {
                      amount: money(paid, data.currency),
                    })}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-success transition-all"
                    style={{ width: `${paidPct ?? 0}%` }}
                  />
                </div>

                {/* Zahlungsweg des Portals (0240). Ohne diese Zeile fragt die
                    Rezeption beim Gast nach, obwohl das Portal längst kassiert
                    hat — oder sie kassiert nicht, obwohl sie müsste. */}
                {data.payment_collect ? (
                  <p className="flex flex-wrap items-center gap-2 rounded-(--radius) bg-secondary/60 p-3 text-sm">
                    <Icon
                      icon={
                        data.payment_collect === "ota"
                          ? "ph:check-circle"
                          : "ph:hand-coins"
                      }
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <span>
                      {t(`bookingDetail.paymentCollect.${data.payment_collect}`)}
                      {data.payment_method_ota
                        ? ` · ${t(`bookingDetail.paymentMethod.${data.payment_method_ota}`)}`
                        : ""}
                    </span>
                  </p>
                ) : null}

                {/* Portalprovision: der Unterschied zwischen Umsatz und Erlös. */}
                {data.ota_commission != null ? (
                  <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {t("bookingDetail.otaCommission")}
                    </span>
                    <span>
                      <span className="font-semibold">
                        −{money(data.ota_commission, data.currency)}
                      </span>
                      <span className="text-muted-foreground">
                        {" · "}
                        {t("bookingDetail.netPayout", {
                          amount: money(
                            total - data.ota_commission,
                            data.currency,
                          ),
                        })}
                      </span>
                    </span>
                  </p>
                ) : null}
              </>
            )}
          </Card>

          {/* Zusatzleistungen */}
          {!isCancelled && (
            <Card className="p-5">
              <ReservationAddonsSection
                reservationId={reservationId}
                currency={data.currency}
              />
            </Card>
          )}

          {/* Anmerkungen / Notiz */}
          <Card className="flex flex-col gap-2 p-5">
            <h2 className="font-display text-lg font-bold">
              {t("bookingDetail.notes")}
            </h2>
            {data.note ? (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {data.note}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("bookingDetail.noNotes")}
              </p>
            )}
          </Card>

          {/* Storno-Aktion / -Hinweis */}
          {isCancelled ? (
            <Card className="border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
              <p className="font-semibold">{t("bookingDetail.cancelled")}</p>
              {data.cancel_reason && (
                <p className="mt-0.5">
                  {t("bookingDetail.cancelReason", { reason: data.cancel_reason })}
                </p>
              )}
              {data.invoice && (
                <p className="mt-1.5">
                  {t("bookingDetail.cancelledInvoiceHint", {
                    number: data.invoice.invoice_number ?? data.invoice.id,
                  })}
                </p>
              )}
            </Card>
          ) : (
            <Card className="p-5">
              {!cancelOpen ? (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setCancelOpen(true)}
                >
                  <Icon icon="ph:x-circle" className="size-4" />
                  {t("bookingDetail.cancelReservation")}
                </Button>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-semibold text-destructive">
                    {t("bookingDetail.cancelReasonRequired")}
                  </p>
                  {isOta && (
                    <p className="rounded-(--radius) bg-amber-100 px-2.5 py-2 text-xs text-amber-800">
                      <Icon icon="ph:warning" className="mr-1 inline size-3.5" />
                      {t("bookingDetail.cancelOtaHint", {
                        otaName: data.ota_name ? ` (${data.ota_name})` : "",
                      })}
                    </p>
                  )}
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    autoFocus
                    placeholder={t("bookingDetail.cancelReasonPlaceholder")}
                    className="w-full rounded-(--radius) border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-destructive/40"
                  />
                  {d.actionError && (
                    <p className="text-xs text-destructive">{d.actionError}</p>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCancelOpen(false);
                        setReason("");
                      }}
                      disabled={d.cancelling}
                    >
                      {t("bookingDetail.cancel")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={submitCancel}
                      disabled={d.cancelling || !reason.trim()}
                    >
                      {d.cancelling
                        ? t("bookingDetail.cancelling")
                        : t("bookingDetail.confirmCancel")}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* ===== Rechte Spalte: Standort / Kostenaufteilung / Kunde / Aufgaben / Fotos ===== */}
        <div className="flex flex-col gap-5">
          {/* Objekt-Standort (Karte + Adresse), wie .. rechts oben. */}
          <PropertyLocation
            title={data.property_title || t("bookingDetail.propertyFallback")}
            street={data.property_street}
            postalCode={data.property_postal_code}
            city={data.property_city}
            country={data.property_country}
            lat={data.property_lat}
            lng={data.property_lng}
          />

          {/* Kostenaufteilungsdetails */}
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="font-display text-lg font-bold">
              {t("bookingDetail.costBreakdownDetails")}
            </h2>
            {data.quote_items.length === 0 && total == null ? (
              <p className="text-sm text-muted-foreground">
                {t("bookingDetail.noAmountAccess")}
              </p>
            ) : (
              <dl className="flex flex-col gap-1.5 text-sm">
                {data.quote_items.map((q, i) => (
                  <div key={i} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{q.label}</dt>
                    <dd>{money(q.amount, data.currency)}</dd>
                  </div>
                ))}
                <div className="mt-1 flex justify-between border-t pt-2 font-semibold">
                  <dt>{t("bookingDetail.finalPrice")}</dt>
                  <dd className="font-display font-extrabold">
                    {money(total, data.currency)}
                  </dd>
                </div>
                {data.invoice && (
                  <div className="mt-2 flex items-center justify-between gap-3 border-t pt-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">
                        {data.invoice.invoice_number ?? t("bookingDetail.invoice")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {data.invoice.status}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={d.invoiceDocBusy}
                      onClick={() => void d.openInvoiceDialog(data.invoice!.id)}
                    >
                      <Icon
                        icon={d.invoiceDocBusy ? "ph:spinner" : "ph:receipt"}
                        className={"size-4 " + (d.invoiceDocBusy ? "animate-spin" : "")}
                      />
                      {t("bookingDetail.view")}
                    </Button>
                  </div>
                )}
              </dl>
            )}
          </Card>

          {/* Kundendaten (maskiert) */}
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="font-display text-lg font-bold">
              {t("bookingDetail.guestData")}
            </h2>
            <dl className="flex flex-col gap-1.5 text-sm">
              <Row label={t("bookingDetail.name")} value={data.guest_name} />
              <Row label={t("bookingDetail.email")} value={data.guest_email} />
              <Row label={t("bookingDetail.phone")} value={data.guest_phone} />
              <Row label={t("bookingDetail.language")} value={data.guest_language} />
              <Row label={t("bookingDetail.country")} value={data.guest_country} />
            </dl>
            {data.guest_id && (
              <Link
                href={`/gaeste/${data.guest_id}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
              >
                <Icon icon="ph:identification-card" className="size-4" />
                {t("bookingDetail.openGuestCard")}
              </Link>
            )}
          </Card>

          {/* Aufgaben zu dieser Buchung (echt angebunden, live) */}
          <Card className="p-5">
            <BookingTasksSection
              reservationId={reservationId}
              propertyId={data.property_id}
              checkIn={data.check_in}
              checkOut={data.check_out}
            />
          </Card>

          {/* Fotos — echter Leerzustand */}
          <Card className="flex flex-col gap-2 p-5">
            <h2 className="font-display text-lg font-bold">
              {t("bookingDetail.photos")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("bookingDetail.noPhotosFound")}
            </p>
          </Card>
        </div>
      </div>

      {paymentOpen && (
        <CheckoutPaymentDialog
          busy={d.actionBusy}
          onClose={() => setPaymentOpen(false)}
          onConfirm={(payment) => {
            setPaymentOpen(false);
            void d.doCheckOut(payment);
          }}
        />
      )}

      {d.invoiceDoc && (
        <SendDocumentModal
          isOpen
          onClose={d.closeInvoiceDialog}
          document={d.invoiceDoc}
          documentType="invoice"
          companyId="me"
        />
      )}
    </div>
  );
}

function Breadcrumb({
  refLabel,
  t,
}: {
  refLabel: string;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Link href="/reservierungen" className="hover:text-foreground hover:underline">
        {t("bookingDetail.bookingsBreadcrumb")}
      </Link>
      <Icon icon="ph:caret-right" className="size-3.5" />
      <span className="text-foreground">
        {t("bookingDetail.bookingHeading", { ref: refLabel })}
      </span>
    </nav>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="truncate text-right">{value}</dd>
    </div>
  );
}
