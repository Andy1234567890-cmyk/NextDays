"use client";

// Abo-Abschnitt direkt auf der Konto-Seite (/konto) — kein eigener Tab
// (konto-alles-gebuendelt). Zeigt den aktuellen Tarif (Grundgebühr + Objekt-
// Staffel), die abrechenbare Objektzahl, gebuchte Zusatzmodule und erlaubt
// Abschluss/Verwaltung über Stripe Checkout bzw. Billing-Portal.
//
// Beträge kommen ausschließlich aus Stripe (getPricing) und werden mit
// formatCurrency gerendert — kein €-Hardcode. Realtime auf tenant_subscription
// + tenant_module_entitlement, damit Webhook-Änderungen sofort erscheinen.
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { getMe } from "@/lib/auth";
import { formatCurrency } from "@/lib/currency";
import {
  getCommissions,
  getPricing,
  getSubscriptionStatus,
  openBillingPortal,
  startCheckout,
  type CommissionSummary,
  type Pricing,
  type SubscriptionStatus,
} from "@/lib/subscriptions";
import { useRealtime } from "@/lib/use-realtime";

// Anzeige-Reihenfolge + Klartext der Zusatzmodule.
const MODULE_LABELS: Record<string, string> = {
  modul3_buchhaltung: "Buchhaltung",
  modul4_mitarbeiter: "Mitarbeiter",
  modul5_jobmarkt: "Jobmarkt",
  modul6_hotel: "Hotel",
};

type Loaded = {
  canManage: boolean;
  tenantId: string | null;
  status: SubscriptionStatus | null;
  pricing: Pricing | null;
  commissions: CommissionSummary | null;
  error: string | null;
};

// Baut aus den graduated-Tiers eine lesbare Staffel-Zeile, Beträge aus Stripe.
function tierLines(pricing: Pricing): string[] {
  const cur = pricing.currency;
  const lines: string[] = [];
  let prev = 0;
  pricing.grundtarif_tiers.forEach((t) => {
    const upTo = t.up_to;
    if (t.flat_amount != null) {
      lines.push(
        `Grundgebühr (inkl. 1. Objekt): ${formatCurrency(t.flat_amount / 100, cur)} / Monat`,
      );
    } else if (t.unit_amount != null) {
      const from = prev + 1;
      const range = upTo != null ? `${from}–${upTo}` : `ab ${from}`;
      lines.push(
        `Objekt ${range}: +${formatCurrency(t.unit_amount / 100, cur)} / Monat`,
      );
    }
    if (upTo != null) prev = upTo;
  });
  return lines;
}

