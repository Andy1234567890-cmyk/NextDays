"use client";

// Export-Historie (Buchhaltung → DATEV): jeder Lauf mit Zeitraum, Typ,
// Belegarten, Anzahl, Größe, Warnungen und Download. Der Download läuft über
// den Next-Proxy (/api/v1/…), der den Bearer aus dem httpOnly-Cookie setzt
// und Content-Disposition durchreicht — der Bucket selbst ist privat.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";

import { Card } from "@nextdays/ui/card";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import type { Belegart, ExportLauf } from "@/lib/buchhaltung-datev-typen";
import { formatDate, formatDateTime } from "@/lib/utils";

function groesse(bytes: number, locale: string): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} MB`;
}

export function DatevExportHistorie({ laeufe }: { laeufe: ExportLauf[] }) {
  const t = useTranslations("finance");
  const locale = useLocale();

  if (laeufe.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
          <Icon icon="ph:export" className="size-7 text-muted-foreground" />
        </span>
        <div>
          <p className="font-display text-lg font-extrabold">{t("datevPage.history.emptyTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("datevPage.history.emptySubtitle")}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t("datevPage.history.columnCreated")}</th>
              <th className="px-4 py-3 font-medium">{t("datevPage.history.columnType")}</th>
              <th className="px-4 py-3 font-medium">{t("datevPage.history.columnPeriod")}</th>
              <th className="px-4 py-3 font-medium">{t("datevPage.history.columnBelegarten")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("datevPage.history.columnCount")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("datevPage.history.columnSize")}</th>
              <th className="px-4 py-3 font-medium">{t("datevPage.history.columnFile")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {laeufe.map((l) => (
              <tr key={l.id} className="transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3 text-muted-foreground">{formatDateTime(l.createdAt, locale)}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                    {l.exportType === "buchungsstapel"
                      ? t("datevPage.export.typeBuchungsstapel")
                      : t("datevPage.export.typeStammdaten")}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">{l.kontenrahmen}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(l.dateFrom, locale)} – {formatDate(l.dateTo, locale)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {l.belegarten.length === 0
                    ? "—"
                    : l.belegarten.map((a) => t(`datevPage.belegart.${a as Belegart}`)).join(", ")}
                </td>
                <td className="px-4 py-3 text-right font-medium">{l.anzahl}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{groesse(l.groesse, locale)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/v1/buchhaltung/datev/exports/${l.id}/download`}
                      download={l.dateiname}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
                    >
                      <Icon icon="ph:download-simple" className="size-4" />
                      {t("datevPage.history.download")}
                    </a>
                    {l.warnungen.length > 0 && (
                      <InfoHinweis
                        titel={t("datevPage.history.warningsTitle", { anzahl: l.warnungen.length })}
                        text={l.warnungen.slice(0, 20)}
                        ariaLabel={t("datevPage.history.warningsAria")}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
