"use client";

// Empfänger-Übersicht: wer bekommt Geld, wie viel bisher, und gilt heute ein
// Abrechnungsvertrag.
//
// Die Empfänger sind die EIGENTÜMER (`/eigentuemer`) — hier wird nichts
// dupliziert, sondern ausgewertet. Ein zweiter Stammdatensatz „Empfänger"
// neben dem Eigentümer hätte zwei Bankverbindungen für dieselbe Person zur
// Folge, und niemand wüsste, welche gilt.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { formatCurrency } from "@/lib/currency";
import type { EmpfaengerZeile } from "@/lib/owner-reporting";

export function EmpfaengerListe({
  items,
  loadError,
}: {
  items: EmpfaengerZeile[];
  loadError: string | null;
}) {
  const t = useTranslations("ownerReporting.recipients");
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-extrabold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/eigentuemer">
            <Icon icon="ph:user-circle-gear" className="size-4" />
            {t("manageOwners")}
          </Link>
        </Button>
      </div>

      {loadError ? (
        <Card className="p-5 text-sm text-destructive">{loadError}</Card>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <Icon icon="ph:users" className="size-7 text-muted-foreground" />
          </span>
          <p className="font-display text-lg font-extrabold">{t("emptyTitle")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t("emptyHint")}</p>
          <Button asChild>
            <Link href="/eigentuemer">{t("manageOwners")}</Link>
          </Button>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left">
                <th className="px-4 py-3 font-semibold">{t("cols.name")}</th>
                <th className="px-4 py-3 font-semibold">{t("cols.email")}</th>
                <th className="px-4 py-3 text-right font-semibold">
                  {t("cols.properties")}
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  {t("cols.payments")}
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  {t("cols.volume")}
                </th>
                <th className="px-4 py-3 font-semibold">{t("cols.terms")}</th>
                <th className="px-4 py-3 text-right font-semibold">
                  {t("cols.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr
                  key={e.owner_id}
                  className="border-b border-border last:border-0 hover:bg-secondary/30"
                >
                  <td className="px-4 py-3 font-semibold">
                    <Link
                      href={`/eigentuemer/reporting/empfaenger/${e.owner_id}`}
                      className="hover:underline"
                    >
                      {e.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {e.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {e.property_count}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {e.payment_count}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {e.payment_total.length === 0 ? (
                      "—"
                    ) : (
                      // Je Währung eine eigene Zeile — nicht addiert.
                      <div className="flex flex-col items-end">
                        {e.payment_total.map((w) => (
                          <span key={w.currency}>
                            {formatCurrency(w.amount, w.currency, locale)}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {e.hat_vertrag ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium">
                        <Icon icon="ph:check-circle" className="size-3.5" />
                        {t("termsYes")}
                      </span>
                    ) : (
                      // Ohne Vertrag ist keine Zahlung berechenbar. Das steht
                      // hier, statt den Betreiber erst beim Erzeugen in einen
                      // 422 laufen zu lassen.
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                        <Icon icon="ph:warning" className="size-3.5" />
                        {t("termsNo")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/eigentuemer/reporting/empfaenger/${e.owner_id}`}
                        >
                          {t("details")}
                        </Link>
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
