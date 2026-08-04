"use client";

// Detailseite einer Erweiterung (/erweiterungen/[slug]) — Lodgify-Aufbau:
// Zurück-Link, Kopfzeile (Icon · Name · Untertitel) mit „Aktivieren" rechts,
// Meta-Zeile (Preis · Verfügbarkeit · Kategorie), dann „Über …", „Wie
// funktioniert … mit myNextDays?", „Wie funktioniert die Einrichtung?" als drei
// Schritte und zum Schluss die weiterführenden Links.
//
// Gebucht wird über POST /subscriptions/modules — nicht über einen zweiten
// Checkout (das würde ein zweites Abo mit doppelter Grundgebühr anlegen).
// Preise ausschließlich aus getPricing() (Wurzel 4).
import { Icon } from "@iconify/react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { getMe } from "@/lib/auth";
import { preisAnzeige, type Erweiterung } from "@/lib/erweiterungen";
import {
  addSubscriptionModule,
  getPricing,
  getSubscriptionStatus,
  removeSubscriptionModule,
  type Pricing,
  type SubscriptionStatus,
} from "@/lib/subscriptions";
import { useRealtime } from "@/lib/use-realtime";

import { PreisverlaufIllustration } from "./illustrationen";

type Loaded = {
  canManage: boolean;
  tenantId: string | null;
  pricing: Pricing | null;
  status: SubscriptionStatus | null;
  error: string | null;
};

export function ErweiterungDetail({ eintrag }: { eintrag: Erweiterung }) {
  const locale = useLocale();
  const [state, setState] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);

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
      error: !p.ok ? p.error : !s.ok ? s.error : null,
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: Entitlement (Buchung/Kündigung, auch per Webhook) und Abo-Status.
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

  const eintragAktiv = (s: SubscriptionStatus | null) =>
    (s?.modules ?? []).some((m) => m.module_key === eintrag.moduleKey && m.active);

  async function onAktivieren() {
    setBusy(true);
    try {
      const res = await addSubscriptionModule(eintrag.moduleKey);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${eintrag.name} ist aktiviert.`);
      // Kein manuelles Nachladen: das Realtime-Abo auf
      // tenant_module_entitlement liefert den neuen Zustand.
    } finally {
      setBusy(false);
    }
  }

  async function onKuendigen() {
    setBusy(true);
    try {
      const res = await removeSubscriptionModule(eintrag.moduleKey);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${eintrag.name} wurde gekündigt.`);
    } finally {
      setBusy(false);
    }
  }

  const aktiv = eintragAktiv(state?.status ?? null);
  const preis = preisAnzeige(
    state?.pricing?.modules.find((m) => m.module_key === eintrag.moduleKey),
    state?.pricing?.currency ?? "",
    locale,
  );
  // Ohne laufendes Abo lehnt der Server das Buchen ab (422) — dann führt der Weg
  // über die Abrechnung, nicht über diesen Knopf.
  const hatAbo = state?.status?.has_subscription ?? false;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Link
        href="/erweiterungen"
        className="flex items-center gap-1 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <Icon icon="lucide:chevron-left" className="size-4" />
        Erweiterungen
      </Link>

      {/* Kopfzeile: Icon · Name/Untertitel · Aktion */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted">
            <Icon icon={eintrag.icon} className="size-6" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-extrabold">{eintrag.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {eintrag.untertitel}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {!state ? (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon icon="svg-spinners:180-ring" className="size-4" />
              wird geladen …
            </span>
          ) : !state.canManage ? (
            <span className="text-sm text-muted-foreground">
              Zum Buchen fehlt dir die Berechtigung.
            </span>
          ) : aktiv ? (
            <>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/15 px-3 py-0.5 text-xs font-semibold text-emerald-600">
                  Aktiv
                </span>
                <Button variant="outline" onClick={() => void onKuendigen()} disabled={busy}>
                  {busy && <Icon icon="svg-spinners:180-ring" className="mr-2 size-4" />}
                  Kündigen
                </Button>
              </div>
              <Link
                href={eintrag.flaeche.href}
                className="text-sm font-medium text-foreground underline"
              >
                {eintrag.flaeche.label}
              </Link>
            </>
          ) : hatAbo ? (
            <Button onClick={() => void onAktivieren()} disabled={busy}>
              {busy && <Icon icon="svg-spinners:180-ring" className="mr-2 size-4" />}
              Aktivieren
            </Button>
          ) : (
            <>
              {/* Kein Abo → das Modul wäre nicht abrechenbar. Statt eines
                  Knopfes, der sicher in einen 422 läuft, der ehrliche Weg. */}
              <Button asChild>
                <Link href="/konto/tarif">Abo abschließen</Link>
              </Button>
              <span className="max-w-xs text-right text-xs text-muted-foreground">
                Erweiterungen setzen ein laufendes myNextDays-Abo voraus.
              </span>
            </>
          )}
        </div>
      </div>

      {state?.error && (
        <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      )}

      {/* Meta-Zeile: Preis · Verfügbarkeit · Kategorie */}
      <dl className="flex flex-wrap gap-x-8 gap-y-4 border-y border-border py-4">
        <Meta
          label="Preis"
          wert={
            preis
              ? preis.lang
              : state?.canManage === false
                ? "—"
                : "Preis konnte nicht geladen werden"
          }
        />
        <Meta label="Verfügbarkeit" wert={eintrag.verfuegbarkeit} trennstrich />
        <Meta label="Kategorie" wert={eintrag.kategorie} trennstrich />
      </dl>

      {/* Vorschau — Lodgify zeigt hier Produktbilder/Video des Moduls. Bei uns
          das eigene Motiv: Preisverlauf zwischen den beiden Grenzen. */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-extrabold">Vorschau</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-6">
          <PreisverlaufIllustration className="h-auto w-full" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-extrabold">
          Über {eintrag.name}
        </h2>
        {eintrag.ueber.map((p) => (
          <p key={p.slice(0, 40)} className="text-sm leading-relaxed text-muted-foreground">
            {p}
          </p>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-extrabold">
          Wie funktioniert {eintrag.name} mit myNextDays?
        </h2>
        <ul className="flex flex-col gap-2">
          {eintrag.soFunktioniert.map((z) => (
            <li key={z.slice(0, 40)} className="flex gap-2 text-sm text-muted-foreground">
              <Icon
                icon="lucide:check"
                className="mt-0.5 size-4 shrink-0 text-emerald-600"
              />
              <span>{z}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-extrabold">
          Wie funktioniert die Einrichtung?
        </h2>
        <ol className="flex flex-col gap-3">
          {eintrag.einrichtung.map((z, i) => (
            <li key={z.slice(0, 40)} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-display text-sm font-extrabold">
                {i + 1}
              </span>
              <span className="pt-0.5 text-sm text-muted-foreground">{z}</span>
            </li>
          ))}
        </ol>
        <p className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
          {eintrag.hinweis}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xl font-extrabold">Weiterführende Links</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {eintrag.links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-foreground underline"
              >
                <Icon icon="lucide:external-link" className="size-3.5" />
                {l.text}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Meta({
  label,
  wert,
  trennstrich = false,
}: {
  label: string;
  wert: string;
  trennstrich?: boolean;
}) {
  return (
    <div className={trennstrich ? "border-l border-border pl-8" : undefined}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold">{wert}</dd>
    </div>
  );
}
