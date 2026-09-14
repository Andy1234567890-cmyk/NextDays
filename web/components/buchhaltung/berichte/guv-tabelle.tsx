// Gewinn- und Verlustrechnung eines Kalenderjahres: Monatszeilen + Summe.
import { useLocale, useTranslations } from "next-intl";

import type { GuvResponse } from "@/lib/buchhaltung-berichte-typen";

import { geld, periodeLabel } from "./format";
import { NachbarHinweis } from "./nachbar-hinweis";

export function GuvTabelle({ daten }: { daten: GuvResponse }) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const ergebnisTon = Number(daten.ergebnis) < 0 ? "text-destructive" : "";
  return (
    <div className="flex flex-col gap-3">
      <NachbarHinweis ausgaben={daten.ausgabenVerfuegbar} />
      <div className="grid gap-3 sm:grid-cols-3">
        {daten.aufwand.map((z) => (
          <div key={z.key} className="rounded-(--radius) bg-secondary/40 p-3">
            <p className="text-xs text-muted-foreground">
              {t.has(`berichtePage.bwa.${z.key}`) ? t(`berichtePage.bwa.${z.key}`) : z.label}
            </p>
            <p className="font-semibold tabular-nums">{geld(z.aktuell, daten.currency)}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t("berichtePage.guv.monat")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("berichtePage.guv.erloese")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("berichtePage.guv.aufwand")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("berichtePage.guv.ergebnis")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {daten.monate.map((m) => (
              <tr key={m.monat}>
                <td className="px-4 py-2.5">{periodeLabel(m.monat, locale)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{geld(m.erloese, daten.currency)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{geld(m.aufwand, daten.currency)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${Number(m.ergebnis) < 0 ? "text-destructive" : ""}`}>
                  {geld(m.ergebnis, daten.currency)}
                </td>
              </tr>
            ))}
            <tr className="bg-secondary/40 font-semibold">
              <td className="px-4 py-2.5">{t("berichtePage.guv.jahr", { jahr: daten.jahr })}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{geld(daten.erloeseNetto, daten.currency)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{geld(daten.aufwandGesamt, daten.currency)}</td>
              <td className={`px-4 py-2.5 text-right tabular-nums ${ergebnisTon}`}>{geld(daten.ergebnis, daten.currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
