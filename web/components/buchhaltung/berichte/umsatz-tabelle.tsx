// Die Zeitreihe als Tabelle (Reihe × Periode) — Tabellenansicht ist Pflicht
// neben jedem Diagramm (Barrierefreiheit; die Zahl ist die Wahrheit).
import { useLocale, useTranslations } from "next-intl";

import type { RevenueResponse } from "@/lib/buchhaltung-berichte-typen";

import { geld, periodeLabel } from "./format";

export function UmsatzTabelle({ daten }: { daten: RevenueResponse }) {
  const t = useTranslations("finance");
  const locale = useLocale();
  if (daten.reihen.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">{t("umsatzPage.reihe")}</th>
            {daten.perioden.map((p) => (
              <th key={p} className="px-4 py-3 text-right font-medium">
                {periodeLabel(p, locale)}
              </th>
            ))}
            <th className="px-4 py-3 text-right font-medium">{t("umsatzPage.summe")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {daten.reihen.map((r) => (
            <tr key={r.key}>
              <td className="px-4 py-2.5 font-medium">{r.label}</td>
              {daten.perioden.map((p) => (
                <td key={p} className="px-4 py-2.5 text-right tabular-nums">
                  {geld(r.punkte.find((x) => x.periode === p)?.netto ?? 0, daten.currency)}
                </td>
              ))}
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                {geld(r.summeNetto, daten.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
