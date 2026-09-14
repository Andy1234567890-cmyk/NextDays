"use client";

// Verteilung des Netto-Umsatzes über Kunden/Objekte/Kanäle: liegende Balken
// (Rang ist die Aussage) plus Tabelle mit Anteil. Farbe folgt der Reihe,
// nicht dem Rang: eine Farbe je Balkenreihe, Identität steht im Label.
import { useTranslations } from "next-intl";

import { Card } from "@nextdays/ui/card";
import type { ChartConfig } from "@nextdays/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  XAxis,
  YAxis,
} from "@nextdays/ui/chart";
import type { RevenueResponse } from "@/lib/buchhaltung-berichte-typen";

import { geld, zahl } from "./format";

const MAX_BALKEN = 8;

export function Verteilung({
  titel,
  daten,
  farbe,
}: {
  titel: string;
  daten: RevenueResponse;
  farbe: string;
}) {
  const t = useTranslations("finance");
  const gesamt = daten.reihen.reduce((a, r) => a + zahl(r.summeNetto), 0);
  const kopf = daten.reihen.slice(0, MAX_BALKEN);
  const rest = daten.reihen.slice(MAX_BALKEN);
  const zeilen = [
    ...kopf.map((r) => ({ key: r.key, label: r.label, netto: zahl(r.summeNetto), anzahl: r.punkte.reduce((a, p) => a + p.anzahl, 0) })),
    ...(rest.length
      ? [{
          key: "__weitere",
          label: t("statistikPage.weitere", { anzahl: rest.length }),
          netto: rest.reduce((a, r) => a + zahl(r.summeNetto), 0),
          anzahl: rest.reduce((a, r) => a + r.punkte.reduce((b, p) => b + p.anzahl, 0), 0),
        }]
      : []),
  ];
  const config: ChartConfig = { netto: { label: t("statistikPage.netto"), color: farbe } };
  const format = (v: unknown) => geld(typeof v === "number" ? v : Number(v), daten.currency);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <h3 className="font-semibold">{titel}</h3>
      {zeilen.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("berichteGemeinsam.keineDaten")}</p>
      ) : (
        <>
          <ChartContainer config={config} className="aspect-auto w-full" style={{ height: `${Math.max(3, zeilen.length) * 2.25}rem` }}>
            <BarChart data={zeilen} layout="vertical" margin={{ left: 4, right: 12 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" width={140} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => format(v)} hideLabel />} />
              <Bar dataKey="netto" fill="var(--color-netto)" radius={[0, 4, 4, 0]} barSize={14} />
            </BarChart>
          </ChartContainer>
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 font-medium">{t("statistikPage.name")}</th>
                <th className="py-2 text-right font-medium">{t("statistikPage.belege")}</th>
                <th className="py-2 text-right font-medium">{t("statistikPage.netto")}</th>
                <th className="py-2 text-right font-medium">{t("statistikPage.anteil")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {zeilen.map((z) => (
                <tr key={z.key}>
                  <td className="py-2">{z.label}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">{z.anzahl}</td>
                  <td className="py-2 text-right tabular-nums">{geld(z.netto, daten.currency)}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    {gesamt === 0 ? "—" : `${((z.netto / gesamt) * 100).toFixed(1)} %`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  );
}
