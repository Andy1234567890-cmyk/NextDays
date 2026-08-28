// Layout des SEO-Reiters (0430): Reiterleiste + Unterpunkt-Liste.
//
// Als Layout und nicht in jeder Unterseite, damit die Unterpunkt-Liste beim
// Wechsel STEHEN bleibt — sonst flackert sie bei jedem Klick neu auf. Muster
// wie beim Einstellungen-Reiter.
//
// Der Rahmen wird DIREKT gerufen. Dazwischen lag bis 27.08.2026 eine
// `SeoRahmen`-Hülle in `components/website/seo/rahmen.tsx`: eine Datei mit einem
// Aufrufer, die nichts tat außer `useBaukastenRealtime` zu rufen, `breit` zu
// setzen und einen Container zu zeichnen — und die genauso hieß wie der echte
// Rahmen. Dieselbe Hülle gab es für die Einstellungen. Drei gleichnamige
// Dateien für eine Aufgabe; das Abo kann der Rahmen selbst (`tabellen`).
import type { ReactNode } from "react";

import { BaukastenRahmen } from "@/components/website/rahmen";

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
      <BaukastenRahmen
        pages={pages}
        domains={domains}
        breit
        // SEO speist sich aus drei Tabellen: den site-weiten Angaben, den
        // Seiten und den Weiterleitungen. Welche der Baukasten überhaupt
        // abonnieren darf, steht an EINER Stelle: `baukasten-realtime.ts`.
        tabellen={["tenant_site_config", "site_pages", "site_redirects"]}
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
