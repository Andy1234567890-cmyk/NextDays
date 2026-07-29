"use client";

// Abrechnung (/konto/tarif) — Abo-Karte mit Kennzahlenleiste, Rechnungsadresse
// und Rechnungsverlauf. UI-Vorbild ist die Lodgify-Abrechnungsseite: eine
// Karte je Thema, Kennzahlen nebeneinander mit Trennstrichen, Aktionen im
// „…"-Menü rechts oben.
//
// Beträge kommen ausschließlich aus Stripe (getPricing) und werden mit
// formatCurrency gerendert — kein €-Hardcode (Wurzel 4). Realtime auf
// tenant_subscription + commission_ledger, damit Webhook-Änderungen sofort
// erscheinen.
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
import { getMe } from "@/lib/auth";
import { formatCurrency } from "@/lib/currency";
import {
  getBillingAddress,
  getCommissions,
  getPricing,
  getSubscriptionStatus,
  openBillingPortal,
  type BillingAddress,
  type CommissionSummary,
  type Pricing,
  type SubscriptionStatus,
} from "@/lib/subscriptions";
import { useRealtime } from "@/lib/use-realtime";

import { ProvisionsVerlauf } from "./provisions-verlauf";
import { RechnungsadresseDialog } from "./rechnungsadresse-dialog";
import { Rechnungsverlauf } from "./rechnungsverlauf";
import { TarifRechner } from "./tarif-rechner";

type Loaded = {
  canManage: boolean;
  tenantId: string | null;
  status: SubscriptionStatus | null;
  pricing: Pricing | null;
  commissions: CommissionSummary | null;
  address: BillingAddress | null;
  error: string | null;
};

