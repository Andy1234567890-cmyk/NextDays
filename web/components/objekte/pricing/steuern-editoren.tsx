"use client";

// Steuer-Editoren der Preise-Seite: USt./MwSt. (genau eine je Objekt) und
// lokale Steuern (Kurtaxe & Co.) im vollen Umfang, den die Portale brauchen:
// Steuerart nach der Airbnb-Taxonomie, Betrag pro Gast/Nacht, prozentuale
// Bemessungsgrundlage, gastseitiger Name je Sprache und Übernahme auf weitere
// Objekte. Liegt bewusst neben pricing-form.tsx, statt sie weiter aufzublähen.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  EditorShell,
  Field,
  Footer,
  Hint,
  useSaver,
} from "@/components/objekte/editor-primitives";
import { Button } from "@nextdays/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
import { Input } from "@nextdays/ui/input";
import { MultiSelect } from "@nextdays/ui/multi-select";
import { RichTextEditor } from "@nextdays/ui/rich-text-editor";
import { Segmented } from "@nextdays/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nextdays/ui/select";
import {
  type Currency,
  type LocalTaxType,
  type Pricing,
  type Tax,
  type TaxChargeBasis,
  type TaxPeriod,
  LOCAL_TAX_TYPES,
  TAXABLE_BASE_ITEMS,
  TAXABLE_BASE_PRICE,
  currencySymbol,
} from "@/lib/pricing-meta";
import { type Locale, LOCALES, LOCALE_LABELS } from "@/i18n/locales";
import { applyTaxToProperties } from "@/lib/properties";
import { ZuAnderenObjekten } from "@/components/objekte/pricing/zu-anderen-objekten";

/** USt./MwSt.: genau zwei Angaben — Satz und ob er im Preis steckt. Einen
 *  eigenen Namen bekommt sie nicht (sie IST die Umsatzsteuer des Objekts). */
