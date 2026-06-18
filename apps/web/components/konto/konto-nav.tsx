"use client";

// Unter-Navigation der Konto-Seite (Profil / Nutzer / Sicherheit).
// Aktiver Punkt anhand des Pfads. Icons via Iconify (ph:*).
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ITEMS = [
  { title: "Profil", href: "/konto", icon: "ph:user-circle" },
  { title: "Nutzer", href: "/konto/nutzer", icon: "ph:users" },
  { title: "Sicherheit", href: "/konto/sicherheit", icon: "ph:shield-check" },
] as const;

export function KontoNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map((item) => {
        const active =
          item.href === "/konto"
            ? pathname === "/konto"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-(--radius) px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            <Icon icon={item.icon} className="size-5" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
