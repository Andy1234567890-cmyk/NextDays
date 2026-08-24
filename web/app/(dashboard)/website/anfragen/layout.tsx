// Layout des Anfragen-Reiters (0436): die Reiterleiste des Baukastens.
//
// Als eigenes Layout und nicht in der Seite selbst, aus demselben Grund wie beim
// SEO- und Einstellungen-Reiter: die Leiste bleibt beim Navigieren STEHEN,
// statt bei jedem Klick neu aufzubauen.
//
// Dass es die Datei überhaupt gibt, ist ein behobener Fehler: die Anfragen-Seite
// war die einzige des Baukastens ohne Rahmen. Sie zeigte ihre Liste, aber keine
// Reiter — und damit gab es von ihr aus KEINEN Weg zurück zu Design oder Seiten,
// nur den Browser-Zurück-Knopf. Eine Seite ohne Rückweg ist eine Sackgasse.
import type { ReactNode } from "react";

import { AnfragenRahmen } from "@/components/website/anfragen-rahmen";

import { ladeBaukasten } from "../daten";
import { KeinZugriff } from "../kein-zugriff";

export default async function AnfragenLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { keinZugriff, pages, domains } = await ladeBaukasten();
  if (keinZugriff) return <KeinZugriff />;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <AnfragenRahmen pages={pages} domains={domains}>
        {children}
      </AnfragenRahmen>
    </div>
  );
}
