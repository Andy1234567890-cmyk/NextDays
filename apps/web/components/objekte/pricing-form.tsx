"use client";

// Preis-Seite eines Objekts (Pricing, Etappe 1).
//  Nightly price: Grundpreis (Währung, Dynamic, Wochentag), Mark-up je Kanal,
//  Extra-Gast-Aufschlag, Kurzaufenthalts-Aufschlag.
//  Length of stay: Wochen-/Monats-/eigene Längenpreise.
// Gespeichert per updateProperty() in type_attributes.pricing.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  ChannelLogo,
  EditorShell,
  Field,
  Footer,
  Hint,
  Pill,
  useSaver,
} from "@/components/objekte/editor-primitives";
import { RatePlanWizard } from "@/components/objekte/rate-plan-wizard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CHANNEL_LABELS } from "@/lib/availability-meta";
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
  type TaxMode,
  CURRENCY_OPTIONS,
  FEE_BASIS_LABELS,
  MARKUP_CHANNELS,
  STAY_KIND_LABELS,
  TAX_KIND_LABELS,
  WEEKDAY_LABELS,
  currencySymbol,
  fmtPrice,
  readPricing,
} from "@/lib/pricing-meta";
import { type Property, updateProperty } from "@/lib/properties";
import {
  deleteRatePlan,
  listRatePlans,
  setBasePrice,
  type RatePlan,
} from "@/lib/rates";
import { useRealtime } from "@/lib/use-realtime";

