"use client";

// Vollständige Reservierungs-Detailansicht als rechter Slider (Hostaway-Niveau).
// Lädt die Detaildaten beim Öffnen (GET /reservations/{id}). Beträge/Kontakt
// kommen bereits maskiert aus dem Backend (DSGVO-Daten-Split) — fehlende Felder
// werden weggelassen, nichts erfunden. Check-in/Check-out (0091) laufen hier:
// der Check-out erzeugt serverseitig verpflichtend die finale Rechnung (0092).
import { Icon } from "@iconify/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ReservationAddonsSection } from "@/components/kalender/reservation-addons-section";
import { Button } from "@/components/ui/button";
import { getInvoice } from "@/lib/buchhaltung";
import type { AvailabilitySource } from "@/lib/calendar";
import { channelMeta } from "@/lib/calendar-channels";
import { STATUS_META, displayStatus } from "@/lib/calendar-status";
import { formatCurrency } from "@/lib/currency";
import { type InvoiceDocument, invoiceToDocument } from "@/lib/invoice-document";
import {
  type CheckOutPayment,
  type CheckOutResult,
  type ReservationDetail,
  cancelReservation,
  checkInReservation,
  checkOutReservation,
  getReservationDetail,
} from "@/lib/reservations";
import { useRealtime } from "@/lib/use-realtime";

// Dokument-Dialog (PDF-Vorschau/Download/Druck) aus dem Buchhaltungs-Bestand —
// dynamisch geladen, damit das Kalender-Bundle schlank bleibt.
const SendDocumentModal = dynamic(
  () =>
    import("@/components/finance/SendDocumentModal").then(
      (m) => m.SendDocumentModal,
    ),
  { ssr: false },
);

