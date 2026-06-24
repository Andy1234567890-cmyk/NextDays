"use client";

// Preis-Seite eines Objekts (wie Lodgify „Pricing", Etappe 1).
//  Nightly price: Grundpreis (Währung, Dynamic, Wochentag), Mark-up je Kanal,
//  Extra-Gast-Aufschlag, Kurzaufenthalts-Aufschlag.
//  Length of stay: Wochen-/Monats-/eigene Längenpreise.
// Gespeichert per updateProperty() in type_attributes.pricing.
import { Icon } from "@iconify/react";
import { useState } from "react";

import { CHANNEL_LABELS, CHANNEL_LOGOS } from "@/lib/availability-meta";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
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
import { setBasePrice } from "@/lib/rates";

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

function ChannelBadge({ channel }: { channel: "airbnb" | "booking" | "google" }) {
  const logo = CHANNEL_LOGOS[channel];
  return logo.kind === "img" ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo.src} alt={CHANNEL_LABELS[channel]} className="size-3.5 rounded-sm" />
  ) : (
    <Icon icon={logo.icon} className="size-3.5" />
  );
}

export function PricingForm({ initial }: { initial: Property }) {
  const [p, setP] = useState<Property>(initial);
  const [section, setSection] = useState<Section>(null);
  const pr = readPricing(p.type_attributes);
  const cur = pr.currency;

  async function save(next: Pricing): Promise<true | string> {
    const res = await updateProperty(p.id, {
      type_attributes: { ...p.type_attributes, pricing: next },
    });
    if (!res.ok) return res.error;
    setP(res.data);
    setSection(null);
    // Basispreis zusätzlich als rate_plan persistieren — das ist die Channex-
    // Wahrheit und schließt die Kette (Sync, Verbinden, Kalender).
    if (next.basePrice > 0) {
      const rp = await setBasePrice(p.id, next.basePrice, next.currency);
      if (!rp.ok) return rp.error;
    }
    return true;
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-3xl font-extrabold">Preise</h1>

      {/* Nightly price */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-xl font-extrabold">Preis pro Nacht</h2>
          <p className="text-sm text-muted-foreground">
            Lege deinen Nachtpreis mit Grundpreis und Aufschlag fest.
          </p>
        </div>

        <BlockCard
          title="Grundpreis"
          hint="Grundpreis pro Nacht und Währung. Optional pro Wochentag anpassen."
          onEdit={() => setSection("base")}
        >
          <Pill>{fmtPrice(pr.basePrice, cur)}</Pill>
        </BlockCard>

        <BlockCard
          title="Aufschlag (Mark-up)"
          hint="Passe den an externe Kanäle gesendeten Grundpreis an."
          onEdit={() => setSection("markup")}
          localOnly
        >
          <span className="flex flex-wrap items-center gap-2">
            {MARKUP_CHANNELS.map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1.5 text-sm">
                <ChannelBadge channel={c} />
                {pr.markup[c] >= 0 ? "+" : ""}{pr.markup[c]}%
              </span>
            ))}
          </span>
        </BlockCard>

        <BlockCard
          title="Aufschlag pro Gast"
          hint="Aktiviere einen Nacht-Aufschlag für jeden weiteren Gast."
          actionLabel={pr.extraGuestCharge > 0 ? "Bearbeiten" : "Hinzufügen"}
          onEdit={() => setSection("extraGuest")}
        >
          {pr.extraGuestCharge > 0 ? (
            <Pill>{fmtPrice(pr.extraGuestCharge, cur)} ab Gast {pr.extraGuestFrom + 1}</Pill>
          ) : null}
        </BlockCard>

        <BlockCard
          title="Kurzaufenthalts-Aufschlag"
          hint="Erhöhe den Nachtpreis, wenn ein Gast nur kurz bleibt."
          actionLabel={pr.shortStayMaxNights > 0 ? "Bearbeiten" : "Hinzufügen"}
          onEdit={() => setSection("shortStay")}
          localOnly
        >
          {pr.shortStayMaxNights > 0 ? (
            <Pill>+{fmtPrice(pr.shortStaySurcharge, cur)} bis {pr.shortStayMaxNights} Nächte</Pill>
          ) : null}
        </BlockCard>
      </section>

      {/* Length of stay prices */}
      <section className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-xl font-extrabold">
              Längenabhängige Preise
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                nur Direktbuchungen
              </span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Reduziere Preise für längere Aufenthalte — ab einer Woche bis zu beliebiger Länge.
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Icon icon="ph:plus" className="size-4" />
                Hinzufügen
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSection({ length: "weekly" })}>
                <div className="flex flex-col">
                  <span className="font-medium">Wochenpreis</span>
                  <span className="text-xs text-muted-foreground">7 Nächte oder mehr</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSection({ length: "monthly" })}>
                <div className="flex flex-col">
                  <span className="font-medium">Monatspreis</span>
                  <span className="text-xs text-muted-foreground">30 Nächte oder mehr</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSection({ length: "custom" })}>
                <div className="flex flex-col">
                  <span className="font-medium">Eigener Längenpreis</span>
                  <span className="text-xs text-muted-foreground">Ab beliebiger Nächtezahl</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {pr.lengthPrices.length === 0 ? (
          <Card className="p-5 text-sm text-muted-foreground">
            Noch keine längenabhängigen Preise. Füge oben einen hinzu.
          </Card>
        ) : (
          pr.lengthPrices.map((lp) => (
            <Card key={lp.id} className="flex items-center justify-between gap-4 p-5">
              <div className="leading-tight">
                <p className="font-semibold">{STAY_KIND_LABELS[lp.kind]}</p>
                <p className="text-sm text-muted-foreground">{lp.minNights} Nächte oder mehr</p>
                <span className="mt-2 inline-flex w-fit items-center rounded-full bg-muted/60 px-3 py-1.5 text-sm">
                  {fmtPrice(lp.pricePerNight, cur)} / Nacht
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSection({ length: lp.kind, id: lp.id })}>
                  Bearbeiten
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Entfernen"
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
        title="Gebühren"
        hint="Lege Gebühren für zusätzliche Leistungen fest, die nicht im Grundpreis enthalten sind."
        onAdd={() => setSection({ fee: "new" })}
        empty="Noch keine Gebühren."
        items={pr.fees}
        render={(f) => (
          <ListRow
            key={f.id}
            title={f.name}
            pill={`${fmtPrice(f.amount, cur)} · ${FEE_BASIS_LABELS[f.basis]}${f.optional ? " · optional" : ""}`}
            onEdit={() => setSection({ fee: f.id })}
            onDelete={() => save({ ...pr, fees: pr.fees.filter((x) => x.id !== f.id) })}
          />
        )}
      />

      {/* Taxes */}
      <section className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-extrabold">Steuern</h2>
            <p className="text-sm text-muted-foreground">
              USt./Mehrwertsteuer auf Preise anwenden und weitere Steuern konfigurieren.
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Icon icon="ph:plus" className="size-4" /> Hinzufügen
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSection({ tax: "vat" })}>
                <div className="flex flex-col">
                  <span className="font-medium">USt. / Mehrwertsteuer</span>
                  <span className="text-xs text-muted-foreground">Im Preis enthalten oder nicht.</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSection({ tax: "local" })}>
                <div className="flex flex-col">
                  <span className="font-medium">Lokale Steuer</span>
                  <span className="text-xs text-muted-foreground">Weitere Steuern einrichten.</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {pr.taxes.length === 0 ? (
          <Card className="p-5 text-sm text-muted-foreground">Noch keine Steuern.</Card>
        ) : (
          pr.taxes.map((t) => (
            <ListRow
              key={t.id}
              title={t.name || TAX_KIND_LABELS[t.kind]}
              pill={`${t.mode === "percent" ? `${t.value}%` : fmtPrice(t.value, cur)}${t.includedInPrice ? " · im Preis" : ""}`}
              onEdit={() => setSection({ tax: t.kind, id: t.id })}
              onDelete={() => save({ ...pr, taxes: pr.taxes.filter((x) => x.id !== t.id) })}
            />
          ))
        )}
      </section>

      {/* Promotions */}
      <ListSection
        title="Aktionen"
        hint="Erstelle Sonderaktionen für bestimmte Zeiträume oder Rabatte für einzelne Gäste."
        localOnly
        onAdd={() => setSection({ promo: "new" })}
        empty="Noch keine Aktionen."
        items={pr.promotions}
        render={(p2) => (
          <ListRow
            key={p2.id}
            title={p2.name}
            pill={`${p2.percent}%${p2.conditions ? " · mit Bedingungen" : ""}`}
            onEdit={() => setSection({ promo: p2.id })}
            onDelete={() => save({ ...pr, promotions: pr.promotions.filter((x) => x.id !== p2.id) })}
          />
        )}
      />

      {/* Add-ons */}
      <ListSection
        title="Add-ons"
        hint="Biete Extras für die Reservierung an (z. B. Frühstück). Verfügbar bei NextDays-Direktbuchungen."
        localOnly
        onAdd={() => setSection({ addon: "new" })}
        empty="Noch keine Add-ons."
        items={pr.addOns}
        render={(a) => (
          <ListRow
            key={a.id}
            title={a.name}
            badge={a.active ? "Aktiviert" : undefined}
            pill={`${fmtPrice(a.amount, cur)} · ${FEE_BASIS_LABELS[a.basis]}`}
            onEdit={() => setSection({ addon: a.id })}
            onDelete={() => save({ ...pr, addOns: pr.addOns.filter((x) => x.id !== a.id) })}
          />
        )}
      />

      {/* Other information */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-extrabold">Weitere Informationen</h2>
        <BlockCard
          title="Steuer-Informationen"
          hint="Wird nur für mit Airbnb verbundene Inserate zur Steuererhebung/-meldung genutzt."
          onEdit={() => setSection("taxInfo")}
        >
          {(pr.businessTaxId || pr.totRegistrationId) && (
            <Pill>{[pr.businessTaxId, pr.totRegistrationId].filter(Boolean).join(" · ")}</Pill>
          )}
        </BlockCard>
        <BlockCard
          title="Bezeichnung für den Grundpreis (Website)"
          hint="Lege einen Namen fest, unter dem dein Grundpreis auf der Website erscheint."
          actionLabel={pr.basePriceLabel ? "Bearbeiten" : "Hinzufügen"}
          onEdit={() => setSection("baseLabel")}
        >
          {pr.basePriceLabel && <Pill>{pr.basePriceLabel}</Pill>}
        </BlockCard>
      </section>

      {/* Editoren */}
      {section === "base" && <BaseEditor pr={pr} onSave={save} onClose={() => setSection(null)} />}
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
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-extrabold">
            {title}
            {localOnly && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                nur Direktbuchungen
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onAdd}>
          <Icon icon="ph:plus" className="size-4" /> Hinzufügen
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
        <Button variant="outline" size="sm" onClick={onEdit}>Bearbeiten</Button>
        <Button variant="ghost" size="icon" aria-label="Entfernen" onClick={onDelete}>
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
  actionLabel = "Bearbeiten",
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
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="leading-tight">
          <p className="flex items-center gap-2 font-semibold">
            {title}
            {localOnly && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                nur Direktbuchungen
              </span>
            )}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          {actionLabel}
        </Button>
      </div>
      {children}
    </Card>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-muted/60 px-3 py-1.5 text-sm">
      {children}
    </span>
  );
}

