// Fachliche PMS-Komponente: Reservierungs-Karte (Lastenheft §2.2/§5).
// Zeigt eine Reservierung kompakt: Gast-Vorname, Zeitraum (check_in/check_out),
// Status (reservation_status), Buchungskanal (reservation_channel), Betrag und
// Nachrichten-Zähler. Aufbau auf vorhandenen Primitiven (Card, Badge, Avatar).
//
// DATEN-SPLIT (Lastenheft §5): Der Eigentümer sieht von Gästen NUR den Vornamen
// (kein Nachname, keine Kontaktdaten) und nur Netto/Nacht. Diese Komponente
// erhält daher bewusst ausschließlich `guestFirstName` — nie den vollständigen
// Namen. Finanzen/Namen werden Mitarbeitern (staff/cleaner) gar nicht angezeigt.

import { Icon } from "@iconify/react";
import type { ComponentProps } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Echte Enum-Werte aus supabase/migrations (BUILD_REFERENCE).
export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed";

export type ReservationChannel =
  | "direct"
  | "portal"
  | "booking"
  | "airbnb"
  | "vrbo";

// Unterstützte Währungen (glatte Beträge, keine Cent — Lastenheft §5).
export type ReservationCurrency = "EUR" | "DKK";

// --- Status-Badge: Mapping reservation_status → Badge-Variante + DE-Label. ---
// Farb-Logik gemäß BUILD_REFERENCE: pending=warning(amber), confirmed=success,
// cancelled=secondary(grau), completed=default(dunkel).
const STATUS_CONFIG: Record<
  ReservationStatus,
  { label: string; variant: ComponentProps<typeof Badge>["variant"]; icon: string }
> = {
  pending: { label: "Ausstehend", variant: "warning", icon: "ph:clock" },
  confirmed: { label: "Bestätigt", variant: "success", icon: "ph:check-circle" },
  cancelled: { label: "Storniert", variant: "secondary", icon: "ph:x-circle" },
  completed: { label: "Abgeschlossen", variant: "default", icon: "ph:flag-checkered" },
};

function StatusBadge({ status }: { status: ReservationStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <Badge variant={cfg.variant}>
      <Icon icon={cfg.icon} className="size-3.5" />
      {cfg.label}
    </Badge>
  );
}

// --- Channel-Icon: Mapping reservation_channel → Iconify (ph:*) + DE-Label. ---
const CHANNEL_CONFIG: Record<
  ReservationChannel,
  { label: string; icon: string }
> = {
  direct: { label: "Direkt", icon: "ph:storefront" },
  portal: { label: "Portal", icon: "ph:globe-hemisphere-west" },
  booking: { label: "Booking.com", icon: "ph:bed" },
  airbnb: { label: "Airbnb", icon: "ph:house-line" },
  vrbo: { label: "Vrbo", icon: "ph:buildings" },
};

function ChannelIcon({ channel }: { channel: ReservationChannel }) {
  const cfg = CHANNEL_CONFIG[channel];
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      title={cfg.label}
    >
      <Icon icon={cfg.icon} className="size-4" aria-hidden />
      {cfg.label}
    </span>
  );
}

// --- Preis-Anzeige: glatte Beträge ohne Cent (Lastenheft §5). ---
// DKK wird mit "Kr" dargestellt, EUR mit "€".
function PriceDisplay({
  amount,
  currency,
}: {
  amount: number;
  currency: ReservationCurrency;
}) {
  const rounded = Math.round(amount);
  const formatted = new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 0,
  }).format(rounded);
  const suffix = currency === "DKK" ? "Kr" : "€";
  return (
    <span className="font-semibold text-foreground">
      {formatted} {suffix}
    </span>
  );
}

// --- Datum DE: Intl-Formatierung "TT.MM.JJJJ". ---
function formatDateDE(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

export type ReservationCardProps = ComponentProps<typeof Card> & {
  // Eigentümer sieht NUR den Vornamen (Daten-Split, Lastenheft §5).
  guestFirstName: string;
  // ISO-Datum (YYYY-MM-DD).
  checkIn: string;
  checkOut: string;
  status: ReservationStatus;
  channel: ReservationChannel;
  amount: number;
  currency?: ReservationCurrency;
  // Anzahl ungelesener/gesamter Nachrichten im Gast-Chat.
  messageCount?: number;
};

export function ReservationCard({
  guestFirstName,
  checkIn,
  checkOut,
  status,
  channel,
  amount,
  currency = "EUR",
  messageCount = 0,
  className,
  ...props
}: ReservationCardProps) {
  const initial = guestFirstName.trim().charAt(0).toUpperCase();

  return (
    <Card className={cn("w-full max-w-md", className)} {...props}>
      <CardContent className="flex flex-col gap-4 p-4">
        {/* Kopf: Gast (nur Vorname) + Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-medium leading-tight text-foreground">
                {guestFirstName}
              </span>
              <ChannelIcon channel={channel} />
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Zeitraum: check_in → check_out (Datum DE) */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon icon="ph:calendar-blank" className="size-4 shrink-0" aria-hidden />
          <span className="text-foreground">{formatDateDE(checkIn)}</span>
          <Icon icon="ph:arrow-right" className="size-4 shrink-0" aria-hidden />
          <span className="text-foreground">{formatDateDE(checkOut)}</span>
        </div>

        {/* Fuß: Betrag + Nachrichten-Zähler */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <PriceDisplay amount={amount} currency={currency} />
          <span
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
            title={`${messageCount} Nachrichten`}
          >
            <Icon icon="ph:chat-circle-text" className="size-4" aria-hidden />
            {messageCount}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
