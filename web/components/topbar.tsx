"use client";

// Dashboard-Topbar: Sidebar-Trigger, Seitentitel, Benachrichtigungen,
// Theme-Umschalter. Client-Komponente (Iconify + Interaktion).
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { Glocke } from "@/components/glocke";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@nextdays/ui/separator";
import { SidebarTrigger } from "@nextdays/ui/sidebar";

// Pfad-Segment → nav-Übersetzungskey (Seitentitel folgt der aktiven Route).
//
// Auch UNTER-Bereiche stehen hier: Der Titel folgt seit dem 31.08.2026 dem
// TIEFSTEN bekannten Segment, nicht mehr dem ersten. Vorher stand über den
// Aufgaben-Reitern durchweg „Reservierungen" — das erste Segment von
// `/reservierungen/aufgaben/inspektion`. Wer auf „Inspektion" stand, las oben
// den Namen eines Bereichs, in dem er sich gar nicht mehr bewegte; gemeldet
// als „warum steht da oben Reservierungen und nicht das Tab, wo wir sind".
const PATH_TITLE: Record<string, string> = {
  dashboard: "dashboard",
  reservierungen: "reservations",
  aufgaben: "tasks",
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
  // Titel aus dem Pfad. Das TIEFSTE bekannte Segment gewinnt, aber NUR solange
  // der Pfad ohne Unterbrechung aus bekannten Segmenten besteht.
  //
  // Der Abbruch beim ersten unbekannten Segment ist die halbe Miete: bei
  // `/reservierungen/unterkuenfte/<id>/kalender` steht hinter der Objekt-ID
  // zwar „kalender", gemeint ist aber der Kalender DIESES Objekts — nicht das
  // Kalender-Modul aus der Hauptnavigation. Ohne den Abbruch trüge die Seite
  // den Namen eines fremden Menüpunkts, was schlechter wäre als der bisherige
  // Zustand.
  const teile = pathname.split("/").filter(Boolean);
  let navKey: string | undefined;
  for (const teil of teile) {
    const treffer = PATH_TITLE[teil];
    if (!treffer) break;
    navKey = treffer;
  }

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
        <Glocke />
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
