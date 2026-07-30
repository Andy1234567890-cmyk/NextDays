"use client";

// Header-Suche wird auf der Hilfe-Startseite ausgeblendet, weil dort der Hero
// bereits eine prominente Suche zeigt — sonst gäbe es zwei Suchleisten. Auf allen
// Unterseiten (Kategorie/Artikel/Suche) bleibt die Header-Suche sichtbar.
import { usePathname } from "next/navigation";

import { HelpSearchBox } from "./help-search-box";

export function HeaderSearchSlot() {
  const pathname = usePathname();
  if (pathname === "/hilfe") return null;
  return (
    <div className="mx-auto hidden w-full max-w-xl md:block">
      <HelpSearchBox />
    </div>
  );
}
