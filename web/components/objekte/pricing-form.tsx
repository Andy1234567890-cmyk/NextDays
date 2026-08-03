"use client";

// Preis-Seite eines Objekts (Pricing, Etappe 1).
//  Nightly price: Grundpreis (Währung, Dynamic, Wochentag), Mark-up je Kanal,
//  Extra-Gast-Aufschlag, Kurzaufenthalts-Aufschlag.
//  Length of stay: Wochen-/Monats-/eigene Längenpreise.
// Gespeichert per updateProperty() in type_attributes.pricing.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  EditorShell,
  Field,
  Footer,
  Hint,
  Pill,
  useSaver,
} from "@/components/objekte/editor-primitives";
import { RatePlanWizard } from "@/components/objekte/rate-plan-wizard";
import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
import { Input } from "@nextdays/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nextdays/ui/select";
import { Switch } from "@nextdays/ui/switch";
import {
  LokaleSteuerEditor,
  MwStEditor,
} from "@/components/objekte/pricing/steuern-editoren";
import {
  type AddOn,
  type Currency,
  type Fee,
  type FeeBasis,
  type LengthPrice,
  type Pricing,
  type Promotion,
  type StayKind,
  type Tax,
  type TaxKind,
  CURRENCY_OPTIONS,
  FEE_BASIS_LABELS,
  STAY_KIND_LABELS,
  TAX_KIND_LABELS,
  TAXABLE_BASE_PRICE,
  WEEKDAY_LABELS,
  currencySymbol,
  fmtPrice,
  readPricing,
  taxAmountBasis,
  taxDisplayName,
} from "@/lib/pricing-meta";
import { channelLogoLoose } from "@/lib/channel-logos";
import {
  listChannelConnections,
  setPortalPriceAdjustment,
  type StoredChannelConnection,
} from "@/lib/channex";
import { getDpSettings } from "@/lib/dynamic-pricing";
import { type Property, updateProperty } from "@/lib/properties";
import {
  deleteRatePlan,
  listRatePlans,
  setBasePrice,
  type RatePlan,
} from "@/lib/rates";
import { useRealtime } from "@/lib/use-realtime";

type Section =
  | "currency"
  | "base"
  | "extraGuest"
  | "shortStay"
  | { length: StayKind; id?: string }
  | { fee: string | "new" }
  | { tax: TaxKind; id?: string }
  | { promo: string | "new" }
  | { addon: string | "new" }
  | "taxInfo"
  | "baseLabel"
  | null;

