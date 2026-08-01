"use client";

// Vollständige Reservierungs-Detailansicht als rechter Slider (Hostaway-Niveau).
// Lädt die Detaildaten beim Öffnen (GET /reservations/{id}). Beträge/Kontakt
// kommen bereits maskiert aus dem Backend (DSGVO-Daten-Split) — fehlende Felder
// werden weggelassen, nichts erfunden. Check-in/Check-out (0091) laufen hier:
// der Check-out erzeugt serverseitig verpflichtend die finale Rechnung (0092).
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ReservationAddonsSection } from "@/components/kalender/reservation-addons-section";
import { CheckoutPaymentDialog } from "@/components/reservierungen/checkout-payment-dialog";
import { Button } from "@nextdays/ui/button";
import type { AvailabilitySource } from "@/lib/calendar";
import { channelMeta } from "@/lib/calendar-channels";
import { STATUS_META, displayStatus } from "@/lib/calendar-status";
import { formatCurrency } from "@/lib/currency";
import type { CheckOutPayment } from "@/lib/reservations";
import { useReservationDetail } from "@/lib/use-reservation-detail";

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
  // Geteilte Detail-Logik (Laden, Realtime, Check-in/out, Storno, Rechnungs-
  // Dialog) — dieselbe Basis wie die PM-Detail-Vollseite, kein Doppelcode.
  // onChanged läuft nach jeder Aktion, onCancelled zusätzlich nur nach Storno
  // (Aufrufer schließen darüber den Slider — bei Check-in/out bleibt er offen).
  const d = useReservationDetail(reservationId, { onChanged, onCancelled });
  const { data, error } = d;
  // Nur-lokaler UI-Zustand des Sliders (Panels auf/zu, Storno-Eingabe).
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [earlyConfirm, setEarlyConfirm] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const isCancelled = data?.status === "cancelled";
  // OTA-Buchung erkannt am echten Portal-Namen (channel "portal" sammelt 40+ OTAs).
  const isOta = !!data && data.channel !== "direct";

  const submitCancel = async () => {
    const ok = await d.submitCancel(reason);
    if (ok) {
      setCancelOpen(false);
      setReason("");
    }
  };

  const doCheckIn = async () => {
    setEarlyConfirm(false);
    await d.doCheckIn();
  };

  const doCheckOut = async (payment: CheckOutPayment) => {
    setPaymentOpen(false);
    await d.doCheckOut(payment);
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

  const t = useTranslations("calendar");
  const locale = useLocale();
  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const fmtDate = (s: string) =>
    new Date(`${s}T00:00:00`).toLocaleDateString(locale, {
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
          <Button variant="outline" size="icon" onClick={onClose} aria-label={t("slider.close")}>
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
              {!isCancelled && !d.checkoutResult && (
                <>
                  {!data.checked_in_at && data.status === "confirmed" && (
                    <div className="flex flex-col gap-2">
                      {!earlyConfirm ? (
                        <Button
                          type="button"
                          className="w-full"
                          disabled={d.actionBusy}
                          onClick={() =>
                            todayKey < data.check_in
                              ? setEarlyConfirm(true)
                              : doCheckIn()
                          }
                        >
                          <Icon icon="ph:door-open" className="size-4" />
                          {d.actionBusy ? "Checke ein…" : "Gast einchecken"}
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
                              disabled={d.actionBusy}
                            >
                              Abbrechen
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={doCheckIn}
                              disabled={d.actionBusy}
                            >
                              {d.actionBusy ? "Checke ein…" : "Ja, einchecken"}
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
                        disabled={d.actionBusy}
                        onClick={() => setPaymentOpen(true)}
                      >
                        <Icon icon="ph:flag-checkered" className="size-4" />
                        {d.actionBusy
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
                  {d.actionError && (
                    <p className="rounded-(--radius) border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                      {d.actionError}
                    </p>
                  )}
                </>
              )}

              {/* Ergebnis-Panel nach erfolgreichem Check-out */}
              {d.checkoutResult && (
                <div className="flex flex-col gap-2 rounded-(--radius) border border-success/40 bg-success/10 p-3 text-sm">
                  <p className="font-semibold">
                    <Icon icon="ph:check-circle" className="mr-1 inline size-4" />
                    {d.checkoutResult.invoice_already_existed
                      ? `Check-out abgeschlossen — Rechnung ${d.checkoutResult.invoice_number ?? ""} verwendet.`
                      : `Finale Rechnung ${d.checkoutResult.invoice_number ?? ""} erstellt.`}
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
                    Rechnung ansehen &amp; versenden
                  </Button>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/buchhaltung?invoice=${encodeURIComponent(d.checkoutResult!.invoice_id)}`,
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
              <Section title={t("slider.revenueInvoice")}>
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
                    <dt className="text-muted-foreground">{t("slider.invoiced")}</dt>
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
                    <dt className="text-muted-foreground">{t("slider.stillOpen")}</dt>
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
                          disabled={d.invoiceDocBusy}
                          onClick={() => void d.openInvoiceDialog(data.invoice!.id)}
                        >
                          <Icon
                            icon={d.invoiceDocBusy ? "ph:spinner" : "ph:receipt"}
                            className={
                              "size-4 " + (d.invoiceDocBusy ? "animate-spin" : "")
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
                        placeholder={t("slider.cancelReasonPlaceholder")}
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
                          Abbrechen
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={submitCancel}
                          disabled={d.cancelling || !reason.trim()}
                        >
                          {d.cancelling ? "Storniere…" : "Stornieren"}
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

      {/* Zahlart-Abfrage beim Check-out (geteilt mit der PM-Detail-Vollseite). */}
      {paymentOpen && (
        <CheckoutPaymentDialog
          busy={d.actionBusy}
          onClose={() => setPaymentOpen(false)}
          onConfirm={(payment) => void doCheckOut(payment)}
        />
      )}

      {/* Dokument-Dialog (PDF-Vorschau/Download/Druck) direkt im Kalender.
          companyId ist Bestands-Kompatibilität — das Backend löst den Tenant
          aus der Session auf, der Pfad-Parameter wird ignoriert. */}
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
