"use client";

// Provisions-Monatsverlauf — was wird wann abgerechnet. Aufbau wie der
// Rechnungsverlauf, damit beide Ansichten sich gleich anfühlen.
//
// Diese Liste zeigt AUSSCHLIESSLICH die Provisionen externer Portale
// (commission_ledger). Die 8 % des myBestDays-Marktplatzes werden direkt beim
// Zahlungseingang über die Stripe-application_fee einbehalten
// (payments/service.py) und stehen deshalb nie im Ledger — ohne diesen Hinweis
// liest ein Betrieb mit Marktplatz-Buchungen hier „keine Provisionen".
//
// `charge_date` ist der FAKTURIERUNGS-Tag (1. des Folgemonats), NICHT der
// Belastungstag: bill_pending_commissions legt nur ein Stripe-Invoice-Item an,
// das mit der nächsten regulären Abo-Rechnung mitläuft (Docstrings
// subscriptions/service.py `_einzugstag`, schemas.py `CommissionMonth`).
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { formatCurrency } from "@/lib/currency";
import {
  getCommissionMonths,
  type CommissionMonth,
  type CommissionStatus,
} from "@/lib/subscriptions";

// Die Map muss ALLE Werte von `CommissionStatus` tragen — `Record` über die
// Union macht den Zugriff total, ein Fallback wäre toter Code. Kommt im DB-Enum
// `commission_status` (0006) ein Wert dazu, MUSS er hier ergänzt werden; tsc
// erzwingt das dann. Genau dieses Netz fehlte, als 'paid' zum Absturz führte.
// 'pending' heißt „noch nicht fakturiert" — nicht „wird gerade eingezogen":
// der Einzug passiert erst mit der nächsten Abo-Rechnung. Der Text steht als
// i18n-Key hier, nicht als deutscher Literal.
const STATUS: Record<CommissionStatus, { key: string; klasse: string }> = {
  invoiced: {
    key: "commissions.statusInvoiced",
    klasse: "bg-emerald-500/15 text-emerald-600",
  },
  paid: {
    key: "commissions.statusPaid",
    klasse: "bg-emerald-500/15 text-emerald-600",
  },
  pending: {
    key: "commissions.statusPending",
    klasse: "bg-amber-500/15 text-amber-600",
  },
  mixed: {
    key: "commissions.statusMixed",
    klasse: "bg-sky-500/15 text-sky-600",
  },
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
  const locale = useLocale();
  const t = useTranslations("account");
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
        {t("commissions.backToBilling")}
      </button>

      <div>
        <h2 className="font-display text-xl font-extrabold">
          {t("commissions.monthsTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("commissions.monthsIntro")}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("commissions.monthsChannels")}
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
          {t("commissions.monthsLoading")}
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {t("commissions.monthsEmpty")}
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">
                  {t("commissions.colMonth")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("commissions.colBookings")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("commissions.colGross")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("commissions.colCommission")}
                </th>
                {/* `chargedOn` heißt „Abgerechnet am": der 1. ist der
                    Fakturierungstag, nicht der Belastungstag. */}
                <th className="px-4 py-3 font-medium">
                  {t("commissions.chargedOn")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("commissions.colStatus")}
                </th>
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
                        {t(st.key)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Die Tabelle zeigt die UNGEKAPPTEN Ledger-Beträge — der Deckel greift
          erst beim Fakturieren (bill_pending_commissions). Ohne diesen Hinweis
          wirkt die kleinere Belastung später wie ein Fehler. Der konkrete
          Deckelbetrag liegt hier nicht vor und wird nicht erfunden (Wurzel 4);
          er steht in der Übersichtskarte der Abrechnung. */}
      {rows && rows.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t("commissions.capHint")}
        </p>
      )}

      {rows && rows.some((r) => r.currency === null) && (
        <p className="text-sm text-muted-foreground">
          {t("commissions.mixedCurrencyHint")}
        </p>
      )}
    </div>
  );
}
