"use client";

// Historie der eingefrorenen Meldungen: Periode, Version, Status, Zahllast,
// Export (CSV/JSON über den Next-Proxy /api/v1/buchhaltung/…, der das Session-
// Token server-seitig setzt) und „als eingereicht markieren".
// Keine ELSTER-Übertragung — bewusst: kein Zertifikat, kein ERiC. Der Export
// ist der ehrliche Weg, keine Attrappe „Übertragen".
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { EmptyState } from "@nextdays/ui/empty-state";
import { updateTaxReturn } from "@/lib/buchhaltung-steuer";
import type { ReturnStatus, TaxReturn } from "@/lib/buchhaltung-steuer-typen";
import { formatDate, formatDateTime } from "@/lib/utils";

import { geld } from "./ustva-tabelle";

const STATUS_CLASSES: Record<ReturnStatus, string> = {
  draft: "bg-secondary text-secondary-foreground",
  submitted: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  corrected: "bg-muted text-muted-foreground",
};

export function MeldungenHistorie({ items }: { items: TaxReturn[] }) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const statusLabel: Record<ReturnStatus, string> = {
    draft: t("steuerPage.statusDraft"),
    submitted: t("steuerPage.statusSubmitted"),
    corrected: t("steuerPage.statusCorrected"),
  };

  async function einreichen(id: string) {
    setBusy(id);
    const res = await updateTaxReturn(id, { status: "submitted" });
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("steuerPage.markedSubmitted"));
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon="ph:archive"
        titel={t("steuerPage.historyEmptyTitle")}
        text={t("steuerPage.historyEmptyText")}
      />
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">{t("steuerPage.columnPeriod")}</th>
            <th className="px-4 py-3 font-medium">{t("steuerPage.columnVersion")}</th>
            <th className="px-4 py-3 font-medium">{t("steuerPage.columnStatus")}</th>
            <th className="px-4 py-3 text-right font-medium">{t("steuerPage.payable")}</th>
            <th className="px-4 py-3 font-medium">{t("steuerPage.columnFrozenAt")}</th>
            <th className="px-4 py-3 font-medium">{t("steuerPage.columnSubmittedAt")}</th>
            <th className="px-4 py-3 text-right font-medium">{t("steuerPage.columnActions")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((m) => (
            <tr key={m.id} className="transition-colors hover:bg-secondary/30">
              <td className="px-4 py-3 font-medium">
                {m.period}
                <div className="text-xs text-muted-foreground">
                  {formatDate(m.periodStart, locale)} – {formatDate(m.periodEnd, locale)}
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">v{m.version}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[m.status]}`}
                >
                  {statusLabel[m.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-medium">{geld(m.payable, m.currency)}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatDateTime(m.createdAt, locale)}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {m.submittedAt ? formatDateTime(m.submittedAt, locale) : "—"}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <a
                    href={`/api/v1/buchhaltung/tax/export/${encodeURIComponent(m.id)}.csv`}
                    className="inline-flex h-9 items-center gap-1 rounded-full border border-border px-3 text-xs hover:bg-secondary"
                    title={t("steuerPage.exportCsv")}
                  >
                    <Icon icon="ph:file-csv" className="size-4" /> CSV
                  </a>
                  <a
                    href={`/api/v1/buchhaltung/tax/export/${encodeURIComponent(m.id)}.json`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-1 rounded-full border border-border px-3 text-xs hover:bg-secondary"
                    title={t("steuerPage.exportJson")}
                  >
                    <Icon icon="ph:brackets-curly" className="size-4" /> JSON
                  </a>
                  {m.status === "draft" && (
                    <Button
                      size="sm"
                      variant="accent"
                      className="rounded-full"
                      disabled={busy === m.id}
                      onClick={() => einreichen(m.id)}
                    >
                      {busy === m.id ? (
                        <Icon icon="ph:spinner" className="size-4 animate-spin" />
                      ) : (
                        <Icon icon="ph:check" className="size-4" />
                      )}
                      {t("steuerPage.markSubmitted")}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
