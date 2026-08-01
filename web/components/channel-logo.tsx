"use client";

// Kanal-Herkunft als Symbol — EIN Renderer für Kalender, Buchungsliste und
// Dashboard, damit ein Kanal überall gleich aussieht. Quelle ist allein
// `CHANNEL_META` (lib/calendar-channels.ts); hier steht kein eigenes Mapping,
// sonst driften die Kopien wieder auseinander (so fehlte `ota_other` erst nur
// im Dashboard).
import { Icon } from "@iconify/react";

import type { AvailabilitySource } from "@/lib/calendar";
import { channelMeta } from "@/lib/calendar-channels";

export function ChannelLogo({
  source,
  className = "size-3",
}: {
  source: AvailabilitySource;
  className?: string;
}) {
  const logo = channelMeta(source).logo;
  if (logo.kind === "img") {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logo.src}
        alt={source}
        className={`${className} shrink-0 rounded-[0.125rem]`}
      />
    );
  }
  return <Icon icon={logo.icon} className={`${className} shrink-0`} />;
}