type Section =
  | "base"
  | "markup"
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
  const multiPlan = plans.length > 1;
  const basePlan = multiPlan ? null : (plans[0] ?? null);
  // rate_plans.currency ist als text gespeichert; die UI kennt nur den
  // Currency-Union — leere/unbekannte Werte rendern symbollos (lib/currency).
  const cur = ((basePlan?.currency ?? pr.currency) || "") as Currency | "";
  const shownBasePrice = basePlan ? basePlan.base_price : pr.basePrice;

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
            <Pill>{fmtPrice(shownBasePrice, cur)}</Pill>
          </BlockCard>
        )}

        <RatePlanList
          plans={plans}
          currency={cur}
          onCreate={() => setWizardOpen(true)}
          onDeleted={() => void loadPlans()}
        />

        <BlockCard
          title={t("pricingForm.markupTitle")}
          hint={t("pricingForm.markupHint")}
          onEdit={() => setSection("markup")}
          localOnly
        >
          <span className="flex flex-wrap items-center gap-2">
            {MARKUP_CHANNELS.map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1.5 text-sm">
                <ChannelLogo channel={c} />
                {pr.markup[c] >= 0 ? "+" : ""}{pr.markup[c]}%
              </span>
            ))}
          </span>
        </BlockCard>

        <BlockCard
          title={t("pricingForm.extraGuestTitle")}
          hint={t("pricingForm.extraGuestHint")}
          actionLabel={pr.extraGuestCharge > 0 ? t("pricingForm.edit") : t("pricingForm.add")}
          onEdit={() => setSection("extraGuest")}
        >
          {pr.extraGuestCharge > 0 ? (
            <Pill>{t("pricingForm.extraGuestPill", { price: fmtPrice(pr.extraGuestCharge, cur), guest: pr.extraGuestFrom + 1 })}</Pill>
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
            <Pill>{t("pricingForm.shortStayPill", { price: fmtPrice(pr.shortStaySurcharge, cur), nights: pr.shortStayMaxNights })}</Pill>
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
                  {t("pricingForm.pricePerNight", { price: fmtPrice(lp.pricePerNight, cur) })}
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
            pill={`${fmtPrice(f.amount, cur)} · ${FEE_BASIS_LABELS[f.basis]}${f.taxRate != null ? ` · ${t("pricingForm.taxRateSuffix", { rate: f.taxRate })}` : ""
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
              <DropdownMenuItem onClick={() => setSection({ tax: "vat" })}>
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
              title={tx.name || TAX_KIND_LABELS[tx.kind]}
              pill={`${tx.mode === "percent" ? `${tx.value}%` : fmtPrice(tx.value, cur)}${tx.includedInPrice ? ` · ${t("pricingForm.includedInPriceSuffix")}` : ""}`}
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
            pill={`${fmtPrice(a.amount, cur)} · ${FEE_BASIS_LABELS[a.basis]}`}
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
      {section === "base" && (
        <BaseEditor
          // Editor mit der Plan-Wahrheit vorbelegen (rate_plans), nicht mit der
          // type_attributes-Kopie — sonst editiert man einen veralteten Wert.
          pr={basePlan ? { ...pr, basePrice: basePlan.base_price, currency: (basePlan.currency || pr.currency) as Pricing["currency"] } : pr}
          onSave={save}
          onClose={() => setSection(null)}
        />
      )}
      {section === "markup" && <MarkupEditor pr={pr} onSave={save} onClose={() => setSection(null)} />}
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
        <TaxEditor pr={pr} kind={section.tax} editId={section.id} onSave={save} onClose={() => setSection(null)} />
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
      <Field label={t("pricingForm.currencyLabel")}>
        <Select value={v.currency} onValueChange={(val) => setV({ ...v, currency: val as Currency })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="flex items-start gap-2 rounded-(--radius) bg-accent/10 p-3 text-sm">
        <Icon icon="ph:lightning" className="mt-0.5 size-4 shrink-0 text-accent" />
        <span>
          {t.rich("pricingForm.dynamicPricingHint", {
            link: (chunks) => (
              <a href="/dynamic-pricing" className="font-semibold text-accent underline">
                {chunks}
              </a>
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

function MarkupEditor({
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
      title={t("pricingForm.markupEditorTitle")}
      subtitle={t("pricingForm.markupEditorSubtitle")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      {MARKUP_CHANNELS.map((c) => (
        <Field
          key={c}
          label={
            <span className="flex items-center gap-1.5">
              <ChannelLogo channel={c} />
              {CHANNEL_LABELS[c]}
            </span>
          }
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={v.markup[c]}
              onChange={(e) => setV({ ...v, markup: { ...v.markup, [c]: Number(e.target.value) || 0 } })}
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </Field>
      ))}
      <Hint>{t("pricingForm.markupHintNote")}</Hint>
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

function TaxEditor({
  pr,
  kind,
  editId,
  onSave,
  onClose,
}: {
  pr: Pricing;
  kind: TaxKind;
  editId?: string;
  onSave: (next: Pricing) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const ex = editId ? pr.taxes.find((x) => x.id === editId) : undefined;
  const [v, setV] = useState<Tax>(
    ex ?? { id: "", kind, name: "", mode: "percent", value: 0, includedInPrice: false },
  );
  const { busy, error, run } = useSaver(onSave);

  function commit() {
    const entry: Tax = { ...v, id: v.id || crypto.randomUUID() };
    const list = ex ? pr.taxes.map((x) => (x.id === entry.id ? entry : x)) : [...pr.taxes, entry];
    run({ ...pr, taxes: list });
  }

  return (
    <EditorShell
      title={kind === "vat" ? t("pricingForm.vatLabel") : t("pricingForm.localTaxLabel")}
      subtitle={t("pricingForm.taxEditorSubtitle")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={commit} />}
    >
      <Field label={t("pricingForm.designationLabel")}>
        <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder={kind === "vat" ? t("pricingForm.vatPlaceholder") : t("pricingForm.localTaxPlaceholder")} />
      </Field>
      <Field label={t("pricingForm.taxModeLabel")}>
        <Select value={v.mode} onValueChange={(val) => setV({ ...v, mode: val as TaxMode })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="percent">{t("pricingForm.taxModePercent")}</SelectItem>
            <SelectItem value="amount">{t("pricingForm.taxModeAmount")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label={v.mode === "percent" ? t("pricingForm.rateLabel") : t("pricingForm.amountLabel")}>
        {v.mode === "percent" ? (
          <div className="flex items-center gap-2">
            <Input type="number" min={0} value={v.value} onChange={(e) => setV({ ...v, value: Number(e.target.value) || 0 })} />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        ) : (
          <MoneyInput value={v.value} currency={pr.currency} onChange={(n) => setV({ ...v, value: n })} />
        )}
      </Field>
      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
        <span className="font-medium">{t("pricingForm.includedInPriceLabel")}</span>
        <Switch checked={v.includedInPrice} onCheckedChange={(c) => setV({ ...v, includedInPrice: c })} />
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
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const offsetLabel = (p: RatePlan): string => {
    const parts: string[] = [];
    if (p.offset_amount != null && p.offset_amount !== 0) {
      parts.push(`${p.offset_amount > 0 ? "+" : ""}${fmtPrice(p.offset_amount, currency)}`);
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
                : fmtPrice(p.base_price, (p.currency || "") as Currency | "")}
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
