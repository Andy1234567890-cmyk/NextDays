// Offene Posten Debitoren: Alterungsstruktur als Kacheln + Liste, älteste
// Fälligkeit zuerst (sortiert vom Server nach Belegdatum, Wurzel 5b).
import { useLocale, useTranslations } from "next-intl";

import { Card } from "@nextdays/ui/card";
import type { Bucket, OpenItemsResponse } from "@/lib/buchhaltung-berichte-typen";

import { datum, geld } from "./format";

const BUCKET_TON: Record<Bucket, string> = {
  nicht_faellig: "text-muted-foreground",
  "0-30": "text-foreground",
  "31-60": "text-amber-700 dark:text-amber-400",
  "61-90": "text-orange-700 dark:text-orange-400",
  ">90": "text-destructive",
  ohne_faelligkeit: "text-muted-foreground",
};

export function OpListe({ daten }: { daten: OpenItemsResponse }) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const bucketLabel = (b: Bucket) => t(`listenPage.bucket.${b.replace(">", "ueber")}`);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {daten.buckets.map((b) => (
          <Card key={b.bucket} className="p-4">
            <p className="text-xs text-muted-foreground">{bucketLabel(b.bucket)}</p>
            <p className={`font-display text-lg font-extrabold tabular-nums ${BUCKET_TON[b.bucket]}`}>
              {geld(b.offen, daten.currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("listenPage.anzahlPosten", { anzahl: b.anzahl })}
            </p>
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden p-0">
        {daten.posten.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t("listenPage.keineOffenen")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("listenPage.rechnung")}</th>
                  <th className="px-4 py-3 font-medium">{t("listenPage.kunde")}</th>
                  <th className="px-4 py-3 font-medium">{t("listenPage.belegdatum")}</th>
                  <th className="px-4 py-3 font-medium">{t("listenPage.faellig")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("listenPage.alter")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("listenPage.brutto")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("listenPage.bezahlt")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("listenPage.offen")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {daten.posten.map((p) => (
                  <tr key={p.invoiceId} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-2.5 font-medium">{p.invoiceNumber ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.customerName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{datum(p.issueDate, locale)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{datum(p.dueDate, locale)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${BUCKET_TON[p.bucket]}`}>
                      {p.alterTage === null ? "—" : p.alterTage < 0 ? t("listenPage.inTagen", { tage: -p.alterTage }) : p.alterTage}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{geld(p.grossAmount, p.currency)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{geld(p.paidAmount, p.currency)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{geld(p.offen, p.currency)}</td>
                  </tr>
                ))}
                <tr className="bg-secondary/40 font-semibold">
                  <td className="px-4 py-2.5" colSpan={7}>
                    {t("listenPage.summe", { anzahl: daten.anzahl })}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{geld(daten.summeOffen, daten.currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
