// Layout des Einstellungen-Reiters: Reiterleiste + Unterpunkt-Liste.
//
// Als Layout und nicht in jeder Unterseite, weil die Unterpunkt-Liste bei einem
// Wechsel STEHEN bleiben soll — sonst flackert sie bei jedem Klick neu auf.
import type { ReactNode } from "react";

import { EinstellungenRahmen } from "@/components/website/einstellungen/rahmen";

import { ladeBaukasten } from "../daten";
import { KeinZugriff } from "../kein-zugriff";

export default async function EinstellungenLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { keinZugriff, pages, domains } = await ladeBaukasten();
  if (keinZugriff) return <KeinZugriff />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <EinstellungenRahmen pages={pages} domains={domains}>
        {children}
      </EinstellungenRahmen>
    </div>
  );
}
