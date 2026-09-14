// Belege in anderer Währung als der Berichtswährung — getrennt ausgewiesen,
// NIE in die Summen gemischt (Wurzel 4). Ohne Einträge rendert nichts.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import type { Fremdwaehrung } from "@/lib/buchhaltung-berichte-typen";

import { geld } from "./format";

export function FremdwaehrungHinweis({ eintraege }: { eintraege: Fremdwaehrung[] }) {
  const t = useTranslations("finance");
  if (eintraege.length === 0) return null;
  return (
    <div className="flex flex-wrap items-start gap-2 rounded-(--radius) border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
      <Icon icon="ph:warning-circle" className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="font-medium">{t("berichteGemeinsam.fremdwaehrungTitel")}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {eintraege.map((f) => (
            <li key={f.currency}>
              {t("berichteGemeinsam.fremdwaehrungZeile", {
                anzahl: f.anzahl,
                betrag: geld(f.netto, f.currency === "?" ? "" : f.currency),
                currency: f.currency,
              })}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
