"use client";

// Topbar des Eigentümer-Portals: Sidebar-Trigger, Seitentitel, Sprache, Theme.
// Bewusst OHNE die Glocke der Agentur-Topbar — die In-App-Meldungen sind
// Betriebs-Meldungen (fehlende Fotos, abgelaufene Portal-Tokens) und gehören
// nicht in die Eigentümer-Fläche.
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@nextdays/ui/separator";
import { SidebarTrigger } from "@nextdays/ui/sidebar";

// Zweites Pfad-Segment (/portal/<segment>) → Key im Namespace portal.nav.
const PATH_TITLE: Record<string, string> = {
  kalender: "calendar",
  berichte: "reports",
  sperrungen: "blockRequests",
  zaehlerstaende: "meterReadings",
  dienstleistungen: "services",
  benachrichtigungen: "notifications",
};

export function PortalTopbar() {
  const t = useTranslations("portal.nav");
  const pathname = usePathname() || "";
  const seg = pathname.split("/").filter(Boolean)[1] ?? "";
  const key = PATH_TITLE[seg] ?? "overview";

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <h1 className="font-display text-base font-extrabold">{t(key)}</h1>

      <div className="ml-auto flex items-center gap-1">
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
