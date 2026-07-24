"use client";

// Rechte Spalte des Posteingangs (Airbnb „Reservation"): Objekt-Foto, Titel +
// Ort, Reservierungs-/Zahldetails (Nächte, Gäste, Status, Betrag, Zahlstatus,
// Stornogrund). Lädt beim Öffnen; fehlende Felder rendern „—" (kein Fake).
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { formatCurrency } from "@nextdays/currency";

import type { HostReservationDetail } from "@/lib/posteingang";
import { getReservationDetail } from "@/lib/posteingang";

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Bestätigt",
  pending: "Ausstehend",
  cancelled: "Storniert",
  completed: "Abgeschlossen",
};

export function ReservierungsPanel({
  threadId,
  onClose,
}: {
  threadId: string;
  onClose: () => void;
}) {
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
          Details
        </h2>
        <button
          type="button"
          aria-label="Schließen"
          onClick={onClose}
          className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
        >
          <Icon icon="ph:x" className="size-4" />
        </button>
      </div>

      {laedt ? (
        <p className="px-6 py-8 text-sm text-muted-foreground">Wird geladen …</p>
      ) : !detail ? (
        <p className="px-6 py-8 text-sm text-muted-foreground">
          Keine Reservierungsdaten.
        </p>
      ) : (
        <div className="px-6 py-6">
          {/* Foto */}
          {detail.property_photos.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={detail.property_photos[0]}
              alt={detail.property_title ?? "Objekt"}
              className="mb-4 h-52 w-full rounded-2xl object-cover"
            />
          ) : (
            <div className="mb-4 flex h-52 w-full items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Icon icon="ph:image" className="size-8" />
            </div>
          )}

          <h3 className="font-display text-xl font-semibold">
            {detail.property_title ?? "—"}
          </h3>
          {(detail.city || detail.country) && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[detail.city, detail.country].filter(Boolean).join(", ")}
            </p>
          )}

          <div className="mt-6 border-t border-border pt-6">
            <h4 className="mb-3 text-lg font-semibold">Reservierungsdetails</h4>
            <dl className="space-y-3 text-sm">
              <Zeile label="Anreise" wert={datum(detail.check_in)} />
              <Zeile label="Abreise" wert={datum(detail.check_out)} />
              <Zeile
                label="Nächte"
                wert={detail.nights != null ? String(detail.nights) : "—"}
              />
              <Zeile
                label="Gäste"
                wert={detail.num_guests != null ? String(detail.num_guests) : "—"}
              />
              <Zeile
                label="Status"
                wert={
                  detail.status
                    ? (STATUS_LABEL[detail.status] ?? detail.status)
                    : "—"
                }
              />
            </dl>
          </div>

          <div className="mt-6 border-t border-border pt-6">
            <h4 className="mb-3 text-lg font-semibold">Zahlung</h4>
            <dl className="space-y-3 text-sm">
              <Zeile
                label="Gesamtbetrag"
                wert={betrag(detail.total_amount, detail.currency)}
              />
              <Zeile
                label="Bezahlt"
                wert={betrag(detail.paid_amount, detail.currency)}
              />
              <Zeile
                label="Zahlstatus"
                wert={detail.payment_status ?? "—"}
              />
            </dl>
          </div>

          {detail.cancel_reason && (
            <div className="mt-6 border-t border-border pt-6">
              <h4 className="mb-1 text-lg font-semibold">Stornierung</h4>
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

function datum(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Betrag mit echter Objektwährung (kein €-Hardcode, Wurzel 4). Fehlt der Betrag,
// „—"; fehlt die Währung, rendert formatCurrency symbollos.
function betrag(amount: number | null, currency: string | null): string {
  if (amount == null) return "—";
  return formatCurrency(amount, currency);
}
