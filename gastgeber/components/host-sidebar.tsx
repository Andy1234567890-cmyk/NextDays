"use client";

// Schlanke Gastgeber-Navigation (Marktplatz-Host, NICHT web's Agentur-Sidebar).
// Nur die Host-relevanten Bereiche des Katalogs. Komponenten aus @nextdays/ui.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@nextdays/ui/sidebar";

import { LogoutButton } from "./logout-button";

const NAV = [
  { key: "dashboard", href: "/", icon: "solar:widget-5-bold-duotone" },
  { key: "objekte", href: "/objekte", icon: "solar:home-2-bold-duotone" },
  { key: "kalender", href: "/kalender", icon: "solar:calendar-bold-duotone" },
  { key: "buchungen", href: "/buchungen", icon: "solar:ticket-bold-duotone" },
  { key: "nachrichten", href: "/nachrichten", icon: "solar:chat-round-line-bold-duotone" },
  { key: "bewertungen", href: "/bewertungen", icon: "solar:star-bold-duotone" },
  { key: "finanzen", href: "/finanzen", icon: "solar:wallet-bold-duotone" },
  { key: "statistiken", href: "/statistiken", icon: "solar:chart-2-bold-duotone" },
  { key: "konto", href: "/konto", icon: "solar:user-circle-bold-duotone" },
] as const;

export function HostSidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4">
        <Link href="/" className="font-display text-lg font-semibold">
          myNextDays
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link href={item.href}>
                        <Icon icon={item.icon} className="size-5" />
                        <span>{t(item.key)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-4 py-4">
        <LogoutButton />
      </SidebarFooter>
    </Sidebar>
  );
}
