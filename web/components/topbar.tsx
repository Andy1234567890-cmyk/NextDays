"use client";

// Dashboard-Topbar: Sidebar-Trigger, Seitentitel, Benachrichtigungen,
// Theme-Umschalter. Client-Komponente (Iconify + Interaktion).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@nextdays/ui/button";
import { Separator } from "@nextdays/ui/separator";
import { SidebarTrigger } from "@nextdays/ui/sidebar";

// Pfad-Segment → nav-Übersetzungskey (Seitentitel folgt der aktiven Route).
const PATH_TITLE: Record<string, string> = {
  dashboard: "dashboard",
  reservierungen: "reservations",
  posteingang: "inbox",
  kalender: "calendar",
  verkaufsstopp: "stopSell",
  objekte: "properties",
  "website-baukasten": "websiteBuilder",
  channels: "channelManager",
  "channel-manager": "channelManager",
};

export function Topbar() {
  const t = useTranslations("common");
  const tNav = useTranslations("nav");
  const pathname = usePathname() || "";
  // Erstes Pfad-Segment (z.B. /posteingang → "posteingang").
  const seg = pathname.split("/").filter(Boolean)[0] ?? "";
  const navKey = PATH_TITLE[seg];

  let title = t("overview");
  if (navKey) {
    try {
      title = tNav(navKey);
    } catch {
      title = t("overview");
    }
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <h1 className="font-display text-base font-extrabold">{title}</h1>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label={t("notifications")}>
          <Icon icon="ph:bell" className="size-5" />
        </Button>
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
