"use client";

// Eigentümer-Detail (Agentur-Sicht): Stammdaten, Auszahlungs-/Provisions-
// Einstellungen und Objekt-Zuordnung (Anteil + Provisions-Override je Objekt).
// useState-Formular + Server-Actions (Muster wie objekte/location-form).
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { COUNTRIES, vatIdLabel } from "@/lib/countries";
import {
  assignOwnerProperty,
  deleteOwner,
  unassignOwnerProperty,
  updateOwner,
  type Owner,
  type OwnerInput,
} from "@/lib/owners";

type PropOption = { id: string; title: string };

export function OwnerDetail({
  initial,
  properties,
  embedded = false,
}: {
  initial: Owner;
  properties: PropOption[];
  embedded?: boolean;
}) {
  const t = useTranslations("owners");
  const router = useRouter();
  const [owner, setOwner] = useState<Owner>(initial);
  const [busy, setBusy] = useState(false);

  const titleById = new Map(properties.map((p) => [p.id, p.title]));
  const unassigned = properties.filter(
    (p) => !owner.properties.some((l) => l.property_id === p.id),
  );

  function set<K extends keyof Owner>(key: K, value: Owner[K]) {
    setOwner((o) => ({ ...o, [key]: value }));
  }

  async function save() {
    setBusy(true);
    const input: OwnerInput = {
      name: owner.name,
      company: owner.company,
      email: owner.email,
      phone: owner.phone,
      street: owner.street,
      house_number: owner.house_number,
      postal_code: owner.postal_code,
      city: owner.city,
      country: owner.country,
      tax_id: owner.tax_id,
      vat_id: owner.vat_id,
      iban: owner.iban,
      bic: owner.bic,
      bank_name: owner.bank_name,
      account_holder: owner.account_holder,
      default_commission_pct: owner.default_commission_pct,
      default_payout_method: owner.default_payout_method,
      statement_frequency: owner.statement_frequency,
      notes: owner.notes,
    };
    const res = await updateOwner(owner.id, input);
    setBusy(false);
    if (res.ok) {
      setOwner(res.data);
      toast.success(t("saved"));
    } else toast.error(res.error);
  }

  async function remove() {
    if (!window.confirm(t("deleteConfirm"))) return;
    const res = await deleteOwner(owner.id);
    if (res.ok) {
      toast.success(t("deleted"));
      router.push("/eigentuemer");
    } else toast.error(res.error);
  }

  async function assign(propertyId: string) {
    const res = await assignOwnerProperty(owner.id, { property_id: propertyId });
    if (res.ok) setOwner(res.data);
    else toast.error(res.error);
  }

  async function updateLink(
    propertyId: string,
    share: number,
    commission: number | null,
  ) {
    const res = await assignOwnerProperty(owner.id, {
      property_id: propertyId,
      ownership_share: share,
      commission_override_pct: commission,
    });
    if (res.ok) setOwner(res.data);
    else toast.error(res.error);
  }

  async function unassign(propertyId: string) {
    const res = await unassignOwnerProperty(owner.id, propertyId);
    if (res.ok) setOwner(res.data);
    else toast.error(res.error);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        {embedded ? (
          <span />
        ) : (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => router.push("/eigentuemer")}
              className="w-fit text-sm text-muted-foreground hover:text-foreground"
            >
              ← {t("title")}
            </button>
            <h1 className="font-display text-3xl font-extrabold">{owner.name}</h1>
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void remove()}>
            <Icon icon="ph:trash" className="size-4" />
            {t("delete")}
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? t("saving") : t("save")}
          </Button>
        </div>
      </div>

      {/* Stammdaten */}
      <Card className="flex flex-col gap-4 p-6">
        <h2 className="font-display text-lg font-extrabold">{t("sections.master")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("fields.name")}>
            <Input value={owner.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label={t("fields.company")}>
            <Input
              value={owner.company ?? ""}
              onChange={(e) => set("company", e.target.value || null)}
            />
          </Field>
          <Field label={t("fields.email")}>
            <Input
              type="email"
              value={owner.email ?? ""}
              onChange={(e) => set("email", e.target.value || null)}
            />
          </Field>
          <Field label={t("fields.phone")}>
            <Input
              value={owner.phone ?? ""}
              onChange={(e) => set("phone", e.target.value || null)}
            />
          </Field>
          <Field label={t("fields.street")}>
            <Input
              value={owner.street ?? ""}
              onChange={(e) => set("street", e.target.value || null)}
            />
          </Field>
          <Field label={t("fields.houseNumber")}>
            <Input
              value={owner.house_number ?? ""}
              onChange={(e) => set("house_number", e.target.value || null)}
            />
          </Field>
          <Field label={t("fields.postalCode")}>
            <Input
              value={owner.postal_code ?? ""}
              onChange={(e) => set("postal_code", e.target.value || null)}
            />
          </Field>
          <Field label={t("fields.city")}>
            <Input
              value={owner.city ?? ""}
              onChange={(e) => set("city", e.target.value || null)}
            />
          </Field>
          <Field label={t("fields.country")}>
            <NativeSelect
              value={owner.country ?? ""}
              onChange={(e) => set("country", e.target.value || null)}
            >
              <option value="">—</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t("fields.taxId")}>
            <Input
              value={owner.tax_id ?? ""}
              onChange={(e) => set("tax_id", e.target.value || null)}
            />
          </Field>
          <Field label={vatIdLabel(owner.country)}>
            <Input
              value={owner.vat_id ?? ""}
              onChange={(e) => set("vat_id", e.target.value || null)}
            />
          </Field>
        </div>
      </Card>

      {/* Auszahlung / Provision */}
      <Card className="flex flex-col gap-4 p-6">
        <h2 className="font-display text-lg font-extrabold">{t("sections.payout")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("fields.accountHolder")}>
            <Input
              value={owner.account_holder ?? ""}
              onChange={(e) => set("account_holder", e.target.value || null)}
            />
          </Field>
          <Field label={t("fields.iban")}>
            <Input
              value={owner.iban ?? ""}
              onChange={(e) => set("iban", e.target.value || null)}
            />
          </Field>
          <Field label={t("fields.bic")}>
            <Input
              value={owner.bic ?? ""}
              onChange={(e) => set("bic", e.target.value || null)}
            />
          </Field>
          <Field label={t("fields.bankName")}>
            <Input
              value={owner.bank_name ?? ""}
              onChange={(e) => set("bank_name", e.target.value || null)}
            />
          </Field>
          <Field label={t("fields.commission")}>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={owner.default_commission_pct}
              onChange={(e) =>
                set("default_commission_pct", Number(e.target.value))
              }
            />
          </Field>
          <Field label={t("fields.payoutMethod")}>
            <Input
              value={owner.default_payout_method ?? ""}
              onChange={(e) => set("default_payout_method", e.target.value || null)}
            />
          </Field>
          <Field label={t("fields.statementFrequency")}>
            <NativeSelect
              value={owner.statement_frequency}
              onChange={(e) =>
                set(
                  "statement_frequency",
                  e.target.value as Owner["statement_frequency"],
                )
              }
            >
              <option value="none">{t("frequency.none")}</option>
              <option value="monthly">{t("frequency.monthly")}</option>
            </NativeSelect>
          </Field>
        </div>
        <Field label={t("fields.notes")}>
          <Textarea
            value={owner.notes ?? ""}
            onChange={(e) => set("notes", e.target.value || null)}
          />
        </Field>
      </Card>

      {/* Objekt-Zuordnung */}
      <Card className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-extrabold">
            {t("sections.properties")}
          </h2>
          {unassigned.length > 0 && (
            <NativeSelect
              value=""
              onChange={(e) => {
                if (e.target.value) void assign(e.target.value);
              }}
              className="w-auto"
            >
              <option value="">{t("addProperty")}</option>
              {unassigned.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </NativeSelect>
          )}
        </div>

        {owner.properties.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noProperties")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {owner.properties.map((link) => (
              <div
                key={link.property_id}
                className="flex flex-wrap items-end gap-4 rounded-(--radius) border border-border p-4"
              >
                <div className="min-w-40 flex-1">
                  <p className="font-medium">
                    {titleById.get(link.property_id) ?? link.property_id}
                  </p>
                </div>
                <Field label={t("fields.share")} className="w-28">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    defaultValue={link.ownership_share}
                    onBlur={(e) =>
                      void updateLink(
                        link.property_id,
                        Number(e.target.value),
                        link.commission_override_pct,
                      )
                    }
                  />
                </Field>
                <Field label={t("fields.commissionOverride")} className="w-36">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    placeholder={`${owner.default_commission_pct}`}
                    defaultValue={link.commission_override_pct ?? ""}
                    onBlur={(e) =>
                      void updateLink(
                        link.property_id,
                        link.ownership_share,
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                  />
                </Field>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void unassign(link.property_id)}
                  aria-label={t("removeProperty")}
                >
                  <Icon icon="ph:x" className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
