"use client";

// Umsatzsteuer-Auswertung einer Periode: neutrale Zeilen (jedes Land), darunter
// bei Land DE die Kennzahlen-Zuordnung (Kz 81/86/66/83 …) aus dem Backend.
// Die Komponente rechnet NICHTS — sie formatiert, was der Server liefert.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@nextdays/ui/card";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import type { SalesCategory, VatReturn } from "@/lib/buchhaltung-steuer-typen";
import { formatCurrency } from "@/lib/currency";

export function geld(betrag: string | null | undefined, currency: string): string {
  const n = Number(betrag);
  return formatCurrency(Number.isFinite(n) ? n : 0, currency);
}

export function satzText(rate: string | null): string {
  if (rate === null || rate === undefined || rate === "") return "—";
  return `${Number(rate).toLocaleString()} %`;
}

export function UstvaTabelle({ data }: { data: VatReturn }) {
  const t = useTranslations("finance");
  const c = data.currency;
  const erstattung = Number(data.payable) < 0;

  const kategorie = (k: SalesCategory): string =>
    t.has(`steuerPage.category_${k}`) ? t(`steuerPage.category_${k}`) : k;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kachel titel={t("steuerPage.salesTax")} wert={geld(data.salesTaxTotal, c)} />
        <Kachel titel={t("steuerPage.inputTax")} wert={geld(data.inputTaxTotal, c)} />
        <Kachel
          titel={erstattung ? t("steuerPage.refund") : t("steuerPage.payable")}
          wert={geld(data.payable, c)}
          betont
          hinweis={t("steuerPage.payableHint")}
        />
      </div>

      {data.warnings.length > 0 && (
        <Card className="border-amber-300/60 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="flex flex-col gap-1 py-3 text-sm">
            {data.warnings.map((w) => (
              <div key={w} className="flex items-start gap-2">
                <Icon icon="ph:warning" className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <span>{w}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <CardHeader className="px-4 pt-4">
          <CardTitle className="text-base">{t("steuerPage.salesTitle")}</CardTitle>
        </CardHeader>
        <table className="w-full text-sm">
          <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">{t("steuerPage.columnCategory")}</th>
              <th className="px-4 py-2 font-medium">{t("steuerPage.columnRate")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("steuerPage.columnCount")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("steuerPage.columnNet")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("steuerPage.columnTax")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.sales.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  {t("steuerPage.noSales")}
                </td>
              </tr>
            )}
            {data.sales.map((z) => (
              <tr key={`${z.category}-${z.taxRate ?? "x"}`}>
                <td className="px-4 py-2">{kategorie(z.category)}</td>
                <td className="px-4 py-2 text-muted-foreground">{satzText(z.taxRate)}</td>
                <td className="px-4 py-2 text-right text-muted-foreground">{z.invoiceCount}</td>
                <td className="px-4 py-2 text-right">{geld(z.net, c)}</td>
                <td className="px-4 py-2 text-right">{geld(z.tax, c)}</td>
              </tr>
            ))}
            {data.inputTax.map((z) => (
              <tr key={`in-${z.taxRate ?? "x"}`} className="bg-secondary/20">
                <td className="px-4 py-2">{t("steuerPage.inputTaxRow")}</td>
                <td className="px-4 py-2 text-muted-foreground">{satzText(z.taxRate)}</td>
                <td className="px-4 py-2 text-right text-muted-foreground">{z.expenseCount}</td>
                <td className="px-4 py-2 text-right">{geld(z.net, c)}</td>
                <td className="px-4 py-2 text-right">−{geld(z.tax, c)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t font-medium">
            <tr>
              <td className="px-4 py-2" colSpan={3}>
                {t("steuerPage.totalRow")}
              </td>
              <td className="px-4 py-2 text-right">{geld(data.salesNetTotal, c)}</td>
              <td className="px-4 py-2 text-right">{geld(data.payable, c)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>

      {data.mappingScheme === "DE_USTVA" && data.mapping.length > 0 && (
        <Card className="overflow-hidden p-0">
          <CardHeader className="flex-row items-center gap-2 px-4 pt-4">
            <CardTitle className="text-base">{t("steuerPage.deMappingTitle")}</CardTitle>
            <InfoHinweis ariaLabel={t("steuerPage.deMappingTitle")} text={t("steuerPage.deMappingHint")} />
          </CardHeader>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {data.mapping.map((m) => (
                <tr key={m.code} className={m.kind === "result" ? "font-semibold" : ""}>
                  <td className="w-20 px-4 py-2 font-mono text-muted-foreground">Kz {m.code}</td>
                  <td className="px-4 py-2">{m.label}</td>
                  <td className="px-4 py-2 text-right">{geld(m.amount, c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function Kachel({
  titel,
  wert,
  betont = false,
  hinweis,
}: {
  titel: string;
  wert: string;
  betont?: boolean;
  hinweis?: string;
}) {
  return (
    <Card className={betont ? "border-accent/40" : ""}>
      <CardContent className="flex flex-col gap-1 py-4">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {titel}
          {hinweis && <InfoHinweis ariaLabel={titel} text={hinweis} className="size-4" />}
        </div>
        <div className={`font-display text-xl font-extrabold ${betont ? "text-accent" : ""}`}>{wert}</div>
      </CardContent>
    </Card>
  );
}
