"use client";

// Hülle der PM-Fläche: rendert links die globale Modul-Navigation neben dem
// Inhalt. Ausnahme Objekt-Detailbereich (/reservierungen/unterkuenfte/{id}/…):
// dort zeigt das Objekt-Sub-Layout seine eigene 6-Reiter-Navigation, deshalb
// wird die globale PM-Nav hier ausgeblendet (sonst stünden zwei Navspalten
// nebeneinander). Der Objekt-Detailbereich ist alles UNTERHALB der Objektliste,
// also /unterkuenfte/<id>… — die Liste selbst (/unterkuenfte) behält die PM-Nav.
import { usePathname } from "next/navigation";

import { PmModuleNav } from "@/components/reservierungen/pm-module-nav";

// /reservierungen/unterkuenfte/<etwas> → Objekt-Detail (globale Nav aus).
// /reservierungen/unterkuenfte        → Objektliste  (globale Nav an).
const PROPERTY_DETAIL_RE = /^\/reservierungen\/unterkuenfte\/[^/]+/;

// /reservierungen/aufgaben[/…] → Aufgaben-Modul mit eigener linker Sub-Nav
// (wie ..): globale PM-Nav ausblenden, sonst stünden zwei Nav-Spalten.
const TASKS_RE = /^\/reservierungen\/aufgaben(\/|$)/;

export function PmModuleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = PROPERTY_DETAIL_RE.test(pathname) || TASKS_RE.test(pathname);

  if (hideNav) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <aside className="w-full shrink-0 lg:w-56">
        <PmModuleNav />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
