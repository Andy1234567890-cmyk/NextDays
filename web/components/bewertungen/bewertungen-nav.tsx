"use client";

// Unternavigation des Bewertungsbereichs. Jeder Eintrag zeigt auf eine ECHTE
// Route — tote Links haben wir uns woanders schon eingefangen.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const EINTRAEGE = [
  { key: "navAll", href: "/bewertungen", icon: "ph:star" },
  { key: "navQueue", href: "/bewertungen/geplant", icon: "ph:clock-countdown" },
  { key: "navQuality", href: "/bewertungen/qualitaet", icon: "ph:chart-line-up" },
  { key: "navAutomation", href: "/bewertungen/einstellungen", icon: "ph:robot" },
] as const;

export function BewertungenNav() {
  const t = useTranslations("reviews");
  const pathname = usePathname();

  return (
    <nav className="flex shrink-0 gap-1 overflow-x-auto lg:w-56 lg:flex-col lg:overflow-visible">
      {EINTRAEGE.map((e) => {
        // Exakter Vergleich: /bewertungen ist Präfix aller anderen und wäre
        // sonst dauerhaft aktiv.
        const aktiv = pathname === e.href;
        return (
          <Link
            key={e.href}
            href={e.href}
            className={
              "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors lg:rounded-(--radius) " +
              (aktiv
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground")
            }
          >
            <Icon icon={e.icon} className="size-4" />
            {t(e.key)}
          </Link>
        );
      })}
    </nav>
  );
}
