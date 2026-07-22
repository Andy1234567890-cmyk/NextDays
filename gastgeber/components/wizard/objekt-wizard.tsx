"use client";

// Objekt-Wizard (Airbnb-„Become a Host"-Flow). Vollbild, ein Schritt pro Screen,
// Draft wird beim ersten Weiter angelegt (POST) und danach je Schritt gepatcht.
import { currencyForCountry, LAENDER } from "@nextdays/laender";
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";

import {
  createProperty,
  updateProperty,
} from "@/lib/properties-actions";
import { WizardShell } from "./wizard-shell";
import { ChoiceCard, GridTile, StepperRow } from "./wizard-primitives";

// Wizard-State (alle Schritt-Daten in einem Objekt).
interface WizardData {
  property_type: string;
  privacy_type: string;
  country: string;
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  max_guests: number;
  bedrooms: number;
  beds: number;
  bathrooms_private: number;
  bathrooms_shared: number;
  occupancy: string[];
  amenities: string[];
  photos: string[];
  title: string;
  description: string;
  booking_mode: "instant" | "request";
  base_price: number;
  weekly_discount: boolean;
  monthly_discount: boolean;
}

const TYPES = [
  { key: "ferienhaus", icon: "solar:home-2-bold-duotone" },
  { key: "appartement", icon: "solar:buildings-2-bold-duotone" },
  { key: "glamping", icon: "solar:tent-bold-duotone" },
  { key: "tiny_house", icon: "solar:home-smile-bold-duotone" },
  { key: "hausboot", icon: "solar:ship-bold-duotone" },
  { key: "einzelzimmer", icon: "solar:bed-bold-duotone" },
  { key: "doppelzimmer", icon: "solar:bed-bold-duotone" },
  { key: "suite", icon: "solar:crown-bold-duotone" },
] as const;

const AMENITIES = [
  { key: "wifi", icon: "solar:wi-fi-router-bold-duotone", label: "WLAN" },
  { key: "kitchen", icon: "solar:chef-hat-bold-duotone", label: "Küche" },
  { key: "parking", icon: "solar:parking-square-bold-duotone", label: "Parkplatz" },
  { key: "washer", icon: "solar:washing-machine-bold-duotone", label: "Waschmaschine" },
  { key: "tv", icon: "solar:tv-bold-duotone", label: "TV" },
  { key: "heating", icon: "solar:temperature-bold-duotone", label: "Heizung" },
  { key: "ac", icon: "solar:snowflake-bold-duotone", label: "Klimaanlage" },
  { key: "pool", icon: "solar:waterdrops-bold-duotone", label: "Pool" },
] as const;

const OCCUPANCY = [
  { key: "me", icon: "solar:user-bold-duotone" },
  { key: "familie", icon: "solar:users-group-rounded-bold-duotone" },
  { key: "andere", icon: "solar:users-group-two-rounded-bold-duotone" },
  { key: "mitbewohner", icon: "solar:user-hands-bold-duotone" },
] as const;

const TOTAL = 15;

