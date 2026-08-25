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
import { NachberechnungAbschnitt } from "@/components/reservierungen/nachberechnung-abschnitt";
import { BookingConditionsCard } from "@/components/reservierungen/booking-conditions-card";
import { BookingDetailTabs } from "@/components/reservierungen/booking-detail-tabs";
import { BookingGuestSheet } from "@/components/reservierungen/booking-guest-sheet";
import { BookingNoteSheet } from "@/components/reservierungen/booking-note-sheet";
import { BookingOtaTermsCard } from "@/components/reservierungen/booking-ota-terms-card";
import { BookingPeriodDialog } from "@/components/reservierungen/booking-period-dialog";
import { BookingTasksSection } from "@/components/reservierungen/booking-tasks-section";
import { CheckoutPaymentDialog } from "@/components/reservierungen/checkout-payment-dialog";
import { PropertyLocation } from "@/components/reservierungen/property-location";
import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
import type { AvailabilitySource } from "@/lib/calendar";
import { useCalendarLabels } from "@/lib/use-calendar-labels";
import { channelMeta } from "@/lib/calendar-channels";
import {
  OWNER_STAY_BAR,
  OWNER_STAY_ICON,
  STATUS_META,
  displayStatus,
} from "@/lib/calendar-status";
import { formatCurrency } from "@/lib/currency";
import { channelLabelLoose } from "@/lib/channel-logos";
import { dateKey } from "@/lib/calendar-views";
import { setReservationArchived } from "@/lib/reservations";
import { useReservationDetail } from "@/lib/use-reservation-detail";

const SendDocumentModal = dynamic(
  () =>
    import("@/components/finance/SendDocumentModal").then(
      (m) => m.SendDocumentModal,
    ),
  { ssr: false },
);

// Die FREMDEN Portale. `portal` (unser Marktplatz myBestDays) und `website`
// (eigene Buchungsstrecke) gehören NICHT dazu — dort verkaufen und kassieren
// wir selbst. Spiegelt `PaymentsService._OTA_CHANNELS` im Backend; wer hier
// einen Kanal ergänzt, ergänzt ihn dort auch.
const OTA_KANAELE = ["booking", "airbnb", "vrbo", "ota_other"];

