"use client";

// Liste der E-Rechnungen mit Statusfilter; jede Zeile führt zur Detailseite.
// Kein Realtime: e_invoices ist für authenticated gesperrt (Wurzel 6), die
// Seite lädt nach eigener Aktion über router.refresh() neu.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { Card } from "@nextdays/ui/card";
import { NativeSelect } from "@nextdays/ui/native-select";
import type { EInvoice, ValidationStatus } from "@/lib/buchhaltung-erechnung-typen";

import { FORMAT_KEY, STATUS_CLASSES, STATUS_KEY, formatDate } from "./darstellung";

const ALLE = "__alle__";

export function EInvoiceListe({ items, locale }: { items: EInvoice[]; locale: string }) {
  const t = useTranslations("finance");
  const [filter, setFilter] = useState<string>(ALLE);
  const sichtbar = filter === ALLE ? items : items.filter((e) => e.validationStatus === filter);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg font-extrabold">{t("eRechnungPage.listTitle")}</h3>
        <div className="w-56">
          <NativeSelect
            aria-label={t("eRechnungPage.filterStatus")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value={ALLE}>{t("eRechnungPage.filterAll")}</option>
            {(Object.keys(STATUS_KEY) as ValidationStatus[]).map((s) => (
              <option key={s} value={s}>
                {t(STATUS_KEY[s])}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {sichtbar.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t("eRechnungPage.listEmptyFiltered")}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("eRechnungPage.columnInvoice")}</th>
                  <th className="px-4 py-3 font-medium">{t("eRechnungPage.columnCustomer")}</th>
                  <th className="px-4 py-3 font-medium">{t("eRechnungPage.columnFormat")}</th>
                  <th className="px-4 py-3 font-medium">{t("eRechnungPage.columnVersion")}</th>
                  <th className="px-4 py-3 font-medium">{t("eRechnungPage.columnGenerated")}</th>
                  <th className="px-4 py-3 font-medium">{t("eRechnungPage.columnStatus")}</th>
                  <th className="px-4 py-3 font-medium">{t("eRechnungPage.columnFindings")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sichtbar.map((e) => {
                  const fehler = e.findings.filter((f) => f.severity === "error").length;
                  const warnungen = e.findings.length - fehler;
                  return (
                    <tr key={e.id} className="transition-colors hover:bg-secondary/30">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/buchhaltung/e-rechnung/${e.id}`} className="hover:underline">
                          {e.invoiceNumber ?? e.invoiceId.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{e.customerName ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t(FORMAT_KEY[e.format])}</td>
                      <td className="px-4 py-3 text-muted-foreground">v{e.version}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(e.generatedAt, locale, true)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[e.validationStatus]}`}
                        >
                          {t(STATUS_KEY[e.validationStatus])}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {e.findings.length === 0
                          ? "—"
                          : t("eRechnungPage.findingsCount", { errors: fehler, warnings: warnungen })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/buchhaltung/e-rechnung/${e.id}`}
                          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                        >
                          {t("eRechnungPage.openDetail")}
                          <Icon icon="ph:arrow-right" aria-hidden className="size-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  );
}
