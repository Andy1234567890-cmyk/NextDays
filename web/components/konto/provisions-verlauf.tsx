"use client";

// Provisions-Monatsverlauf — was wird wann eingezogen. Aufbau wie der
// Rechnungsverlauf, damit beide Ansichten sich gleich anfühlen.
//
// Die Provision eines Monats wird am 1. des Folgemonats über die hinterlegte
// Zahlungsmethode eingezogen; `charge_date` kommt fertig vom Server, damit im
// Frontend keine zweite Datumsrechnung entsteht.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { formatCurrency } from "@/lib/currency";
import { getCommissionMonths, type CommissionMonth } from "@/lib/subscriptions";

const STATUS: Record<
  CommissionMonth["status"],
  { label: string; klasse: string }
> = {
  invoiced: { label: "Abgerechnet", klasse: "bg-emerald-500/15 text-emerald-600" },
  pending: { label: "Wird eingezogen", klasse: "bg-amber-500/15 text-amber-600" },
  mixed: { label: "Teilweise offen", klasse: "bg-sky-500/15 text-sky-600" },
};

function monatsName(period: string, locale: string): string {
  const [jahr, monat] = period.split("-").map(Number);
  // Tag 1 ist willkürlich — es geht nur um Monat + Jahr in der Anzeige.
  return new Date(jahr, monat - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

export function ProvisionsVerlauf({ onBack }: { onBack: () => void }) {
  const t = useTranslations("account");
  const locale = useLocale();
  const [rows, setRows] = useState<CommissionMonth[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await getCommissionMonths(36);
      if (res.ok) setRows(res.data);
      else setError(res.error);
    })();
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <Icon icon="lucide:chevron-left" className="size-4" />
        Abrechnung
      </button>

      <div>
        <h2 className="font-display text-xl font-extrabold">
          Provisionen je Monat
        </h2>
        <p className="text-sm text-muted-foreground">
          Provisionen aus Buchungen über externe Portale. Der Betrag eines
          Monats wird am 1. des Folgemonats über Ihre hinterlegte
          Zahlungsmethode eingezogen.
        </p>
      </div>

      {error && (
        <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!rows && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon icon="svg-spinners:180-ring" className="size-4" />
          Provisionen werden geladen …
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Es sind noch keine Provisionen angefallen. Buchungen über Ihre eigene
          Website bleiben dauerhaft provisionsfrei.
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Monat</th>
                <th className="px-4 py-3 font-medium">Buchungen</th>
                <th className="px-4 py-3 font-medium">Buchungsumsatz</th>
                <th className="px-4 py-3 font-medium">Provision</th>
                <th className="px-4 py-3 font-medium">{t("commissions.chargedOn")}</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = STATUS[r.status];
                return (
                  <tr
                    key={r.period}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">
                      {monatsName(r.period, locale)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.booking_count}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {/* Gemischte Währungen werden nicht addiert (Wurzel 4) —
                          dann steht die Summe ohne Symbol da. */}
                      {formatCurrency(r.gross_total, r.currency)}
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums">
                      {formatCurrency(r.commission_total, r.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <Icon
                          icon="lucide:calendar"
                          className="size-3.5 text-muted-foreground"
                        />
                        {new Date(r.charge_date).toLocaleDateString(locale, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-0.5 text-xs font-semibold ${st.klasse}`}
                      >
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows && rows.some((r) => r.currency === null) && (
        <p className="text-sm text-muted-foreground">
          Monate mit Buchungen in mehreren Währungen werden ohne Gesamtsumme
          angezeigt — die Einzelbeträge stehen in der jeweiligen Rechnung.
        </p>
      )}
    </div>
  );
}
