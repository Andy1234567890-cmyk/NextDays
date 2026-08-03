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
  useSaver,
} from "@/components/objekte/editor-primitives";
import {
  PreisAbschnitt,
  PreisBadge,
  PreisChip,
  PreisHinzufuegen,
  PreisKarte,
  PreisLeer,
  PreisSeitenkopf,
  PreisSpalte,
  PreisSymbolAktion,
  PreisTextAktion,
} from "@/components/objekte/pricing/preis-bausteine";
import { RatePlanWizard } from "@/components/objekte/rate-plan-wizard";
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
import { EinschraenkungenEditor } from "@/components/objekte/pricing/einschraenkungen-editor";
import { GebuehrAuswahl } from "@/components/objekte/pricing/gebuehr-auswahl";
import { GebuehrEditor } from "@/components/objekte/pricing/gebuehren-editor";
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
import { channelLabel, channelLogoLoose } from "@/lib/channel-logos";
import {
  getAbgabenStatus,
  listChannelConnections,
  setPortalPriceAdjustment,
  type AbgabePostenStatus,
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

/** Sync-Stand der Abgaben eines Objekts, wie der Server ihn liefert. */
type AbgabenStatus = {
  currency_missing: boolean;
  portals: string[];
  items: AbgabePostenStatus[];
};

type Section =
  | "currency"
  | "base"
  | "extraGuest"
  | "shortStay"
  | { length: StayKind; id?: string }
  // Auswahlschritt VOR dem Gebühren-Formular („neue oder bestehende Gebühr"),
  // wie im Branchenstandard `assign-fee`.
  | "feePick"
  // `vorlage` = übernommene Gebühr aus der Auswahlliste (neue Kennung, gleiche
  // Felder). Nur bei `fee: "new"` gesetzt.
  | { fee: string | "new"; vorlage?: Fee }
  | { restrict: "fee" | "tax"; id: string }
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

  // Welcher Posten kommt bei welchem verbundenen Portal NICHT an? Gerechnet vom
  // Server aus derselben Quelle, aus der der Sync sendet (`ota_abgaben`) — die
  // Oberfläche führt dazu KEINE eigene Regeltabelle, sonst behauptete der Chip
  // „geht raus", wo der Sync den Posten wegließe.
  const [abgaben, setAbgaben] = useState<AbgabenStatus | null>(null);
  const loadAbgaben = useCallback(async () => {
    const res = await getAbgabenStatus(p.id);
    // Bei Fehler bleibt der Stand LEER, nicht „alles synchron": ein nicht
    // ladbarer Status darf nicht als Erfolgsmeldung aussehen (Wurzel 4).
    setAbgaben(res.ok ? res.data : null);
  }, [p.id]);
  useEffect(() => {
    void loadAbgaben();
  }, [loadAbgaben]);
  // Verbindet/trennt der Betrieb ein Portal, ändert sich die Antwort — ohne das
  // Abo stünde der Chip bis zum nächsten Seitenaufruf falsch da.
  useRealtime({
    table: "channex_channel_connection",
    filter: `property_id=eq.${p.id}`,
    onChange: () => void loadAbgaben(),
  });

  // Fehler beim Übertragen eines Postens auf weitere Objekte. Er entsteht NACH
  // dem Speichern — also nachdem der Editor-Dialog geschlossen wurde. Deshalb
  // liegt er hier auf der Seite: im Dialog wäre die Meldung an eine Fläche
  // geheftet, die es in dem Moment nicht mehr gibt, und ein fehlgeschlagenes
  // Verteilen sähe wie ein erfolgreiches aus (Wurzel 5 — nichts verschlucken).
  const [verteilFehler, setVerteilFehler] = useState<string | null>(null);

  /** Portale, bei denen dieser Posten von Hand gepflegt werden muss. */
  function manualPortals(key: string): string[] {
    return abgaben?.items.find((x) => x.key === key)?.manual_portals ?? [];
  }

  async function save(next: Pricing): Promise<true | string> {
    const res = await updateProperty(p.id, {
      type_attributes: { ...p.type_attributes, pricing: next },
    });
    if (!res.ok) return res.error;
    setP(res.data);
    setSection(null);
    // Der Sync-Stand hängt an den gerade gespeicherten Posten — ohne diesen
    // Aufruf zeigte der Chip den Stand VOR der Änderung.
    void loadAbgaben();
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
    <PreisSpalte>
      <PreisSeitenkopf title={t("pricingForm.pageTitle")} />

      {/* Ein Posten wurde gespeichert, ließ sich aber nicht auf alle gewählten
          Objekte übertragen. Die Meldung steht HIER und nicht im Editor: der ist
          nach dem Speichern zu, und ein fehlgeschlagenes Verteilen sähe sonst
          wie ein erfolgreiches aus. Sie bleibt stehen, bis der nächste Vorgang
          sie ersetzt — ein Toast wäre weg, bevor man ihn gelesen hat. */}
      {verteilFehler && (
        <p
          role="alert"
          className="rounded-(--radius) border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {verteilFehler}
        </p>
      )}

      {/* Zentrale Objektwährung — gilt für ALLE Preispläne dieses Objekts
          (FeWo wie Hotel). Eine Stelle, kein Setzen je Rate-Plan (Channex:
          1 Objekt = 1 Währung, Migration 0161). */}
      <section className="pb-16">
        <BlockCard
          title={t("pricingForm.currencyTitle")}
          hint={t("pricingForm.currencyHint")}
          hasValue={Boolean(cur)}
          onEdit={() => setSection("currency")}
        >
          {cur ? (
            <PreisChip>
              {CURRENCY_OPTIONS.find((o) => o.value === cur)?.label ?? cur}
            </PreisChip>
          ) : null}
        </BlockCard>
      </section>

      {/* Nightly price */}
      <PreisAbschnitt
        title={t("pricingForm.nightlyPriceTitle")}
        hint={t("pricingForm.nightlyPriceHint")}
      >
        {/* Ein Plan → Objekt-Grundpreis direkt pflegbar. Mehrere Pläne (BAR/B&B,
            abgeleitet) → kein EINER Objekt-Grundpreis; die Pläne werden
            datumsgenau im Kalender gepflegt. Die Liste steht in beiden Fällen. */}
        {!multiPlan && (
          <BlockCard
            title={t("pricingForm.basePriceTitle")}
            hint={t("pricingForm.basePriceHint")}
            hasValue
            onEdit={() => setSection("base")}
          >
            <PreisChip>{fmtPrice(shownBasePrice, cur, locale)}</PreisChip>
          </BlockCard>
        )}

        {dpEnabled && (
          <PreisKarte
            className="border-accent/40 bg-accent/5"
            title={
              <span className="flex items-center gap-2">
                <span aria-hidden className="text-accent">⚡</span>
                {t("pricingForm.dynamicActiveTitle")}
              </span>
            }
            hint={t("pricingForm.dynamicActiveHint")}
            action={
              <PreisTextAktion asChild>
                <a href={`/dynamic-pricing/${p.id}`}>
                  {t("pricingForm.dynamicActiveOpen")}
                </a>
              </PreisTextAktion>
            }
          />
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
          hasValue={pr.extraGuestCharge > 0}
          onEdit={() => setSection("extraGuest")}
        >
          {pr.extraGuestCharge > 0 ? (
            <PreisChip>{t("pricingForm.extraGuestPill", { price: fmtPrice(pr.extraGuestCharge, cur, locale), guest: pr.extraGuestFrom + 1 })}</PreisChip>
          ) : null}
        </BlockCard>

        <BlockCard
          title={t("pricingForm.shortStayTitle")}
          hint={t("pricingForm.shortStayHint")}
          hasValue={pr.shortStayMaxNights > 0}
          onEdit={() => setSection("shortStay")}
          localOnly
        >
          {pr.shortStayMaxNights > 0 ? (
            <PreisChip>{t("pricingForm.shortStayPill", { price: fmtPrice(pr.shortStaySurcharge, cur, locale), nights: pr.shortStayMaxNights })}</PreisChip>
          ) : null}
        </BlockCard>
      </PreisAbschnitt>

      {/* Length of stay prices */}
      <PreisAbschnitt
        title={t("pricingForm.lengthPricesTitle")}
        hint={t("pricingForm.lengthPricesHint")}
        badge={<PreisBadge>{t("pricingForm.directBookingsOnly")}</PreisBadge>}
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <PreisHinzufuegen label={t("pricingForm.add")} />
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
        }
      >
        {pr.lengthPrices.length === 0 ? (
          <PreisLeer>{t("pricingForm.lengthPricesEmpty")}</PreisLeer>
        ) : (
          pr.lengthPrices.map((lp) => (
            <PreisKarte
              key={lp.id}
              title={STAY_KIND_LABELS[lp.kind]}
              hint={t("pricingForm.minNightsOrMore", { nights: lp.minNights })}
              action={
                <div className="flex shrink-0 items-center">
                  <PreisSymbolAktion
                    label={t("pricingForm.edit")}
                    onClick={() => setSection({ length: lp.kind, id: lp.id })}
                  />
                  <PreisSymbolAktion
                    icon="ph:trash"
                    label={t("pricingForm.remove")}
                    onClick={() => save({ ...pr, lengthPrices: pr.lengthPrices.filter((x) => x.id !== lp.id) })}
                  />
                </div>
              }
            >
              <PreisChip>
                {t("pricingForm.pricePerNight", { price: fmtPrice(lp.pricePerNight, cur, locale) })}
              </PreisChip>
            </PreisKarte>
          ))
        )}
      </PreisAbschnitt>

      {/* Fees */}
      <ListSection
        title={t("pricingForm.feesTitle")}
        hint={t("pricingForm.feesHint")}
        onAdd={() => setSection("feePick")}
        empty={t("pricingForm.feesEmpty")}
        items={pr.fees}
        render={(f) => (
          <ListRow
            key={f.id}
            title={f.name}
            pill={feeSummary(f, cur, locale, t)}
            badge={
              (f.portalScope ?? []).length > 0
                ? t("pricingForm.restrictedSuffix")
                : undefined
            }
            manualPortals={manualPortals(f.id)}
            onEdit={() => setSection({ fee: f.id })}
            onRestrict={() => setSection({ restrict: "fee", id: f.id })}
            onDelete={() => save({ ...pr, fees: pr.fees.filter((x) => x.id !== f.id) })}
          />
        )}
        /* Ohne Objektwährung überträgt der Abgaben-Sync GAR NICHTS. Das ist ein
           Befund über das Objekt, kein Chip an jedem Posten — deshalb einmal
           unter der Liste und nicht zwanzigmal in den Zeilen. */
        footer={
          abgaben?.currency_missing && pr.fees.length + pr.taxes.length > 0 ? (
            <PreisLeer>{t("pricingForm.abgabenNoCurrency")}</PreisLeer>
          ) : undefined
        }
      />

      {/* Taxes */}
      <PreisAbschnitt
        title={t("pricingForm.taxesTitle")}
        hint={t("pricingForm.taxesHint")}
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <PreisHinzufuegen label={t("pricingForm.add")} />
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
        }
      >
        {pr.taxes.length === 0 ? (
          <PreisLeer>{t("pricingForm.taxesEmpty")}</PreisLeer>
        ) : (
          pr.taxes.map((tx) => (
            <ListRow
              key={tx.id}
              title={
                tx.kind === "vat"
                  ? t("pricingForm.vatLabel")
                  : taxDisplayName(tx, locale) || TAX_KIND_LABELS[tx.kind]
              }
              pill={taxSummary(tx, cur, locale, t)}
              badge={
                (tx.portalScope ?? []).length > 0
                  ? t("pricingForm.restrictedSuffix")
                  : undefined
              }
              manualPortals={manualPortals(tx.id)}
              onEdit={() => setSection({ tax: tx.kind, id: tx.id })}
              onRestrict={() => setSection({ restrict: "tax", id: tx.id })}
              onDelete={() => save({ ...pr, taxes: pr.taxes.filter((x) => x.id !== tx.id) })}
            />
          ))
        )}
      </PreisAbschnitt>

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
            badgeTone="success"
            pill={`${fmtPrice(a.amount, cur, locale)} · ${FEE_BASIS_LABELS[a.basis]}`}
            onEdit={() => setSection({ addon: a.id })}
            onDelete={() => save({ ...pr, addOns: pr.addOns.filter((x) => x.id !== a.id) })}
          />
        )}
      />

      {/* Other information */}
      <PreisAbschnitt title={t("pricingForm.otherInfoTitle")}>
        <BlockCard
          title={t("pricingForm.taxInfoTitle")}
          hint={t("pricingForm.taxInfoHint")}
          hasValue={Boolean(pr.businessTaxId || pr.totRegistrationId)}
          onEdit={() => setSection("taxInfo")}
        >
          {(pr.businessTaxId || pr.totRegistrationId) && (
            <PreisChip>{[pr.businessTaxId, pr.totRegistrationId].filter(Boolean).join(" · ")}</PreisChip>
          )}
        </BlockCard>
        <BlockCard
          title={t("pricingForm.baseLabelTitle")}
          hint={t("pricingForm.baseLabelHint")}
          hasValue={Boolean(pr.basePriceLabel)}
          onEdit={() => setSection("baseLabel")}
        >
          {pr.basePriceLabel && <PreisChip>{pr.basePriceLabel}</PreisChip>}
        </BlockCard>
      </PreisAbschnitt>

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
      {section === "feePick" && (
        <GebuehrAuswahl
          propertyId={p.id}
          summary={(f) => feeSummary(f, cur, locale, t)}
          onNew={() => setSection({ fee: "new" })}
          onPick={(f) => setSection({ fee: "new", vorlage: f })}
          onClose={() => setSection(null)}
        />
      )}
      {section && typeof section === "object" && "fee" in section && (
        <GebuehrEditor
          pr={pr}
          propertyId={p.id}
          editId={section.fee === "new" ? undefined : section.fee}
          vorlage={section.vorlage}
          onSave={save}
          onApplyError={setVerteilFehler}
          onClose={() => setSection(null)}
        />
      )}
      {section && typeof section === "object" && "restrict" in section && (
        <EinschraenkungenEditor
          pr={pr}
          propertyId={p.id}
          kind={section.restrict}
          id={section.id}
          onSave={save}
          onClose={() => setSection(null)}
        />
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
            onApplyError={setVerteilFehler}
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
    </PreisSpalte>
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
  footer,
}: {
  title: string;
  hint: string;
  onAdd: () => void;
  empty: string;
  items: T[];
  render: (item: T) => React.ReactNode;
  localOnly?: boolean;
  /** Hinweis UNTER der Liste (gilt für die Liste als Ganzes, nicht je Zeile). */
  footer?: React.ReactNode;
}) {
  const t = useTranslations("objects");
  return (
    <PreisAbschnitt
      title={title}
      hint={hint}
      badge={
        localOnly ? <PreisBadge>{t("pricingForm.directBookingsOnly")}</PreisBadge> : undefined
      }
      action={<PreisHinzufuegen label={t("pricingForm.add")} onClick={onAdd} />}
    >
      {items.length === 0 ? <PreisLeer>{empty}</PreisLeer> : items.map(render)}
      {footer}
    </PreisAbschnitt>
  );
}

