// Buchungsliste mit Tabs (upcoming/past/cancelled). Client-Insel: lädt pro Tab
// die Buchungen des Gastes und rendert Karten. Der initiale Tab (upcoming) wird
// serverseitig vorgeladen und als Prop übergeben (schneller First Paint).
"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { useState } from "react";

import { ChannelBadge, PaymentBadge, StatusBadge } from "@/components/status-badge";
import {
  type BookingListItem,
  type BookingStatusFilter,
  ladeBuchungen,
} from "@/lib/guest-bookings";
import { formatRange } from "@/lib/format";
import { formatCurrency } from "@/lib/listings";

const TABS: { key: BookingStatusFilter; label: string }[] = [
  { key: "upcoming", label: "Anstehend" },
  { key: "past", label: "Vergangen" },
  { key: "cancelled", label: "Storniert" },
];

export function BuchungenListe({
  initialItems,
}: {
  initialItems: BookingListItem[];
}) {
  const [tab, setTab] = useState<BookingStatusFilter>("upcoming");
  // Cache je Tab (upcoming ist vorgeladen).
  const [cache, setCache] = useState<
    Partial<Record<BookingStatusFilter, BookingListItem[]>>
  >({ upcoming: initialItems });
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function wechsle(next: BookingStatusFilter) {
    setTab(next);
    setFehler(null);
    if (cache[next]) return;
    setBusy(true);
    const res = await ladeBuchungen(next);
    setBusy(false);
    if (res.ok) {
      setCache((c) => ({ ...c, [next]: res.data.items }));
    } else {
      setFehler(res.error);
    }
  }

  const items = cache[tab] ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 rounded-full bg-secondary p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => wechsle(t.key)}
            className={
              "flex-1 rounded-full py-2 text-sm font-medium transition-colors " +
              (tab === t.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {fehler && (
        <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent">
          {fehler}
        </p>
      )}

      {busy ? (
        <div className="flex items-center gap-2 py-10 text-muted-foreground">
          <Icon icon="ph:spinner" className="size-5 animate-spin" />
          Lädt…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
            <Icon icon="ph:suitcase-rolling" className="size-7" />
          </span>
          <p className="text-sm text-muted-foreground">
            Keine Buchungen in dieser Kategorie.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((b) => (
            <BuchungKarte key={b.id} b={b} />
          ))}
        </div>
      )}
    </div>
  );
}

function BuchungKarte({ b }: { b: BookingListItem }) {
  const waehrung = b.currency ?? b.property.currency;
  return (
    <Link
      href={`/buchungen/${b.id}`}
      className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center"
    >
      <div className="h-40 w-full shrink-0 overflow-hidden rounded-xl bg-secondary sm:size-28">
        {b.property.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.property.photo}
            alt={b.property.title}
            className="size-full object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-muted-foreground">
            <Icon icon="ph:image" className="size-7" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={b.status} />
          <ChannelBadge channel={b.channel} />
        </div>
        <p className="mt-2 truncate font-medium">{b.property.title}</p>
        {b.property.address && (
          <p className="truncate text-sm text-muted-foreground">
            {b.property.address}
          </p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          {formatRange(b.check_in, b.check_out)} · {b.num_guests} Gäste
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
        {b.total_amount != null ? (
          <span className="font-semibold">
            {formatCurrency(b.total_amount, waehrung)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
        <PaymentBadge status={b.payment_status} />
      </div>
    </Link>
  );
}
