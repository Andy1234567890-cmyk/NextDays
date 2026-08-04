"use client";

// Erweiterungen (/erweiterungen) — Kachel-Raster der buchbaren Zusatzmodule.
// UI-Vorbild ist der Lodgify-Marktplatz: gleich große Kacheln, Logo-/Icon-Fläche
// oben, unten Name mit Preis-Badge rechts und eine Zeile Beschreibung. Klick
// öffnet die Detailseite mit „Aktivieren" — genau wie dort.
//
// Preise kommen aus getPricing() (Stripe bzw. Server-Satz), der gebuchte Zustand
// aus getSubscriptionStatus(). Nichts hier hardcoden (Wurzel 4).
import { Icon } from "@iconify/react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { getMe } from "@/lib/auth";
import { ERWEITERUNGEN, preisAnzeige } from "@/lib/erweiterungen";
import {
  getPricing,
  getSubscriptionStatus,
  type Pricing,
  type SubscriptionStatus,
} from "@/lib/subscriptions";
import { useRealtime } from "@/lib/use-realtime";

type Loaded = {
  canManage: boolean;
  tenantId: string | null;
  pricing: Pricing | null;
  status: SubscriptionStatus | null;
  error: string | null;
};

export function ErweiterungenListe() {
  const locale = useLocale();
  const [state, setState] = useState<Loaded | null>(null);

  const load = useCallback(async () => {
    const me = await getMe();
    const canManage = me?.capabilities.includes("manage_billing") ?? false;
    if (!me || !canManage) {
      setState({
        canManage,
        tenantId: me?.tenant_id ?? null,
        pricing: null,
        status: null,
        error: null,
      });
      return;
    }
    const [p, s] = await Promise.all([getPricing(), getSubscriptionStatus()]);
    setState({
      canManage: true,
      tenantId: me.tenant_id ?? null,
      pricing: p.ok ? p.data : null,
      status: s.ok ? s.data : null,
      // Fehler zeigen, nicht verschlucken (Wurzel 5).
      error: !p.ok ? p.error : !s.ok ? s.error : null,
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime-Pflicht: Modul gebucht/gekündigt (auch durch einen zweiten Nutzer
  // oder den Stripe-Webhook) muss hier sofort erscheinen.
  useRealtime({
    table: "tenant_module_entitlement",
    filter: state?.tenantId ? `tenant_id=eq.${state.tenantId}` : undefined,
    enabled: !!state?.tenantId,
    onChange: () => void load(),
  });
  useRealtime({
    table: "tenant_subscription",
    filter: state?.tenantId ? `tenant_id=eq.${state.tenantId}` : undefined,
    enabled: !!state?.tenantId,
    onChange: () => void load(),
  });

  if (!state) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon icon="svg-spinners:180-ring" className="size-4" />
        Erweiterungen werden geladen …
      </div>
    );
  }

  if (!state.canManage) {
    return (
      <p className="text-sm text-muted-foreground">
        Zum Buchen von Erweiterungen fehlt dir die Berechtigung.
      </p>
    );
  }

  const aktiv = new Set(
    (state.status?.modules ?? []).filter((m) => m.active).map((m) => m.module_key),
  );

  return (
    <div className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ERWEITERUNGEN.map((e) => {
          const preis = preisAnzeige(
            state.pricing?.modules.find((m) => m.module_key === e.moduleKey),
            state.pricing?.currency ?? "",
            locale,
          );
          return (
            <Link
              key={e.slug}
              href={`/erweiterungen/${e.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-foreground/20"
            >
              {/* Icon-Fläche (bei Lodgify das Logo des Anbieters) */}
              <div className="flex h-32 items-center justify-center bg-muted/50">
                <Icon icon={e.icon} className="size-10 text-foreground" />
              </div>
              <div className="flex flex-1 flex-col gap-1 p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-display text-sm font-extrabold">
                    {e.name}
                  </span>
                  {aktiv.has(e.moduleKey) ? (
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                      Aktiv
                    </span>
                  ) : preis ? (
                    <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      {preis.kurz}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">{e.untertitel}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Lodgify schließt den Marktplatz mit einem Vorschlagskasten ab — bei uns
          führt er in den Live-Chat, den es hier schon gibt (kein neues Formular). */}
      <div className="rounded-2xl bg-muted/50 p-5">
        <div className="font-display text-base font-extrabold">
          Nicht das, was Sie brauchen?
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Wir bauen laufend weiter. Schreiben Sie uns, was Ihnen fehlt — über den
          Support-Chat im Konto-Menü oder{" "}
          <a href="/hilfe" className="underline" target="_blank" rel="noopener noreferrer">
            im Hilfe-Center
          </a>
          .
        </p>
      </div>
    </div>
  );
}
