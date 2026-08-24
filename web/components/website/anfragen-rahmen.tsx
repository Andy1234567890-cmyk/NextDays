"use client";

// Rahmen des Anfragen-Reiters (0436).
//
// Anders als SEO und Einstellungen hat dieser Reiter KEINE Unterpunkt-Spalte:
// es gibt genau eine Ansicht. Die Spalte wäre eine leere Leiste, die Platz
// kostet und nichts sagt.
//
// Warum trotzdem eine eigene Datei und nicht `BaukastenRahmen` direkt im
// Layout: `BaukastenRahmen` ist eine Client-Komponente, und ihr `inhalt` ist
// eine Prop. Ein Server-Layout kann sie zwar rendern, aber diese eine Zeile
// Umverdrahtung („children wird zu inhalt") gehört auf die Client-Seite —
// sonst steht sie in jeder Route neu.
import type { ReactNode } from "react";

import type { CustomDomain } from "@/lib/site-config";
import type { Page } from "@/lib/site-pages";

import { BaukastenRahmen } from "./rahmen";

export function AnfragenRahmen({
  pages,
  domains,
  children,
}: {
  pages: Page[];
  domains: CustomDomain[];
  children: ReactNode;
}) {
  return (
    <BaukastenRahmen
      pages={pages}
      domains={domains}
      breit
      inhalt={<div className="p-4 md:p-6">{children}</div>}
    />
  );
}
