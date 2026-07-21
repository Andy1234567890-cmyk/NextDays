"use client";

// Zweite (linke) Sidebar der Einstellungen-Fläche — analog zu PmModuleNav.
// Gruppe „Allgemeine Einstellungen" mit den Reitern Konditionen / Zahlungen.
// Der aktive Reiter wird über usePathname bestimmt. Neue Einstellungs-Flächen
// kommen als weiterer Reiter hierher, nicht als eigene Top-Level-Route.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  exact?: boolean;
};

type NavGroup = { title: string; items: NavItem[] };

// requiresBilling: nur sichtbar mit manage_billing (der Endpunkt erzwingt es).
function buildGroups(canBilling: boolean): NavGroup[] {
  const items: NavItem[] = [
    {
      key: "conditions",
      label: "Konditionen",
      href: "/einstellungen",
      icon: "ph:file-text",
      exact: true,
    },
    {
      key: "calendar-sync",
      label: "Kalender importieren/exportieren",
      href: "/einstellungen/kalender",
      icon: "ph:calendar-dots",
    },
  ];
  if (canBilling) {
    items.push({
      key: "payments",
      label: "Zahlungen",
      href: "/einstellungen/zahlungen",
      icon: "ph:credit-card",
    });
  }
  return [{ title: "Allgemeine Einstellungen", items }];
}

export function EinstellungenNav({ canBilling }: { canBilling: boolean }) {
  const pathname = usePathname();
  const GROUPS = buildGroups(canBilling);

  const isActive = (item: NavItem): boolean =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <nav aria-label="Einstellungen" className="flex w-full flex-col gap-6">
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
