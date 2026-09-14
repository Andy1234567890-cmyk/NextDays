"use client";

// Reiter „Belege" der Kundendetailseite: die letzten Belege des Kunden aus
// `GET /customers/{id}/overview` (serverseitig gerechnet, Decimal).
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";

import { Card } from "@nextdays/ui/card";
import type { UebersichtBeleg } from "@/lib/buchhaltung-kontakte-typen";
import { formatCurrency } from "@/lib/currency";

const STATUS_CLASSES: Record<string, string> = {
  draft: "bg-secondary text-secondary-foreground",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  finalized: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  overdue: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
};

export function BelegeTab({ belege, gesamt }: { belege: UebersichtBeleg[]; gesamt: number }) {
  const t = useTranslations("finance");
  const locale = useLocale();

  const datum = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(locale).format(new Date(iso)) : "—";
  const geld = (wert: string, currency: string) => {
    const n = Number(wert);
    return formatCurrency(Number.isFinite(n) ? n : 0, currency, locale);
  };
  const statusText = (s: string) => {
    const key = `kontaktePage.status.${s}`;
    return t.has(key) ? t(key) : s;
  };

  if (belege.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-10 text-center">
        <Icon icon="ph:receipt" className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("kontaktePage.belege.empty")}</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t("kontaktePage.belege.number")}</th>
              <th className="px-4 py-3 font-medium">{t("kontaktePage.belege.type")}</th>
              <th className="px-4 py-3 font-medium">{t("kontaktePage.belege.date")}</th>
              <th className="px-4 py-3 font-medium">{t("kontaktePage.belege.due")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("kontaktePage.belege.gross")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("kontaktePage.belege.open")}</th>
              <th className="px-4 py-3 font-medium">{t("kontaktePage.belege.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {belege.map((b) => (
              <tr key={b.id} className="transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3 font-medium">
                  {b.invoiceNumber || (
                    <span className="text-muted-foreground">{t("kontaktePage.belege.draft")}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {t.has(`kontaktePage.belege.types.${b.invoiceType}`)
                    ? t(`kontaktePage.belege.types.${b.invoiceType}`)
                    : b.invoiceType}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{datum(b.issueDate)}</td>
                <td className={`px-4 py-3 ${b.isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                  {datum(b.dueDate)}
                </td>
                <td className="px-4 py-3 text-right font-medium">{geld(b.grossAmount, b.currency)}</td>
                <td className="px-4 py-3 text-right">
                  {Number(b.openAmount) > 0 ? geld(b.openAmount, b.currency) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[b.status] ?? "bg-secondary text-secondary-foreground"}`}
                  >
                    {statusText(b.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {gesamt > belege.length && (
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">
          {t("kontaktePage.belege.showing", { shown: belege.length, total: gesamt })}
        </p>
      )}
    </Card>
  );
}