// --- Editor-Hülle ----------------------------------------------------------

function EditorShell({
  title,
  subtitle,
  onClose,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle className="font-display text-xl font-extrabold">{title}</SheetTitle>
          <SheetDescription className={subtitle ? "" : "sr-only"}>{subtitle ?? title}</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">{children}</div>
        <div className="flex items-center justify-end gap-3 border-t p-4">{footer}</div>
      </SheetContent>
    </Sheet>
  );
}

function useSaver(onSave: (next: Pricing) => Promise<true | string>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(next: Pricing) {
    setBusy(true);
    setError(null);
    const r = await onSave(next);
    setBusy(false);
    if (r !== true) setError(r);
  }
  return { busy, error, run };
}

function Footer({
  busy,
  error,
  onCancel,
  onSave,
  disabled,
}: {
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex w-full items-center gap-3">
      {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
      <Button variant="ghost" onClick={onCancel} disabled={busy} className={error ? "" : "ml-auto"}>
        Abbrechen
      </Button>
      <Button onClick={onSave} disabled={busy || disabled}>
        {busy ? "Speichern…" : "Speichern"}
      </Button>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-(--radius) bg-blue-50 p-3 text-sm text-blue-900">
      <Icon icon="ph:info" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
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
  currency: Currency;
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
  const [v, setV] = useState(pr);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title="Grundpreis"
      subtitle="Lege Grundpreis und Währung pro Nacht fest. Optional pro Wochentag anpassen."
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      <Field label="Währung">
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
          Dynamische Preise (automatisch nach Saison, Wochenende, Auslastung,
          Markt …) richtest du zentral unter{" "}
          <a href="/dynamic-pricing" className="font-semibold text-accent underline">
            Dynamic Pricing
          </a>{" "}
          im Hauptmenü ein. Ein hier gesetzter Grundpreis bleibt die Basis; ein
          manueller Tagespreis im Kalender hat immer Vorrang.
        </span>
      </div>

      <Field label="Grundpreis pro Nacht">
        <MoneyInput value={v.basePrice} currency={v.currency} onChange={(n) => setV({ ...v, basePrice: n })} />
      </Field>

      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
        <span className="font-medium">Pro Wochentag anpassen</span>
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
  const [v, setV] = useState(pr);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title="Aufschlag für externe Kanäle"
      subtitle="Positiver % erhöht, negativer % senkt den Grundpreis für externe Kanäle."
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      {MARKUP_CHANNELS.map((c) => (
        <Field
          key={c}
          label={
            <span className="flex items-center gap-1.5">
              <ChannelBadge channel={c} />
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
      <Hint>Der Aufschlag gilt nicht für NextDays-Direktbuchungen.</Hint>
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
  const [v, setV] = useState(pr);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title="Aufschlag pro Gast"
      subtitle="Aktiviere einen nächtlichen Aufschlag für jeden weiteren Gast."
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      <Field label="Aufschlag pro Gast">
        <MoneyInput value={v.extraGuestCharge} currency={v.currency} onChange={(n) => setV({ ...v, extraGuestCharge: n })} />
      </Field>
      <Field label="Gilt für jeden Gast ab">
        <Select value={String(v.extraGuestFrom)} onValueChange={(val) => setV({ ...v, extraGuestFrom: Number(val) })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <SelectItem key={n} value={String(n)}>{n} Gast{n > 1 ? "äste" : ""}</SelectItem>
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
  const [v, setV] = useState(pr);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title="Kurzaufenthalts-Aufschlag"
      subtitle="Erhöhe den Nachtpreis, wenn ein Gast nur kurz bleibt."
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      <Field label="Ein Kurzaufenthalt hat höchstens">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            value={v.shortStayMaxNights}
            onChange={(e) => setV({ ...v, shortStayMaxNights: Number(e.target.value) || 0 })}
          />
          <span className="text-sm text-muted-foreground">Nächte</span>
        </div>
      </Field>
      <Field label="Aufschlag pro Nacht">
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
      subtitle="Reduziere den Nachtpreis für längere Aufenthalte."
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={commit} disabled={price <= 0} />}
    >
      <Field label="Gilt ab (Nächte)">
        <Input
          type="number"
          min={1}
          value={minNights}
          onChange={(e) => setMinNights(Number(e.target.value) || 1)}
          disabled={kind !== "custom"}
        />
      </Field>
      <Field label="Reduzierter Preis pro Nacht">
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
      title={ex ? "Gebühr bearbeiten" : "Gebühr hinzufügen"}
      subtitle="Zusätzliche Leistung, die nicht im Grundpreis enthalten ist."
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={commit} disabled={!v.name.trim()} />}
    >
      <Field label="Name">
        <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="z. B. Reinigungsgebühr" />
      </Field>
      <Field label="Betrag">
        <MoneyInput value={v.amount} currency={pr.currency} onChange={(n) => setV({ ...v, amount: n })} />
      </Field>
      <Field label="Berechnung">
        <BasisSelect value={v.basis} onChange={(b) => setV({ ...v, basis: b })} />
      </Field>
      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
        <span className="font-medium">Optional (Gast kann ab-/zuwählen)</span>
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
      title={kind === "vat" ? "USt. / Mehrwertsteuer" : "Lokale Steuer"}
      subtitle="Steuersatz oder -betrag festlegen."
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={commit} />}
    >
      <Field label="Bezeichnung">
        <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder={kind === "vat" ? "MwSt." : "Kurtaxe"} />
      </Field>
      <Field label="Art">
        <Select value={v.mode} onValueChange={(val) => setV({ ...v, mode: val as TaxMode })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="percent">Prozent (%)</SelectItem>
            <SelectItem value="amount">Fester Betrag</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label={v.mode === "percent" ? "Satz (%)" : "Betrag"}>
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
        <span className="font-medium">Im Preis enthalten</span>
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
      title={ex ? "Aktion bearbeiten" : "Aktion hinzufügen"}
      subtitle="Prozentualer Rabatt mit optionalen Bedingungen."
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={commit} disabled={!v.name.trim()} />}
    >
      <Field label="Name">
        <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="z. B. Frühbucher" />
      </Field>
      <Field label="Rabatt (%)">
        <div className="flex items-center gap-2">
          <Input type="number" min={0} max={100} value={v.percent} onChange={(e) => setV({ ...v, percent: Number(e.target.value) || 0 })} />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </Field>
      <Field label="Bedingungen (optional)">
        <Input value={v.conditions} onChange={(e) => setV({ ...v, conditions: e.target.value })} placeholder="z. B. nur Juni 2026, ab 7 Nächten" />
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
      title={ex ? "Add-on bearbeiten" : "Add-on hinzufügen"}
      subtitle="Extra für die Reservierung (z. B. Frühstück). Verfügbar bei Direktbuchungen."
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={commit} disabled={!v.name.trim()} />}
    >
      <Field label="Name">
        <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="z. B. Wäschepaket" />
      </Field>
      <Field label="Preis">
        <MoneyInput value={v.amount} currency={pr.currency} onChange={(n) => setV({ ...v, amount: n })} />
      </Field>
      <Field label="Berechnung">
        <BasisSelect value={v.basis} onChange={(b) => setV({ ...v, basis: b })} />
      </Field>
      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
        <span className="font-medium">Aktiviert</span>
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
  const [v, setV] = useState(pr);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title="Steuer-Informationen"
      subtitle="Wird nur für mit Airbnb verbundene Inserate genutzt."
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      <Field label="Business Tax ID">
        <Input value={v.businessTaxId} onChange={(e) => setV({ ...v, businessTaxId: e.target.value })} placeholder="z. B. Dgy678" />
      </Field>
      <Field label="TOT Registration ID">
        <Input value={v.totRegistrationId} onChange={(e) => setV({ ...v, totRegistrationId: e.target.value })} placeholder="z. B. Dgy678" />
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
  const [v, setV] = useState(pr);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title="Bezeichnung für den Grundpreis"
      subtitle="Name, unter dem dein Grundpreis auf der Website erscheint."
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      <Field label="Name">
        <Input
          value={v.basePriceLabel}
          maxLength={100}
          onChange={(e) => setV({ ...v, basePriceLabel: e.target.value })}
          placeholder="z. B. Standardpreis"
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
