"use client";

// Drei gleichrangige Vertriebskanal-Chips auf der Objektkarte:
//   Website (eigene Kunden-Website) · Plattform (myBestDays-Marktplatz) · Portale
//   (Channex → OTAs, im Kundentext NIE „Channex").
// Ebene B (pro-Kanal-Sichtbarkeit), getrennt vom Lebenszyklus-Badge (status).
// Zustandsmodell branchen-recherchiert (Guesty/Cloudbeds/SiteMinder): active
// (grün), paused (grau, Nutzer-Wille), not_connected (neutral/gestrichelt),
// error (rot, nur Portale möglich), pending (amber, nur Plattform: Freigabe des
// Marktplatz-Betreibers offen). Pausiert ≠ Fehler ≠ Wartet — bewusst getrennte
// Farben, damit der grüne Punkt nur steht, wenn das Objekt WIRKLICH verkauft.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import type { ChannelState, PropertyChannels } from "@/lib/properties";

type ChannelKey = "website" | "marketplace" | "portals";

const CHANNEL_META: Record<ChannelKey, { icon: string; labelKey: string }> = {
  website: { icon: "ph:globe-simple", labelKey: "channelChips.website" },
  marketplace: { icon: "ph:storefront", labelKey: "channelChips.platform" },
  portals: { icon: "ph:broadcast", labelKey: "channelChips.portals" },
};

// Ampel-Kodierung je Zustand (Tailwind-Tokens, keine arbitrary Hex). paused/
// not_connected sind neutral (kein Alarm), pending wartet (amber, wie „verbunden,
// Zuordnung offen" im Kanalmanager), nur error ist rot.
const STATE_DOT: Record<ChannelState, string> = {
  active: "bg-emerald-500",
  paused: "bg-muted-foreground/40",
  not_connected: "bg-muted-foreground/25 ring-1 ring-dashed ring-muted-foreground/40",
  error: "bg-destructive",
  pending: "bg-amber-500",
};

function Chip({
  channelKey,
  state,
  dimmed,
  label,
  stateLabel,
}: {
  channelKey: ChannelKey;
  state: ChannelState;
  dimmed: boolean;
  label: string;
  stateLabel: string;
}) {
  const meta = CHANNEL_META[channelKey];
  return (
    <span
      title={`${label}: ${stateLabel}`}
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-2.5 py-1 text-xs font-medium ${
        dimmed ? "opacity-40" : ""
      }`}
    >
      <Icon icon={meta.icon} className="size-3.5 text-muted-foreground" />
      <span>{label}</span>
      <span className={`size-2 rounded-full ${STATE_DOT[state]}`} aria-hidden />
    </span>
  );
}

export function ChannelChips({
  channels,
  status,
}: {
  channels: PropertyChannels;
  status: string;
}) {
  const t = useTranslations("objects");
  // Nicht-aktives Objekt (Entwurf/Inaktiv): Kanäle können gar nicht verkaufen →
  // Chips gedimmt (kein Fehler, nur „Objekt nicht verkaufsbereit").
  const dimmed = status !== "active";
  const stateLabel = (s: ChannelState) => t(`channelChips.state.${s}`);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(["website", "marketplace", "portals"] as ChannelKey[]).map((k) => (
        <Chip
          key={k}
          channelKey={k}
          state={channels[k]}
          dimmed={dimmed}
          label={t(CHANNEL_META[k].labelKey)}
          stateLabel={stateLabel(channels[k])}
        />
      ))}
    </div>
  );
}