export function ObjektWizard() {
  const t = useTranslations("wizard");
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [d, setD] = useState<WizardData>({
    property_type: "",
    privacy_type: "",
    country: "DE",
    street: "",
    house_number: "",
    postal_code: "",
    city: "",
    max_guests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms_private: 1,
    bathrooms_shared: 0,
    occupancy: [],
    amenities: [],
    photos: [],
    title: "",
    description: "",
    booking_mode: "request",
    base_price: 0,
    weekly_discount: false,
    monthly_discount: false,
  });

  const set = <K extends keyof WizardData>(k: K, v: WizardData[K]) =>
    setD((p) => ({ ...p, [k]: v }));

  const currency = currencyForCountry(d.country);

  // Ob der aktuelle Schritt „Weiter" erlaubt (Pflichtfelder).
  function canNext(): boolean {
    switch (step) {
      case 1:
        return !!d.property_type;
      case 2:
        return !!d.privacy_type;
      case 3:
        return !!d.country;
      case 10:
        return d.title.trim().length > 0;
      case 13:
        return d.base_price > 0;
      default:
        return true;
    }
  }

  // Persistiert den aktuellen Stand (create beim ersten Mal, sonst patch).
  async function persist(): Promise<boolean> {
    const type_attributes = {
      privacy_type: d.privacy_type,
      bedrooms: d.bedrooms,
      beds: d.beds,
      bathrooms_private: d.bathrooms_private,
      bathrooms_shared: d.bathrooms_shared,
      occupancy: d.occupancy,
    };
    const fields: Record<string, unknown> = {
      title: d.title || t("titel_step.titel"),
      property_type: d.property_type || "ferienhaus",
      max_guests: d.max_guests,
      currency,
      country: d.country,
      city: d.city || undefined,
      street: d.street || undefined,
      house_number: d.house_number || undefined,
      postal_code: d.postal_code || undefined,
      platform_description: d.description || undefined,
      amenities: d.amenities,
      photos: d.photos,
      booking_mode: d.booking_mode,
      type_attributes,
    };

    if (!propertyId) {
      const res = await createProperty({
        title: fields.title as string,
        property_type: fields.property_type as string,
        max_guests: d.max_guests,
        currency,
        country: d.country,
        city: d.city || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return false;
      }
      setPropertyId(res.data.id);
      // Restliche Felder direkt nachpatchen.
      await updateProperty(res.data.id, fields);
      return true;
    }
    const res = await updateProperty(propertyId, fields);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    return true;
  }

  async function next() {
    // Ab Schritt 1 (Typ gewählt) speichern wir bei jedem Weiter.
    if (step >= 1) {
      setSaving(true);
      const ok = await persist();
      setSaving(false);
      if (!ok) return;
    }
    if (step >= TOTAL) {
      // Fertig → zur Objekt-Detailseite.
      if (propertyId) router.push(`/objekte/${propertyId}`);
      else router.push("/objekte");
      return;
    }
    setStep((s) => s + 1);
  }

  function back() {
    if (step <= 1) {
      router.push("/objekte");
      return;
    }
    setStep((s) => s - 1);
  }

  function toggle(list: string[], key: string): string[] {
    return list.includes(key) ? list.filter((x) => x !== key) : [...list, key];
  }

  return (
    <WizardShell
      step={step}
      total={TOTAL}
      canNext={canNext()}
      onBack={back}
      onNext={next}
      saving={saving}
      nextLabel={step === TOTAL ? t("abschluss.zumObjekt") : undefined}
    >
      {/* 1 — Objekttyp */}
      {step === 1 && (
        <Step title={t("typ.titel")}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TYPES.map((ty) => (
              <GridTile
                key={ty.key}
                label={t(`typ.${ty.key}`)}
                icon={ty.icon}
                selected={d.property_type === ty.key}
                onClick={() => set("property_type", ty.key)}
              />
            ))}
          </div>
        </Step>
      )}

      {/* 2 — Privacy */}
      {step === 2 && (
        <Step title={t("privacy.titel")}>
          <div className="space-y-3">
            {(["entire", "room", "shared"] as const).map((p) => (
              <ChoiceCard
                key={p}
                title={t(`privacy.${p}`)}
                description={t(`privacy.${p}Hint`)}
                icon="solar:home-bold-duotone"
                selected={d.privacy_type === p}
                onClick={() => set("privacy_type", p)}
              />
            ))}
          </div>
        </Step>
      )}

      {/* 3 — Adresse */}
      {step === 3 && (
        <Step title={t("adresse.titel")} subtitle={t("adresse.untertitel")}>
          <div className="space-y-4">
            <Field label={t("adresse.land")}>
              <NativeSelect
                value={d.country}
                onChange={(e) => set("country", e.target.value)}
              >
                {LAENDER.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <Field label={t("adresse.strasse")}>
                <Input value={d.street} onChange={(e) => set("street", e.target.value)} />
              </Field>
              <Field label={t("adresse.hausnummer")}>
                <Input
                  value={d.house_number}
                  onChange={(e) => set("house_number", e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-[8rem_1fr] gap-3">
              <Field label={t("adresse.plz")}>
                <Input
                  value={d.postal_code}
                  onChange={(e) => set("postal_code", e.target.value)}
                />
              </Field>
              <Field label={t("adresse.stadt")}>
                <Input value={d.city} onChange={(e) => set("city", e.target.value)} />
              </Field>
            </div>
          </div>
        </Step>
      )}

      {/* 4 — Karten-Pin (Platzhalter: Adresse ist gespeichert) */}
      {step === 4 && (
        <Step title={t("pin.titel")} subtitle={t("pin.untertitel")}>
          <div className="flex aspect-video items-center justify-center rounded-2xl border border-border bg-muted text-center text-sm text-muted-foreground">
            <div>
              <Icon
                icon="solar:map-point-bold-duotone"
                className="mx-auto mb-2 size-10"
              />
              {[d.street, d.house_number].filter(Boolean).join(" ")},{" "}
              {d.postal_code} {d.city}
              <p className="mt-2 text-xs">{t("pin.hinweis")}</p>
            </div>
          </div>
        </Step>
      )}

      {/* 5 — Kapazität */}
      {step === 5 && (
        <Step title={t("kapazitaet.titel")}>
          <p className="mb-2 font-medium">{t("kapazitaet.frage")}</p>
          <StepperRow
            label={t("kapazitaet.gaeste")}
            value={d.max_guests}
            onChange={(v) => set("max_guests", v)}
            min={1}
            max={50}
          />
          <StepperRow
            label={t("kapazitaet.schlafzimmer")}
            value={d.bedrooms}
            onChange={(v) => set("bedrooms", v)}
            min={0}
          />
          <StepperRow
            label={t("kapazitaet.betten")}
            value={d.beds}
            onChange={(v) => set("beds", v)}
            min={1}
          />
        </Step>
      )}

      {/* 6 — Bäder */}
      {step === 6 && (
        <Step title={t("baeder.titel")}>
          <StepperRow
            label={t("baeder.privat")}
            hint={t("baeder.privatHint")}
            value={d.bathrooms_private}
            onChange={(v) => set("bathrooms_private", v)}
          />
          <StepperRow
            label={t("baeder.gemeinsam")}
            hint={t("baeder.gemeinsamHint")}
            value={d.bathrooms_shared}
            onChange={(v) => set("bathrooms_shared", v)}
          />
        </Step>
      )}

      {/* 7 — Belegung */}
      {step === 7 && (
        <Step title={t("belegung.titel")} subtitle={t("belegung.untertitel")}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {OCCUPANCY.map((o) => (
              <GridTile
                key={o.key}
                label={t(`belegung.${o.key}`)}
                icon={o.icon}
                selected={d.occupancy.includes(o.key)}
                onClick={() => set("occupancy", toggle(d.occupancy, o.key))}
              />
            ))}
          </div>
        </Step>
      )}

      {/* 8 — Ausstattung */}
      {step === 8 && (
        <Step title={t("ausstattung.titel")} subtitle={t("ausstattung.untertitel")}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {AMENITIES.map((a) => (
              <GridTile
                key={a.key}
                label={a.label}
                icon={a.icon}
                selected={d.amenities.includes(a.key)}
                onClick={() => set("amenities", toggle(d.amenities, a.key))}
              />
            ))}
          </div>
        </Step>
      )}

      {/* 9 — Fotos (Platzhalter: URL-Eingabe; echter Upload folgt) */}
      {step === 9 && (
        <Step title={t("fotos.titel")} subtitle={t("fotos.untertitel")}>
          <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
            <Icon
              icon="solar:gallery-add-bold-duotone"
              className="mx-auto mb-3 size-12 text-muted-foreground"
            />
            <p className="text-sm text-muted-foreground">
              {t("fotos.anzahl", { n: d.photos.length, min: 5 })}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Foto-Upload wird angebunden — dieser Schritt ist überspringbar.
            </p>
          </div>
        </Step>
      )}

      {/* 10 — Titel */}
      {step === 10 && (
        <Step title={t("titel_step.titel")} subtitle={t("titel_step.untertitel")}>
          <Textarea
            value={d.title}
            maxLength={50}
            onChange={(e) => set("title", e.target.value)}
            className="min-h-32"
          />
          <p className="mt-2 text-sm text-muted-foreground tabular-nums">
            {d.title.length}/50
          </p>
        </Step>
      )}

      {/* 11 — Beschreibung */}
      {step === 11 && (
        <Step title={t("beschreibung.titel")} subtitle={t("beschreibung.untertitel")}>
          <Textarea
            value={d.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder={t("beschreibung.platzhalter")}
            className="min-h-40"
          />
        </Step>
      )}

      {/* 12 — Buchungsmodus */}
      {step === 12 && (
        <Step title={t("buchungsmodus.titel")}>
          <div className="space-y-3">
            <ChoiceCard
              title={t("buchungsmodus.request")}
              description={t("buchungsmodus.requestHint")}
              icon="solar:calendar-mark-bold-duotone"
              selected={d.booking_mode === "request"}
              onClick={() => set("booking_mode", "request")}
            />
            <ChoiceCard
              title={t("buchungsmodus.instant")}
              description={t("buchungsmodus.instantHint")}
              icon="solar:bolt-bold-duotone"
              selected={d.booking_mode === "instant"}
              onClick={() => set("booking_mode", "instant")}
            />
          </div>
        </Step>
      )}

      {/* 13 — Preis */}
      {step === 13 && (
        <Step title={t("preis.titel")} subtitle={t("preis.untertitel")}>
          <Field label={`${t("preis.basispreis")} (${currency || "—"})`}>
            <Input
              type="number"
              min={1}
              value={d.base_price || ""}
              onChange={(e) => set("base_price", Number(e.target.value))}
              className="text-2xl"
            />
          </Field>
        </Step>
      )}

      {/* 14 — Rabatte */}
      {step === 14 && (
        <Step title={t("rabatte.titel")} subtitle={t("rabatte.untertitel")}>
          <div className="space-y-3">
            <DiscountRow
              label={t("rabatte.wochen")}
              hint={t("rabatte.wochenHint")}
              percent={7}
              checked={d.weekly_discount}
              onToggle={() => set("weekly_discount", !d.weekly_discount)}
            />
            <DiscountRow
              label={t("rabatte.monat")}
              hint={t("rabatte.monatHint")}
              percent={15}
              checked={d.monthly_discount}
              onToggle={() => set("monthly_discount", !d.monthly_discount)}
            />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{t("rabatte.hinweis")}</p>
        </Step>
      )}

      {/* 15 — Abschluss */}
      {step === 15 && (
        <Step title={t("abschluss.titel")} subtitle={t("abschluss.untertitel")}>
          <div className="flex items-center justify-center py-10">
            <Icon
              icon="solar:check-circle-bold-duotone"
              className="size-20 text-emerald-500"
            />
          </div>
        </Step>
      )}
    </WizardShell>
  );
}

function Step({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-balance font-display text-3xl font-semibold leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function DiscountRow({
  label,
  hint,
  percent,
  checked,
  onToggle,
}: {
  label: string;
  hint: string;
  percent: number;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition-colors ${
        checked ? "border-foreground bg-muted/40" : "border-border"
      }`}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border font-semibold tabular-nums">
        {percent}%
      </span>
      <span className="flex-1">
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-muted-foreground">{hint}</span>
      </span>
      <span
        className={`flex size-6 items-center justify-center rounded-md border ${
          checked ? "border-foreground bg-foreground text-background" : "border-border"
        }`}
      >
        {checked && <Icon icon="solar:check-read-linear" className="size-4" />}
      </span>
    </button>
  );
}
