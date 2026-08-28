// Layout des Einstellungen-Reiters: Reiterleiste + Unterpunkt-Liste.
//
// Als Layout und nicht in jeder Unterseite, weil die Unterpunkt-Liste bei einem
// Wechsel STEHEN bleiben soll — sonst flackert sie bei jedem Klick neu auf.
//
// Der Rahmen wird DIREKT gerufen; zur weggefallenen `EinstellungenRahmen`-Hülle
// siehe den Kopf von `../seo/layout.tsx`.
//
// Die Unterpunkte zeigt die MENÜSPALTE der Schale (`REITER_MENUE.einstellungen`).
// Die alte Hülle zeichnete daneben ihre eigene `<nav>` mit denselben sechs
// Punkten — unsichtbar, solange die Menüspalte für diesen Bereich nicht rendern
// durfte, und ab dann doppelt (Nachprüfung C2).
import type { ReactNode } from "react";

import { BaukastenRahmen } from "@/components/website/rahmen";

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
      <BaukastenRahmen
        pages={pages}
        domains={domains}
        breit
        // Alle Einstellungen des Baukastens stehen in der Site-Konfiguration.
        tabellen={["tenant_site_config"]}
        inhalt={
          <div className="flex min-h-full flex-col gap-6 p-4 md:p-6">
            {/* Die Inhaltsspalte begrenzt ihre Breite: ein Formular über
                1600 px ist unlesbar, weil Beschriftung und Feld weit
                auseinanderliegen. */}
            <div className="min-w-0 flex-1 md:max-w-3xl">{children}</div>
          </div>
        }
      />
    </div>
  );
}