export function KontoAboSection() {
  const [state, setState] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const me = await getMe();
    if (!me) {
      setState({
        canManage: false, tenantId: null, status: null, pricing: null,
        commissions: null, error: null,
      });
      return;
    }
    const canManage = me.capabilities.includes("manage_billing");
    if (!canManage || !me.tenant_id) {
      setState({
        canManage,
        tenantId: me.tenant_id ?? null,
        status: null,
        pricing: null,
        commissions: null,
        error: null,
      });
      return;
    }
    const [statusRes, pricingRes, commRes] = await Promise.all([
      getSubscriptionStatus(),
      getPricing(),
      getCommissions(),
    ]);
    setState({
      canManage,
      tenantId: me.tenant_id,
      status: statusRes.ok ? statusRes.data : null,
      pricing: pricingRes.ok ? pricingRes.data : null,
      commissions: commRes.ok ? commRes.data : null,
      // Fehler sichtbar machen, nicht verschlucken (Wurzel 5).
      error: !statusRes.ok ? statusRes.error : !pricingRes.ok ? pricingRes.error : null,
    });
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: Abo + Modul-Änderungen (Webhook schreibt) sofort spiegeln.
  useRealtime({
    table: "tenant_subscription",
    filter: state?.tenantId ? `tenant_id=eq.${state.tenantId}` : undefined,
    enabled: !!state?.tenantId,
    onChange: () => void load(),
  });
  useRealtime({
    table: "tenant_module_entitlement",
    filter: state?.tenantId ? `tenant_id=eq.${state.tenantId}` : undefined,
    enabled: !!state?.tenantId,
    onChange: () => void load(),
  });
  useRealtime({
    table: "commission_ledger",
    filter: state?.tenantId ? `tenant_id=eq.${state.tenantId}` : undefined,
    enabled: !!state?.tenantId,
    onChange: () => void load(),
  });

  if (!state) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon icon="svg-spinners:180-ring" className="size-4" />
        Abo wird geladen …
      </div>
    );
  }

  if (!state.canManage) {
    return (
      <p className="text-sm text-muted-foreground">
        Für die Tarifverwaltung fehlt dir die Berechtigung.
      </p>
    );
  }

  const s = state.status;
  const p = state.pricing;

  async function onCheckout() {
    setBusy(true);
    try {
      const origin = window.location.origin;
      const res = await startCheckout({
        moduleKeys: [],
        successUrl: `${origin}/konto?abo=ok`,
        cancelUrl: `${origin}/konto?abo=abbruch`,
      });
      if (res.ok) window.location.href = res.data.checkout_url;
      else toast.error(res.error);
    } finally {
      setBusy(false);
    }
  }

  async function onPortal() {
    setBusy(true);
    try {
      const res = await openBillingPortal(`${window.location.origin}/konto`);
      if (res.ok) window.location.href = res.data.portal_url;
      else toast.error(res.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      )}

      {/* Tarif-Übersicht (Beträge aus Stripe) */}
      {p && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 font-display text-base font-extrabold">Tarif</div>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {tierLines(p).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Ist-Zustand */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Abrechenbare Objekte
          </div>
          <div className="mt-1 font-display text-2xl font-extrabold">
            {s?.property_count ?? 0}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Abo-Status
          </div>
          <div className="mt-1 font-display text-2xl font-extrabold capitalize">
            {s?.has_subscription ? (s.status ?? "—") : "kein Abo"}
          </div>
          {s?.current_period_end && (
            <div className="mt-1 text-xs text-muted-foreground">
              Läuft bis {new Date(s.current_period_end).toLocaleDateString("de-DE")}
              {s.cancel_at_period_end && " (endet danach)"}
            </div>
          )}
        </div>
      </div>

      {/* Module */}
      {p && p.modules.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 font-display text-base font-extrabold">Zusatzmodule</div>
          <ul className="flex flex-col gap-2 text-sm">
            {p.modules
              .filter((m) => !m.per_unit_label) // flat-Variante als Zeile; per-unit als Zusatz
              .map((m) => {
                const active = s?.modules.some(
                  (e) => e.module_key === m.module_key && e.active,
                );
                const perUnit = p.modules.find(
                  (x) => x.module_key === m.module_key && x.per_unit_label,
                );
                return (
                  <li
                    key={m.module_key}
                    className="flex items-center justify-between gap-2"
                  >
                    <span>
                      {MODULE_LABELS[m.module_key] ?? m.module_key} —{" "}
                      {formatCurrency(m.unit_amount / 100, p.currency)} / Monat
                      {perUnit &&
                        ` oder ${formatCurrency(perUnit.unit_amount / 100, p.currency)} / ${perUnit.per_unit_label}`}
                    </span>
                    {active ? (
                      <span className="rounded-full bg-emerald-500/15 px-3 py-0.5 text-xs font-semibold text-emerald-600">
                        gebucht
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">nicht gebucht</span>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      {/* Provisionen (externe OTA-Buchungen: 1 % / 0,5 %) */}
      {state.commissions && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-1 font-display text-base font-extrabold">
            Provision externe Portale
          </div>
          <p className="text-sm text-muted-foreground">
            Booking, Airbnb &amp; Co.:{" "}
            {(state.commissions.current_rate * 100)
              .toLocaleString("de-DE", { maximumFractionDigits: 2 })}{" "}
            % vom Buchungsumsatz. Wird monatlich abgerechnet.
          </p>
          {state.commissions.pending_count > 0 ? (
            <div className="mt-2 text-sm">
              Offen ({state.commissions.pending_count} Buchungen):{" "}
              <span className="font-semibold">
                {formatCurrency(
                  state.commissions.pending_total,
                  state.commissions.currency,
                )}
              </span>
            </div>
          ) : (
            <div className="mt-2 text-sm text-muted-foreground">
              Aktuell keine offenen Provisionen.
            </div>
          )}
        </div>
      )}

      {/* Aktionen */}
      <div className="flex flex-wrap gap-2">
        {s?.has_subscription ? (
          <Button onClick={onPortal} disabled={busy} variant="outline">
            {busy ? "…" : "Abo verwalten"}
          </Button>
        ) : (
          <Button onClick={onCheckout} disabled={busy}>
            {busy ? "…" : "Abo abschließen"}
          </Button>
        )}
      </div>
    </div>
  );
}