export function MwStEditor({
  pr,
  onSave,
  onClose,
}: {
  pr: Pricing;
  onSave: (next: Pricing) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const vorhanden = pr.taxes.find((x) => x.kind === "vat");
  const [satz, setSatz] = useState<number>(vorhanden?.value ?? 0);
  const [enthalten, setEnthalten] = useState<boolean>(
    vorhanden?.includedInPrice ?? true,
  );
  const { busy, error, run } = useSaver(onSave);

  function commit() {
    // Bestehende Zeile SPREADEN, nicht von Null bauen: dieser Editor zeigt nur
    // Satz und „im Preis enthalten", die USt trägt aber weitere Felder
    // (portalScope, names, descriptionHtml). Ohne den Spread löschte jedes
    // Öffnen-und-Speichern sie stillschweigend.
    const eintrag: Tax = {
      ...vorhanden,
      id: vorhanden?.id || crypto.randomUUID(),
      kind: "vat",
      name: vorhanden?.name ?? "",
      mode: "percent",
      value: satz,
      includedInPrice: enthalten,
    };
    // Nur EINE USt je Objekt (der Server erzwingt es zusätzlich): eine
    // bestehende wird ersetzt, nicht ergänzt.
    const rest = pr.taxes.filter((x) => x.kind !== "vat");
    run({ ...pr, taxes: [...rest, eintrag] });
  }

  return (
    <EditorShell
      title={t("pricingForm.vatLabel")}
      subtitle={t("pricingForm.vatEditorSubtitle")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={commit} />}
    >
      <Field label={t("pricingForm.rateLabel")}>
        <div className="relative">
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={satz}
            placeholder="0.00"
            onChange={(e) => setSatz(Number(e.target.value) || 0)}
            className="pr-8"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
            %
          </span>
        </div>
      </Field>
      <Field label={t("pricingForm.includedInPriceLabel")}>
        <Select
          value={enthalten ? "included" : "excluded"}
          onValueChange={(v) => setEnthalten(v === "included")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="included">{t("pricingForm.vatIncluded")}</SelectItem>
            <SelectItem value="excluded">{t("pricingForm.vatExcluded")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </EditorShell>
  );
}

/** Lokale Steuer (Kurtaxe, Beherbergungssteuer …) im vollen Umfang. */
export function LokaleSteuerEditor({
  pr,
  propertyId,
  editId,
  onSave,
  onApplyError,
  onClose,
}: {
  pr: Pricing;
  propertyId: string;
  editId?: string;
  onSave: (next: Pricing) => Promise<true | string>;
  /** Fehler beim Übertragen auf weitere Objekte — gemeldet an die SEITE, weil
   *  dieser Dialog nach erfolgreichem Speichern nicht mehr steht. */
  onApplyError: (error: string | null) => void;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const vorhanden = editId ? pr.taxes.find((x) => x.id === editId) : undefined;
  const [v, setV] = useState<Tax>(
    vorhanden ?? {
      id: "",
      kind: "local",
      taxType: "TouristTax",
      name: "",
      mode: "amount",
      value: 0,
      chargeBasis: "SingleCharge",
      period: "PerStay",
      includedInPrice: false,
    },
  );
  const [sprache, setSprache] = useState<Locale>("de");
  const [ziele, setZiele] = useState<string[]>([]);
  const { busy, error, run } = useSaver(onSave);

  const setzeName = (text: string) =>
    setV((alt) => ({
      ...alt,
      names: { ...(alt.names ?? {}), [sprache]: text },
      // Der interne Name folgt der deutschen Eingabe, damit Listen und
      // Bestands-Rechnungen einen Namen haben, auch ohne Übersetzungen.
      name: sprache === "de" ? text : alt.name,
    }));

  async function commit() {
    const eintrag: Tax = { ...v, id: v.id || crypto.randomUUID() };
    const liste = vorhanden
      ? pr.taxes.map((x) => (x.id === eintrag.id ? eintrag : x))
      : [...pr.taxes, eintrag];
    const ok = await run({ ...pr, taxes: liste });
    // Übernahme auf weitere Objekte erst NACH dem Speichern — vorher gibt es
    // die Steuer am Quell-Objekt noch nicht. Und nur bei Erfolg: ein
    // fehlgeschlagenes Speichern verteilte sonst trotzdem eine Steuer, die es am
    // Quell-Objekt gar nicht gibt. Ein Fehler beim Verteilen bleibt sichtbar,
    // statt still zu verschwinden (Wurzel 5).
    if (ok && ziele.length > 0) {
      const res = await applyTaxToProperties(propertyId, eintrag.id, ziele);
      // Nach oben, nicht in diesen Dialog: erfolgreiches Speichern schließt ihn.
      onApplyError(res.ok ? null : res.error);
    }
  }

  const waehrung: Currency | "" = pr.currency;
  // Bemessungsgrundlage = Grundpreis + GebührenKATEGORIEN, nicht einzelne
  // Gebühren: beim Portal werden mehrere Gebührenarten zu EINER Gebühr ihrer
  // Kategorie zusammengefasst, „genau diese eine Gebühr" gibt es dort nicht.
  const grundlagenOptionen = TAXABLE_BASE_ITEMS.map((item) => ({
    value: item,
    label:
      item === TAXABLE_BASE_PRICE
        ? t("pricingForm.taxableBasePrice")
        : t(`pricingForm.taxableBaseCategory.${item}`),
  }));

  return (
    <EditorShell
      title={
        vorhanden ? t("pricingForm.localTaxEditTitle") : t("pricingForm.localTaxNewTitle")
      }
      subtitle={t("pricingForm.localTaxEditorSubtitle")}
      onClose={onClose}
      footer={
        <Footer
          busy={busy}
          error={error}
          onCancel={onClose}
          onSave={() => void commit()}
        />
      }
    >
      <Hint>
        {t("pricingForm.localTaxHelpHint")}{" "}
        <Link href="/hilfe" className="font-medium underline">
          {t("pricingForm.localTaxHelpLink")}
        </Link>
      </Hint>

      <Field label={t("pricingForm.localTaxTypeLabel")} required>
        <Select
          value={v.taxType ?? "Unknown"}
          onValueChange={(val) => setV({ ...v, taxType: val as LocalTaxType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOCAL_TAX_TYPES.map((art) => (
              <SelectItem key={art} value={art}>
                {t(`pricingForm.localTaxType.${art}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-extrabold">
          {t("pricingForm.amountSectionTitle")}
        </h3>
        <Segmented
          value={v.mode}
          onChange={(m) =>
            setV(
              m === "percent"
                ? { ...v, mode: "percent", chargeBasis: undefined, period: undefined }
                : {
                    ...v,
                    mode: "amount",
                    chargeBasis: v.chargeBasis ?? "SingleCharge",
                    period: v.period ?? "PerStay",
                    taxableBase: undefined,
                  },
            )
          }
          variant="solid"
          block
          options={[
            { value: "amount" as const, label: t("pricingForm.taxModeAmount") },
            { value: "percent" as const, label: t("pricingForm.taxModePercent") },
          ]}
        />

        {v.mode === "amount" ? (
          <>
            <Field label={t("pricingForm.amountLabel")} required>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={v.value}
                  placeholder="0"
                  onChange={(e) => setV({ ...v, value: Number(e.target.value) || 0 })}
                />
                {/* Währung kommt aus dem Objekt, ist hier keine Wahl. Ohne
                    gewählte Objektwährung bleibt die Fläche leer statt „€". */}
                <span className="min-w-8 text-sm text-muted-foreground">
                  {currencySymbol(waehrung)}
                </span>
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Select
                value={v.chargeBasis ?? "SingleCharge"}
                onValueChange={(val) =>
                  setV({ ...v, chargeBasis: val as TaxChargeBasis })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SingleCharge">
                    {t("pricingForm.chargeSingle")}
                  </SelectItem>
                  <SelectItem value="PerPerson">
                    {t("pricingForm.chargePerPerson")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={v.period ?? "PerStay"}
                onValueChange={(val) => setV({ ...v, period: val as TaxPeriod })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PerStay">{t("pricingForm.periodPerStay")}</SelectItem>
                  <SelectItem value="PerNight">
                    {t("pricingForm.periodPerNight")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <>
            <Field label={t("pricingForm.rateLabel")} required>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={v.value}
                  placeholder={t("pricingForm.percentOfBasePlaceholder")}
                  onChange={(e) => setV({ ...v, value: Number(e.target.value) || 0 })}
                  className="pr-8"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                  %
                </span>
              </div>
            </Field>
            <p className="text-sm text-muted-foreground">
              {t("pricingForm.percentTaxHint")}
            </p>
          </>
        )}
      </section>

      {v.mode === "percent" && (
        <section className="flex flex-col gap-3">
          <h3 className="font-display text-lg font-extrabold">
            {t("pricingForm.taxableBaseTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("pricingForm.taxableBaseHint")}
          </p>
          <MultiSelect
            options={grundlagenOptionen}
            selected={v.taxableBase ?? []}
            onChange={(next) => setV({ ...v, taxableBase: next })}
            placeholder={t("pricingForm.taxableBasePlaceholder")}
            searchPlaceholder={t("pricingForm.searchPlaceholder")}
            emptyHint={t("pricingForm.noMatches")}
            selectAllLabel={t("pricingForm.selectAll")}
            countLabel={(n, m) => t("pricingForm.selectedCount", { count: n, total: m })}
          />
          <Hint>{t("pricingForm.taxableBaseFeesHint")}</Hint>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-extrabold">
          {t("pricingForm.guestFacingNameTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("pricingForm.guestFacingNameHint")}
        </p>
        {/* 24 EU-Amtssprachen (i18n/locales.ts) — als Dropdown statt 24
            Schaltflächen. Gepflegte Sprachen bekommen ein Häkchen, damit man
            sieht, was schon übersetzt ist, ohne jede einzeln zu öffnen. */}
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-2">
                {LOCALE_LABELS[sprache]}
                <Icon icon="ph:caret-down" className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
              {LOCALES.map((l) => (
                <DropdownMenuItem key={l} onClick={() => setSprache(l)}>
                  {LOCALE_LABELS[l]}
                  {v.names?.[l]?.trim() && (
                    <Icon icon="ph:check" className="ml-auto size-4 text-muted-foreground" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-xs text-muted-foreground">
            {t("pricingForm.languagesFilled", {
              count: Object.values(v.names ?? {}).filter((x) => x?.trim()).length,
              total: LOCALES.length,
            })}
          </span>
        </div>
        <Field label={t("pricingForm.localTaxNameLabel")} required>
          <Input
            value={v.names?.[sprache] ?? (sprache === "de" ? v.name : "")}
            onChange={(e) => setzeName(e.target.value)}
          />
        </Field>
        <RichTextEditor
          value={v.descriptionHtml ?? ""}
          onChange={(html) => setV({ ...v, descriptionHtml: html })}
          placeholder={t("pricingForm.internalDescriptionPlaceholder")}
        />
      </section>

      <ZuAnderenObjekten
        propertyId={propertyId}
        kind="tax"
        selected={ziele}
        onChange={setZiele}
      />
    </EditorShell>
  );
}

