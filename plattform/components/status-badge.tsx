// Wiederverwendbare Status-/Zahl-Badges für Buchungen. Deutsche Labels;
// unbekannte Werte werden roh gerendert (nie erfunden).
import { Icon } from "@iconify/react";

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Bestätigt",
  pending: "Angefragt",
  cancelled: "Storniert",
  completed: "Abgeschlossen",
  checked_in: "Eingecheckt",
  checked_out: "Ausgecheckt",
  no_show: "Nicht erschienen",
};

const PAYMENT_LABEL: Record<string, string> = {
  paid: "Bezahlt",
  partial: "Teilweise bezahlt",
  unpaid: "Offen",
  pending: "In Bearbeitung",
  refunded: "Erstattet",
};

// Ton-Klassen (semantische Tokens statt Arbitrary-Hex).
const TONE: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-800",
  neutral: "bg-secondary text-secondary-foreground",
  warning: "bg-amber-100 text-amber-800",
  negative: "bg-accent/10 text-accent",
};

function statusTone(status: string): string {
  if (["confirmed", "completed", "checked_in", "checked_out"].includes(status))
    return TONE.positive;
  if (["cancelled", "no_show"].includes(status)) return TONE.negative;
  if (status === "pending") return TONE.warning;
  return TONE.neutral;
}

function paymentTone(status: string): string {
  if (status === "paid") return TONE.positive;
  if (["unpaid", "refunded"].includes(status)) return TONE.negative;
  if (status === "partial" || status === "pending") return TONE.warning;
  return TONE.neutral;
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusTone(status)}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function PaymentBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${paymentTone(status)}`}
    >
      {PAYMENT_LABEL[status] ?? status}
    </span>
  );
}

// Kanal-Badge: eigene Plattform vs. OTA (Booking/Airbnb & Co.) klar labeln.
const CHANNEL_LABEL: Record<string, string> = {
  // Der Kanal, den das Backend für Marktplatz-Buchungen setzt.
  portal: "myNextDays",
  platform: "myNextDays",
  marketplace: "myNextDays",
  // 'direct' ist die EIGENE Seite des Betriebs — nicht myNextDays.
  direct: "Direktbuchung",
  ota_other: "Portal",
  booking: "Booking.com",
  "booking.com": "Booking.com",
  airbnb: "Airbnb",
  expedia: "Expedia",
  vrbo: "Vrbo",
};

export function ChannelBadge({ channel }: { channel: string }) {
  const key = channel.toLowerCase();
  const istEigen = ["portal", "platform", "marketplace", "direct"].includes(
    key,
  );
  const label = CHANNEL_LABEL[key] ?? channel;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
      <Icon
        icon={istEigen ? "ph:house-simple" : "ph:globe-hemisphere-west"}
        className="size-3.5"
      />
      {istEigen ? label : `Portal · ${label}`}
    </span>
  );
}
