"use client";

// Geplante Berichte: Name · Häufigkeit · Währung · Objekte · Empfänger · Aktiv.
//
// „Aktiv" steht als eigene Spalte und nicht nur im Detail: ein Plan, der nicht
// läuft, ist der häufigste Grund dafür, dass eine erwartete Abrechnung fehlt —
// das muss auf einen Blick sichtbar sein.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { deleteSchedule, type ScheduleListItem } from "@/lib/owner-reporting";

export function PlanListe({
  items,
  loadError,
}: {
  items: ScheduleListItem[];
  loadError: string | null;
}) {
  const t = useTranslations("ownerReporting.schedules");
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function entfernen(p: ScheduleListItem) {
    setBusyId(p.id);
    const res = await deleteSchedule(p.id);
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("deleted"));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-extrabold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/eigentuemer/reporting/geplant/neu">
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
              icon="ph:clock-clockwise"
              className="size-7 text-muted-foreground"
            />
          </span>
          <p className="font-display text-lg font-extrabold">{t("emptyTitle")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("emptyHint")}
          </p>
          <Button asChild>
            <Link href="/eigentuemer/reporting/geplant/neu">{t("new")}</Link>
          </Button>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left">
                <th className="px-4 py-3 font-semibold">{t("cols.name")}</th>
                <th className="px-4 py-3 font-semibold">
                  {t("cols.frequency")}
                </th>
                <th className="px-4 py-3 font-semibold">
                  {t("cols.currency")}
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  {t("cols.properties")}
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  {t("cols.recipients")}
                </th>
                <th className="px-4 py-3 font-semibold">{t("cols.active")}</th>
                <th className="px-4 py-3 font-semibold">{t("cols.lastRun")}</th>
                <th className="px-4 py-3 text-right font-semibold">
                  {t("cols.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/30"
                >
                  <td className="px-4 py-3 font-semibold">
                    <Link
                      href={`/eigentuemer/reporting/geplant/${p.id}`}
                      className="hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{t(`frequency.${p.rhythmus}`)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.currency}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {p.property_count}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {p.recipient_count}
                  </td>
                  <td className="px-4 py-3">
                    {p.aktiv ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium">
                        <Icon icon="ph:play-circle" className="size-3.5" />
                        {t("activeYes")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Icon icon="ph:pause-circle" className="size-3.5" />
                        {t("activeNo")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {/* „—" heißt: der Plan hat noch nie gelaufen. Ein Datum zu
                        erfinden (etwa das Anlagedatum) wäre eine Falschaussage
                        über einen Vorgang, den es nicht gab. */}
                    {p.zuletzt_erzeugt_fuer ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/eigentuemer/reporting/geplant/${p.id}`}>
                          {t("details")}
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${t("delete")} — ${p.name}`}
                        disabled={busyId === p.id}
                        className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => void entfernen(p)}
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
    </div>
  );
}
