"use client";

// Topbar des Eigentümer-Portals: Sidebar-Trigger, Seitentitel, Glocke,
// Sprache, Theme.
//
// DIE GLOCKE STAND HIER BEWUSST NICHT — mit der Begründung, In-App-Meldungen
// seien Betriebs-Meldungen (fehlende Fotos, abgelaufene Portal-Tokens). Das
// war einmal richtig und ist es seit 0331/0332 nicht mehr: der Eigentümer ist
// selbst Empfänger von vier Kategorien (`owner_booking`, `owner_service`,
// `block_decision`, `block_freigabe`). Die Zeilen wurden also die ganze Zeit
// für ihn geschrieben und nie angezeigt.
//
// Der Schaden war nicht nur eine fehlende Anzeige. Der partielle Unique-Index
// auf `(user_id, dedup_key) where gelesen_am is null` (0287) lässt eine
// Wiederholung erst zu, NACHDEM eine Meldung gelesen wurde. Ohne Glocke wird
// keine gelesen: gemessen am 03.09.2026 lagen 382 Meldungen an Eigentümern,
// davon 382 ungelesen, die älteste vom 10.08. Jede davon sperrte dauerhaft
// die nächste Meldung mit demselben Schlüssel — bei `owner_booking` also die
// nächste Änderung an derselben Buchung. Eine stumme Anzeige war damit auch
// ein stummer Zustellungs-Riegel.
//
// Die Glocke selbst ist rollenneutral: sie liest über `/notification-settings/glocke`
// nur die eigenen Zeilen (RLS + Scope über ctx), kennt also keine Rolle.
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { Glocke } from "@/components/glocke";
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
        <Glocke />
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
