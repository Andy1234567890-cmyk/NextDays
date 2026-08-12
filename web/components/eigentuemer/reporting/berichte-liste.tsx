"use client";

// Berichte-Übersicht — Tabelle wie im Branchenstandard:
// Name · Währung · Zwischen · Unterkünfte · Automatisch generiert · Aktionen.
//
// Bewusst eine TABELLE und keine Karten: die Spalten sind vergleichende Größen
// (welcher Monat, wie viele Objekte, automatisch oder von Hand). In Karten
// müsste man sie einzeln lesen, statt sie untereinander zu sehen.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { deleteReport, type ReportListItem } from "@/lib/owner-reporting";

export function BerichteListe({
  items,
  loadError,
}: {
  items: ReportListItem[];
  /** Grund, falls die Liste nicht geladen werden konnte. Ein Ladefehler ist
   *  NICHT „keine Berichte" — beides als leere Liste zu zeigen wäre eine
   *  Falschaussage (Wurzel 4). */
  loadError: string | null;
}) {
  const t = useTranslations("ownerReporting.reports");
  const [loeschen, setLoeschen] = useState<ReportListItem | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-extrabold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/eigentuemer/reporting/berichte/neu">
            <Icon icon="ph:plus" className="size-4" />
            {t("new")}
          </Link>
        </Button>
      </div>

      {loadError ? (
        <Card className="p-5 text-sm text-destructive">{loadError}</Card>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <Icon
              icon="ph:chart-line"
              className="size-7 text-muted-foreground"
            />
          </span>
          <p className="font-display text-lg font-extrabold">
            {t("emptyTitle")}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("emptyHint")}
          </p>
          <Button asChild>
            <Link href="/eigentuemer/reporting/berichte/neu">
              <Icon icon="ph:plus" className="size-4" />
              {t("new")}
            </Link>
          </Button>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left">
                <th className="px-4 py-3 font-semibold">{t("cols.name")}</th>
                <th className="px-4 py-3 font-semibold">
                  {t("cols.currency")}
                </th>
                <th className="px-4 py-3 font-semibold">{t("cols.period")}</th>
                <th className="px-4 py-3 text-right font-semibold">
                  {t("cols.properties")}
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  {t("cols.payments")}
                </th>
                <th className="px-4 py-3 font-semibold">{t("cols.auto")}</th>
                <th className="px-4 py-3 text-right font-semibold">
                  {t("cols.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/30"
                >
                  <td className="px-4 py-3 font-semibold">
                    <Link
                      href={`/eigentuemer/reporting/berichte/${r.id}`}
                      className="hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.currency}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {t("between", { from: r.period_from, to: r.period_to })}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.property_count}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.payment_count}
                  </td>
                  <td className="px-4 py-3">
                    {r.auto_generated ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                        <Icon icon="ph:clock-clockwise" className="size-3" />
                        {t("autoYes")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t("autoNo")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/eigentuemer/reporting/berichte/${r.id}`}
                        >
                          {t("details")}
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${t("delete")} — ${r.name}`}
                        className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setLoeschen(r)}
                      >
                        <Icon icon="ph:trash" className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {loeschen && (
        <BerichtLoeschenDialog
          report={loeschen}
          onClose={() => setLoeschen(null)}
        />
      )}
    </div>
  );
}

/**
 * Bestätigung vor dem Löschen.
 *
 * `router.refresh()` nach Erfolg ist hier PFLICHT und kein Notnagel: die
 * Reporting-Tabellen sind für `authenticated` gesperrt (0365, Wurzel 6) und
 * liegen nicht in `supabase_realtime` — es gibt keine Realtime-Quelle, die das
 * Delete-Ereignis tragen könnte. Ohne das Refresh bliebe die Zeile stehen.
 */
function BerichtLoeschenDialog({
  report,
  onClose,
}: {
  report: ReportListItem;
  onClose: () => void;
}) {
  const t = useTranslations("ownerReporting.reports");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const res = await deleteReport(report.id);
    if (res.ok) {
      toast.success(t("deleted"));
      onClose();
      router.refresh();
      return;
    }
    setBusy(false);
    // Auch der 409 („es bestehen Zahlungen") läuft hier durch — er ist die
    // Antwort des Servers und wird im Wortlaut gezeigt, statt in ein
    // allgemeines „Fehler" übersetzt zu werden.
    toast.error(res.error);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <div className="flex flex-col gap-4">
          <DialogTitle>{t("delete")}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-foreground">
                {report.name}
              </span>
              <span>{t("deleteConfirm")}</span>
            </div>
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void submit()}
              disabled={busy}
            >
              {busy ? (
                <Icon icon="ph:spinner" className="size-4 animate-spin" />
              ) : (
                <Icon icon="ph:trash" className="size-4" />
              )}
              {t("delete")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