export function PricingForm({ initial }: { initial: Property }) {
  const t = useTranslations("objects");
  const locale = useLocale();
  const [p, setP] = useState<Property>(initial);
  const [section, setSection] = useState<Section>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const pr = readPricing(p.type_attributes);

  // Grundpreis-Wahrheit ist rate_plans (Resolver/Channex lesen NUR dort) — die
  // Anzeige spiegelt den Plan, nicht die type_attributes-Kopie. Ein Objekt = eine
  // Einheit; es kann mehrere Rate-Pläne haben (z. B. BAR/B&B) — dann gibt es keinen
  // EINEN Objekt-Grundpreis, die Pläne werden im Kalender („Preise") gepflegt.
  const [plans, setPlans] = useState<RatePlan[]>([]);
  const loadPlans = useCallback(async () => {
    const res = await listRatePlans(p.id);
    if (res.ok) setPlans(res.data.items);
  }, [p.id]);
  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);
  useRealtime({
    table: "rate_plans",
    filter: `property_id=eq.${p.id}`,
    onChange: () => void loadPlans(),
  });
  // Dynamic Pricing aktiv? Dann sind die verkauften Tagespreise die dynamischen
  // — der Grundpreis hier ist nur der Anker. Ohne diesen Hinweis liest sich die
  // Seite als „das Objekt kostet 129 €", während Kalender/Portale längst andere
  // Tagespreise führen.
  const [dpEnabled, setDpEnabled] = useState(false);
  const loadDp = useCallback(async () => {
    const res = await getDpSettings(p.id);
    if (res.ok) setDpEnabled(Boolean(res.data.enabled));
  }, [p.id]);
  useEffect(() => {
    void loadDp();
  }, [loadDp]);
  useRealtime({
    table: "dp_settings",
    filter: `property_id=eq.${p.id}`,
    onChange: () => void loadDp(),
  });
  const multiPlan = plans.length > 1;
  const basePlan = multiPlan ? null : (plans[0] ?? null);
  // Währung ist zentral am OBJEKT eingestellt (properties.currency, 0161) und
  // gilt für alle Rate-Plans. Anzeige-Priorität: Objektwährung → (Bestand) Plan-
  // /pricing-Währung. Leer/unbekannt rendert symbollos (lib/currency), nie ein
  // erfundenes € (Wurzel 4).
  const cur = ((p.currency ?? basePlan?.currency ?? pr.currency) || "") as
    | Currency
    | "";
  const shownBasePrice = basePlan ? basePlan.base_price : pr.basePrice;

  // Zentrale Objektwährung setzen: schreibt properties.currency; das Backend
  // zieht alle Rate-Plans dieses Objekts mit (Wurzel 1) und resynct die Portale.
  async function saveCurrency(next: Currency): Promise<true | string> {
    const res = await updateProperty(p.id, { currency: next });
    if (!res.ok) return res.error;
    setP(res.data);
    setSection(null);
    void loadPlans();
    return true;
  }

  async function save(next: Pricing): Promise<true | string> {
    const res = await updateProperty(p.id, {
      type_attributes: { ...p.type_attributes, pricing: next },
    });
    if (!res.ok) return res.error;
    setP(res.data);
    setSection(null);
    // Basispreis in rate_plans persistieren — die eine Preis-Wahrheit (Resolver,
    // Channex, Kalender). Auch 0 wird gespiegelt (Zurücksetzen muss wirken);
    // ohne gewählte Währung kein Push (Backend lehnt leere Währung ab, 422).
    // Bei mehreren Plänen am Objekt gibt es keinen einen Grundpreis — dann kein Upsert.
    if (!multiPlan && next.currency) {
      const rp = await setBasePrice(p.id, next.basePrice, next.currency);
      if (!rp.ok) return rp.error;
      void loadPlans();
    }
    return true;
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-3xl font-extrabold">{t("pricingForm.pageTitle")}</h1>

      {/* Zentrale Objektwährung — gilt für ALLE Preispläne dieses Objekts
          (FeWo wie Hotel). Eine Stelle, kein Setzen je Rate-Plan (Channex:
          1 Objekt = 1 Währung, Migration 0161). */}
      <section className="flex flex-col gap-4">
        <BlockCard
          title={t("pricingForm.currencyTitle")}
          hint={t("pricingForm.currencyHint")}
          actionLabel={cur ? t("pricingForm.edit") : t("pricingForm.add")}
          onEdit={() => setSection("currency")}
        >
          {cur ? (
            <Pill>
              {CURRENCY_OPTIONS.find((o) => o.value === cur)?.label ?? cur}
            </Pill>
          ) : null}
        </BlockCard>
      </section>

      {/* Nightly price */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-xl font-extrabold">{t("pricingForm.nightlyPriceTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("pricingForm.nightlyPriceHint")}
          </p>
        </div>

        {/* Ein Plan → Objekt-Grundpreis direkt pflegbar. Mehrere Pläne (BAR/B&B,
            abgeleitet) → kein EINER Objekt-Grundpreis; die Pläne werden
            datumsgenau im Kalender gepflegt. Die Liste steht in beiden Fällen. */}
        {!multiPlan && (
          <BlockCard
            title={t("pricingForm.basePriceTitle")}
            hint={t("pricingForm.basePriceHint")}
            onEdit={() => setSection("base")}
          >
            <Pill>{fmtPrice(shownBasePrice, cur, locale)}</Pill>
          </BlockCard>
        )}

        {dpEnabled && (
          <Card className="flex flex-wrap items-center justify-between gap-3 border-accent/40 bg-accent/5 p-4">
            <div className="flex min-w-0 items-start gap-2">
              <span aria-hidden className="text-accent">⚡</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {t("pricingForm.dynamicActiveTitle")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("pricingForm.dynamicActiveHint")}
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" asChild>
              <a href={`/dynamic-pricing/${p.id}`}>
                {t("pricingForm.dynamicActiveOpen")}
              </a>
            </Button>
          </Card>
        )}

        <RatePlanList
          plans={plans}
          currency={cur}
          onCreate={() => setWizardOpen(true)}
          onDeleted={() => void loadPlans()}
        />

        <PortalAdjustmentsCard propertyId={p.id} plans={plans} />

        <BlockCard
          title={t("pricingForm.extraGuestTitle")}
          hint={t("pricingForm.extraGuestHint")}
          actionLabel={pr.extraGuestCharge > 0 ? t("pricingForm.edit") : t("pricingForm.add")}
          onEdit={() => setSection("extraGuest")}
        >
          {pr.extraGuestCharge > 0 ? (
            <Pill>{t("pricingForm.extraGuestPill", { price: fmtPrice(pr.extraGuestCharge, cur, locale), guest: pr.extraGuestFrom + 1 })}</Pill>
          ) : null}
        </BlockCard>

        <BlockCard
          title={t("pricingForm.shortStayTitle")}
          hint={t("pricingForm.shortStayHint")}
          actionLabel={pr.shortStayMaxNights > 0 ? t("pricingForm.edit") : t("pricingForm.add")}
          onEdit={() => setSection("shortStay")}
          localOnly
        >
          {pr.shortStayMaxNights > 0 ? (
            <Pill>{t("pricingForm.shortStayPill", { price: fmtPrice(pr.shortStaySurcharge, cur, locale), nights: pr.shortStayMaxNights })}</Pill>
          ) : null}
        </BlockCard>
      </section>

      {/* Length of stay prices */}
      <section className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-xl font-extrabold">
              {t("pricingForm.lengthPricesTitle")}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {t("pricingForm.directBookingsOnly")}
              </span>
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("pricingForm.lengthPricesHint")}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Icon icon="ph:plus" className="size-4" />
                {t("pricingForm.add")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSection({ length: "weekly" })}>
                <div className="flex flex-col">
                  <span className="font-medium">{t("pricingForm.weeklyPriceLabel")}</span>
                  <span className="text-xs text-muted-foreground">{t("pricingForm.weeklyPriceDesc")}</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSection({ length: "monthly" })}>
                <div className="flex flex-col">
                  <span className="font-medium">{t("pricingForm.monthlyPriceLabel")}</span>
                  <span className="text-xs text-muted-foreground">{t("pricingForm.monthlyPriceDesc")}</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSection({ length: "custom" })}>
                <div className="flex flex-col">
                  <span className="font-medium">{t("pricingForm.customLengthPriceLabel")}</span>
                  <span className="text-xs text-muted-foreground">{t("pricingForm.customLengthPriceDesc")}</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {pr.lengthPrices.length === 0 ? (
          <Card className="p-5 text-sm text-muted-foreground">
            {t("pricingForm.lengthPricesEmpty")}
          </Card>
        ) : (
          pr.lengthPrices.map((lp) => (
            <Card key={lp.id} className="flex items-center justify-between gap-4 p-5">
              <div className="leading-tight">
                <p className="font-semibold">{STAY_KIND_LABELS[lp.kind]}</p>
                <p className="text-sm text-muted-foreground">{t("pricingForm.minNightsOrMore", { nights: lp.minNights })}</p>
                <span className="mt-2 inline-flex w-fit items-center rounded-full bg-muted/60 px-3 py-1.5 text-sm">
                  {t("pricingForm.pricePerNight", { price: fmtPrice(lp.pricePerNight, cur, locale) })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSection({ length: lp.kind, id: lp.id })}>
                  {t("pricingForm.edit")}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("pricingForm.remove")}
                  onClick={() => save({ ...pr, lengthPrices: pr.lengthPrices.filter((x) => x.id !== lp.id) })}
                >
                  <Icon icon="ph:trash" className="size-4 text-muted-foreground" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </section>

      {/* Fees */}
      <ListSection
        title={t("pricingForm.feesTitle")}
        hint={t("pricingForm.feesHint")}
        onAdd={() => setSection({ fee: "new" })}
        empty={t("pricingForm.feesEmpty")}
        items={pr.fees}
        render={(f) => (
          <ListRow
            key={f.id}
            title={f.name}
            pill={`${fmtPrice(f.amount, cur, locale)} · ${FEE_BASIS_LABELS[f.basis]}${f.taxRate != null ? ` · ${t("pricingForm.taxRateSuffix", { rate: f.taxRate })}` : ""
              }${f.optional ? ` · ${t("pricingForm.optionalSuffix")}` : ""}`}
            onEdit={() => setSection({ fee: f.id })}
            onDelete={() => save({ ...pr, fees: pr.fees.filter((x) => x.id !== f.id) })}
          />
        )}
      />

      {/* Taxes */}
      <section className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-extrabold">{t("pricingForm.taxesTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("pricingForm.taxesHint")}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Icon icon="ph:plus" className="size-4" /> {t("pricingForm.add")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Es gibt genau EINE USt je Objekt — ist sie angelegt, führt der
                  Eintrag nicht zu einer zweiten, sondern gar nicht mehr weiter. */}
              <DropdownMenuItem
                disabled={pr.taxes.some((x) => x.kind === "vat")}
                onClick={() => setSection({ tax: "vat" })}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{t("pricingForm.vatLabel")}</span>
                  <span className="text-xs text-muted-foreground">{t("pricingForm.vatDesc")}</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSection({ tax: "local" })}>
                <div className="flex flex-col">
                  <span className="font-medium">{t("pricingForm.localTaxLabel")}</span>
                  <span className="text-xs text-muted-foreground">{t("pricingForm.localTaxDesc")}</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {pr.taxes.length === 0 ? (
          <Card className="p-5 text-sm text-muted-foreground">{t("pricingForm.taxesEmpty")}</Card>
        ) : (
          pr.taxes.map((tx) => (
            <ListRow
              key={tx.id}
              title={
                tx.kind === "vat"
                  ? t("pricingForm.vatLabel")
                  : taxDisplayName(tx, locale) || TAX_KIND_LABELS[tx.kind]
              }
              pill={taxSummary(tx, pr, cur, locale, t)}
              onEdit={() => setSection({ tax: tx.kind, id: tx.id })}
              onDelete={() => save({ ...pr, taxes: pr.taxes.filter((x) => x.id !== tx.id) })}
            />
          ))
        )}
      </section>

      {/* Promotions */}
      <ListSection
        title={t("pricingForm.promotionsTitle")}
        hint={t("pricingForm.promotionsHint")}
        localOnly
        onAdd={() => setSection({ promo: "new" })}
        empty={t("pricingForm.promotionsEmpty")}
        items={pr.promotions}
        render={(p2) => (
          <ListRow
            key={p2.id}
            title={p2.name}
            pill={`${p2.percent}%${p2.conditions ? ` · ${t("pricingForm.withConditionsSuffix")}` : ""}`}
            onEdit={() => setSection({ promo: p2.id })}
            onDelete={() => save({ ...pr, promotions: pr.promotions.filter((x) => x.id !== p2.id) })}
          />
        )}
      />

      {/* Add-ons */}
      <ListSection
        title={t("pricingForm.addOnsTitle")}
        hint={t("pricingForm.addOnsHint")}
        localOnly
        onAdd={() => setSection({ addon: "new" })}
        empty={t("pricingForm.addOnsEmpty")}
        items={pr.addOns}
        render={(a) => (
          <ListRow
            key={a.id}
            title={a.name}
            badge={a.active ? t("pricingForm.activated") : undefined}
            pill={`${fmtPrice(a.amount, cur, locale)} · ${FEE_BASIS_LABELS[a.basis]}`}
            onEdit={() => setSection({ addon: a.id })}
            onDelete={() => save({ ...pr, addOns: pr.addOns.filter((x) => x.id !== a.id) })}
          />
        )}
      />

      {/* Other information */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-extrabold">{t("pricingForm.otherInfoTitle")}</h2>
        <BlockCard
          title={t("pricingForm.taxInfoTitle")}
          hint={t("pricingForm.taxInfoHint")}
          onEdit={() => setSection("taxInfo")}
        >
          {(pr.businessTaxId || pr.totRegistrationId) && (
            <Pill>{[pr.businessTaxId, pr.totRegistrationId].filter(Boolean).join(" · ")}</Pill>
          )}
        </BlockCard>
        <BlockCard
          title={t("pricingForm.baseLabelTitle")}
          hint={t("pricingForm.baseLabelHint")}
          actionLabel={pr.basePriceLabel ? t("pricingForm.edit") : t("pricingForm.add")}
          onEdit={() => setSection("baseLabel")}
        >
          {pr.basePriceLabel && <Pill>{pr.basePriceLabel}</Pill>}
        </BlockCard>
      </section>

      {/* Editoren */}
      {section === "currency" && (
        <CurrencyEditor current={cur} onSave={saveCurrency} onClose={() => setSection(null)} />
      )}
      {section === "base" && (
        <BaseEditor
          // Editor mit der Plan-Wahrheit vorbelegen (rate_plans), nicht mit der
          // type_attributes-Kopie — sonst editiert man einen veralteten Wert.
          pr={basePlan ? { ...pr, basePrice: basePlan.base_price, currency: (basePlan.currency || pr.currency) as Pricing["currency"] } : pr}
          onSave={save}
          onClose={() => setSection(null)}
        />
      )}
      {section === "extraGuest" && <ExtraGuestEditor pr={pr} onSave={save} onClose={() => setSection(null)} />}
      {section === "shortStay" && <ShortStayEditor pr={pr} onSave={save} onClose={() => setSection(null)} />}
      {section && typeof section === "object" && "length" in section && (
        <LengthEditor
          pr={pr}
          kind={section.length}
          editId={section.id}
          onSave={save}
          onClose={() => setSection(null)}
        />
      )}
      {section && typeof section === "object" && "fee" in section && (
        <FeeEditor pr={pr} editId={section.fee === "new" ? undefined : section.fee} onSave={save} onClose={() => setSection(null)} />
      )}
      {section && typeof section === "object" && "tax" in section && (
        section.tax === "vat" ? (
          <MwStEditor pr={pr} onSave={save} onClose={() => setSection(null)} />
        ) : (
          <LokaleSteuerEditor
            pr={pr}
            propertyId={p.id}
            editId={section.id}
            onSave={save}
            onClose={() => setSection(null)}
          />
        )
      )}
      {section && typeof section === "object" && "promo" in section && (
        <PromoEditor pr={pr} editId={section.promo === "new" ? undefined : section.promo} onSave={save} onClose={() => setSection(null)} />
      )}
      {section && typeof section === "object" && "addon" in section && (
        <AddOnEditor pr={pr} editId={section.addon === "new" ? undefined : section.addon} onSave={save} onClose={() => setSection(null)} />
      )}
      {section === "taxInfo" && <TaxInfoEditor pr={pr} onSave={save} onClose={() => setSection(null)} />}
      {section === "baseLabel" && <BaseLabelEditor pr={pr} onSave={save} onClose={() => setSection(null)} />}

      {wizardOpen && (
        <RatePlanWizard
          propertyId={p.id}
          plans={plans}
          currency={cur}
          onDone={() => {
            setWizardOpen(false);
            toast.success(t("pricingForm.planCreated"));
            void loadPlans();
          }}
          onClose={() => setWizardOpen(false)}
        />
      )}
    </div>
  );
}

