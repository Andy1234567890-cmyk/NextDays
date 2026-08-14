"use client";

// Linke Modul-Navigation der PM-Fläche (.. „PM-Module"-Look): zwei
// Gruppen „Startseite" und „Einstellungen", jeder Reiter führt per Klick auf
// die verlinkte Seite. Der aktive Reiter wird über usePathname bestimmt.
//
// Grundsatz (CLAUDE.md Wurzel 4): kein erfundener Inhalt. Reiter, für die es
// noch keine eigene Fläche gibt, verlinken auf die passende BESTEHENDE Route
// (z. B. Unterkünfte → /objekte, Reporting → /buchhaltung/berichte). Reine
// Platzhalter (Gastmodul/Aufgaben) führen auf ehrliche „noch nicht aktiv"-
// Seiten innerhalb dieser Fläche.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavItem = {
  key: string;
  labelKey: string;
  href: string;
  icon: string;
  // exact=true: nur bei exakt gleichem Pfad aktiv (verhindert, dass „Buchungen"
  // (/reservierungen) auch auf Unterseiten wie /reservierungen/aufgaben aktiv ist).
  exact?: boolean;
};

type NavGroup = { titleKey: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    titleKey: "groupHome",
    items: [
      { key: "control", labelKey: "control", href: "/reservierungen/kontrollzentrum", icon: "ph:squares-four", exact: true },
      // „Buchungen" (/reservierungen) zog am 14.08.2026 in die Haupt-Sidebar
      // unter „Posteingang" (app-sidebar.tsx MAIN) — Tagesgeschäft, das nicht
      // hinter zwei Klicks gehört. Hier NICHT wiederholen, sonst stünde der
      // Punkt doppelt in der Navigation.
      { key: "properties", labelKey: "properties", href: "/reservierungen/unterkuenfte", icon: "ph:house-line" },
      { key: "tasks", labelKey: "tasks", href: "/reservierungen/aufgaben", icon: "ph:check-square" },
      { key: "photos", labelKey: "photos", href: "/reservierungen/bilder", icon: "ph:image" },
      { key: "warnings", labelKey: "warnings", href: "/reservierungen/warnungen", icon: "ph:warning" },
      { key: "timeline", labelKey: "timeline", href: "/kalender", icon: "ph:clock-clockwise" },
      { key: "reporting", labelKey: "reporting", href: "/buchhaltung/berichte", icon: "ph:chart-line" },
      // „Gastmodul" entfiel am 14.08.2026 — die Seite war ein Platzhalter ohne
      // Inhalt; die echten Felder stehen in der Objektkartei, Stufe „Zugang &
      // Technik" (/objekte/[id]/kartei).
    ],
  },
  {
    titleKey: "groupSettings",
    items: [
      { key: "settings", labelKey: "settings", href: "/einstellungen", icon: "ph:gear" },
      { key: "team", labelKey: "team", href: "/hr/mitarbeiter", icon: "ph:users-three" },
      { key: "app", labelKey: "app", href: "/reservierungen/app", icon: "ph:device-mobile" },
      { key: "slack", labelKey: "slack", href: "/reservierungen/slack", icon: "ph:chat-circle-dots" },
    ],
  },
];

export function PmModuleNav() {
  const pathname = usePathname();
  const t = useTranslations("reservations");

  const isActive = (item: NavItem): boolean =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <nav aria-label={t("pmModuleNav.navLabel")} className="flex w-full flex-col gap-6">
      {GROUPS.map((group) => (
        <div key={group.titleKey} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`pmModuleNav.${group.titleKey}`)}
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
                <span className="truncate">{t(`pmModuleNav.${item.labelKey}`)}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
