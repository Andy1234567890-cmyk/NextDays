// Layout des SEO-Reiters (0430): Reiterleiste + Unterpunkt-Liste.
//
// Als Layout und nicht in jeder Unterseite, damit die Unterpunkt-Liste beim
// Wechsel STEHEN bleibt — sonst flackert sie bei jedem Klick neu auf. Muster
// wie beim Einstellungen-Reiter.
import type { ReactNode } from "react";

import { SeoRahmen } from "@/components/website/seo/rahmen";

import { ladeBaukasten } from "../daten";
import { KeinZugriff } from "../kein-zugriff";

export default async function SeoLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { keinZugriff, pages, domains } = await ladeBaukasten();
  if (keinZugriff) return <KeinZugriff />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <SeoRahmen pages={pages} domains={domains}>
        {children}
      </SeoRahmen>
    </div>
  );
}