// Generische Listen-Sektion (Fees/Promotions/Add-ons): Titel + Add + Liste.
function ListSection<T>({
  title,
  hint,
  onAdd,
  empty,
  items,
  render,
  localOnly,
}: {
  title: string;
  hint: string;
  onAdd: () => void;
  empty: string;
  items: T[];
  render: (item: T) => React.ReactNode;
  localOnly?: boolean;
}) {
  const t = useTranslations("objects");
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-extrabold">
            {title}
            {localOnly && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {t("pricingForm.directBookingsOnly")}
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onAdd}>
          <Icon icon="ph:plus" className="size-4" /> {t("pricingForm.add")}
        </Button>
      </div>
      {items.length === 0 ? (
        <Card className="p-5 text-sm text-muted-foreground">{empty}</Card>
      ) : (
        items.map(render)
      )}
    </section>
  );
}

// Zusammenfassung einer Steuer für die Listenzeile: Wert plus die Angaben, die
// den Betrag erst eindeutig machen — bei Beträgen die Basis („pro Gast · pro
// Nacht"), bei Prozentsätzen die gewählte Bemessungsgrundlage.
function taxSummary(
  tx: Tax,
  pr: Pricing,
  cur: Currency | "",
  locale: string,
  t: (key: string) => string,
): string {
  const teile: string[] = [];
  if (tx.mode === "percent") {
    teile.push(`${tx.value}%`);
    const basis = tx.taxableBase ?? [];
    if (basis.length > 0) {
      const namen = basis.map((id) =>
        id === TAXABLE_BASE_PRICE
          ? t("pricingForm.taxableBasePrice")
          : (pr.fees.find((f) => f.id === id)?.name ?? id),
      );
      teile.push(namen.join(", "));
    }
  } else {
    const { charge, period } = taxAmountBasis(tx);
    teile.push(fmtPrice(tx.value, cur, locale));
    teile.push(
      charge === "PerPerson"
        ? t("pricingForm.chargePerPerson")
        : t("pricingForm.chargeSingle"),
    );
    teile.push(
      period === "PerNight"
        ? t("pricingForm.periodPerNight")
        : t("pricingForm.periodPerStay"),
    );
  }
  if (tx.includedInPrice) teile.push(t("pricingForm.includedInPriceSuffix"));
  return teile.join(" · ");
}

