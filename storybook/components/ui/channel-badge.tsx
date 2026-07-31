"use client";

// Kennzeichnung je Formularfeld: Geht dieses Feld an die Buchungsportale
// (Booking.com, Airbnb & Co.) oder lebt es nur auf der eigenen myBestDays-
// Plattform? Der Channel-Manager dahinter (Channex) wird bewusst NIE erwähnt —
// der Kunde sieht nur die Portale. Kleines Badge + Info-Tooltip mit dem Warum.
import { Icon } from "@iconify/react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Channel = "ota" | "local";

// Standardtexte (deutsch). Über `label`/`hint` überschreibbar, z. B. für i18n.
const DEFAULTS: Record<Channel, { label: string; hint: string; icon: string }> = {
  ota: {
    label: "Booking, Airbnb & Co.",
    hint: "Dieses Feld wird an die Buchungsportale (Booking.com, Airbnb & Co.) übertragen und ist dort für Gäste sichtbar.",
    icon: "ph:globe-hemisphere-west",
  },
  local: {
    label: "Nur myBestDays",
    hint: "Dieses Feld gilt nur auf Ihrer myBestDays-Plattform und für Direktbuchungen — es wird nicht an die Buchungsportale übertragen.",
    icon: "ph:house-line",
  },
};

export function ChannelBadge({
  channel,
  label,
  hint,
  className = "",
}: {
  channel: Channel;
  label?: string;
  hint?: string;
  className?: string;
}) {
  const d = DEFAULTS[channel];
  const text = label ?? d.label;
  const help = hint ?? d.hint;
  const tone =
    channel === "ota"
      ? "border-accent/40 bg-accent/10 text-accent"
      : "border-border bg-secondary text-muted-foreground";

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${text} – mehr Informationen`}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-medium leading-none ${tone} ${className}`}
          >
            <Icon icon={d.icon} className="size-3" />
            {text}
            <Icon icon="ph:info" className="size-3 opacity-70" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{help}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