// Zusammenfassung einer Gebühr für die Listenzeile. Prozent und Betrag lesen
// sich unterschiedlich: ein Prozentsatz ist immer einmalig auf den Zimmerpreis,
// eine Basis dranzuschreiben wäre falsch.
function feeSummary(
  f: Fee,
  cur: Currency | "",
  locale: string,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  const teile: string[] = [];
  if ((f.mode ?? "amount") === "percent") {
    teile.push(`${f.amount}%`);
    teile.push(t("pricingForm.feeModePercentShort"));
  } else {
    teile.push(fmtPrice(f.amount, cur, locale));
    teile.push(FEE_BASIS_LABELS[f.basis]);
  }
  if (f.taxRate != null) {
    teile.push(t("pricingForm.taxRateSuffix", { rate: f.taxRate }));
  }
  if (f.optional) teile.push(t("pricingForm.optionalSuffix"));
  if ((f.portalScope ?? []).length > 0) {
    teile.push(t("pricingForm.restrictedSuffix"));
  }
  return teile.join(" · ");
}

// Zusammenfassung einer Steuer für die Listenzeile: Wert plus die Angaben, die
// den Betrag erst eindeutig machen — bei Beträgen die Basis („pro Gast · pro
// Nacht"), bei Prozentsätzen die gewählte Bemessungsgrundlage.
function taxSummary(
  tx: Tax,
  cur: Currency | "",
  locale: string,
  t: (key: string) => string,
): string {
  const teile: string[] = [];
  if (tx.mode === "percent") {
    teile.push(`${tx.value}%`);
    const basis = tx.taxableBase ?? [];
    if (basis.length > 0) {
      // Die Grundlage sind Kategorien, keine einzelnen Gebühren — mehrere
      // Gebührenarten fallen beim Portal auf dieselbe Kategorie.
      teile.push(
        basis
          .map((item) =>
            item === TAXABLE_BASE_PRICE
              ? t("pricingForm.taxableBasePrice")
              : t(`pricingForm.taxableBaseCategory.${item}`),
          )
          .join(", "),
      );
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
  badgeTone,
  manualPortals,
  onEdit,
  onDelete,
  onRestrict,
}: {
  title: string;
  pill: string;
  badge?: string;
  /** `info` (Standard) = Einschränkung/Umfang, `success` = aktiv geschaltet. */
  badgeTone?: "info" | "success";
  /** Portale, die diesen Posten NICHT automatisch bekommen — dort muss er im
   *  Extranet gepflegt werden. Kommt gerechnet vom Server (Wurzel 4: die Zeile
   *  behauptet nichts, was der Sync nicht belegt). */
  manualPortals?: string[];
  onEdit: () => void;
  onDelete: () => void;
  /** Gesetzt bei Gebühren/Steuern: die Kanal-Einschränkung ist ein EIGENER
   *  Dialog neben Bearbeiten und Entfernen — sie gehört nicht zum Posten
   *  selbst, sondern regelt, wohin er geht. */
  onRestrict?: () => void;
}) {
  const t = useTranslations("objects");
  return (
    <PreisKarte
      title={title}
      badge={badge ? <PreisBadge tone={badgeTone}>{badge}</PreisBadge> : undefined}
      action={
        onRestrict ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <PreisSymbolAktion
                icon="ph:dots-three-vertical"
                label={t("pricingForm.actions")}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Icon icon="ph:pencil-simple" className="size-4" />
                {t("pricingForm.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onRestrict}>
                <Icon icon="ph:arrows-in-line-vertical" className="size-4" />
                {t("pricingForm.restrictionsTitle")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete}>
                <Icon icon="ph:trash" className="size-4" />
                {t("pricingForm.remove")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex shrink-0 items-center">
            <PreisSymbolAktion label={t("pricingForm.edit")} onClick={onEdit} />
            <PreisSymbolAktion icon="ph:trash" label={t("pricingForm.remove")} onClick={onDelete} />
          </div>
        )
      }
    >
      <PreisChip>{pill}</PreisChip>
      {/* „Manuelle Synchronisierung" mit den Logos der betroffenen Portale —
          genau so führt es der Branchenstandard direkt am Posten. Der Chip
          erscheint NUR, wenn ein verbundenes Portal den Posten wirklich
          nicht nimmt; ohne echtes Markenlogo bleibt es beim Namen. */}
      {(manualPortals ?? []).length > 0 && (
        <PreisChip>
          {t("pricingForm.manualSyncLabel")}
          {(manualPortals ?? []).map((code) => (
            <PortalMarke key={code} code={code} name={channelLabel(code)} nurLogo />
          ))}
        </PreisChip>
      )}
    </PreisKarte>
  );
}

// --- Karten/Bausteine ------------------------------------------------------

function BlockCard({
  title,
  hint,
  hasValue,
  onEdit,
  localOnly,
  children,
}: {
  title: string;
  hint: string;
  /** Ist schon etwas eingerichtet? Dann führt der Stift hinein (Branchen-
   *  standard), sonst steht dort das Wort „Hinzufügen" — der Stift an einer
   *  leeren Karte behauptete, es gäbe etwas zu ändern. */
  hasValue?: boolean;
  onEdit: () => void;
  localOnly?: boolean;
  children?: React.ReactNode;
}) {
  const t = useTranslations("objects");
  return (
    <PreisKarte
      title={title}
      hint={hint}
      badge={
        localOnly ? <PreisBadge>{t("pricingForm.directBookingsOnly")}</PreisBadge> : undefined
      }
      action={
        hasValue ? (
          <PreisSymbolAktion label={t("pricingForm.edit")} onClick={onEdit} />
        ) : (
          <PreisTextAktion label={t("pricingForm.add")} onClick={onEdit} />
        )
      }
    >
      {children}
    </PreisKarte>
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
// KEIN generisches Ersatz-Icon (ausdrückliche Vorgabe, lib/channel-logos): ein
// Platzhalter-Symbol sähe nach „irgendein Kanal" aus.
function PortalMarke({
  code,
  name,
  nurLogo,
}: {
  code: string;
  name: string;
  /** Im Chip „Manuelle Synchronisierung" stehen bis zu drei Portale neben
   *  Fließtext — dort trägt nur das Logo, der Name würde die Zeile sprengen.
   *  Ohne Logo bleibt der Name, sonst stünde da nichts. */
  nurLogo?: boolean;
}) {
  const logo = channelLogoLoose(code) ?? channelLogoLoose(name);
  if (nurLogo) {
    // Feste HÖHE, freie Breite: die echten Logos sind teils Wortmarken
    // (Booking.com, Expedia). In ein 16×16-Quadrat gequetscht werden sie zu
    // einem grauen Strich — man sieht, dass da etwas ist, aber nicht welches
    // Portal. Genau die Information trägt der Chip aber.
    return logo ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={name}
        title={name}
        className="h-4 w-auto max-w-20 rounded-sm object-contain"
      />
    ) : (
      <span className="text-xs font-medium">{name}</span>
    );
  }
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
      <PreisKarte
        title={t("pricingForm.portalAdjustmentTitle")}
        hint={t("pricingForm.portalAdjustmentHint")}
        action={
          <PreisSymbolAktion
            label={t("pricingForm.edit")}
            disabled={!conns?.length}
            onClick={() => setOffen(true)}
          />
        }
      >
        {conns !== null && conns.length === 0 ? (
          <PreisLeer>{t("pricingForm.portalAdjustmentNone")}</PreisLeer>
        ) : (
          gesetzt.map((c) => {
            const v = wert(c.portal_code);
            const logo = channelLogoLoose(c.portal_code) ?? channelLogoLoose(c.portal);
            return (
              <span key={c.portal_code} title={c.portal}>
                <PreisChip>
                  {v > 0 ? "+" : ""}
                  {v}%
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt={c.portal} className="size-4 rounded-sm object-contain" />
                  ) : (
                    c.portal
                  )}
                </PreisChip>
              </span>
            );
          })
        )}
      </PreisKarte>
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
    <PreisKarte
      title={t("pricingForm.plansTitle")}
      hint={t("pricingForm.plansHint")}
      action={
        <div className="flex shrink-0 items-center">
          <PreisTextAktion asChild>
            <a href="/kalender?view=rates">{t("pricingForm.openCalendar")}</a>
          </PreisTextAktion>
          <PreisTextAktion onClick={onCreate}>
            <Icon icon="ph:plus" className="size-4" />
            {t("pricingForm.planCreate")}
          </PreisTextAktion>
        </div>
      }
    >
      {err && <p className="w-full text-[0.8125rem] leading-5 text-destructive">{err}</p>}

      <ul className="flex w-full flex-col divide-y">
        {plans.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium leading-5">
              {p.name}
            </span>
            <PreisChip>
              {p.rate_mode === "derived"
                ? t("pricingForm.planModeDerived", {
                    parent: p.derived_from_name ?? "",
                    offset: offsetLabel(p),
                  })
                : t("pricingForm.planModeManual")}
            </PreisChip>
            <span className="w-24 shrink-0 text-right text-[0.8125rem] leading-5 tabular-nums">
              {p.rate_mode === "derived"
                ? t("pricingForm.planDerivedPrice")
                : fmtPrice(p.base_price, (p.currency || "") as Currency | "", locale)}
            </span>
            <span className="w-28 shrink-0 text-right text-xs leading-4 text-muted-foreground">
              {t("pricingForm.planMinStay", { nights: p.min_stay })}
            </span>
            <PreisSymbolAktion
              icon="ph:trash"
              label={t("pricingForm.planDelete")}
              disabled={busy === p.id}
              onClick={() => void remove(p.id)}
            />
          </li>
        ))}
      </ul>
    </PreisKarte>
  );
}