// Eine Listenzeile mit Pill + Bearbeiten/Löschen.
function ListRow({
  title,
  pill,
  badge,
  onEdit,
  onDelete,
}: {
  title: string;
  pill: string;
  badge?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("objects");
  return (
    <Card className="flex items-center justify-between gap-4 p-5">
      <div className="leading-tight">
        <p className="flex items-center gap-2 font-semibold">
          {title}
          {badge && (
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              {badge}
            </span>
          )}
        </p>
        <span className="mt-2 inline-flex w-fit items-center rounded-full bg-muted/60 px-3 py-1.5 text-sm">
          {pill}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>{t("pricingForm.edit")}</Button>
        <Button variant="ghost" size="icon" aria-label={t("pricingForm.remove")} onClick={onDelete}>
          <Icon icon="ph:trash" className="size-4 text-muted-foreground" />
        </Button>
      </div>
    </Card>
  );
}

// --- Karten/Bausteine ------------------------------------------------------

function BlockCard({
  title,
  hint,
  actionLabel,
  onEdit,
  localOnly,
  children,
}: {
  title: string;
  hint: string;
  actionLabel?: string;
  onEdit: () => void;
  localOnly?: boolean;
  children?: React.ReactNode;
}) {
  const t = useTranslations("objects");
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="leading-tight">
          <p className="flex items-center gap-2 font-semibold">
            {title}
            {localOnly && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {t("pricingForm.directBookingsOnly")}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          {actionLabel ?? t("pricingForm.edit")}
        </Button>
      </div>
      {children}
    </Card>
  );
}

// Geld-Eingabe mit Währungssuffix.
function MoneyInput({
  value,
  onChange,
  currency,
}: {
  value: number;
  onChange: (v: number) => void;
  // Wurzel 4: "" = noch keine Währung gewählt → Symbol bleibt leer, kein EUR.
  currency: Currency | "";
}) {
  return (
    <div className="flex items-center gap-2">
      <Input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
      <span className="text-sm text-muted-foreground">{currencySymbol(currency)}</span>
    </div>
  );
}

// --- Editoren ---------------------------------------------------------------

function CurrencyEditor({
  current,
  onSave,
  onClose,
}: {
  current: Currency | "";
  onSave: (next: Currency) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  // Vorbelegung nur mit einem gültigen Code; leer bleibt leer (kein erfundenes
  // Default-€, Wurzel 4) — Speichern ist dann deaktiviert.
  const [v, setV] = useState<Currency | "">(current);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title={t("pricingForm.currencyTitle")}
      subtitle={t("pricingForm.currencyEditorSubtitle")}
      onClose={onClose}
      footer={
        <Footer
          busy={busy}
          error={error}
          onCancel={onClose}
          onSave={() => v && run(v)}
          disabled={!v}
        />
      }
    >
      <Field label={t("pricingForm.currencyLabel")}>
        <Select value={v || undefined} onValueChange={(val) => setV(val as Currency)}>
          <SelectTrigger>
            <SelectValue placeholder={t("pricingForm.currencyNotSet")} />
          </SelectTrigger>
          <SelectContent>
            {CURRENCY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Hint>{t("pricingForm.currencyEditorHint")}</Hint>
    </EditorShell>
  );
}

function BaseEditor({
  pr,
  onSave,
  onClose,
}: {
  pr: Pricing;
  onSave: (next: Pricing) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [v, setV] = useState(pr);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title={t("pricingForm.basePriceTitle")}
      subtitle={t("pricingForm.baseEditorSubtitle")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      {/* Währung wird zentral am Objekt gepflegt (Sektion „Währung" oben) und
          gilt für alle Preispläne — hier nur read-only, kein zweites Select. */}
      <Field label={t("pricingForm.currencyLabel")}>
        <div className="rounded-(--radius) border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {v.currency
            ? (CURRENCY_OPTIONS.find((o) => o.value === v.currency)?.label ?? v.currency)
            : t("pricingForm.currencyNotSet")}
        </div>
      </Field>

      <div className="flex items-start gap-2 rounded-(--radius) bg-accent/10 p-3 text-sm">
        <Icon icon="ph:lightning" className="mt-0.5 size-4 shrink-0 text-accent" />
        <span>
          {t.rich("pricingForm.dynamicPricingHint", {
            link: (chunks) => (
              <Link href="/dynamic-pricing" className="font-semibold text-accent underline">
                {chunks}
              </Link>
            ),
          })}
        </span>
      </div>

      <Field label={t("pricingForm.basePricePerNightLabel")}>
        <MoneyInput value={v.basePrice} currency={v.currency} onChange={(n) => setV({ ...v, basePrice: n })} />
      </Field>

      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
        <span className="font-medium">{t("pricingForm.customByWeekdayLabel")}</span>
        <Switch checked={v.customByWeekday} onCheckedChange={(c) => setV({ ...v, customByWeekday: c })} />
      </label>

      {v.customByWeekday && (
        <div className="flex flex-col gap-2">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d.key} className="flex items-center gap-3">
              <span className="w-8 text-sm text-muted-foreground">{d.label}</span>
              <MoneyInput
                value={v.weekdayPrices[d.key]}
                currency={v.currency}
                onChange={(n) => setV({ ...v, weekdayPrices: { ...v.weekdayPrices, [d.key]: n } })}
              />
            </div>
          ))}
        </div>
      )}
    </EditorShell>
  );
}

