"use client";

// Unter-Navigation der Konto-Seite. Aktiver Punkt anhand des Pfads.
// Rollen-/Capability-Gating (wie die Haupt-Sidebar): nur Tabs zeigen, die der
// Nutzer wirklich bedienen kann — sonst landet er auf 403-/„Kein Zugriff"-
// Seiten. „Tarif & Abo" ist Admin/Co-Admin-Sache; Profil, Nutzer und
// Sicherheit richten sich nach eigenen Guards.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type Item = {
  title: string;
  href: string;
  icon: string;
  // Sichtbar nur, wenn eine dieser Capabilities vorhanden ist (leer = immer).
  requireAny?: string[];
};

// „Branding & Domains" absichtlich entfernt: die Route existierte nicht (404).
const ITEMS: readonly Item[] = [
  { title: "Profil", href: "/konto", icon: "ph:user-circle" },
  {
    title: "Tarif & Abo",
    href: "/konto/tarif",
    icon: "ph:receipt",
    requireAny: ["manage_billing"],
  },
  {
    title: "Nutzer",
    href: "/konto/nutzer",
    icon: "ph:users",
    requireAny: ["manage_staff"],
  },
  {
    title: "API-Zugang",
    href: "/konto/api-zugang",
    icon: "ph:code",
    requireAny: ["manage_tenant"],
  },
  { title: "Sicherheit", href: "/konto/sicherheit", icon: "ph:shield-check" },
];

export function KontoNav({
  role = null,
  capabilities = [],
  permissions = [],
}: {
  role?: string | null;
  capabilities?: string[];
  permissions?: string[];
}) {
  const pathname = usePathname();
  const grantSet = new Set([...capabilities, ...permissions]);

  const items = ITEMS.filter((item) => {
    if (role === "admin") return true;
    if (!item.requireAny) return true;
    return item.requireAny.some((c) => grantSet.has(c));
  });

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
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
