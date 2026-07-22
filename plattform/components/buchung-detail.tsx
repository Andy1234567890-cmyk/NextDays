// Buchungsdetail (Client-Insel): Aufschlüsselung, Zahlstatus + offener Betrag,
// Timeline-Tab, Storno mit Bestätigungsdialog, Links zu Aufenthalt/Nachrichten/
// Bewertung. Lädt Detail + Timeline über die Gast-Endpunkte.
"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  ChannelBadge,
  PaymentBadge,
  StatusBadge,
} from "@/components/status-badge";
import {
  type BookingDetail,
  type TimelineItem,
  ladeBuchung,
  ladeTimeline,
  storniereBuchung,
} from "@/lib/guest-bookings";
import { formatDate, formatDateTime, formatRange, formatTime } from "@/lib/format";
import { formatCurrency } from "@/lib/listings";

type Phase =
  | { kind: "loading" }
  | { kind: "error"; msg: string }
  | { kind: "ready"; b: BookingDetail };

// Timeline-Ereignis-Icons je kind (unbekannt → generisch).
const TIMELINE_ICON: Record<string, string> = {
  booking: "ph:calendar-plus",
  created: "ph:calendar-plus",
  payment: "ph:credit-card",
  message: "ph:chat-circle",
  task: "ph:check-square",
  addon: "ph:plus-circle",
  move: "ph:arrows-left-right",
  reprice: "ph:tag",
  check_in: "ph:sign-in",
  check_out: "ph:sign-out",
  cancel: "ph:x-circle",
  cancelled: "ph:x-circle",
};

// Deutsche Klartext-Labels je kind. Das backend-seitige `detail` ist ein OBJEKT
// (dict) und darf NIE direkt als React-Child gerendert werden (Laufzeit-Crash) —
// wir zeigen das lesbare Label; unbekannte kinds fallen auf den kind-Text zurück.
const TIMELINE_LABEL: Record<string, string> = {
  booking: "Buchung angelegt",
  created: "Buchung angelegt",
  payment: "Zahlung",
  message: "Nachricht",
  task: "Aufgabe",
  addon: "Zusatzleistung",
  move: "Zeitraum geändert",
  reprice: "Preis angepasst",
  check_in: "Eingecheckt",
  check_out: "Ausgecheckt",
  cancel: "Storniert",
  cancelled: "Storniert",
};