// Portal-Logo + Name eines verbundenen Portals; ohne echtes Logo nur der Name.
function PortalMarke({ code, name }: { code: string; name: string }) {
  const logo = channelLogoLoose(code) ?? channelLogoLoose(name);
  return (
    <span className="flex min-w-0 items-center gap-2">
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="size-4 shrink-0 rounded-sm object-contain" />
      )}
      <span className="truncate text-sm font-medium">{name}</span>
    </span>
  );
}

function PortalAdjustmentsCard({
  propertyId,
  plans,
}: {
  propertyId: string;
  plans: RatePlan[];
}) {
  // Preisänderung je Portal (Lodgify-Modell „Aufschlag"): Karte zeigt nur die
  // gesetzten Aufschläge als Chips, der Stift öffnet ein Sheet mit allen
  // verbundenen Portalen. Technisch ist jeder Aufschlag ein automatisch
  // gepflegter Kanal-Plan (portal_scope) auf die effektive Tageskurve GENAU
  // dieses Portals — er ersetzt den früheren „Mark-up", der eine Attrappe war.
  // Werte kommen aus `plans` (Realtime auf rate_plans hält sie frisch).
  const t = useTranslations("objects");
  const [conns, setConns] = useState<StoredChannelConnection[] | null>(null);
  const [offen, setOffen] = useState(false);
  useEffect(() => {
    void (async () => {
      const res = await listChannelConnections(propertyId);
      if (res.ok) setConns(res.data.items);
    })();
  }, [propertyId]);

  const wert = (portal: string): number =>
    plans.find((pl) => pl.portal_scope === portal)?.offset_percent ?? 0;
  const gesetzt = (conns ?? []).filter((c) => wert(c.portal_code) !== 0);

  return (
    <>
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="leading-tight">
            <p className="font-semibold">{t("pricingForm.portalAdjustmentTitle")}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("pricingForm.portalAdjustmentHint")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("pricingForm.edit")}
            disabled={!conns?.length}
            onClick={() => setOffen(true)}
          >
            <Icon icon="ph:pencil-simple" className="size-4" />
          </Button>
        </div>
        {conns !== null && conns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("pricingForm.portalAdjustmentNone")}
          </p>
        ) : gesetzt.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {gesetzt.map((c) => {
              const v = wert(c.portal_code);
              const logo = channelLogoLoose(c.portal_code) ?? channelLogoLoose(c.portal);
              return (
                <span
                  key={c.portal_code}
                  title={c.portal}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1.5 text-sm"
                >
                  {v > 0 ? "+" : ""}
                  {v}%
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt={c.portal} className="size-4 rounded-sm object-contain" />
                  ) : (
                    <span className="text-muted-foreground">{c.portal}</span>
                  )}
                </span>
              );
            })}
          </div>
        ) : null}
      </Card>
      {offen && conns && (
        <PortalAdjustmentsEditor
          propertyId={propertyId}
          conns={conns}
          wert={wert}
          onClose={() => setOffen(false)}
        />
      )}
    </>
  );
}

