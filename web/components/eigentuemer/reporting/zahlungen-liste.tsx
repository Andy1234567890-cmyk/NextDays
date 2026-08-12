"use client";

// Zahlungen-Übersicht über ALLE Berichte hinweg:
// Bericht · Empfänger · Wert · bezahlter Prozentsatz · Rechnung · Aktionen.
//
// Der Filter „nur unbezahlte" läuft über den SERVER und nicht über ein
// clientseitiges `filter()`: der bezahlte Prozentsatz ist die Summe der
// Teilzahlungen geteilt durch den Betrag, und die Teilzahlungen liegen nicht
// in dieser Liste. Im Browser gefiltert stünde dort eine zweite, eigene
// Rechnung — die beim ersten Nachtrag einer Teilzahlung auseinanderläuft.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import { formatCurrency } from "@/lib/currency";
import {
  markPaymentPaid,
  type PaymentListItem,
} from "@/lib/owner-reporting";

export function ZahlungenListe({
  items,
  loadError,
  nurOffene,
}: {
  items: PaymentListItem[];
  loadError: string | null;
  nurOffene: boolean;
}) {
  const t = useTranslations("ownerReporting.payments");
  const locale = useLocale();
  const router = useRouter();
  const [suche, setSuche] = useState("");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Die Textsuche darf im Browser bleiben: sie filtert über Felder, die in der
  // Liste schon stehen (Berichts- und Empfängername). Anders als der
  // Bezahlt-Filter braucht sie keine Daten, die hier fehlen.
  const q = suche.trim().toLowerCase();
  const sichtbar = q
    ? items.filter(
        (p) =>
          p.report_name.toLowerCase().includes(q) ||
          (p.owner_name ?? "").toLowerCase().includes(q),
      )
    : items;

  async function alsBezahlt(p: PaymentListItem) {
    setBusyId(p.id);
    const res = await markPaymentPaid(p.id);
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("markedPaid"));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-extrabold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={nurOffene}
            disabled={pending}
            onChange={(e) =>
              startTransition(() =>
                router.push(
                  e.target.checked
                    ? "/eigentuemer/reporting/zahlungen?offen=1"
                    : "/eigentuemer/reporting/zahlungen",
                ),
              )
            }
          />
          {t("onlyUnpaid")}
        </label>
      </div>

      <Input
        value={suche}
        onChange={(e) => setSuche(e.target.value)}
        placeholder={t("search")}
      />

      {loadError ? (
        <Card className="p-5 text-sm text-destructive">{loadError}</Card>
      ) : sichtbar.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {items.length === 0 ? t("empty") : t("noMatch")}
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left">
                <th className="px-4 py-3 font-semibold">{t("cols.report")}</th>
                <th className="px-4 py-3 font-semibold">
                  {t("cols.recipient")}
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  {t("cols.amount")}
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  {t("cols.paidPct")}
                </th>
                <th className="px-4 py-3 font-semibold">{t("cols.invoice")}</th>
                <th className="px-4 py-3 text-right font-semibold">
                  {t("cols.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sichtbar.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/eigentuemer/reporting/zahlungen/${p.id}`}
                      className="font-semibold hover:underline"
                    >
                      {p.report_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.owner_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrency(p.betrag, p.currency, locale)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <BezahltAnteil pct={p.bezahlt_pct} />
                  </td>
                  <td className="px-4 py-3">
                    {p.has_invoice ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium">
                        <Icon icon="ph:receipt" className="size-3.5" />
                        {t("invoiceYes")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t("invoiceNo")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {p.bezahlt_pct < 100 && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === p.id}
                          onClick={() => void alsBezahlt(p)}
                        >
                          {busyId === p.id ? (
                            <Icon
                              icon="ph:spinner"
                              className="size-4 animate-spin"
                            />
                          ) : null}
                          {t("markPaid")}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/eigentuemer/reporting/zahlungen/${p.id}`}>
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

/**
 * Der bezahlte Anteil als Balken + Zahl.
 *
 * Der Wert kommt fertig vom Server. Ihn hier aus Betrag und Teilzahlungen
 * nachzurechnen hieße, dieselbe Division an zwei Stellen zu führen — und die
 * Liste kennt die Teilzahlungen gar nicht.
 */
function BezahltAnteil({ pct }: { pct: number }) {
  const voll = pct >= 100;
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
        <span
          className={`block h-full ${voll ? "bg-primary" : "bg-accent"}`}
          style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
        />
      </span>
      <span className="w-12 tabular-nums">{Math.round(pct)} %</span>
    </span>
  );
}
