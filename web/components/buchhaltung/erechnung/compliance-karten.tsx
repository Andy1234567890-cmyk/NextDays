// Compliance-Übersicht (Server-Komponente): Anteil ausgestellter Rechnungen mit
// gültiger E-Rechnung im Zeitraum, dazu die Lücken je Kunde (E-Mail/Leitweg-ID).
import { Icon } from "@iconify/react";
import { getLocale, getTranslations } from "next-intl/server";

import { Card } from "@nextdays/ui/card";
import type { Compliance } from "@/lib/buchhaltung-erechnung-typen";

import { formatDate } from "./darstellung";

function Kachel({
  label,
  wert,
  icon,
  ton,
}: {
  label: string;
  wert: string;
  icon: string;
  ton?: string;
}) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span
        className={`flex size-11 shrink-0 items-center justify-center rounded-full ${ton ?? "bg-secondary"}`}
      >
        <Icon icon={icon} aria-hidden className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-display text-2xl font-extrabold">{wert}</p>
      </div>
    </Card>
  );
}

export async function ComplianceKarten({ daten }: { daten: Compliance }) {
  const t = await getTranslations("finance");
  const locale = await getLocale();
  const anteil =
    daten.validSharePercent === null
      ? "—"
      : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(daten.validSharePercent)} %`;
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-extrabold">{t("eRechnungPage.complianceTitle")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("eRechnungPage.complianceRange", {
            from: formatDate(daten.fromDate, locale),
            to: formatDate(daten.toDate, locale),
          })}
          {daten.mandatoryFrom
            ? ` · ${t("eRechnungPage.mandatoryFromLabel")}: ${formatDate(daten.mandatoryFrom, locale)}`
            : ""}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kachel
          label={t("eRechnungPage.kpiShare")}
          wert={anteil}
          icon="ph:chart-pie-slice"
          ton="bg-accent/15 text-accent"
        />
        <Kachel
          label={t("eRechnungPage.kpiValid")}
          wert={String(daten.withValidEinvoice)}
          icon="ph:seal-check"
          ton="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
        />
        <Kachel
          label={t("eRechnungPage.kpiInvalid")}
          wert={String(daten.withInvalidEinvoice)}
          icon="ph:warning-circle"
          ton="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
        />
        <Kachel
          label={t("eRechnungPage.kpiWithout")}
          wert={`${daten.withoutEinvoice} / ${daten.invoicesTotal}`}
          icon="ph:file-dashed"
        />
      </div>
      {daten.customerGaps.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-medium">{t("eRechnungPage.gapsTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("eRechnungPage.gapsSubtitle")}</p>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">{t("eRechnungPage.columnCustomer")}</th>
                <th className="px-4 py-2 font-medium">{t("eRechnungPage.columnInvoices")}</th>
                <th className="px-4 py-2 font-medium">{t("eRechnungPage.columnMissing")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {daten.customerGaps.map((g) => (
                <tr key={g.customerId}>
                  <td className="px-4 py-2 font-medium">{g.customerName}</td>
                  <td className="px-4 py-2 text-muted-foreground">{g.invoiceCount}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {g.missingEmail && (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          {t("eRechnungPage.missingEmail")}
                        </span>
                      )}
                      {g.missingLeitwegId && (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          {t("eRechnungPage.missingLeitweg")}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}
