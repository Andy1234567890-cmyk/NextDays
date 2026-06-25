"use client";

// „Manage statements": Liste aller Statements mit Status, Owner-Payout und
// Aktionen (öffnen, löschen). Entspricht dem Hostaway-Tab „Manage statements".
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import {
  deleteStatement,
  type StatementListItem,
} from "@/lib/owner-statements";

export function StatementManage({
  items,
  onOpen,
  onListChange,
}: {
  items: StatementListItem[];
  onOpen: (id: string) => void;
  onListChange: (fn: (prev: StatementListItem[]) => StatementListItem[]) => void;
}) {
  const t = useTranslations("ownerStatements");

  async function remove(id: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    const res = await deleteStatement(id);
    if (res.ok) {
      onListChange((prev) => prev.filter((i) => i.id !== id));
      toast.success(t("deleted"));
    } else toast.error(res.error);
  }

  if (items.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
          <Icon icon="ph:list-bullets" className="size-7 text-muted-foreground" />
        </span>
        <p className="font-display text-lg font-extrabold">{t("manage.emptyTitle")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{t("manage.emptyHint")}</p>
      </Card>
    );
  }

  return (
    <Card className="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="px-5 py-3 font-medium">{t("manage.owner")}</th>
              <th className="px-5 py-3 font-medium">{t("manage.period")}</th>
              <th className="px-5 py-3 font-medium">{t("manage.status")}</th>
              <th className="px-5 py-3 text-right font-medium">{t("summary.ownerPayout")}</th>
              <th className="px-5 py-3 text-right font-medium">{t("summary.pmPayout")}</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium">{s.owner_name ?? "—"}</td>
                <td className="px-5 py-3">
                  {s.period_from} – {s.period_to}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      s.status === "finalized"
                        ? "bg-foreground text-background"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {t(`status.${s.status}`)}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">{formatCurrency(s.owner_payout, s.currency)}</td>
                <td className="px-5 py-3 text-right">{formatCurrency(s.pm_payout, s.currency)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onOpen(s.id)}
                      aria-label={t("manage.open")}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Icon icon="ph:arrow-square-out" className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(s.id)}
                      aria-label={t("delete")}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Icon icon="ph:trash" className="size-4" />
                    </button>
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
