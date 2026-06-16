// Fachliche PMS-Komponente: Kanal-Icon + Label für reservation_channel.
// Lastenheft §3 — Buchungskanal einer Reservierung visuell kennzeichnen.
// Icons NUR via @iconify/react (ph:*), Stil/Tokens wie components/ui/button.tsx.
import { Icon } from "@iconify/react";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Echte Enum-Werte aus supabase/migrations (BUILD_REFERENCE):
// reservation_channel: direct | portal | booking | airbnb | vrbo
export type ReservationChannel =
  | "direct"
  | "portal"
  | "booking"
  | "airbnb"
  | "vrbo";

// Zuordnung Kanal -> ph-Icon + deutsches Label.
const CHANNEL_CONFIG: Record<
  ReservationChannel,
  { icon: string; label: string }
> = {
  direct: { icon: "ph:house-line", label: "Direktbuchung" },
  portal: { icon: "ph:globe", label: "Portal" },
  booking: { icon: "ph:buildings", label: "Booking.com" },
  airbnb: { icon: "ph:bed", label: "Airbnb" },
  vrbo: { icon: "ph:key", label: "Vrbo" },
};

const channelIconVariants = cva(
  "inline-flex items-center gap-1.5 text-foreground",
  {
    variants: {
      size: {
        sm: "text-xs [&_svg]:h-3.5 [&_svg]:w-3.5",
        default: "text-sm [&_svg]:h-4 [&_svg]:w-4",
        lg: "text-base [&_svg]:h-5 [&_svg]:w-5",
      },
    },
    defaultVariants: { size: "default" },
  },
);

type ChannelIconProps = ComponentProps<"span"> &
  VariantProps<typeof channelIconVariants> & {
    channel: ReservationChannel;
    // Label ausblenden -> nur Icon (z.B. in dichten Tabellen).
    iconOnly?: boolean;
  };

export function ChannelIcon({
  className,
  channel,
  size,
  iconOnly = false,
  ...props
}: ChannelIconProps) {
  const { icon, label } = CHANNEL_CONFIG[channel];
  return (
    <span
      className={cn(channelIconVariants({ size }), className)}
      title={iconOnly ? label : undefined}
      aria-label={iconOnly ? label : undefined}
      {...props}
    >
      <Icon icon={icon} aria-hidden className="text-muted-foreground" />
      {!iconOnly && <span>{label}</span>}
    </span>
  );
}

export { channelIconVariants, CHANNEL_CONFIG };