export function BuchungDetailAnsicht({ id }: { id: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [tab, setTab] = useState<"details" | "verlauf">("details");
  const [timeline, setTimeline] = useState<TimelineItem[] | null>(null);
  const [timelineBusy, setTimelineBusy] = useState(false);

  // Storno-Dialog
  const [stornoOffen, setStornoOffen] = useState(false);
  const [grund, setGrund] = useState("");
  const [stornoBusy, setStornoBusy] = useState(false);
  const [stornoFehler, setStornoFehler] = useState<string | null>(null);

  useEffect(() => {
    let aktiv = true;
    (async () => {
      const res = await ladeBuchung(id);
      if (!aktiv) return;
      setPhase(
        res.ok ? { kind: "ready", b: res.data } : { kind: "error", msg: res.error },
      );
    })();
    return () => {
      aktiv = false;
    };
  }, [id]);

  async function ladeVerlauf() {
    setTab("verlauf");
    if (timeline !== null) return;
    setTimelineBusy(true);
    const res = await ladeTimeline(id);
    setTimelineBusy(false);
    if (res.ok) setTimeline(res.data.items);
  }

  async function stornieren() {
    setStornoBusy(true);
    setStornoFehler(null);
    const res = await storniereBuchung(id, grund.trim());
    setStornoBusy(false);
    if (res.ok) {
      setStornoOffen(false);
      // Detail neu laden (Status jetzt storniert).
      const neu = await ladeBuchung(id);
      if (neu.ok) setPhase({ kind: "ready", b: neu.data });
      router.refresh();
    } else {
      setStornoFehler(res.error);
    }
  }

  if (phase.kind === "loading") {
    return (
      <div className="flex items-center gap-2 py-16 text-muted-foreground">
        <Icon icon="ph:spinner" className="size-5 animate-spin" />
        Buchung wird geladen…
      </div>
    );
  }
  if (phase.kind === "error") {
    return (
      <div className="rounded-2xl border border-accent/40 bg-accent/10 p-6 text-sm text-accent">
        {phase.msg}
      </div>
    );
  }

  const b = phase.b;
  const waehrung = b.currency ?? b.property.currency;
  const abgeschlossen =
    b.status === "completed" || b.status === "checked_out";

  return (
    <div className="flex flex-col gap-6">
      {/* Kopf: Objekt + Foto + Status */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="h-56 w-full bg-secondary">
          {b.property.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={b.property.photo}
              alt={b.property.title}
              className="size-full object-cover"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-muted-foreground">
              <Icon icon="ph:image" className="size-10" />
            </span>
          )}
        </div>
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={b.status} />
            <PaymentBadge status={b.payment_status} />
            <ChannelBadge channel={b.channel} />
          </div>
          <h2 className="mt-3 font-display text-xl font-semibold">
            {b.property.title}
          </h2>
          {b.property.address && (
            <p className="text-sm text-muted-foreground">
              {b.property.address}
            </p>
          )}
        </div>
      </div>

      {/* Aktions-Links */}
      <div className="flex flex-wrap gap-3">
        <Aktion
          href={`/aufenthalt/${b.id}`}
          icon="ph:house"
          label="Aufenthalt & Check-in"
        />
        <Aktion
          href={`/nachrichten?reservation=${b.id}`}
          icon="ph:chat-circle"
          label="Gastgeber kontaktieren"
        />
        {abgeschlossen && (
          <Aktion
            href={`/bewertungen?reservation=${b.id}`}
            icon="ph:star"
            label="Bewerten"
          />
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-full bg-secondary p-1">
        <button
          type="button"
          onClick={() => setTab("details")}
          className={
            "flex-1 rounded-full py-2 text-sm font-medium transition-colors " +
            (tab === "details"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          Details
        </button>
        <button
          type="button"
          onClick={ladeVerlauf}
          className={
            "flex-1 rounded-full py-2 text-sm font-medium transition-colors " +
            (tab === "verlauf"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          Verlauf
        </button>
      </div>

      {tab === "details" ? (
        <>
          {/* Eckdaten */}
          <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
            <Info label="Zeitraum" wert={formatRange(b.check_in, b.check_out)} />
            <Info
              label="Gäste"
              wert={
                b.adults != null
                  ? `${b.adults} Erw.${b.children ? `, ${b.children} Kinder` : ""}`
                  : `${b.num_guests} Gäste`
              }
            />
            {b.checkin_time && (
              <Info label="Check-in ab" wert={formatTime(b.checkin_time)} />
            )}
            {b.checkout_time && (
              <Info label="Check-out bis" wert={formatTime(b.checkout_time)} />
            )}
            {b.checked_in_at && (
              <Info
                label="Eingecheckt am"
                wert={formatDateTime(b.checked_in_at)}
              />
            )}
            {b.cancelled_at && (
              <Info
                label="Storniert am"
                wert={formatDateTime(b.cancelled_at)}
              />
            )}
          </div>

          {b.note && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-medium">Hinweis</p>
              <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                {b.note}
              </p>
            </div>
          )}

          {/* Preisaufschlüsselung */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-medium">Aufschlüsselung</p>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              {b.quote_items.length > 0 ? (
                b.quote_items.map((q, i) => (
                  <div
                    key={`${q.label}-${i}`}
                    className="flex items-center justify-between"
                  >
                    <span className="text-muted-foreground">
                      {q.label}
                      {q.quantity && q.quantity > 1 ? ` × ${q.quantity}` : ""}
                    </span>
                    <span>
                      {q.amount != null
                        ? formatCurrency(q.amount, waehrung)
                        : "—"}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">
                  Keine Einzelposten hinterlegt.
                </p>
              )}

              <div className="mt-2 flex items-center justify-between border-t border-border pt-3 font-semibold">
                <span>Gesamt</span>
                <span>
                  {b.total_amount != null
                    ? formatCurrency(b.total_amount, waehrung)
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Bereits bezahlt</span>
                <span>
                  {b.paid_amount != null
                    ? formatCurrency(b.paid_amount, waehrung)
                    : "—"}
                </span>
              </div>
              {b.balance_due != null && b.balance_due > 0 && (
                <div className="flex items-center justify-between font-semibold text-accent">
                  <span>Offener Betrag</span>
                  <span>{formatCurrency(b.balance_due, waehrung)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Storno */}
          {b.can_cancel && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="font-medium">Buchung stornieren</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Prüfe die Stornobedingungen deines Gastgebers, bevor du
                stornierst.
              </p>
              <button
                type="button"
                onClick={() => setStornoOffen(true)}
                className="mt-4 rounded-full border border-accent px-5 py-2.5 text-sm font-medium text-accent hover:bg-accent/10"
              >
                Stornieren
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5">
          {timelineBusy ? (
            <div className="flex items-center gap-2 py-6 text-muted-foreground">
              <Icon icon="ph:spinner" className="size-5 animate-spin" />
              Verlauf wird geladen…
            </div>
          ) : timeline && timeline.length > 0 ? (
            <ol className="flex flex-col gap-5">
              {timeline.map((t, i) => (
                <li key={`${t.kind}-${t.created_at}-${i}`} className="flex gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
                    <Icon
                      icon={TIMELINE_ICON[t.kind] ?? "ph:dot-outline"}
                      className="size-4"
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm">{TIMELINE_LABEL[t.kind] ?? t.kind}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(t.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Noch keine Ereignisse.
            </p>
          )}
        </div>
      )}

      {/* Storno-Dialog */}
      {stornoOffen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h3 className="font-display text-lg font-semibold">
              Buchung stornieren?
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {b.property.title} · {formatDate(b.check_in)}
            </p>
            <label className="mt-4 flex flex-col gap-1.5">
              <span className="text-sm font-medium">Grund (optional)</span>
              <textarea
                value={grund}
                onChange={(e) => setGrund(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                placeholder="z. B. geänderte Reisepläne"
              />
            </label>
            {stornoFehler && (
              <p className="mt-3 rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent">
                {stornoFehler}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setStornoOffen(false)}
                disabled={stornoBusy}
                className="rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-secondary"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={stornieren}
                disabled={stornoBusy}
                className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60"
              >
                {stornoBusy && (
                  <Icon icon="ph:spinner" className="size-4 animate-spin" />
                )}
                Jetzt stornieren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Aktion({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium hover:shadow-sm"
    >
      <Icon icon={icon} className="size-4" />
      {label}
    </Link>
  );
}

function Info({ label, wert }: { label: string; wert: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium">{wert}</p>
    </div>
  );
}
