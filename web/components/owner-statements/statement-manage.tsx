"use client";

// „Manage statements": Liste aller Statements mit Status, Owner-Payout und
// Aktionen (öffnen, löschen). Entspricht dem Hostaway-Tab „Manage statements".
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Card } from "@nextdays/ui/card";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
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
              <th className="px-5 py-3 font-medium">
                <span className="flex items-center gap-1.5">
                  {t("manage.status")}
                  <InfoHinweis
                    titel={t("info.status.title")}
                    text={[
                      t("info.status.draft"),
                      t("info.status.finalized"),
                      t("info.status.cancelled"),
                    ]}
                    ariaLabel={t("info.aria", { feld: t("manage.status") })}
                  />
                </span>
              </th>
              <th className="px-5 py-3 text-right font-medium">
                <span className="flex items-center justify-end gap-1.5">
                  {t("summary.ownerPayout")}
                  <InfoHinweis
                    text={[t("info.ownerPayout"), t("info.dash.meaning")]}
                    ariaLabel={t("info.aria", { feld: t("summary.ownerPayout") })}
                  />
                </span>
              </th>
              <th className="px-5 py-3 text-right font-medium">
                <span className="flex items-center justify-end gap-1.5">
                  {t("summary.pmPayout")}
                  <InfoHinweis
                    text={[t("info.pmPayout"), t("info.dash.meaning")]}
                    ariaLabel={t("info.aria", { feld: t("summary.pmPayout") })}
                  />
                </span>
              </th>
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
                {/* `null` = nicht berechenbar (kein Provisionssatz). Als „—", nie als
                    0,00 — sonst behauptet die Liste eine Auszahlung von null
                    Kronen, wo nur der Satz fehlt (Wurzel 4). */}
                <td className="px-5 py-3 text-right">{s.owner_payout == null ? "—" : formatCurrency(s.owner_payout, s.currency)}</td>
                <td className="px-5 py-3 text-right">{s.pm_payout == null ? "—" : formatCurrency(s.pm_payout, s.currency)}</td>
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