// Abo-Status → deutsches Label + Farbe. Unbekanntes zeigen wir roh, statt es
// auf „aktiv" zu raten (Wurzel 4).
const STATUS_LABEL: Record<string, { label: string; klasse: string }> = {
  active: { label: "Aktiv", klasse: "bg-emerald-500/15 text-emerald-600" },
  trialing: { label: "Testphase", klasse: "bg-sky-500/15 text-sky-600" },
  past_due: { label: "Zahlung offen", klasse: "bg-amber-500/15 text-amber-600" },
  canceled: { label: "Gekündigt", klasse: "bg-muted text-muted-foreground" },
  unpaid: { label: "Unbezahlt", klasse: "bg-destructive/10 text-destructive" },
  incomplete: { label: "Unvollständig", klasse: "bg-amber-500/15 text-amber-600" },
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
  const [adresseOffen, setAdresseOffen] = useState(false);
  const [zeigeVerlauf, setZeigeVerlauf] = useState(false);
  const [zeigeTarife, setZeigeTarife] = useState(false);
  const [zeigeProvisionen, setZeigeProvisionen] = useState(false);

  async function load() {
    const me = await getMe();
    if (!me) {
      setState({
        canManage: false, tenantId: null, status: null, pricing: null,
        commissions: null, address: null, error: null,
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
        address: null,
        error: null,
      });
      return;
    }
    const [statusRes, pricingRes, commRes, addrRes] = await Promise.all([
      getSubscriptionStatus(),
      getPricing(),
      getCommissions(),
      getBillingAddress(),
    ]);
    setState({
      canManage,
      tenantId: me.tenant_id,
      status: statusRes.ok ? statusRes.data : null,
      pricing: pricingRes.ok ? pricingRes.data : null,
      commissions: commRes.ok ? commRes.data : null,
      address: addrRes.ok ? addrRes.data : null,
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
        Abrechnung wird geladen …
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

  // Der Rechnungsverlauf ist eine Vollbild-Unteransicht des Abrechnungs-
  // Reiters (mit eigenem Zurück), keine dritte Reiter-Ebene.
  if (zeigeVerlauf) {
    return <Rechnungsverlauf onBack={() => setZeigeVerlauf(false)} />;
  }

  if (zeigeProvisionen) {
    return <ProvisionsVerlauf onBack={() => setZeigeProvisionen(false)} />;
  }

  const s = state.status;
  const p = state.pricing;
  const st = s?.status ? STATUS_LABEL[s.status] : undefined;

  async function onPortal() {
    setBusy(true);
    try {
      const res = await openBillingPortal(`${window.location.origin}/konto/tarif`);
      if (res.ok) window.location.href = res.data.portal_url;
      else toast.error(res.error);
    } finally {
      setBusy(false);
    }
  }

  // Tarifseite als Vollbild — kommt NUR über „Abo abschließen", kein Reiter.
  if (zeigeTarife) {
    return <TarifRechner onBack={() => setZeigeTarife(false)} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-2xl font-extrabold">Abrechnung</h2>
        <p className="text-sm text-muted-foreground">
          Abo-Status, Rechnungsadresse und Rechnungen — monatlich über
          myNextDays abgerechnet.
        </p>
      </div>

      {state.error && (
        <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      )}

      {/* Kopfzeile mit den beiden Sprungzielen (Lodgify-Vorbild) */}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => setAdresseOffen(true)}>
          Rechnungsadresse
        </Button>
        <Button variant="outline" onClick={() => setZeigeVerlauf(true)}>
          Rechnungsverlauf
        </Button>
      </div>

      {/* Abo-Karte: Status + Kennzahlenleiste + Aktionen */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-base font-extrabold">
                {s?.has_subscription ? "myNextDays" : "Kein Abo"}
              </span>
              {s?.has_subscription && (
                <>
                  <span className="text-muted-foreground">—</span>
                  <span className="text-sm text-muted-foreground">Monatlich</span>
                  <span
                    className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                      st?.klasse ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {st?.label ?? s.status}
                  </span>
                </>
              )}
            </div>
            {s?.cancel_at_period_end && (
              <p className="mt-1 text-sm text-amber-600">
                Endet zum Ende der laufenden Periode.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {s?.has_subscription ? (
              <>
                <Button onClick={onPortal} disabled={busy}>
                  {busy ? "…" : "Abo verwalten"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Weitere Aktionen"
                      className="inline-flex size-9 items-center justify-center rounded-full hover:bg-muted"
                    >
                      <Icon icon="lucide:more-horizontal" className="size-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {/* Kündigung und Zahlungsmethode laufen bewusst über das
                        Stripe-Portal: dort hängen SCA/Mandate und die
                        rechtsverbindliche Bestätigung dran. */}
                    <DropdownMenuItem onSelect={() => setZeigeTarife(true)}>
                      Abonnement ändern
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void onPortal()}>
                      Zahlungsmethode verwalten
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void onPortal()}>
                      Kündigung beantragen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              // Führt auf die Tarifseite, NICHT direkt zu Stripe: der Betrieb
              // soll erst sehen, was er für seine Objektzahl zahlt.
              <Button onClick={() => setZeigeTarife(true)}>
                Abo abschließen
              </Button>
            )}
          </div>
        </div>

        {/* Kennzahlen nebeneinander, durch Trennstriche geteilt */}
        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-4">
          <Kennzahl
            label="Nächstes Abrechnungsdatum"
            wert={
              s?.current_period_end
                ? new Date(s.current_period_end).toLocaleDateString("de-DE", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "—"
            }
          />
          <Kennzahl
            label="Buchungsgebühr"
            wert={
              state.commissions
                ? `${(state.commissions.current_rate * 100).toLocaleString("de-DE", {
                    maximumFractionDigits: 2,
                  })} %`
                : "—"
            }
            trennstrich
          />
          <Kennzahl
            label="Abrechenbare Objekte"
            wert={String(s?.property_count ?? 0)}
            trennstrich
          />
        </dl>
      </div>

      {/* Tarif-Staffel (Beträge aus Stripe) */}
      {p && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-2 font-display text-base font-extrabold">Tarif</div>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {tierLines(p).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Rechnungsadresse */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display text-base font-extrabold">
              Rechnungsadresse
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Diese Angaben erscheinen auf allen künftigen Rechnungen.
            </p>
            <div className="mt-3 text-sm">
              {adresseZeilen(state.address).length > 0 ? (
                adresseZeilen(state.address).map((z) => <div key={z}>{z}</div>)
              ) : (
                <span className="text-muted-foreground">
                  Noch keine Rechnungsadresse hinterlegt.
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAdresseOffen(true)}
            aria-label="Rechnungsadresse bearbeiten"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-muted"
          >
            <Icon icon="lucide:pencil" className="size-4" />
          </button>
        </div>
      </div>

      {/* Provisionen (externe OTA-Buchungen) */}
      {state.commissions && (
        <div className="rounded-2xl border border-border bg-card p-5">
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
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setZeigeProvisionen(true)}
          >
            Monatsverlauf ansehen
          </Button>
        </div>
      )}

      <RechnungsadresseDialog
        open={adresseOffen}
        onOpenChange={setAdresseOffen}
        address={state.address}
        onSaved={(addr) =>
          setState((prev) => (prev ? { ...prev, address: addr } : prev))
        }
      />
    </div>
  );
}

// Adresse als Anschriftsblock. Leere Felder fallen raus, damit keine Lücken
// oder einsame Kommata entstehen.
function adresseZeilen(a: BillingAddress | null): string[] {
  if (!a) return [];
  const person = [a.first_name, a.last_name].filter(Boolean).join(" ").trim();
  const ort = [a.postal_code, a.city].filter(Boolean).join(" ").trim();
  return [
    a.account_type === "company" ? a.company_name : person,
    a.account_type === "company" ? person : null,
    a.line1,
    a.line2,
    ort,
    a.country,
    a.vat_id ? `USt-IdNr. ${a.vat_id}` : null,
  ]
    .map((z) => (z ?? "").trim())
    .filter((z) => z.length > 0);
}

function Kennzahl({
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
