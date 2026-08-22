"use client";

// Wählt anhand der offenen Adresse, welche Sidebar gilt.
//
// Das Layout ist eine Server-Komponente und kennt den Pfad nicht; `usePathname`
// braucht einen Client. Diese Hülle ist genau dafür da und hält die
// Bereichslogik an EINER Stelle — sonst müsste jede Seite ihre Sidebar selbst
// wählen und die erste vergessene Seite zeigt die falsche.
import { usePathname } from "next/navigation";

import { DokuSidebar } from "@/components/entwickler/doku-sidebar";

import type {
  SidebarGruppe,
  SidebarKapitelGruppe,
} from "@/components/entwickler/doku-sidebar";

export function DokuSidebarRahmen({
  kapitelGruppen,
  gruppen,
  labels,
}: {
  kapitelGruppen: SidebarKapitelGruppe[];
  gruppen: SidebarGruppe[];
  labels: { sprung: string; keineTreffer: string; version: string };
}) {
  const pfadname = usePathname();
  const bereich = pfadname.startsWith("/entwickler/referenz")
    ? "referenz"
    : "doku";

  return (
    <DokuSidebar
      bereich={bereich}
      kapitelGruppen={kapitelGruppen}
      gruppen={gruppen}
      labels={labels}
    />
  );
}
