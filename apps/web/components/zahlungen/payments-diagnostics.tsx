"use client";

// Sichtbares Zahlungs-/Stripe-Debugging auf /konto: pingt Redis, DB und Stripe
// und zeigt den ROHEN Stripe-Connect-Status (currently_due/past_due/
// disabled_reason/pending_verification) im Klartext — damit sofort sichtbar ist,
// WAS klemmt (z. B. Redis-Timeout → 503, oder welches Feld Stripe wirklich
// verlangt), statt zu raten.
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState } from "react";

import {
  type PaymentsDiagnostics,
  getPaymentsDiagnostics,
} from "@/lib/payments";

export function PaymentsDiagnosticsPanel() {
  const [data, setData] = useState<PaymentsDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getPaymentsDiagnostics();
    setLoading(false);
    if (res.ok) {
      setData(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const acct = data?.stripe_account;

  return (
    <section className="flex flex-col gap-3 rounded-(--radius) border border-border p-4">
      <header className="flex items-center justify-between">
        <div className="flex flex-col">
          <h3 className="font-display text-base font-extrabold">
            Zahlungs-Diagnose
          </h3>
          <p className="text-sm text-muted-foreground">
            Live-Status von Redis, Datenbank und Stripe — plus was Stripe wirklich
            noch verlangt.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm font-medium text-accent hover:underline disabled:opacity-50"
        >
          <Icon
            icon="ph:arrows-clockwise"
            className={`size-4 ${loading ? "animate-spin" : ""}`}
          />
          Aktualisieren
        </button>
      </header>

      {error && (
        <p className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* System-Checks (Redis/DB/Stripe) */}
      {data && (
        <ul className="flex flex-col gap-1.5">
          {data.checks.map((c) => (
            <li
              key={c.name}
              className="flex items-start gap-2 rounded-(--radius) bg-muted/40 px-3 py-2 text-sm"
            >
              <Icon
                icon={c.ok ? "ph:check-circle-fill" : "ph:x-circle-fill"}
                className={`mt-0.5 size-4 shrink-0 ${
                  c.ok ? "text-emerald-600" : "text-destructive"
                }`}
              />
              <span className="flex-1">
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">
                  {" — "}
                  {c.detail}
                </span>
              </span>
              {c.duration_ms != null && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {c.duration_ms} ms
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Roher Stripe-Connect-Status */}
      {acct && (
        <div className="flex flex-col gap-2 rounded-(--radius) border border-border p-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <Flag label="charges_enabled" on={acct.charges_enabled} />
            <Flag label="payouts_enabled" on={acct.payouts_enabled} />
            <Flag label="details_submitted" on={acct.details_submitted} />
          </div>
          {acct.disabled_reason && (
            <p className="text-sm text-destructive">
              disabled_reason: <code>{acct.disabled_reason}</code>
            </p>
          )}
          <ReqList title="past_due (überfällig — blockiert!)" items={acct.past_due} tone="red" />
          <ReqList title="currently_due (jetzt fällig)" items={acct.currently_due} tone="amber" />
          <ReqList title="pending_verification (Stripe prüft)" items={acct.pending_verification} tone="blue" />
          <ReqList title="eventually_due (später)" items={acct.eventually_due} tone="gray" />
          {acct.errors.length > 0 && (
            <ReqList title="errors" items={acct.errors} tone="red" />
          )}
          {acct.account_id && (
            <p className="font-mono text-[11px] text-muted-foreground">
              {acct.account_id}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Flag({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono ${
        on
          ? "bg-emerald-100 text-emerald-700"
          : "bg-muted text-muted-foreground"
      }`}
    >
      <Icon icon={on ? "ph:check-bold" : "ph:minus-bold"} className="size-3" />
      {label}
    </span>
  );
}

const TONE: Record<string, string> = {
  red: "text-destructive",
  amber: "text-amber-600",
  blue: "text-blue-600",
  gray: "text-muted-foreground",
};

function ReqList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`text-xs font-medium ${TONE[tone]}`}>{title}</span>
      <ul className="flex flex-wrap gap-1">
        {items.map((r) => (
          <li
            key={r}
            className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
          >
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}