function PortalAdjustmentsEditor({
  propertyId,
  conns,
  wert,
  onClose,
}: {
  propertyId: string;
  conns: StoredChannelConnection[];
  wert: (portal: string) => number;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [entwurf, setEntwurf] = useState<Record<string, string>>(() =>
    Object.fromEntries(conns.map((c) => [c.portal_code, String(wert(c.portal_code))])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ein Speichern für alle Portale: nur geänderte Werte gehen raus, jedes
  // Portal ist ein eigener Endpoint-Aufruf (eigener Kanal-Plan). Ein Fehler
  // bricht ab und lässt das Sheet offen — bereits gespeicherte Portale bleiben
  // gespeichert (Teilstand ist sichtbar, weil die Karte per Realtime folgt).
  const speichern = async () => {
    const zuAendern: Array<[string, number]> = [];
    for (const c of conns) {
      const roh = entwurf[c.portal_code] ?? "";
      const n = Number(roh.trim().replace(",", "."));
      if (roh.trim() === "" || !Number.isFinite(n) || n < -99 || n > 500) {
        setError(t("pricingForm.portalAdjustmentInvalid"));
        return;
      }
      if (n !== wert(c.portal_code)) zuAendern.push([c.portal_code, n]);
    }
    if (zuAendern.length === 0) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    for (const [portal, prozent] of zuAendern) {
      const res = await setPortalPriceAdjustment(propertyId, portal, prozent);
      if (!res.ok) {
        setBusy(false);
        setError(res.error);
        return;
      }
    }
    setBusy(false);
    toast.success(t("pricingForm.portalAdjustmentSaved"));
    onClose();
  };

  return (
    <EditorShell
      title={t("pricingForm.portalAdjustmentTitle")}
      subtitle={t("pricingForm.portalAdjustmentEditorSubtitle")}
      onClose={onClose}
      footer={
        <Footer busy={busy} error={error} onCancel={onClose} onSave={() => void speichern()} />
      }
    >
      {conns.map((c) => (
        <Field key={c.portal_code} label={<PortalMarke code={c.portal_code} name={c.portal} />}>
          <div className="relative">
            <Input
              value={entwurf[c.portal_code] ?? ""}
              onChange={(e) =>
                setEntwurf((prev) => ({ ...prev, [c.portal_code]: e.target.value }))
              }
              inputMode="decimal"
              className="pr-8"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
              %
            </span>
          </div>
        </Field>
      ))}
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Icon icon="ph:arrow-elbow-down-right" className="mt-0.5 size-4 shrink-0" />
        <span>{t("pricingForm.portalAdjustmentDirectNote")}</span>
      </p>
    </EditorShell>
  );
}

function ExtraGuestEditor({
  pr,
  onSave,
  onClose,
}: {
  pr: Pricing;
  onSave: (next: Pricing) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [v, setV] = useState(pr);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title={t("pricingForm.extraGuestTitle")}
      subtitle={t("pricingForm.extraGuestEditorSubtitle")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      <Field label={t("pricingForm.extraGuestTitle")}>
        <MoneyInput value={v.extraGuestCharge} currency={v.currency} onChange={(n) => setV({ ...v, extraGuestCharge: n })} />
      </Field>
      <Field label={t("pricingForm.extraGuestFromLabel")}>
        <Select value={String(v.extraGuestFrom)} onValueChange={(val) => setV({ ...v, extraGuestFrom: Number(val) })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <SelectItem key={n} value={String(n)}>{t("pricingForm.guestCount", { count: n })}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </EditorShell>
  );
}

function ShortStayEditor({
  pr,
  onSave,
  onClose,
}: {
  pr: Pricing;
  onSave: (next: Pricing) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [v, setV] = useState(pr);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title={t("pricingForm.shortStayTitle")}
      subtitle={t("pricingForm.shortStayHint")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      <Field label={t("pricingForm.shortStayMaxLabel")}>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            value={v.shortStayMaxNights}
            onChange={(e) => setV({ ...v, shortStayMaxNights: Number(e.target.value) || 0 })}
          />
          <span className="text-sm text-muted-foreground">{t("pricingForm.nightsUnit")}</span>
        </div>
      </Field>
      <Field label={t("pricingForm.surchargePerNightLabel")}>
        <MoneyInput value={v.shortStaySurcharge} currency={v.currency} onChange={(n) => setV({ ...v, shortStaySurcharge: n })} />
      </Field>
    </EditorShell>
  );
}

function LengthEditor({
  pr,
  kind,
  editId,
  onSave,
  onClose,
}: {
  pr: Pricing;
  kind: StayKind;
  editId?: string;
  onSave: (next: Pricing) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const existing = editId ? pr.lengthPrices.find((x) => x.id === editId) : undefined;
  const defaultMin = kind === "weekly" ? 7 : kind === "monthly" ? 30 : 14;
  const [minNights, setMinNights] = useState(existing?.minNights ?? defaultMin);
  const [price, setPrice] = useState(existing?.pricePerNight ?? 0);
  const { busy, error, run } = useSaver(onSave);

  function commit() {
    const entry: LengthPrice = {
      id: existing?.id ?? crypto.randomUUID(),
      kind,
      minNights,
      pricePerNight: price,
    };
    const list = existing
      ? pr.lengthPrices.map((x) => (x.id === entry.id ? entry : x))
      : [...pr.lengthPrices, entry];
    run({ ...pr, lengthPrices: list });
  }

  return (
    <EditorShell
      title={STAY_KIND_LABELS[kind]}
      subtitle={t("pricingForm.lengthEditorSubtitle")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={commit} disabled={price <= 0} />}
    >
      <Field label={t("pricingForm.minNightsLabel")}>
        <Input
          type="number"
          min={1}
          value={minNights}
          onChange={(e) => setMinNights(Number(e.target.value) || 1)}
          disabled={kind !== "custom"}
        />
      </Field>
      <Field label={t("pricingForm.reducedPricePerNightLabel")}>
        <MoneyInput value={price} currency={pr.currency} onChange={setPrice} />
      </Field>
    </EditorShell>
  );
}

// --- Etappe-2-Editoren ------------------------------------------------------

function FeeEditor({
  pr,
  editId,
  onSave,
  onClose,
}: {
  pr: Pricing;
  editId?: string;
  onSave: (next: Pricing) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const ex = editId ? pr.fees.find((x) => x.id === editId) : undefined;
  const [v, setV] = useState<Fee>(
    ex ?? { id: "", name: "", amount: 0, basis: "per_stay", optional: false },
  );
  const { busy, error, run } = useSaver(onSave);

  function commit() {
    const entry: Fee = { ...v, id: v.id || crypto.randomUUID() };
    const list = ex ? pr.fees.map((x) => (x.id === entry.id ? entry : x)) : [...pr.fees, entry];
    run({ ...pr, fees: list });
  }

  return (
    <EditorShell
      title={ex ? t("pricingForm.feeEditTitle") : t("pricingForm.feeAddTitle")}
      subtitle={t("pricingForm.feeEditorSubtitle")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={commit} disabled={!v.name.trim()} />}
    >
      <Field label={t("pricingForm.nameLabel")}>
        <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder={t("pricingForm.feeNamePlaceholder")} />
      </Field>
      <Field label={t("pricingForm.amountLabel")}>
        <MoneyInput value={v.amount} currency={pr.currency} onChange={(n) => setV({ ...v, amount: n })} />
      </Field>
      <Field label={t("pricingForm.calculationLabel")}>
        <BasisSelect value={v.basis} onChange={(b) => setV({ ...v, basis: b })} />
      </Field>
      <Field label={t("pricingForm.taxRateFieldLabel")}>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={v.taxRate ?? ""}
            placeholder={t("pricingForm.taxRatePlaceholder")}
            onChange={(e) => {
              if (e.target.value === "") {
                setV({ ...v, taxRate: null });
                return;
              }
              // Auf gültigen USt-Bereich 0–100 begrenzen (min/max am Input
              // blocken getippte/„2e3"-Werte nicht) — der Satz wird als
              // Snapshot in Rechnungszeilen übernommen.
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              setV({ ...v, taxRate: Math.min(100, Math.max(0, n)) });
            }}
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </Field>
      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
        <span className="font-medium">{t("pricingForm.feeOptionalLabel")}</span>
        <Switch checked={v.optional} onCheckedChange={(c) => setV({ ...v, optional: c })} />
      </label>
    </EditorShell>
  );
}

function PromoEditor({
  pr,
  editId,
  onSave,
  onClose,
}: {
  pr: Pricing;
  editId?: string;
  onSave: (next: Pricing) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const ex = editId ? pr.promotions.find((x) => x.id === editId) : undefined;
  const [v, setV] = useState<Promotion>(ex ?? { id: "", name: "", percent: 10, conditions: "" });
  const { busy, error, run } = useSaver(onSave);

  function commit() {
    const entry: Promotion = { ...v, id: v.id || crypto.randomUUID() };
    const list = ex ? pr.promotions.map((x) => (x.id === entry.id ? entry : x)) : [...pr.promotions, entry];
    run({ ...pr, promotions: list });
  }

  return (
    <EditorShell
      title={ex ? t("pricingForm.promoEditTitle") : t("pricingForm.promoAddTitle")}
      subtitle={t("pricingForm.promoEditorSubtitle")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={commit} disabled={!v.name.trim()} />}
    >
      <Field label={t("pricingForm.nameLabel")}>
        <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder={t("pricingForm.promoNamePlaceholder")} />
      </Field>
      <Field label={t("pricingForm.discountPercentLabel")}>
        <div className="flex items-center gap-2">
          <Input type="number" min={0} max={100} value={v.percent} onChange={(e) => setV({ ...v, percent: Number(e.target.value) || 0 })} />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </Field>
      <Field label={t("pricingForm.conditionsLabel")}>
        <Input value={v.conditions} onChange={(e) => setV({ ...v, conditions: e.target.value })} placeholder={t("pricingForm.conditionsPlaceholder")} />
      </Field>
    </EditorShell>
  );
}

function AddOnEditor({
  pr,
  editId,
  onSave,
  onClose,
}: {
  pr: Pricing;
  editId?: string;
  onSave: (next: Pricing) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const ex = editId ? pr.addOns.find((x) => x.id === editId) : undefined;
  const [v, setV] = useState<AddOn>(
    ex ?? { id: "", name: "", amount: 0, basis: "per_stay", active: true },
  );
  const { busy, error, run } = useSaver(onSave);

  function commit() {
    const entry: AddOn = { ...v, id: v.id || crypto.randomUUID() };
    const list = ex ? pr.addOns.map((x) => (x.id === entry.id ? entry : x)) : [...pr.addOns, entry];
    run({ ...pr, addOns: list });
  }

  return (
    <EditorShell
      title={ex ? t("pricingForm.addonEditTitle") : t("pricingForm.addonAddTitle")}
      subtitle={t("pricingForm.addonEditorSubtitle")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={commit} disabled={!v.name.trim()} />}
    >
      <Field label={t("pricingForm.nameLabel")}>
        <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder={t("pricingForm.addonNamePlaceholder")} />
      </Field>
      <Field label={t("pricingForm.priceLabel")}>
        <MoneyInput value={v.amount} currency={pr.currency} onChange={(n) => setV({ ...v, amount: n })} />
      </Field>
      <Field label={t("pricingForm.calculationLabel")}>
        <BasisSelect value={v.basis} onChange={(b) => setV({ ...v, basis: b })} />
      </Field>
      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
        <span className="font-medium">{t("pricingForm.activated")}</span>
        <Switch checked={v.active} onCheckedChange={(c) => setV({ ...v, active: c })} />
      </label>
    </EditorShell>
  );
}

function TaxInfoEditor({
  pr,
  onSave,
  onClose,
}: {
  pr: Pricing;
  onSave: (next: Pricing) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [v, setV] = useState(pr);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title={t("pricingForm.taxInfoTitle")}
      subtitle={t("pricingForm.taxInfoEditorSubtitle")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      <Field label={t("pricingForm.businessTaxIdLabel")}>
        <Input value={v.businessTaxId} onChange={(e) => setV({ ...v, businessTaxId: e.target.value })} placeholder={t("pricingForm.taxIdPlaceholder")} />
      </Field>
      <Field label={t("pricingForm.totRegistrationIdLabel")}>
        <Input value={v.totRegistrationId} onChange={(e) => setV({ ...v, totRegistrationId: e.target.value })} placeholder={t("pricingForm.taxIdPlaceholder")} />
      </Field>
    </EditorShell>
  );
}

function BaseLabelEditor({
  pr,
  onSave,
  onClose,
}: {
  pr: Pricing;
  onSave: (next: Pricing) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [v, setV] = useState(pr);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title={t("pricingForm.baseLabelEditorTitle")}
      subtitle={t("pricingForm.baseLabelEditorSubtitle")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      <Field label={t("pricingForm.nameLabel")}>
        <Input
          value={v.basePriceLabel}
          maxLength={100}
          onChange={(e) => setV({ ...v, basePriceLabel: e.target.value })}
          placeholder={t("pricingForm.baseLabelPlaceholder")}
        />
      </Field>
    </EditorShell>
  );
}

// Berechnungsbasis-Auswahl (für Gebühren & Add-ons).
function BasisSelect({ value, onChange }: { value: FeeBasis; onChange: (b: FeeBasis) => void }) {
  return (
    <Select value={value} onValueChange={(val) => onChange(val as FeeBasis)}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        {Object.entries(FEE_BASIS_LABELS).map(([k, label]) => (
          <SelectItem key={k} value={k}>{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Preisplan-Liste (SiteMinder „Rate plans"): eine Zeile je Plan mit Modus,
// Grundpreis bzw. „berechnet" (abgeleitet), Mindestaufenthalt und Aktionen.
// Preise selbst werden datumsgenau im Kalender gepflegt — von hier führt nur
// der Deep-Link dorthin.
function RatePlanList({
  plans,
  currency,
  onCreate,
  onDeleted,
}: {
  plans: RatePlan[];
  currency: Currency | "";
  onCreate: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("objects");
  const locale = useLocale();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const offsetLabel = (p: RatePlan): string => {
    const parts: string[] = [];
    if (p.offset_amount != null && p.offset_amount !== 0) {
      parts.push(`${p.offset_amount > 0 ? "+" : ""}${fmtPrice(p.offset_amount, currency, locale)}`);
    }
    if (p.offset_percent != null && p.offset_percent !== 0) {
      parts.push(`${p.offset_percent > 0 ? "+" : ""}${p.offset_percent} %`);
    }
    return parts.length ? parts.join(" · ") : "1:1";
  };

  const remove = async (id: string) => {
    // Löschen nimmt auch die Datumspreise des Plans mit — Fehlklick auf das
    // Trash-Icon darf das nicht still tun (Projekt-Muster: window.confirm).
    if (!window.confirm(t("pricingForm.planConfirmDelete"))) return;
    setBusy(id);
    setErr(null);
    const res = await deleteRatePlan(id);
    setBusy(null);
    // 409 = Basis-Plan hat abgeleitete Kinder (Server-Guard) — Meldung zeigen.
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    toast.success(t("pricingForm.planDeleted"));
    onDeleted();
  };

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-extrabold">
            {t("pricingForm.plansTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("pricingForm.plansHint")}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" asChild>
            <a href="/kalender?view=rates">{t("pricingForm.openCalendar")}</a>
          </Button>
          <Button type="button" onClick={onCreate}>
            <Icon icon="ph:plus" className="size-4" />
            {t("pricingForm.planCreate")}
          </Button>
        </div>
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}

      <ul className="flex flex-col divide-y">
        {plans.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-3">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {p.name}
            </span>
            <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
              {p.rate_mode === "derived"
                ? t("pricingForm.planModeDerived", {
                    parent: p.derived_from_name ?? "",
                    offset: offsetLabel(p),
                  })
                : t("pricingForm.planModeManual")}
            </span>
            <span className="w-24 shrink-0 text-right text-sm tabular-nums">
              {p.rate_mode === "derived"
                ? t("pricingForm.planDerivedPrice")
                : fmtPrice(p.base_price, (p.currency || "") as Currency | "", locale)}
            </span>
            <span className="w-28 shrink-0 text-right text-xs text-muted-foreground">
              {t("pricingForm.planMinStay", { nights: p.min_stay })}
            </span>
            <button
              type="button"
              onClick={() => void remove(p.id)}
              disabled={busy === p.id}
              title={t("pricingForm.planDelete")}
              className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              <Icon icon="ph:trash" className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
