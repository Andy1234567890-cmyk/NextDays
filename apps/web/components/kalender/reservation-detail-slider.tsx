"use client";

// Vollständige Reservierungs-Detailansicht als rechter Slider (Hostaway-Niveau).
// Lädt die Detaildaten beim Öffnen (GET /reservations/{id}). Beträge/Kontakt
// kommen bereits maskiert aus dem Backend (DSGVO-Daten-Split) — fehlende Felder
// werden weggelassen, nichts erfunden.
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { AvailabilitySource } from "@/lib/calendar";
import { channelMeta } from "@/lib/calendar-channels";
import { STATUS_META, displayStatus } from "@/lib/calendar-status";
import {
  type ReservationDetail,
  getReservationDetail,
} from "@/lib/reservations";

export function ReservationDetailSlider({
  reservationId,
  todayKey,
  onClose,
}: {
  reservationId: string;
  todayKey: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ReservationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    getReservationDetail(reservationId).then((res) => {
      if (cancelled) return;
      if (res.ok) setData(res.data);
      else setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [reservationId]);

  // Esc schließt.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const money = (v: number | null | undefined, currency: string) =>
    v == null
      ? "—"
      : v.toLocaleString("de-DE", {
          style: "currency",
          currency: currency || "EUR",
        });

  const status = data
    ? displayStatus(data.status, data.check_in, data.check_out, todayKey)
    : null;
  const meta = data ? channelMeta(data.channel as AvailabilitySource) : null;

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
              {data?.guest_name?.trim() || (error ? "Fehler" : "Lädt…")}
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

              {/* Zeitraum */}
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{fmtDate(data.check_in)}</span>
                <Icon icon="ph:arrow-right" className="size-4 text-muted-foreground" />
                <span className="font-medium">{fmtDate(data.check_out)}</span>
                <span className="text-muted-foreground">· {data.nights} Nächte</span>
              </div>

              {/* Beträge-Karten (Paid / Due / Total) */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Bezahlt" value={money(data.paid_amount, data.currency)} />
                <Stat label="Offen" value={money(data.due_amount, data.currency)} />
                <Stat label="Gesamt" value={money(data.total_amount, data.currency)} />
              </div>

              {/* Quote-Aufschlüsselung */}
              {data.quote_items.length > 0 && (
                <Section title="Aufschlüsselung">
                  <dl className="flex flex-col gap-1.5 text-sm">
                    {data.quote_items.map((q, i) => (
                      <div key={i} className="flex justify-between">
                        <dt className="text-muted-foreground">{q.label}</dt>
                        <dd>{money(q.amount, data.currency)}</dd>
                      </div>
                    ))}
                    <div className="mt-1 flex justify-between border-t pt-1.5 font-semibold">
                      <dt>Gesamt</dt>
                      <dd>{money(data.total_amount, data.currency)}</dd>
                    </div>
                  </dl>
                </Section>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-(--radius) border bg-secondary/40 px-2 py-2.5">
      <p className="font-display text-sm font-extrabold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
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
