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
import { useTranslations, useLocale } from "next-intl";
import { useCallback, useEffect, useState } from "react";
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
  // Eigenes Feld, damit `commissions === null` nicht zwei Bedeutungen trägt.
  commissionsError: string | null;
  address: BillingAddress | null;
  error: string | null;
};

// Abo-Status → i18n-Key + Farbe. Unbekanntes zeigen wir roh, statt es auf
// „aktiv" zu raten (Wurzel 4).
const STATUS_LABEL: Record<string, { key: string; klasse: string }> = {
  active: {
    key: "subscription.statusActive",
    klasse: "bg-emerald-500/15 text-emerald-600",
  },
  trialing: {
    key: "subscription.statusTrialing",
    klasse: "bg-sky-500/15 text-sky-600",
  },
  past_due: {
    key: "subscription.statusPastDue",
    klasse: "bg-amber-500/15 text-amber-600",
  },
  canceled: {
    key: "subscription.statusCanceled",
    klasse: "bg-muted text-muted-foreground",
  },
  unpaid: {
    key: "subscription.statusUnpaid",
    klasse: "bg-destructive/10 text-destructive",
  },
  incomplete: {
    key: "subscription.statusIncomplete",
    klasse: "bg-amber-500/15 text-amber-600",
  },
};

export function KontoAboSection() {
  const locale = useLocale();
  const [state, setState] = useState<Loaded | null>(null);
  // Nur der Setter: der Ladezustand wird aktuell nirgends angezeigt.
  const [, setBusy] = useState(false);
  const [adresseOffen, setAdresseOffen] = useState(false);
  const [zeigeVerlauf, setZeigeVerlauf] = useState(false);
  const [zeigeTarife, setZeigeTarife] = useState(false);
  const [zeigeProvisionen, setZeigeProvisionen] = useState(false);
  // Ländercode → Klarname. Muss VOR den frühen returns stehen (Hook-Regel).
  const t = useTranslations("account");
  const tCountry = useTranslations("countries");
  const adressZeilen = adresseZeilen(
    state?.address ?? null,
    (c) => tCountry(c),
    (vatId) => t("subscription.vatLine", { vatId }),
  );

  // Stabile Referenz (leere Deps, weil `load` NUR Modul-Importe und den
  // React-stabilen `setState` benutzt — keinen State und keine Props). Dadurch
  // darf der Mount-Effect unten ehrlich `[load]` führen, statt die
  // exhaustive-deps-Regel stummzuschalten.
  const load = useCallback(async () => {
    const me = await getMe();
    if (!me) {
      setState({
        canManage: false, tenantId: null, status: null, pricing: null,
        commissions: null, commissionsError: null, address: null, error: null,
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
        commissionsError: null,
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
      // Getrennt vom Wert: `null` heißt „geladen, aber leer", ein Fehlertext
      // heißt „Laden fehlgeschlagen". Ohne diese Unterscheidung verschwände die
      // Provisionskarte bei einem 500 kommentarlos (Wurzel 5).
      commissionsError: commRes.ok ? null : commRes.error,
      address: addrRes.ok ? addrRes.data : null,
      // Fehler sichtbar machen, nicht verschlucken (Wurzel 5) — ALLE vier
      // Teilabrufe, nicht nur die ersten beiden.
      error:
        [statusRes, pricingRes, commRes, addrRes]
          .find((r) => !r.ok)
          ?.error ?? null,
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // `tenant_subscription` und `tenant_module_entitlement` sind für
  // authenticated bewusst gesperrt (Wurzel 6, Migration 0337: revoke + raus aus
  // supabase_realtime) — Abos darauf wären stumme Attrappen. Eine offene
  // Tabelle, die dieselben Ereignisse trägt, gibt es nicht: ein Abo-Wechsel
  // oder ein gebuchtes/gekündigtes Modul schlägt sich in keiner Reservierung
  // nieder. Ersatzlos gestrichen; ehrlich benannt, was dadurch NICHT mehr live
  // ist: Abo-Status/Tarifwechsel und Modul-Buchungen — insbesondere die, die
  // der Stripe-Webhook serverseitig schreibt, und die eines zweiten Nutzers.
  // Beides erscheint erst beim nächsten Laden der Kontoseite.
  // commission_ledger ist für authenticated bewusst gesperrt (Wurzel 6) — ein Abo
  // darauf wäre eine stumme Attrappe. Provisionen entstehen aus Reservierungen,
  // deshalb hört die Abrechnung auf die erlaubte Quelle.
  useRealtime({
    table: "reservations",
    filter: state?.tenantId ? `tenant_id=eq.${state.tenantId}` : undefined,
    enabled: !!state?.tenantId,
    onChange: () => void load(),
  });

  if (!state) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon icon="svg-spinners:180-ring" className="size-4" />
        {t("subscription.loading")}
      </div>
    );
  }

  if (!state.canManage) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("subscription.noPermission")}
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
        <h2 className="font-display text-2xl font-extrabold">
          {t("subscription.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("subscription.subtitle")}
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
          {t("subscription.billingAddress")}
        </Button>
        <Button variant="outline" onClick={() => setZeigeVerlauf(true)}>
          {t("subscription.invoiceHistory")}
        </Button>
      </div>

      {/* Abo-Karte: Status + Kennzahlenleiste + Aktionen */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-base font-extrabold">
                {s?.has_subscription
                  ? t("subscription.brand")
                  : t("subscription.noSubscription")}
              </span>
              {s?.has_subscription && (
                <>
                  <span className="text-muted-foreground">—</span>
                  <span className="text-sm text-muted-foreground">
                    {t("subscription.monthly")}
                  </span>
                  <span
                    className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                      st?.klasse ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {st ? t(st.key) : s.status}
                  </span>
                </>
              )}
            </div>
            {s?.cancel_at_period_end && (
              <p className="mt-1 text-sm text-amber-600">
                {t("subscription.endsAtPeriodEnd")}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {s?.has_subscription ? (
              <>
                {/* Hauptaktion ist unsere Tarifseite (Objekte dazubuchen) —
                    das Stripe-Portal kennt nur Zahlungsmittel und Kündigung. */}
                <Button onClick={() => setZeigeTarife(true)}>
                  {t("subscription.changePlan")}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={t("subscription.moreActions")}
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
                      {t("subscription.changeSubscription")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void onPortal()}>
                      {t("subscription.managePaymentMethod")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void onPortal()}>
                      {t("subscription.requestCancellation")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              // Führt auf die Tarifseite, NICHT direkt zu Stripe: der Betrieb
              // soll erst sehen, was er für seine Objektzahl zahlt.
              <Button onClick={() => setZeigeTarife(true)}>
                {t("subscription.startSubscription")}
              </Button>
            )}
          </div>
        </div>

        {/* Kennzahlen nebeneinander, durch Trennstriche geteilt */}
        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-4">
          <Kennzahl
            label={t("subscription.nextBilling")}
            wert={
              s?.current_period_end
                ? new Date(s.current_period_end).toLocaleDateString(locale, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : t("subscription.empty")
            }
          />
          <Kennzahl
            label={t("subscription.bookingFee")}
            wert={
              state.commissions
                ? `${(state.commissions.current_rate * 100).toLocaleString(locale, {
                    maximumFractionDigits: 2,
                  })} %`
                : // Ein Ladefehler darf nicht wie „kein Satz vereinbart"
                  // aussehen (Wurzel 5).
                  state.commissionsError
                  ? t("subscription.notAvailable")
                  : t("subscription.empty")
            }
            trennstrich
          />
          {/* Mit Abo zählt die BEZAHLTE Menge (Regler beim Abschluss), nicht
              die Zahl der angelegten Objekte — wer für 5 bucht, sieht 5. */}
          <Kennzahl
            label={
              s?.has_subscription
                ? t("subscription.billedProperties")
                : t("subscription.activeProperties")
            }
            wert={String(
              (s?.has_subscription ? s?.billed_property_count : s?.property_count) ?? 0,
            )}
            trennstrich
          />
        </dl>
      </div>

      {/* Die Preisstaffel (Grundgebühr, Objekt-Stufen) stand hier als eigene
          Karte. Sie ist Vertragsinhalt und gehört in die AGB bzw. auf die
          Preisseite — nicht auf eine Seite, die den laufenden Abo-Stand zeigt.
          Was der Betrieb TATSÄCHLICH zahlt, steht weiterhin oben im Statusblock
          (gebuchte Objekte, nächste Rechnung). Die Keys
          `subscription.planTitle`/`tier*` bleiben für die AGB erhalten. */}

      {/* Rechnungsadresse */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display text-base font-extrabold">
              {t("subscription.billingAddress")}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("subscription.billingAddressHint")}
            </p>
            <div className="mt-3 text-sm">
              {adressZeilen.length > 0 ? (
                adressZeilen.map((z) => <div key={z}>{z}</div>)
              ) : (
                <span className="text-muted-foreground">
                  {t("subscription.billingAddressEmpty")}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAdresseOffen(true)}
            aria-label={t("subscription.editBillingAddress")}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-muted"
          >
            <Icon icon="lucide:pencil" className="size-4" />
          </button>
        </div>
      </div>

      {/* Provisionen (externe OTA-Buchungen). Schlägt das Laden fehl, bleibt die
          Karte an ihrem Platz und sagt das — sie ersatzlos auszublenden hieße,
          dem Betrieb „keine Provisionen" zu suggerieren (Wurzel 5). */}
      {!state.commissions && state.commissionsError && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-1 font-display text-base font-extrabold">
            {t("commissions.cardTitle")}
          </div>
          {/* Kein Ersatzwert und keine Zahl an dieser Stelle (Wurzel 4) — nur
              die Aussage, dass der Abruf fehlschlug. */}
          <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {t("commissions.loadFailed", { error: state.commissionsError })}
          </p>
        </div>
      )}

      {state.commissions && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-1 font-display text-base font-extrabold">
            {t("commissions.cardTitle")}
          </div>
          {/* Die Konditionen selbst (Provisionssatz, Abrechnungsrhythmus,
              Kanalvergleich) stehen bewusst NICHT mehr hier: sie sind
              Vertragsinhalt und gehören in die AGB, nicht auf eine Seite, die
              den aktuellen Stand anzeigt. Die Übersetzungen bleiben als
              `konto.commissions.cardRate*`/`cardOtherChannels` erhalten und
              werden dort weiterverwendet. Diese Karte zeigt nur noch, was
              tatsächlich angefallen ist. */}
          {state.commissions.pending_count > 0 ? (
            <div className="mt-2 text-sm">
              {t("commissions.pending", {
                count: state.commissions.pending_count,
              })}
              <span className="font-semibold">
                {formatCurrency(
                  state.commissions.pending_total,
                  state.commissions.currency,
                )}
              </span>
              {/* Der Deckel greift erst beim Einzug — bis dahin zeigt die Zeile
                  die entstandene Provision. Ohne diesen Hinweis wirkte die
                  Abbuchung später wie ein Fehler. */}
              {state.commissions.pending_capped &&
                state.commissions.cap_amount !== null && (
                  <span className="text-muted-foreground">
                    {t("commissions.pendingCapHint", {
                      cap: formatCurrency(
                        state.commissions.cap_amount,
                        state.commissions.currency,
                      ),
                    })}
                  </span>
                )}
            </div>
          ) : (
            <div className="mt-2 text-sm text-muted-foreground">
              {t("commissions.noPending")}
            </div>
          )}
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setZeigeProvisionen(true)}
          >
            {t("commissions.showMonths")}
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
//
// `landName` übersetzt den gespeicherten ISO-3166-1-alpha-2-Code in den
// Klarnamen: gespeichert und an Stripe übertragen wird IMMER der Code (DE),
// angezeigt wird der Landesname (Deutschland). Fehlt eine Übersetzung, bleibt
// der Code stehen — besser ein Code als eine leere Zeile.
//
// `vatZeile` baut die USt-Zeile aus i18n — der Bezeichner heißt je Sprache
// anders (USt-IdNr. / VAT ID) und darf hier kein Literal sein.
function adresseZeilen(
  a: BillingAddress | null,
  landName: (code: string) => string,
  vatZeile: (vatId: string) => string,
): string[] {
  if (!a) return [];
  const person = [a.first_name, a.last_name].filter(Boolean).join(" ").trim();
  const ort = [a.postal_code, a.city].filter(Boolean).join(" ").trim();
  return [
    a.account_type === "company" ? a.company_name : person,
    a.account_type === "company" ? person : null,
    a.line1,
    a.line2,
    ort,
    a.country ? landName(a.country) : null,
    a.vat_id ? vatZeile(a.vat_id) : null,
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
