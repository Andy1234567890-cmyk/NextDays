"use client";

// Rechnungsverlauf — Tabelle aller Stripe-Rechnungen mit PDF-Download.
// Beträge kommen mit ihrer Währung aus Stripe und werden mit formatCurrency
// gerendert (kein €-Hardcode, Wurzel 4).
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { formatCurrency } from "@/lib/currency";
import { getInvoices, type InvoiceRow } from "@/lib/subscriptions";

// Stripe-Status → deutsches Label + Farbe. Unbekannte Status zeigen wir roh
// an, statt sie auf "bezahlt" zu raten.
const STATUS: Record<string, { label: string; klasse: string }> = {
  paid: { label: "Bezahlt", klasse: "bg-emerald-500/15 text-emerald-600" },
  open: { label: "Offen", klasse: "bg-amber-500/15 text-amber-600" },
  draft: { label: "Entwurf", klasse: "bg-muted text-muted-foreground" },
  uncollectible: { label: "Uneinbringlich", klasse: "bg-destructive/10 text-destructive" },
  void: { label: "Storniert", klasse: "bg-muted text-muted-foreground" },
};

export function Rechnungsverlauf({ onBack }: { onBack: () => void }) {
  const t = useTranslations("account");
  const locale = useLocale();
  const [rows, setRows] = useState<InvoiceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await getInvoices(50);
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
        <h2 className="font-display text-xl font-extrabold">Rechnungsverlauf</h2>
        <p className="text-sm text-muted-foreground">
          Überprüfen Sie Ihre Rechnungen und speichern Sie sie bei Bedarf ab.
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
          Rechnungen werden geladen …
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Es liegen noch keine Rechnungen vor.
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">{t("invoices.fees")}</th>
                <th className="px-4 py-3 font-medium">Ausstellungsdatum</th>
                <th className="px-4 py-3 font-medium">Gesamt</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Rechnung</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = r.status ? STATUS[r.status] : undefined;
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{r.number ?? r.id}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.description ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <Icon
                          icon="lucide:clock"
                          className="size-3.5 text-muted-foreground"
                        />
                        <span className="font-medium">
                          {new Date(r.created).toLocaleDateString(locale, {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {formatCurrency(r.total, r.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                          st?.klasse ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {st?.label ?? r.status ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.pdf_url ? (
                        <a
                          href={r.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex size-8 items-center justify-center rounded-full hover:bg-muted"
                          aria-label={`Rechnung ${r.number ?? r.id} herunterladen`}
                        >
                          <Icon icon="lucide:download" className="size-4" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
