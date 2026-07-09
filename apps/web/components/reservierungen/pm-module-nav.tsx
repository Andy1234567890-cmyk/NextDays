"use client";

// Linke Modul-Navigation der PM-Fläche (Lodgify „PM-Module"-Look): zwei
// Gruppen „Startseite" und „Einstellungen", jeder Reiter führt per Klick auf
// die verlinkte Seite. Der aktive Reiter wird über usePathname bestimmt.
//
// Grundsatz (CLAUDE.md Wurzel 4): kein erfundener Inhalt. Reiter, für die es
// noch keine eigene Fläche gibt, verlinken auf die passende BESTEHENDE Route
// (z. B. Unterkünfte → /objekte, Reporting → /buchhaltung/berichte). Reine
// Platzhalter (Gastmodul/Aufgaben) führen auf ehrliche „noch nicht aktiv"-
// Seiten innerhalb dieser Fläche.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  // exact=true: nur bei exakt gleichem Pfad aktiv (verhindert, dass „Buchungen"
  // (/reservierungen) auch auf Unterseiten wie /reservierungen/aufgaben aktiv ist).
  exact?: boolean;
};

type NavGroup = { title: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    title: "Startseite",
    items: [
      { key: "control", label: "Kontrollzentrum", href: "/reservierungen/kontrollzentrum", icon: "ph:squares-four", exact: true },
      { key: "bookings", label: "Buchungen", href: "/reservierungen", icon: "ph:bookmark-simple", exact: true },
      { key: "properties", label: "Unterkünfte", href: "/reservierungen/unterkuenfte", icon: "ph:house-line" },
      { key: "tasks", label: "Aufgaben", href: "/reservierungen/aufgaben", icon: "ph:check-square" },
      { key: "photos", label: "Bilder", href: "/objekte", icon: "ph:image" },
      { key: "warnings", label: "Warnungen", href: "/reservierungen/warnungen", icon: "ph:warning" },
      { key: "timeline", label: "Zeitleiste", href: "/kalender", icon: "ph:clock-clockwise" },
      { key: "reporting", label: "Reporting", href: "/buchhaltung/berichte", icon: "ph:chart-line" },
      { key: "guestModule", label: "Gastmodul", href: "/reservierungen/gastmodul", icon: "ph:identification-card" },
    ],
  },
  {
    title: "Einstellungen",
    items: [
      { key: "settings", label: "Einstellungen", href: "/einstellungen", icon: "ph:gear" },
      { key: "team", label: "Team", href: "/hr/mitarbeiter", icon: "ph:users-three" },
    ],
  },
];

export function PmModuleNav() {
  const pathname = usePathname();

  const isActive = (item: NavItem): boolean =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <nav aria-label="PM-Module" className="flex w-full flex-col gap-6">
      {GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group.title}
          </p>
          {group.items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent/10 text-accent"
                    : "text-foreground hover:bg-secondary/60",
                )}
              >
                <Icon icon={item.icon} className="size-4.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
