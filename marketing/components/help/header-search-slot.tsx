"use client";

// Header-Suche wird auf der Hilfe-Startseite ausgeblendet, weil dort der Hero
// bereits eine prominente Suche zeigt — sonst gäbe es zwei Suchleisten. Auf allen
// Unterseiten (Kategorie/Artikel/Suche) bleibt die Header-Suche sichtbar.
import { usePathname } from "next/navigation";

import { HelpSearchBox } from "./help-search-box";

export function HeaderSearchSlot() {
  const pathname = usePathname();
  if (pathname === "/hilfe") return null;
  // Der Rahmen (Trennlinie + Abstand) gehoert HIERHER, nicht ins Layout: sonst
  // bliebe auf der Hilfe-Startseite, wo dieser Slot nichts rendert, ein leerer
  // Streifen mit Trennlinie stehen.
  return (
    <div className="border-b border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="mx-auto hidden w-full max-w-xl md:block">
          <HelpSearchBox />
        </div>
      </div>
    </div>
  );
}