export function BookingDetail({ reservationId }: { reservationId: string }) {
  const t = useTranslations("reservations");
  const { channelLabel, statusLabel } = useCalendarLabels();
  const locale = useLocale();
  const d = useReservationDetail(reservationId);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [earlyConfirm, setEarlyConfirm] = useState(false);
  const [guestSheet, setGuestSheet] = useState(false);
  const [noteSheet, setNoteSheet] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);

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
  // OTA heißt: ein FREMDES Portal hat verkauft und kassiert womöglich selbst.
  // Vorher stand hier `channel !== "direct"` — damit galten auch `website`
  // (eigene Buchungsstrecke) und `portal` (unser Marktplatz) als OTA, und eine
  // Website-Buchung bekam im Zahlungsblock „Das Portal hat zur Zahlung nichts
  // gemeldet" zu lesen. Es gibt dort kein Portal, das etwas melden könnte: das
  // ist eine Falschaussage über Geld (Wurzel 4). Dieselbe Liste wie
  // `istPortalBuchung` unten und wie `PaymentsService._OTA_CHANNELS`.
  const isOta = OTA_KANAELE.includes(data.channel);
  // Eigentümer-Aufenthalt (0241): belegt den Kalender, ist aber kein Umsatz —
  // Zahlungen, Rechnung und Zusatzleistungen entfallen, weil es sie nicht gibt.
  const isOwnerStay = data.is_owner_stay;
  const refLabel = data.external_ref ?? data.id.slice(0, 8);
  // Zeitraum änderbar? Dieselben Grenzen, die `move()` serverseitig zieht —
  // hier NUR als Sichtbarkeit, nicht als zweite Wahrheit: was durchkommt,
  // entscheidet weiter das Backend (Doppelbuchung, Stop-Sell, Einheit).
  // Eine Portal-Buchung (Booking/Airbnb & Co.) wird beim PORTAL geändert: der
  // lokale Move hebt sie dort nicht auf und die Nächte würden doppelt verkauft.
  // `channel='portal'` (myBestDays) gehört NICHT dazu — der Marktplatz ist
  // unser eigener Kanal ohne Fremd-Bestand.
  const istPortalBuchung = OTA_KANAELE.includes(data.channel);
  const zeitraumAenderbar =
    !isCancelled &&
    !istPortalBuchung &&
    !data.checked_in_at &&
    !data.checked_out_at;

  // Zahlungs-Fortschritt (..-Balken). Nur mit sichtbaren Beträgen; sonst
  // kein Balken (kein 0-Fallback, kein erfundener Prozentsatz).
  const total = data.total_amount;
  const paid = data.paid_amount;
  const paidPct =
    total != null && paid != null && total > 0
      ? Math.min(100, Math.round((paid / total) * 100))
      : null;
  // Gibt es überhaupt eine Preisinformation? Ein Betrag von 0 ist bei
  // importierten Buchungen (Fremdkalender, Alt-Import) das Zeichen, dass die
  // Quelle keinen Preis mitgeliefert hat — er ist keine Gratis-Buchung. Drei
  // Kacheln mit „0,00" behaupten genau das (Wurzel 4), deshalb hängt die
  // Geld-Darstellung an dieser einen Frage.
  const hatPreis = total != null && total > 0;
  // Wissen wir, wer einzieht? Bei Direktbuchungen sind wir es (dort gibt es
  // keinen Portal-Zahlweg), bei OTA-Buchungen sagt es `payment_collect`. Fehlt
  // es dort, ist jede Aussage über „offen" geraten.
  const zahlwegBekannt = !isOta || data.payment_collect != null;

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
          {/* Überschrift ist der GAST (..-Struktur): an einer Buchung
              arbeitet man mit einer Person, die Referenz ist Beiwerk. Bei einer
              Eigennutzung gibt es keinen Gast — dort trägt der Aufenthaltsname
              (oder das Objekt) die Zeile. */}
          <h1 className="truncate font-display text-2xl font-extrabold">
            {data.guest_name ||
              data.property_title ||
              t("bookingDetail.bookingHeading", { ref: refLabel })}
          </h1>
          {/* Herkunftszeile: Referenz, Buchungszeitpunkt und Kanal. Der
              Zeitpunkt kommt aus der QUELLE (`booked_at`); fehlt er, wird
              ausdrücklich unser Eingang benannt — unsere Uhr ist nie der
              Zeitpunkt einer fremden Handlung (Wurzel 5b). */}
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            #{refLabel}
            {data.booked_at
              ? ` · ${t("bookingDetail.bookedOn", {
                  date: fmtDateTime(data.booked_at),
                })}`
              : data.created_at
                ? ` · ${t("bookingDetail.receivedOn", {
                    date: fmtDateTime(data.created_at),
                  })}`
                : ""}
            {!isOwnerStay
              ? ` · ${t("bookingDetail.viaChannel", {
                  channel: data.ota_name
                    ? channelLabelLoose(data.ota_name)
                    : channelLabel(data.channel as AvailabilitySource),
                })}`
              : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
              <span className={`size-2 rounded-full ${STATUS_META[status].dotBg}`} />
              {statusLabel(status)}
            </span>
            {/* Ablage sichtbar machen: sonst wundert man sich, warum diese
                Buchung in der Liste fehlt (0383). */}
            {data.archived_at && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <Icon icon="ph:archive" className="size-3" />
                {t("bookingDetail.archivedBadge")}
              </span>
            )}
            {/* Eigentümer-Aufenthalt statt Kanal — er kommt von keinem
                Vertriebsweg, ein „Direkt"-Abzeichen wäre irreführend. */}
            {isOwnerStay ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${OWNER_STAY_BAR}`}
              >
                <Icon icon={OWNER_STAY_ICON} className="size-3" />
                {t("bookingDetail.ownerStay")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                <Icon
                  icon={meta.logo.kind === "icon" ? meta.logo.icon : "ph:globe"}
                  className="size-3"
                />
                {data.ota_name ? channelLabelLoose(data.ota_name) : channelLabel(data.channel as AvailabilitySource)}
              </span>
            )}
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
          {/* Nachrichten dieser Buchung (..: Knopf „Nachrichten" oben
              rechts). Führt in den Posteingang-Thread — dort liegt die
              Korrespondenz samt Vorlagen, Übersetzung und Versand; eine zweite
              Chat-Oberfläche hier wäre dieselbe Sache doppelt gepflegt.
              Ohne Thread gibt es keinen Knopf (kein Link auf eine leere
              Ansicht). */}
          {data.message_thread_id && (
            <Link
              href={`/posteingang?thread=${encodeURIComponent(data.message_thread_id)}`}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary/60"
            >
              <Icon icon="ph:chat-circle-text" className="size-4" />
              {t("bookingDetail.messages")}
            </Link>
          )}
          <BookingDetailTabs reservationId={reservationId} />
          {/* Aktionsmenü (..: „…" oben rechts): Drucken + Ablage.
              „Archivieren" nimmt die Buchung aus der Arbeitsliste, ohne den
              Vorgang anzutasten — Nächte gibt nur der Storno frei (0383). */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("bookingDetail.moreActions")}
              >
                <Icon icon="ph:dots-three" className="size-4.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.print()}>
                <Icon icon="ph:printer" className="size-4" />
                {t("bookingDetail.print")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  const res = await setReservationArchived(
                    reservationId,
                    !data.archived_at,
                  );
                  console.debug("[BookingDetail] Ablage geschaltet", {
                    reservationId,
                    archiviert: !data.archived_at,
                    ok: res.ok,
                  });
                  if (res.ok) d.reload();
                }}
              >
                <Icon icon="ph:archive" className="size-4" />
                {data.archived_at
                  ? t("bookingDetail.unarchive")
                  : t("bookingDetail.archive")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
              {zeitraumAenderbar && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPeriodOpen(true)}
                >
                  <Icon icon="ph:calendar-plus" className="size-4" />
                  {t("bookingPeriod.change")}
                </Button>
              )}
              <div className="text-right">
                {/* Preis nur zeigen, wenn es einen gibt. Ein Betrag von 0 heisst
                    bei importierten Direkt-/Fremdkalender-Buchungen „die Quelle
                    hat keinen Preis geliefert" — „0,00" dreifach hinzuschreiben
                    behauptet eine Gratis-Buchung (Wurzel 4). */}
                {!isOwnerStay && hatPreis && (
                  <p className="font-display text-2xl font-extrabold">
                    {money(data.total_amount, data.currency)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t("bookingDetail.nightsCount", { count: data.nights })}
                </p>
              </div>
            </div>

            {/* Zahlungsstand auf einen Blick (..-Kachel-Trio):
                Bezahlt | Offen | Gesamt. Nur mit sichtbaren Beträgen — ohne
                Finanzeinblick (§4.3) gäbe es hier drei Striche, das ist kein
                Informationsgewinn, sondern Rauschen. */}
            {!isOwnerStay && total != null && !hatPreis && (
              <p className="rounded-(--radius) border bg-secondary/40 p-3 text-sm text-muted-foreground">
                <Icon
                  icon="ph:tag"
                  className="mr-1.5 inline size-4 align-text-bottom"
                />
                {t("bookingDetail.noPriceInfo")}
              </p>
            )}

            {/* Kachel-Trio. Auf schmalen Geräten UNTEREINANDER: drei Spalten
                ließen bei 322px rund 100px je Kachel — „NICHT GEMELDET" und
                „3.477,60 DKK" überlappten und wurden rechts abgeschnitten
                (live gesehen). Ab `sm` ist genug Platz für die Dreier-Reihe;
                `divide-y`/`sm:divide-x` zieht die Trennlinie in die jeweils
                richtige Richtung. */}
            {!isOwnerStay && total != null && hatPreis && (
              <div className="grid grid-cols-1 divide-y overflow-hidden rounded-(--radius) border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <Kachel
                  label={t("bookingDetail.paidTile")}
                  value={money(paid, data.currency)}
                />
                {/* „Offen" nur behaupten, wenn wir den Zahlweg kennen. Bei
                    Booking-Alt-Importen liefert das Portal keine Zahlart
                    (payment_collect null) — dann ist der offene Betrag nicht
                    „unbezahlt", sondern ungemeldet. Live geprüft: 51 von 52
                    solchen Buchungen tragen in Channex nur „Imported Booking".
                */}
                <Kachel
                  label={
                    zahlwegBekannt
                      ? t("bookingDetail.dueTile")
                      : t("bookingDetail.unreportedTile")
                  }
                  value={
                    zahlwegBekannt ? money(data.due_amount, data.currency) : "—"
                  }
                  betont={
                    zahlwegBekannt &&
                    data.due_amount != null &&
                    data.due_amount > 0
                  }
                />
                <Kachel
                  label={t("bookingDetail.totalTile")}
                  value={money(total, data.currency)}
                />
              </div>
            )}

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

            {/* Check-in / Check-out (Front-Desk-Aktionen). Beim Eigentümer-
                Aufenthalt entfällt beides: der Check-out erzwingt eine finale
                Rechnung, und die gibt es hier nicht. */}
            {!isCancelled && !d.checkoutResult && !isOwnerStay && (
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

            {/* Erklärung: warum hier keine Beträge/Rechnung stehen. */}
            {isOwnerStay && (
              <p className="rounded-(--radius) border bg-secondary/40 p-3 text-sm text-muted-foreground">
                {t("bookingDetail.ownerStayHint")}
              </p>
            )}
          </Card>


          {/* Rechnungsstellung als eigene Karte (..-Struktur). Sie stand
              vorher als Fußzeile in der Kostenaufteilung — dort sucht sie
              niemand, obwohl es der Beleg ist, den der Gast anfordert. */}
          {!isOwnerStay && (
            <Card className="flex flex-col gap-3 p-5">
              <h2 className="font-display text-lg font-bold">
                {t("bookingDetail.invoicing")}
              </h2>
              {data.invoice ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {data.invoice.invoice_number ?? t("bookingDetail.invoice")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {/* Status kommt so aus der Buchhaltung (finalized/paid/…)
                          — kein eigener Übersetzungsschlüssel, sonst gäbe es
                          zwei Wahrheiten über denselben Zustand. */}
                      {data.invoice.status}
                      {data.invoice.gross_amount != null
                        ? ` · ${money(
                            data.invoice.gross_amount,
                            data.invoice.currency || data.currency,
                          )}`
                        : ""}
                    </p>
                  </div>
                  {/* Aktionsmenü wie in .. („…" an der Rechnungszeile).
                      Nur echte Wege: Vorschau/Versand über den bestehenden
                      Dokumenten-Dialog. „Erneuern" hat bei uns keine
                      Entsprechung — eine GoBD-Nummer wird nicht neu gezogen. */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={d.invoiceDocBusy}
                      >
                        <Icon
                          icon={d.invoiceDocBusy ? "ph:spinner" : "ph:receipt"}
                          className={
                            "size-4 " + (d.invoiceDocBusy ? "animate-spin" : "")
                          }
                        />
                        {t("bookingDetail.invoiceActions")}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => void d.openInvoiceDialog(data.invoice!.id)}
                      >
                        <Icon icon="ph:eye" className="size-4" />
                        {t("bookingDetail.viewInvoice")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => void d.openInvoiceDialog(data.invoice!.id)}
                      >
                        <Icon icon="ph:paper-plane-tilt" className="size-4" />
                        {t("bookingDetail.sendInvoice")}
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/buchhaltung/rechnungen">
                          <Icon icon="ph:arrow-square-out" className="size-4" />
                          {t("bookingDetail.openInAccounting")}
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("bookingDetail.noInvoiceYet")}
                </p>
              )}
            </Card>
          )}

          {/* Konditionen DES PORTALS zuerst: sie sind die Zusage an den Gast
              (0384). Unsere eigene Kondition darunter gilt für Direktbuchungen. */}
          {!isOwnerStay && <BookingOtaTermsCard data={data} />}

          {/* EINE Geldkarte (25.08.2026). Vorher standen hier vier Karten mit
              denselben Beträgen: „Zahlungen" (Fortschritt),
              „Zahlungsanforderung" (Plan + Transaktionen), „Zusatzleistungen"
              und „Nachberechnung". Dieselben 150,00 DKK erschienen dreimal auf
              der Seite; beim Storno fiel es auf.

              Zusammengelegt über die Slots von BookingConditionsCard und nicht
              durch Verschieben: Plan und Transaktionen kommen aus DEM EINEN
              Abruf dieser Komponente. Ein zweites Rendern hätte den Abruf
              verdoppelt und könnte kurzzeitig zwei verschiedene Beträge zeigen.

              Die Karte „Buchungskonditionen" (Richtlinien) rendert dieselbe
              Komponente weiter getrennt darüber — Vertragstext, kein Geld. */}
          {!isOwnerStay && (
            <BookingConditionsCard
              reservationId={reservationId}
              currency={data.currency}
              reloadKey={`${data.status}-${data.paid_amount ?? ""}-${
                data.checked_out_at ?? ""
              }`}
              geldKopf={
                /* Zahlungsfortschritt — bis 25.08.2026 eine eigene Karte
                   „Zahlungen" direkt über dieser. Zwei Karten mit derselben
                   Summe untereinander sind keine zwei Auskünfte. */
                <div className="flex flex-col gap-3">
                {total == null ? (
                  <p className="text-sm text-muted-foreground">
                    {t("bookingDetail.noAmountAccess")}
                  </p>
                ) : !hatPreis ? (
                  // Ohne Preis gibt es keinen Zahlungsstand: ein Balken bei 0 von 0
                  // sähe aus wie „nichts bezahlt", obwohl nichts zu bezahlen ist.
                  <p className="text-sm text-muted-foreground">
                    {t("bookingDetail.noPriceInfo")}
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <span>
                        {t("bookingDetail.booking")}{" "}
                        <span className="font-semibold">
                          {money(total, data.currency)}
                        </span>
                        {zahlwegBekannt && paidPct != null && (
                          <span className="text-muted-foreground"> · {paidPct}%</span>
                        )}
                      </span>
                      <span className="text-muted-foreground">
                        {/* Ohne gemeldeten Zahlweg keine „noch offen"-Aussage:
                            das Portal hat zur Zahlung nichts geliefert. */}
                        {zahlwegBekannt
                          ? `${t("bookingDetail.stillDue", {
                              amount: money(data.due_amount, data.currency),
                            })} · ${t("bookingDetail.paidAmount", {
                              amount: money(paid, data.currency),
                            })}`
                          : t("bookingDetail.paymentUnreported")}
                      </span>
                    </div>
                    {zahlwegBekannt && (
                      <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-success transition-all"
                          style={{ width: `${paidPct ?? 0}%` }}
                        />
                      </div>
                    )}

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

                    {/* Portalprovision + vom Portal einbehaltene Steuern: der
                        Unterschied zwischen Umsatz und Erlös. Die Auszahlung ist
                        Brutto − Provision − einbehaltene Steuern — ohne die
                        Steuern wäre sie zu hoch (Booking behält z. B. City Tax
                        direkt ein). */}
                    {data.ota_commission != null ||
                    data.ota_withheld_taxes != null ? (
                      <div className="space-y-1 text-sm">
                        {data.ota_commission != null ? (
                          <p className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-muted-foreground">
                              {t("bookingDetail.otaCommission")}
                            </span>
                            <span className="font-semibold">
                              −{money(data.ota_commission, data.currency)}
                            </span>
                          </p>
                        ) : null}
                        {data.ota_withheld_taxes != null ? (
                          <p className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-muted-foreground">
                              {t("bookingDetail.withheldTaxes")}
                            </span>
                            <span className="font-semibold">
                              −{money(data.ota_withheld_taxes, data.currency)}
                            </span>
                          </p>
                        ) : null}
                        {/* Auszahlung nur mit gemeldeter Provision — ohne sie wäre
                            jeder Betrag erfunden (Provision null heißt „nicht
                            geliefert", nicht 0). */}
                        {data.ota_commission != null ? (
                          <p className="flex flex-wrap items-baseline justify-end gap-2 text-muted-foreground">
                            {t("bookingDetail.netPayout", {
                              amount: money(
                                total -
                                  data.ota_commission -
                                  (data.ota_withheld_taxes ?? 0),
                                data.currency,
                              ),
                            })}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
                </div>
              }
              geldFuss={
                /* Positionen mit Aktionen — unter dem Journal, weil sie
                   erklären, WOFÜR die Zeilen darüber stehen. Kein eigener
                   `!isOwnerStay`-Wächter mehr: die ganze Karte hängt schon
                   daran, ein zweiter wäre eine Bedingung, die nie greift und
                   die beim nächsten Umbau falsch mitgezogen wird. Beide
                   Abschnitte rahmenlos — sie sitzen in dieser Karte. */
                <div className="flex flex-col gap-4 border-t pt-3">
                {/* Nachberechnung (0469): der Aufenthalt wurde nachträglich
                    teurer, der Gast zahlt die Differenz per Zahlungslink. Auch
                    bei Storno sichtbar (0473): Das Backend antwortet dann
                    `moeglich: false`, liefert aber die bereits BEZAHLTEN
                    Nachberechnungen mit — und die müssen erstattbar bleiben.
                    Ohne offenen Link und ohne bezahlte Position rendert die
                    Komponente null. */}
                <NachberechnungAbschnitt
                  reservationId={reservationId}
                  rahmenlos
                  onChanged={d.reload}
                />
                {/* Zusatzleistungen. Bei Storno wird nichts mehr verkauft (die
                    Komponente blendet Katalog und Zahlungslink selbst aus), aber
                    schon bezahltes Geld bleibt erstattbar. Vorher hing hier ein
                    `!isCancelled`, und genau dadurch war der Erstatten-Knopf bei
                    der stornierten Buchung 6179a5d0 nicht erreichbar — bei der
                    einzigen Buchung, die ihn brauchte. */}
                <ReservationAddonsSection
                  reservationId={reservationId}
                  currency={data.currency}
                  storniert={isCancelled}
                  onChanged={d.reload}
                />
                </div>
              }
            />
          )}

          {/* Anmerkungen / Notiz — bearbeitbar wie in .. */}
          <Card className="flex flex-col gap-2 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold">
                {t("bookingDetail.notes")}
              </h2>
              <button
                type="button"
                onClick={() => setNoteSheet(true)}
                aria-label={t("bookingDetail.editNote")}
                title={t("bookingDetail.editNote")}
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
              >
                <Icon
                  icon={data.note ? "ph:pencil-simple" : "ph:plus"}
                  className="size-4.5"
                />
              </button>
            </div>
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
                        otaName: data.ota_name ? ` (${channelLabelLoose(data.ota_name)})` : "",
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

          {/* Kostenaufteilungsdetails — beim Eigentümer-Aufenthalt gibt es
              keine Positionen und keine Rechnung. */}
          {!isOwnerStay && (
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
              </dl>
            )}
          </Card>
          )}

          {/* Kundendaten (maskiert) — Stift öffnet die Bearbeiten-Schublade
              wie in ... Bei einer Eigennutzung gibt es keinen Gast: dort
              führt der Stift ins Leere, deshalb erscheint er nicht. */}
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold">
                {t("bookingDetail.guestData")}
              </h2>
              {!isOwnerStay && !isCancelled && (
                <button
                  type="button"
                  onClick={() => setGuestSheet(true)}
                  aria-label={t("bookingDetail.editGuest")}
                  title={t("bookingDetail.editGuest")}
                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                >
                  <Icon icon="ph:pencil-simple" className="size-4.5" />
                </button>
              )}
            </div>
            <dl className="flex flex-col gap-1.5 text-sm">
              <Row label={t("bookingDetail.name")} value={data.guest_name} />
              {/* Kontakt direkt anwählbar (..): Mail, Telefon, WhatsApp.
                  Ohne Kontakt-Sichtbarkeit kommt hier null aus dem Backend und
                  die Zeile entfällt — kein leerer Link ins Nichts. */}
              <Row
                label={t("bookingDetail.email")}
                value={data.guest_email}
                href={data.guest_email ? `mailto:${data.guest_email}` : null}
              />
              <Row
                label={t("bookingDetail.phone")}
                value={data.guest_phone}
                href={data.guest_phone ? `tel:${data.guest_phone}` : null}
                zusatz={
                  data.guest_phone ? (
                    <a
                      href={`https://wa.me/${data.guest_phone.replace(/[^\d]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t("bookingDetail.whatsapp")}
                      title={t("bookingDetail.whatsapp")}
                      className="text-success hover:opacity-80"
                    >
                      <Icon icon="ph:whatsapp-logo" className="size-4" />
                    </a>
                  ) : null
                }
              />
              <Row label={t("bookingDetail.language")} value={data.guest_language} />
              <Row label={t("bookingDetail.country")} value={data.guest_country} />
              {/* Erwartete Zeiten (..: „Voraussichtliche Check-in-Zeit").
                  Sie stehen an der Buchung und sind über die Schublade
                  korrigierbar — kein Check-in-Zustand (0091). */}
              <Row
                label={t("bookingDetail.expectedCheckin")}
                value={data.checkin_time}
              />
              <Row
                label={t("bookingDetail.expectedCheckout")}
                value={data.checkout_time}
              />
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
            <BookingTasksSection reservationId={reservationId} />
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

      {/* Gast bearbeiten / Notiz bearbeiten (..-Schubladen von rechts).
          Nach dem Speichern lädt der Hook die Buchung neu — die Realtime-
          Änderung an `reservations` kommt zwar auch an, aber der eigene
          Speichervorgang soll ohne Verzögerung sichtbar sein. */}
      {guestSheet && (
        <BookingGuestSheet
          open
          reservationId={reservationId}
          values={{
            guest_name: data.guest_name,
            guest_email: data.guest_email,
            guest_phone: data.guest_phone,
            guest_language: data.guest_language,
            guest_country: data.guest_country,
            checkin_time: data.checkin_time,
            checkout_time: data.checkout_time,
          }}
          onClose={() => setGuestSheet(false)}
          onSaved={d.reload}
        />
      )}

      {periodOpen && (
        <BookingPeriodDialog
          reservationId={data.id}
          propertyId={data.property_id}
          checkIn={data.check_in}
          checkOut={data.check_out}
          onClose={() => setPeriodOpen(false)}
          onChanged={d.reload}
        />
      )}

      {noteSheet && (
        <BookingNoteSheet
          open
          reservationId={reservationId}
          note={data.note}
          onClose={() => setNoteSheet(false)}
          onSaved={d.reload}
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

function Kachel({
  label,
  value,
  betont = false,
}: {
  label: string;
  value: string;
  betont?: boolean;
}) {
  // `min-w-0` ist Pflicht: eine Grid-Spalte ist per Default `min-width:auto`
  // und wächst über ihre Spur hinaus, statt den Text umbrechen zu lassen —
  // genau so schob sich der Betrag über die Nachbarkachel. Der Betrag bleibt
  // deshalb zusätzlich als EINE Einheit stehen (`whitespace-nowrap`) und
  // schrumpft in der Schriftgröße, statt mitten in der Zahl zu brechen.
  return (
    <div className="min-w-0 bg-secondary/40 px-3 py-2 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={
          "font-display text-base font-extrabold tabular-nums whitespace-nowrap sm:text-lg " +
          (betont ? "text-warning" : "")
        }
      >
        {value}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  href = null,
  zusatz = null,
}: {
  label: string;
  value: string | null | undefined;
  /** Macht den Wert anwählbar (mailto:/tel:). null = reiner Text. */
  href?: string | null;
  /** Zusatz-Aktion rechts (z. B. WhatsApp neben der Nummer). */
  zusatz?: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 text-right">
        {href ? (
          <a href={href} className="truncate text-accent hover:underline">
            {value}
          </a>
        ) : (
          <span className="truncate">{value}</span>
        )}
        {zusatz}
      </dd>
    </div>
  );
}
