"use client";

// Objekt-Warnungen (.. „Warnungen"): aus den Buchungen dieses Objekts
// abgeleitete Hinweise. KEIN erfundener Wert — nur Warnungen, die sich aus den
// vorhandenen Feldern belegen lassen:
//   • Fehlende Zahlung: paid_amount < total_amount (nur mit Betrags-Sichtbarkeit)
//   • Bereits abgereist: Check-out-Tag vorbei, aber nicht ausgecheckt/abgeschlossen
// Filter-Umschalter wie im Screenshot. Live über useRealtime auf reservations.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { dateKey } from "@/lib/calendar-views";
import { formatCurrency } from "@/lib/currency";
import { type Reservation, listReservations } from "@/lib/reservations";
import { useRealtime } from "@/lib/use-realtime";

type WarningKind = "missing_payment" | "already_departed";

type Warning = {
  reservation: Reservation;
  kind: WarningKind;
  label: string;
  detail: string;
};

export function PropertyWarnings({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  // Filter-Umschalter (an = Warnungen dieser Art anzeigen).
  const [showMissingPayment, setShowMissingPayment] = useState(true);
  const [showDeparted, setShowDeparted] = useState(true);

  const load = useCallback(async () => {
    const res = await listReservations(propertyId);
    if (res.ok) setReservations(res.data.items);
    setLoading(false);
  }, [propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime({
    table: "reservations",
    filter: `property_id=eq.${propertyId}`,
    onChange: load,
  });

  const todayKey = dateKey(new Date());

  const warnings = useMemo(() => {
    const out: Warning[] = [];
    for (const r of reservations) {
      if (r.status === "cancelled") continue;

      // Fehlende Zahlung — nur wenn Beträge sichtbar sind (paid/total != null).
      if (
        r.total_amount != null &&
        r.paid_amount != null &&
        r.paid_amount < r.total_amount
      ) {
        const open = r.total_amount - r.paid_amount;
        out.push({
          reservation: r,
          kind: "missing_payment",
          label: "Fehlende Zahlung",
          detail: `${formatCurrency(open, r.currency)} offen`,
        });
      }

      // Bereits abgereist, aber nicht ausgecheckt/abgeschlossen.
      if (
        r.check_out < todayKey &&
        r.status !== "completed" &&
        !r.checked_out_at
      ) {
        out.push({
          reservation: r,
          kind: "already_departed",
          label: "Bereits abgereist",
          detail: `Abreise war am ${new Date(`${r.check_out}T00:00:00`).toLocaleDateString("de-DE")}`,
        });
      }
    }
    return out;
  }, [reservations, todayKey]);

  const filtered = warnings.filter(
    (w) =>
      (w.kind === "missing_payment" && showMissingPayment) ||
      (w.kind === "already_departed" && showDeparted),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">Warnungen</h1>
        <div className="flex flex-wrap items-center gap-4">
          <Toggle
            label="Fehlende Zahlung"
            on={showMissingPayment}
            onToggle={() => setShowMissingPayment((v) => !v)}
          />
          <Toggle
            label="Bereits abgereist"
            on={showDeparted}
            onToggle={() => setShowDeparted((v) => !v)}
          />
        </div>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Lädt…</Card>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
            <Icon icon="ph:check-circle" className="size-6" />
          </span>
          <p className="max-w-md text-sm text-muted-foreground">
            Gute Arbeit! Für diese Unterkunft und den aktuellen Filter wurden keine
            Warnungen gefunden.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((w, i) => (
            <button
              key={`${w.reservation.id}-${w.kind}-${i}`}
              type="button"
              onClick={() => router.push(`/reservierungen/${w.reservation.id}`)}
              className="flex items-center gap-3 rounded-(--radius) border bg-card px-4 py-3 text-left transition-colors hover:bg-secondary/40"
            >
              <span
                className={
                  "flex size-9 shrink-0 items-center justify-center rounded-full " +
                  (w.kind === "missing_payment"
                    ? "bg-warning/15 text-warning"
                    : "bg-destructive/15 text-destructive")
                }
              >
                <Icon
                  icon={w.kind === "missing_payment" ? "ph:currency-circle-dollar" : "ph:sign-out"}
                  className="size-5"
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{w.label}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {w.reservation.guest_name || "Gast"} · {w.detail}
                </p>
              </div>
              <Icon icon="ph:caret-right" className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className={
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors " +
          (on ? "bg-accent" : "bg-secondary")
        }
      >
        <span
          className={
            "inline-block size-5 rounded-full bg-white shadow transition-transform " +
            (on ? "translate-x-5" : "translate-x-0.5")
          }
        />
      </button>
    </label>
  );
}
