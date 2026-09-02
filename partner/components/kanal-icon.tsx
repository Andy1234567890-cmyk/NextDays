// SCHWESTERDATEI: partner/components/kanal-icon.tsx == admin/components/kanal-icon.tsx == marketing/components/partner/kanal-icon.tsx.
// Logo einer Plattform in Markenfarbe (Snapchat-Gelb bekommt einen dunklen Grund,
// sonst wäre es auf Weiß unsichtbar).
import { Icon } from "@iconify/react";

import { type Plattform, PLATTFORM_META } from "@/lib/kanaele";

export function KanalIcon({ platform, className = "size-5" }: { platform: Plattform; className?: string }) {
  const meta = PLATTFORM_META[platform] ?? PLATTFORM_META.other;
  const hell = meta.farbe.toLowerCase() === "#fffc00";
  return (
    <span
      aria-label={meta.label}
      title={meta.label}
      className={`inline-flex shrink-0 items-center justify-center ${hell ? "rounded bg-foreground p-0.5" : ""}`}
    >
      <Icon icon={meta.icon} className={className} style={meta.farbe ? { color: meta.farbe } : undefined} />
    </span>
  );
}