export function ReservationDetailSlider({
  reservationId,
  todayKey,
  onClose,
  onCancelled,
  onChanged,
}: {
  reservationId: string;
  todayKey: string;
  onClose: () => void;
  onCancelled?: () => void;
  /** Optional: nach Check-in/Check-out (Board/Listen neu laden). */
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<ReservationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Storno-Dialog: Begründung ist Pflicht; wird dokumentiert/auditiert.
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  // Check-in/Check-out: Early-Check-in braucht eine Bestätigung; der Check-out
  // zeigt danach die erzeugte Rechnung (Ergebnis-Panel mit Versand-Link).
  const [earlyConfirm, setEarlyConfirm] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<CheckOutResult | null>(null);
  // Zahlart-Abfrage beim Check-out (Rezeption): bar / Kreditkarte (mit
  // Markenauswahl) / auf Rechnung. Erst die Auswahl löst den Check-out aus.
  const [paymentOpen, setPaymentOpen] = useState(false);
  // Dokument-Dialog direkt im Kalender: volle Rechnung laden (getInvoice) und
  // in die Dokumentform des SendDocumentModal mappen — kein Seitenwechsel.
  const [invoiceDoc, setInvoiceDoc] = useState<InvoiceDocument | null>(null);
  const [invoiceDocBusy, setInvoiceDocBusy] = useState(false);

  const openInvoiceDialog = useCallback(
    async (invoiceId: string) => {
      setInvoiceDocBusy(true);
      const res = await getInvoice(invoiceId);
      setInvoiceDocBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Empfängerdaten speichert das Backend nicht am Beleg — Gastname/-mail
      // aus dem Reservierungs-Detail mitgeben (maskiert je nach Rolle).
      setInvoiceDoc(
        invoiceToDocument(res.data, {
          customerName: data?.guest_name ?? "",
          customerEmail: data?.guest_email ?? "",
        }),
      );
    },
    [data?.guest_name, data?.guest_email],
  );
  const [payMethod, setPayMethod] = useState<CheckOutPayment["payment_method"]>("card");
  const [cardBrand, setCardBrand] = useState("Visa");

  const isCancelled = data?.status === "cancelled";
  // OTA-Buchung erkannt am echten Portal-Namen (channel "portal" sammelt 40+ OTAs).
  const isOta = !!data && data.channel !== "direct";

  const submitCancel = async () => {
    const r = reason.trim();
    if (!r) {
      setCancelError("Bitte eine Begründung angeben.");
      return;
    }
    setCancelling(true);
    setCancelError(null);
    const res = await cancelReservation(reservationId, r);
    setCancelling(false);
    if (res.ok) {
      toast.success("Reservierung storniert.");
      setCancelOpen(false);
      onCancelled?.();
    } else {
      setCancelError(res.error);
    }
  };

  const reload = useCallback(() => {
    getReservationDetail(reservationId).then((res) => {
      if (res.ok) setData(res.data);
      else setError(res.error);
    });
  }, [reservationId]);

  useEffect(() => {
    setData(null);
    setError(null);
    setEarlyConfirm(false);
    setActionError(null);
    setCheckoutResult(null);
    reload();
  }, [reload]);

  // Realtime (WebSocket, kein Polling): Detail + zugehörige Rechnung folgen
  // Änderungen sofort — auch wenn parallel jemand anderes ein-/auscheckt.
  useRealtime({
    table: "reservations",
    filter: `id=eq.${reservationId}`,
    onChange: reload,
  });
  useRealtime({
    table: "invoices",
    filter: `reservation_id=eq.${reservationId}`,
    onChange: reload,
  });

  const doCheckIn = async () => {
    setActionBusy(true);
    setActionError(null);
    const res = await checkInReservation(reservationId);
    setActionBusy(false);
    setEarlyConfirm(false);
    if (res.ok) {
      toast.success("Gast eingecheckt.");
      reload();
      onChanged?.();
    } else {
      setActionError(res.error);
    }
  };

  const doCheckOut = async (payment: CheckOutPayment) => {
    setActionBusy(true);
    setActionError(null);
    const res = await checkOutReservation(reservationId, payment);
    setActionBusy(false);
    setPaymentOpen(false);
    if (res.ok) {
      toast.success(
        res.data.invoice_already_existed
          ? "Gast ausgecheckt — bestehende Rechnung verwendet."
          : `Gast ausgecheckt — Rechnung ${res.data.invoice_number ?? ""} erstellt.`,
      );
      setCheckoutResult(res.data);
      reload();
      onChanged?.();
    } else {
      setActionError(res.error);
    }
  };

  // Esc schließt.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const money = (v: number | null | undefined, currency: string) =>
    v == null ? "—" : formatCurrency(v, currency);

  const status = data
    ? displayStatus(
        data.status,
        data.check_in,
        data.check_out,
        todayKey,
        data.checked_in_at,
        data.checked_out_at,
      )
    : null;
  const meta = data ? channelMeta(data.channel as AvailabilitySource) : null;

  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString("de-DE", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const fmtDate = (s: string) =>
    new Date(`${s}T00:00:00`).toLocaleDateString("de-DE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" role="presentation" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-[30rem] flex-col bg-card shadow-xl">
        {/* Kopf */}
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Reservierung
            </p>
            <h2 className="truncate font-display text-xl font-extrabold">
              {error
                ? "Fehler"
                : data
                  ? data.guest_name?.trim() || data.property_title || "Reservierung"
                  : "Lädt…"}
            </h2>
            {data && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.external_ref ? `#${data.external_ref}` : data.id.slice(0, 8)}
                {data.created_at
                  ? ` · ${fmtDate(data.created_at.slice(0, 10))}`
                  : ""}
                {data.ota_name ? ` · ${data.ota_name}` : ""}
              </p>
            )}
          </div>
          <Button variant="outline" size="icon" onClick={onClose} aria-label="Schließen">
            <Icon icon="ph:x" className="size-4" />
          </Button>
        </div>

        {error && (
          <div className="p-5 text-sm text-destructive">{error}</div>
        )}

        {data && (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="flex flex-col gap-5">
              {/* Status + Kanal */}
              <div className="flex flex-wrap items-center gap-2">
                {status && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                    <span className={`size-2 rounded-full ${STATUS_META[status].dotBg}`} />
                    {STATUS_META[status].label}
                  </span>
                )}
                {meta && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                    <Icon icon={meta.logo.kind === "icon" ? meta.logo.icon : "ph:globe"} className="size-3" />
                    {meta.label}
                  </span>
                )}
              </div>

              {/* Objekt + Belegung */}
              <div>
                <p className="font-display font-extrabold">
                  {data.property_title || "Objekt"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {data.num_guests} Gäste
                  {data.adults || data.children || data.infants || data.pets
                    ? ` (${[
                        data.adults && `${data.adults} Erw.`,
                        data.children && `${data.children} Ki.`,
                        data.infants && `${data.infants} Kleink.`,
                        data.pets && `${data.pets} Haustier`,
                      ]
                        .filter(Boolean)
                        .join(", ")})`
                    : ""}
                </p>
              </div>

              {/* Aufenthalts-Band (Layout-Referenz Casona: Ankunft/Abreise-
                  Chips + Nächte, Gesamtbetrag prominent rechts) */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius) border bg-secondary/40 p-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-(--radius) bg-card px-3 py-1.5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Anreise
                    </p>
                    <p className="text-sm font-bold">{fmtDate(data.check_in)}</p>
                  </div>
                  <Icon icon="ph:arrow-right" className="size-4 text-muted-foreground" />
                  <div className="rounded-(--radius) bg-card px-3 py-1.5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Abreise
                    </p>
                    <p className="text-sm font-bold">{fmtDate(data.check_out)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-xl font-extrabold">
                    {money(data.total_amount, data.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.nights} Nächte
                  </p>
                </div>
              </div>

              {/* Echter Check-in/Check-out-Zustand (0091) */}
              {(data.checked_in_at || data.checked_out_at) && (
                <p className="text-xs text-muted-foreground">
                  {data.checked_in_at &&
                    `Eingecheckt seit ${fmtDateTime(data.checked_in_at)}`}
                  {data.checked_out_at &&
                    ` · Ausgecheckt am ${fmtDateTime(data.checked_out_at)}`}
                </p>
              )}

              {/* Check-in / Check-out (Front-Desk-Aktionen). Der Check-out
                  erzeugt serverseitig verpflichtend die finale Rechnung —
                  schlägt sie fehl (z. B. Steuersatz fehlt), bleibt der Gast
                  eingecheckt und der Fehler steht hier im Klartext. */}
              {!isCancelled && !checkoutResult && (
                <>
                  {!data.checked_in_at && data.status === "confirmed" && (
                    <div className="flex flex-col gap-2">
                      {!earlyConfirm ? (
                        <Button
                          type="button"
                          className="w-full"
                          disabled={actionBusy}
                          onClick={() =>
                            todayKey < data.check_in
                              ? setEarlyConfirm(true)
                              : doCheckIn()
                          }
                        >
                          <Icon icon="ph:door-open" className="size-4" />
                          {actionBusy ? "Checke ein…" : "Gast einchecken"}
                        </Button>
                      ) : (
                        <div className="flex flex-col gap-2 rounded-(--radius) border border-warning/40 bg-warning/10 p-3 text-sm">
                          <p>
                            Anreise ist erst am {fmtDate(data.check_in)} — Gast
                            trotzdem jetzt einchecken (Early Check-in)?
                          </p>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setEarlyConfirm(false)}
                              disabled={actionBusy}
                            >
                              Abbrechen
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={doCheckIn}
                              disabled={actionBusy}
                            >
                              {actionBusy ? "Checke ein…" : "Ja, einchecken"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {data.checked_in_at &&
                    !data.checked_out_at &&
                    (todayKey >= data.check_out ? (
                      <Button
                        type="button"
                        className="w-full"
                        disabled={actionBusy}
                        onClick={() => setPaymentOpen(true)}
                      >
                        <Icon icon="ph:flag-checkered" className="size-4" />
                        {actionBusy
                          ? "Checke aus…"
                          : "Check-out + finale Rechnung"}
                      </Button>
                    ) : (
                      /* Check-out erst am Abreisetag — frühere Abreise läuft
                         über „Aufenthalt verkürzen" (Buchung anpassen). */
                      <p className="rounded-(--radius) border bg-secondary/40 p-3 text-sm text-muted-foreground">
                        <Icon
                          icon="ph:flag-checkered"
                          className="mr-1.5 inline size-4 align-text-bottom"
                        />
                        Check-out + finale Rechnung ab dem Abreisetag (
                        {fmtDate(data.check_out)}). Reist der Gast früher ab,
                        zuerst den Aufenthalt verkürzen.
                      </p>
                    ))}
                  {actionError && (
                    <p className="rounded-(--radius) border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                      {actionError}
                    </p>
                  )}
                </>
              )}

              {/* Zahlart-Abfrage (Rezeption) — erst die Auswahl löst den
                  Check-out + die finale Rechnung aus. Bar/Karte = sofort
                  bezahlt, „Auf Rechnung" = Überweisung mit Zahlungsziel. */}
              {paymentOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div
                    className="absolute inset-0 bg-black/40"
                    role="presentation"
                    onClick={() => !actionBusy && setPaymentOpen(false)}
                  />
                  <div className="relative z-10 flex w-full max-w-md flex-col rounded-2xl bg-card shadow-xl">
                    <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
                      <h2 className="font-display text-lg font-extrabold">
                        Wie bezahlt der Gast?
                      </h2>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setPaymentOpen(false)}
                        disabled={actionBusy}
                        aria-label="Schließen"
                      >
                        <Icon icon="ph:x" className="size-4" />
                      </Button>
                    </div>
                    <div className="flex flex-col gap-2 px-5 py-4">
                      {(
                        [
                          { value: "cash", label: "Bar", hint: "Barzahlung am Empfang", icon: "ph:money" },
                          { value: "card", label: "Kreditkarte", hint: "Kartenzahlung am Empfang", icon: "ph:credit-card" },
                          { value: "invoice", label: "Auf Rechnung", hint: "Überweisung mit Zahlungsziel", icon: "ph:receipt" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          aria-pressed={payMethod === opt.value}
                          onClick={() => setPayMethod(opt.value)}
                          className={
                            "flex items-center gap-3 rounded-(--radius) border p-3 text-left transition " +
                            (payMethod === opt.value
                              ? "border-accent bg-accent/5"
                              : "border-border hover:bg-secondary/50")
                          }
                        >
                          <span
                            className={
                              "flex size-9 shrink-0 items-center justify-center rounded-full " +
                              (payMethod === opt.value
                                ? "bg-accent/10 text-accent"
                                : "bg-secondary text-muted-foreground")
                            }
                          >
                            <Icon icon={opt.icon} className="size-4.5" />
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className="text-sm font-medium">{opt.label}</span>
                            <span className="text-xs text-muted-foreground">{opt.hint}</span>
                          </span>
                          {payMethod === opt.value && (
                            <Icon icon="ph:check-circle-fill" className="ml-auto size-5 shrink-0 text-accent" />
                          )}
                        </button>
                      ))}

                      {/* Kartenmarke — alle gängigen zur Auswahl */}
                      {payMethod === "card" && (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {[
                            "Visa",
                            "Mastercard",
                            "American Express",
                            "Maestro",
                            "girocard",
                            "Diners Club",
                            "Discover",
                            "JCB",
                            "UnionPay",
                          ].map((brand) => (
                            <button
                              key={brand}
                              type="button"
                              aria-pressed={cardBrand === brand}
                              onClick={() => setCardBrand(brand)}
                              className={
                                "rounded-full px-3 py-1.5 text-xs font-medium transition " +
                                (cardBrand === brand
                                  ? "bg-accent text-white"
                                  : "bg-secondary text-secondary-foreground hover:bg-secondary/70")
                              }
                            >
                              {brand}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPaymentOpen(false)}
                        disabled={actionBusy}
                      >
                        Abbrechen
                      </Button>
                      <Button
                        type="button"
                        disabled={actionBusy}
                        onClick={() =>
                          void doCheckOut({
                            payment_method: payMethod,
                            card_brand:
                              payMethod === "card" ? cardBrand : undefined,
                          })
                        }
                      >
                        <Icon
                          icon={actionBusy ? "ph:spinner" : "ph:flag-checkered"}
                          className={"size-4 " + (actionBusy ? "animate-spin" : "")}
                        />
                        {actionBusy ? "Checke aus…" : "Check-out abschließen"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Ergebnis-Panel nach erfolgreichem Check-out */}
              {checkoutResult && (
                <div className="flex flex-col gap-2 rounded-(--radius) border border-success/40 bg-success/10 p-3 text-sm">
                  <p className="font-semibold">
                    <Icon icon="ph:check-circle" className="mr-1 inline size-4" />
                    {checkoutResult.invoice_already_existed
                      ? `Check-out abgeschlossen — Rechnung ${checkoutResult.invoice_number ?? ""} verwendet.`
                      : `Finale Rechnung ${checkoutResult.invoice_number ?? ""} erstellt.`}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    disabled={invoiceDocBusy}
                    onClick={() => void openInvoiceDialog(checkoutResult.invoice_id)}
                  >
                    <Icon
                      icon={invoiceDocBusy ? "ph:spinner" : "ph:paper-plane-tilt"}
                      className={"size-4 " + (invoiceDocBusy ? "animate-spin" : "")}
                    />
                    Rechnung ansehen &amp; versenden
                  </Button>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/buchhaltung?invoice=${encodeURIComponent(checkoutResult.invoice_id)}`,
                      )
                    }
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    In der Buchhaltung öffnen
                  </button>
                </div>
              )}

              {/* Umsatz & Rechnung (Layout-Referenz Casona: Aufschlüsselung,
                  Gesamt, in Rechnung gestellt/bezahlt/noch offen, Aktionen).
                  Vorab-Rechnung erst NACH Check-in (fachliche Regel). */}
              <Section title="Umsatz & Rechnung">
                <dl className="flex flex-col gap-1.5 text-sm">
                  {data.quote_items.map((q, i) => (
                    <div key={i} className="flex justify-between">
                      <dt className="text-muted-foreground">{q.label}</dt>
                      <dd>{money(q.amount, data.currency)}</dd>
                    </div>
                  ))}
                  <div className="mt-1 flex justify-between border-t pt-2 font-semibold">
                    <dt>Gesamt</dt>
                    <dd className="font-display font-extrabold">
                      {money(data.total_amount, data.currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <dt className="text-muted-foreground">In Rechnung gestellt</dt>
                    <dd>
                      {data.invoice && data.invoice.gross_amount != null
                        ? formatCurrency(
                            data.invoice.gross_amount,
                            data.invoice.currency || data.currency,
                          )
                        : money(0, data.currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Bezahlt</dt>
                    <dd>{money(data.paid_amount, data.currency)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Noch offen</dt>
                    <dd
                      className={
                        (data.due_amount ?? 0) > 0
                          ? "rounded-full bg-warning/20 px-2 py-0.5 font-semibold"
                          : "font-semibold"
                      }
                    >
                      {money(data.due_amount, data.currency)}
                    </dd>
                  </div>
                </dl>

                {!isCancelled && (
                  <div className="mt-3 border-t pt-3">
                    {data.invoice ? (
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {data.invoice.invoice_number ?? "Rechnung"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {data.invoice.status}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={invoiceDocBusy}
                          onClick={() => void openInvoiceDialog(data.invoice!.id)}
                        >
                          <Icon
                            icon={invoiceDocBusy ? "ph:spinner" : "ph:receipt"}
                            className={
                              "size-4 " + (invoiceDocBusy ? "animate-spin" : "")
                            }
                          />
                          Ansehen &amp; versenden
                        </Button>
                      </div>
                    ) : data.checked_in_at ? (
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/buchhaltung/rechnungen/neu?reservation=${encodeURIComponent(reservationId)}`,
                          )
                        }
                        className="flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                      >
                        <Icon icon="ph:receipt" className="size-4" />
                        Rechnung erstellen (vorab)
                      </button>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Noch keine Rechnung — möglich ab Check-in. Beim Check-out
                        wird sie automatisch erstellt.
                      </p>
                    )}
                  </div>
                )}
              </Section>

              {/* Zusatzleistungen — Schnelltaste: Extra-Angebote zu dieser
                  Buchung dazubuchen (jeder Kanal, auch OTA wie Booking). */}
              {!isCancelled && (
                <ReservationAddonsSection
                  reservationId={reservationId}
                  currency={data.currency}
                />
              )}

              {/* Kontakt */}
              {(data.guest_email || data.guest_phone || data.guest_language || data.guest_country) && (
                <Section title="Gast">
                  <dl className="flex flex-col gap-1.5 text-sm">
                    <Row label="Name" value={data.guest_name} />
                    <Row label="E-Mail" value={data.guest_email} />
                    <Row label="Telefon" value={data.guest_phone} />
                    <Row label="Sprache" value={data.guest_language} />
                    <Row label="Land" value={data.guest_country} />
                  </dl>
                </Section>
              )}

              {/* Policy-Zeiten */}
              {(data.checkin_time || data.checkout_time) && (
                <Section title="An-/Abreise">
                  <dl className="flex flex-col gap-1.5 text-sm">
                    <Row label="Check-in" value={data.checkin_time} />
                    <Row label="Check-out" value={data.checkout_time} />
                  </dl>
                </Section>
              )}

              {/* Externe Quote/URL */}
              {data.external_url && (
                <a
                  href={data.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                >
                  <Icon icon="ph:arrow-square-out" className="size-4" />
                  Im Portal öffnen
                </a>
              )}

              {/* Notiz */}
              {data.note && (
                <Section title="Notiz">
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{data.note}</p>
                </Section>
              )}

              {/* Storno-Hinweis bei bereits stornierter Buchung */}
              {isCancelled && (
                <div className="rounded-(--radius) border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <p className="font-semibold">Storniert</p>
                  {data.cancel_reason && (
                    <p className="mt-0.5 text-destructive/90">
                      Grund: {data.cancel_reason}
                    </p>
                  )}
                  {data.invoice && (
                    <p className="mt-1.5 text-destructive/90">
                      Zur stornierten Buchung existiert Rechnung{" "}
                      {data.invoice.invoice_number ?? data.invoice.id} — ggf.
                      Stornorechnung in der Buchhaltung erstellen.
                    </p>
                  )}
                </div>
              )}

              {/* Storno-Aktion (nur wenn noch nicht storniert) */}
              {!isCancelled && (
                <div className="border-t pt-4">
                  {!cancelOpen ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full text-destructive hover:bg-destructive/10"
                      onClick={() => setCancelOpen(true)}
                    >
                      <Icon icon="ph:x-circle" className="size-4" />
                      Reservierung stornieren
                    </Button>
                  ) : (
                    <div className="flex flex-col gap-3 rounded-(--radius) border border-destructive/30 p-3">
                      <p className="text-sm font-semibold text-destructive">
                        Stornierung – Begründung erforderlich
                      </p>
                      {isOta && (
                        <p className="rounded-(--radius) bg-amber-100 px-2.5 py-2 text-xs text-amber-800">
                          <Icon icon="ph:warning" className="mr-1 inline size-3.5" />
                          Dies storniert die Buchung nur lokal. Bitte storniere sie
                          zusätzlich direkt im Portal
                          {data.ota_name ? ` (${data.ota_name})` : ""}.
                        </p>
                      )}
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        autoFocus
                        placeholder="Grund der Stornierung (wird dokumentiert) …"
                        className="w-full rounded-(--radius) border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-destructive/40"
                      />
                      {cancelError && (
                        <p className="text-xs text-destructive">{cancelError}</p>
                      )}
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCancelOpen(false);
                            setReason("");
                            setCancelError(null);
                          }}
                          disabled={cancelling}
                        >
                          Abbrechen
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={submitCancel}
                          disabled={cancelling || !reason.trim()}
                        >
                          {cancelling ? "Storniere…" : "Stornieren"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dokument-Dialog (PDF-Vorschau/Download/Druck) direkt im Kalender.
          companyId ist Bestands-Kompatibilität — das Backend löst den Tenant
          aus der Session auf, der Pfad-Parameter wird ignoriert. */}
      {invoiceDoc && (
        <SendDocumentModal
          isOpen
          onClose={() => setInvoiceDoc(null)}
          document={invoiceDoc}
          documentType="invoice"
          companyId="me"
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-(--radius) border p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
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
